-- =====================================================================
-- IMPULSIONAMENTO (tráfego pago) — só contas de político compram.
-- O político paga e o conteúdo dele aparece para mais gente, marcado como "Impulsionado".
-- Tudo que decide quem vê, quanto já foi entregue e quanto custa fica AQUI no banco
-- (ninguém consegue burlar pelo celular).
-- =====================================================================

-- ---------- configurações (o admin muda pelo app) ----------
create table if not exists public.boost_settings (
  id int primary key default 1 check (id = 1),
  price_per_thousand numeric(10,2) not null default 10,   -- R$ por mil pessoas alcançadas
  targeting_multiplier numeric(4,2) not null default 1.5, -- público personalizado custa mais
  min_amount numeric(10,2) not null default 10,
  max_amount numeric(10,2) not null default 1000,
  feed_every int not null default 7,                      -- 1 impulsionado a cada N posts no feed
  reels_every int not null default 5,                     -- 1 a cada N vídeos em tela cheia
  auto_approve boolean not null default true,             -- vai ao ar sozinho depois de pago
  updated_at timestamptz not null default now()
);
insert into public.boost_settings (id) values (1) on conflict do nothing;
alter table public.boost_settings enable row level security;
drop policy if exists "ver config impulsionamento" on public.boost_settings;
create policy "ver config impulsionamento" on public.boost_settings for select to authenticated using (true);
drop policy if exists "admin muda config impulsionamento" on public.boost_settings;
create policy "admin muda config impulsionamento" on public.boost_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- campanhas ----------
create table if not exists public.boost_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_kind text not null check (target_kind in ('post', 'profile', 'battle')),
  target_id text not null,
  amount numeric(10,2) not null check (amount > 0),
  reach_goal int not null check (reach_goal > 0),
  delivered int not null default 0,
  clicks int not null default 0,
  follows int not null default 0,
  days int not null default 7 check (days between 1 and 60),
  filters jsonb not null default '{}'::jsonb,   -- {states:[], cities:[], genders:[], ages:[], interests:[]}
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'pending_review', 'active', 'paused', 'completed', 'rejected', 'canceled')),
  starts_at timestamptz,
  ends_at timestamptz,
  paid_at timestamptz,
  paid_with text check (paid_with in ('pix', 'credito', 'manual')),
  payment_id text,
  pix_qr_base64 text,
  pix_copy_paste text,
  refunded_credit numeric(10,2) not null default 0,
  reject_reason text,
  created_at timestamptz not null default now()
);
create index if not exists boost_campaigns_user on public.boost_campaigns (user_id, created_at desc);
create index if not exists boost_campaigns_active on public.boost_campaigns (status, ends_at);
alter table public.boost_campaigns enable row level security;
drop policy if exists "dono vê suas campanhas" on public.boost_campaigns;
create policy "dono vê suas campanhas" on public.boost_campaigns for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- criar, pagar, pausar etc. só pelas funções abaixo (não há insert/update direto)

-- quem já viu cada campanha (cada pessoa conta 1 vez por campanha)
create table if not exists public.boost_impressions (
  campaign_id uuid not null references public.boost_campaigns(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, viewer_id)
);
alter table public.boost_impressions enable row level security;
drop policy if exists "dono vê alcance" on public.boost_impressions;
create policy "dono vê alcance" on public.boost_impressions for select to authenticated using (
  exists (select 1 from public.boost_campaigns c where c.id = campaign_id and (c.user_id = auth.uid() or public.is_admin()))
);

-- cliques e seguidores vindos da campanha
create table if not exists public.boost_events (
  id bigserial primary key,
  campaign_id uuid not null references public.boost_campaigns(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('click', 'follow')),
  created_at timestamptz not null default now(),
  unique (campaign_id, viewer_id, kind)
);
alter table public.boost_events enable row level security;
drop policy if exists "dono vê eventos" on public.boost_events;
create policy "dono vê eventos" on public.boost_events for select to authenticated using (
  exists (select 1 from public.boost_campaigns c where c.id = campaign_id and (c.user_id = auth.uid() or public.is_admin()))
);

-- carteira de créditos (sobra de campanha que não entregou tudo volta aqui)
create table if not exists public.boost_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(10,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.boost_wallets enable row level security;
drop policy if exists "dono vê carteira" on public.boost_wallets;
create policy "dono vê carteira" on public.boost_wallets for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------- funções ----------

-- alcance que o valor compra
create or replace function public.boost_estimate(p_amount numeric, p_targeted boolean) returns int
language sql stable security definer set search_path = public as $$
  select greatest(1, floor(p_amount / s.price_per_thousand * 1000 / case when p_targeted then s.targeting_multiplier else 1 end))::int
  from boost_settings s where s.id = 1;
$$;

-- o filtro de público tem alguma coisa escolhida?
create or replace function public.boost_is_targeted(f jsonb) returns boolean language sql immutable as $$
  select coalesce(jsonb_array_length(f->'states'), 0) + coalesce(jsonb_array_length(f->'cities'), 0)
       + coalesce(jsonb_array_length(f->'genders'), 0) + coalesce(jsonb_array_length(f->'ages'), 0)
       + coalesce(jsonb_array_length(f->'interests'), 0) > 0;
$$;

-- cria a campanha (só político). Fica aguardando pagamento.
create or replace function public.create_boost(p_kind text, p_target text, p_amount numeric, p_days int, p_filters jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare s boost_settings%rowtype; v_id uuid; v_owner uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and account_type = 'politico') then
    raise exception 'Só contas de político podem impulsionar';
  end if;
  select * into s from boost_settings where id = 1;
  if p_amount < s.min_amount then raise exception 'O valor mínimo é R$ %', s.min_amount; end if;
  if p_amount > s.max_amount then raise exception 'O valor máximo é R$ %', s.max_amount; end if;
  if p_days < 1 or p_days > 60 then raise exception 'Duração entre 1 e 60 dias'; end if;
  -- o conteúdo precisa ser do próprio político
  if p_kind = 'post' then
    select user_id into v_owner from posts where id::text = p_target;
  elsif p_kind = 'profile' then
    v_owner := p_target::uuid;
  elsif p_kind = 'battle' then
    select host_id into v_owner from battles where id::text = p_target;
  else
    raise exception 'Tipo inválido';
  end if;
  if v_owner is distinct from auth.uid() then raise exception 'Você só pode impulsionar o que é seu'; end if;

  insert into boost_campaigns (user_id, target_kind, target_id, amount, reach_goal, days, filters)
  values (auth.uid(), p_kind, p_target, round(p_amount, 2), boost_estimate(p_amount, boost_is_targeted(coalesce(p_filters, '{}'))), p_days, coalesce(p_filters, '{}'))
  returning id into v_id;
  return v_id;
end $$;

-- marca como paga e coloca no ar (ou na fila de aprovação). Usada pelo pagamento e pelo admin.
create or replace function public.boost_mark_paid(p_campaign uuid, p_method text, p_payment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s boost_settings%rowtype; c boost_campaigns%rowtype;
begin
  select * into s from boost_settings where id = 1;
  select * into c from boost_campaigns where id = p_campaign for update;
  if not found or c.status <> 'pending_payment' then return; end if;
  update boost_campaigns set
    paid_at = now(), paid_with = p_method, payment_id = coalesce(p_payment, payment_id),
    status = case when s.auto_approve then 'active' else 'pending_review' end,
    starts_at = case when s.auto_approve then now() else null end,
    ends_at = case when s.auto_approve then now() + make_interval(days => c.days) else null end
  where id = p_campaign;
end $$;
revoke execute on function public.boost_mark_paid(uuid, text, text) from public, anon, authenticated;

-- pagar com os créditos da carteira
create or replace function public.pay_boost_with_credit(p_campaign uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c boost_campaigns%rowtype;
begin
  select * into c from boost_campaigns where id = p_campaign and user_id = auth.uid() for update;
  if not found then raise exception 'Campanha não encontrada'; end if;
  if c.status <> 'pending_payment' then raise exception 'Essa campanha já foi paga'; end if;
  update boost_wallets set balance = balance - c.amount, updated_at = now()
   where user_id = auth.uid() and balance >= c.amount;
  if not found then raise exception 'Créditos insuficientes'; end if;
  perform boost_mark_paid(p_campaign, 'credito');
end $$;

-- encerra campanhas vencidas e devolve a sobra como crédito
create or replace function public.finish_expired_boosts() returns void
language plpgsql security definer set search_path = public as $$
declare c record; v_credit numeric;
begin
  for c in select * from boost_campaigns where status in ('active', 'paused') and ends_at is not null and ends_at < now() for update skip locked loop
    v_credit := round(c.amount * greatest(0, c.reach_goal - c.delivered)::numeric / c.reach_goal, 2);
    update boost_campaigns set status = 'completed', refunded_credit = v_credit where id = c.id;
    if v_credit > 0 then
      insert into boost_wallets (user_id, balance) values (c.user_id, v_credit)
      on conflict (user_id) do update set balance = boost_wallets.balance + excluded.balance, updated_at = now();
    end if;
  end loop;
end $$;

-- dono: pausar / retomar / cancelar (cancelar antes de pagar)
-- admin: aprovar / recusar / confirmar pagamento manual
create or replace function public.set_boost_status(p_campaign uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c boost_campaigns%rowtype; v_credit numeric;
begin
  select * into c from boost_campaigns where id = p_campaign for update;
  if not found then raise exception 'Campanha não encontrada'; end if;
  if p_action in ('approve', 'reject', 'mark_paid') then
    if not public.is_admin() then raise exception 'Acesso negado'; end if;
    if p_action = 'mark_paid' then perform boost_mark_paid(p_campaign, 'manual'); return; end if;
    if c.status <> 'pending_review' then raise exception 'A campanha não está aguardando aprovação'; end if;
    if p_action = 'approve' then
      update boost_campaigns set status = 'active', starts_at = now(), ends_at = now() + make_interval(days => c.days) where id = p_campaign;
    else
      -- recusada: o valor pago volta inteiro como crédito
      update boost_campaigns set status = 'rejected', reject_reason = p_reason, refunded_credit = c.amount where id = p_campaign;
      insert into boost_wallets (user_id, balance) values (c.user_id, c.amount)
      on conflict (user_id) do update set balance = boost_wallets.balance + excluded.balance, updated_at = now();
    end if;
    return;
  end if;

  if c.user_id <> auth.uid() and not public.is_admin() then raise exception 'Acesso negado'; end if;
  if p_action = 'pause' and c.status = 'active' then
    update boost_campaigns set status = 'paused' where id = p_campaign;
  elsif p_action = 'resume' and c.status = 'paused' then
    update boost_campaigns set status = 'active' where id = p_campaign;
  elsif p_action = 'cancel' and c.status = 'pending_payment' then
    update boost_campaigns set status = 'canceled' where id = p_campaign;
  elsif p_action = 'stop' and c.status in ('active', 'paused') then
    -- parar antes do fim: a sobra volta como crédito
    v_credit := round(c.amount * greatest(0, c.reach_goal - c.delivered)::numeric / c.reach_goal, 2);
    update boost_campaigns set status = 'completed', ends_at = now(), refunded_credit = v_credit where id = p_campaign;
    if v_credit > 0 then
      insert into boost_wallets (user_id, balance) values (c.user_id, v_credit)
      on conflict (user_id) do update set balance = boost_wallets.balance + excluded.balance, updated_at = now();
    end if;
  else
    raise exception 'Ação não permitida agora';
  end if;
end $$;

-- a pessoa combina com o público escolhido?
create or replace function public.boost_matches(f jsonb, p profiles) returns boolean language plpgsql stable as $$
declare v_age int; v_range text;
begin
  if coalesce(jsonb_array_length(f->'states'), 0) > 0 and not (coalesce(p.state, '') in (select jsonb_array_elements_text(f->'states'))) then return false; end if;
  if coalesce(jsonb_array_length(f->'cities'), 0) > 0 and not (lower(coalesce(p.city, '')) in (select lower(x) from jsonb_array_elements_text(f->'cities') x)) then return false; end if;
  if coalesce(jsonb_array_length(f->'genders'), 0) > 0 and not (coalesce(p.gender, '') in (select jsonb_array_elements_text(f->'genders'))) then return false; end if;
  if coalesce(jsonb_array_length(f->'ages'), 0) > 0 then
    if p.birth_year is null then return false; end if;
    v_age := extract(year from now())::int - p.birth_year;
    -- mesmas faixas do app: 18-24, 25-34, 35-44, 45-59, 60+
    v_range := case when v_age < 25 then '18-24' when v_age < 35 then '25-34' when v_age < 45 then '35-44'
                    when v_age < 60 then '45-59' else '60+' end;
    if not (v_range in (select jsonb_array_elements_text(f->'ages'))) then return false; end if;
  end if;
  if coalesce(jsonb_array_length(f->'interests'), 0) > 0
     and not (coalesce(p.interests, '{}') && array(select jsonb_array_elements_text(f->'interests'))) then return false; end if;
  return true;
end $$;

-- quais impulsionados mostrar para quem está usando o app agora
create or replace function public.next_boosts(p_limit int default 5) returns table (campaign_id uuid, target_kind text, target_id text, user_id uuid)
language plpgsql security definer set search_path = public as $$
declare me profiles%rowtype;
begin
  select * into me from profiles where id = auth.uid();
  if not found then return; end if;
  -- de vez em quando encerra as vencidas
  if random() < 0.05 then perform finish_expired_boosts(); end if;
  return query
    select c.id, c.target_kind, c.target_id, c.user_id
    from boost_campaigns c
    where c.status = 'active' and c.ends_at > now() and c.delivered < c.reach_goal
      and c.user_id <> me.id
      and not exists (select 1 from boost_impressions i where i.campaign_id = c.id and i.viewer_id = me.id)
      and boost_matches(c.filters, me)
    -- quem está mais atrasado na entrega (falta muito e o prazo está acabando) aparece antes
    order by ((c.reach_goal - c.delivered)::numeric / greatest(1, extract(epoch from (c.ends_at - now())) / 3600)) * (0.75 + random() * 0.5) desc
    limit greatest(1, least(p_limit, 20));
end $$;

-- conta que a pessoa viu (1 vez por campanha)
create or replace function public.record_boost_impression(p_campaign uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into boost_impressions (campaign_id, viewer_id)
  select p_campaign, auth.uid() from boost_campaigns c
   where c.id = p_campaign and c.status = 'active' and c.user_id <> auth.uid()
  on conflict do nothing;
  if found then
    update boost_campaigns set delivered = delivered + 1,
      status = case when delivered + 1 >= reach_goal then 'completed' else status end
    where id = p_campaign;
  end if;
end $$;

-- clique / seguiu a partir do impulsionado
create or replace function public.record_boost_event(p_campaign uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('click', 'follow') then return; end if;
  insert into boost_events (campaign_id, viewer_id, kind)
  select p_campaign, auth.uid(), p_kind from boost_campaigns c where c.id = p_campaign and c.user_id <> auth.uid()
  on conflict do nothing;
  if found then
    if p_kind = 'click' then update boost_campaigns set clicks = clicks + 1 where id = p_campaign;
    else update boost_campaigns set follows = follows + 1 where id = p_campaign; end if;
  end if;
end $$;

-- faturamento para o admin
create or replace function public.admin_boost_revenue() returns table (today numeric, month numeric, total numeric, active int, pending_review int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  return query select
    coalesce(sum(amount) filter (where paid_at >= date_trunc('day', now()) and paid_with <> 'credito'), 0),
    coalesce(sum(amount) filter (where paid_at >= date_trunc('month', now()) and paid_with <> 'credito'), 0),
    coalesce(sum(amount) filter (where paid_at is not null and paid_with <> 'credito'), 0),
    count(*) filter (where status = 'active')::int,
    count(*) filter (where status = 'pending_review')::int
  from boost_campaigns;
end $$;

grant execute on function public.boost_estimate(numeric, boolean), public.create_boost(text, text, numeric, int, jsonb),
  public.pay_boost_with_credit(uuid), public.set_boost_status(uuid, text, text), public.next_boosts(int),
  public.record_boost_impression(uuid), public.record_boost_event(uuid, text), public.admin_boost_revenue(),
  public.finish_expired_boosts() to authenticated;
