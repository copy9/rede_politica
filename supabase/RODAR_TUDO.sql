-- RODAR TUDO: junta todas as atualizações do banco desde o Painel real (0019) até o controle da live (0026).
-- Pode rodar mais de uma vez sem problema. Cole tudo no SQL Editor do Supabase e clique em Run.

-- ===================== 0019_painel_real =====================
-- Painel do político com números reais.
-- 1) content_views: cada visualização de publicação, vídeo, story, live e visita ao perfil,
--    e cada compartilhamento. Só o dono do conteúdo lê as próprias linhas.
-- 2) follow_events: guarda quando alguém segue e deixa de seguir (para "Deixaram de seguir").

create table if not exists public.content_views (
  id bigserial primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('post', 'video', 'story', 'battle', 'profile', 'share')),
  ref_id text,
  created_at timestamptz not null default now(),
  check (owner_id <> viewer_id)
);
create index if not exists content_views_owner_time on public.content_views (owner_id, created_at);
alter table public.content_views enable row level security;
drop policy if exists "registrar visualização" on public.content_views;
create policy "registrar visualização" on public.content_views for insert to authenticated with check (viewer_id = auth.uid());
drop policy if exists "dono vê as visualizações" on public.content_views;
create policy "dono vê as visualizações" on public.content_views for select to authenticated using (owner_id = auth.uid());

create table if not exists public.follow_events (
  id bigserial primary key,
  following_id uuid not null references public.profiles(id) on delete cascade,
  follower_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('follow', 'unfollow')),
  created_at timestamptz not null default now()
);
create index if not exists follow_events_following_time on public.follow_events (following_id, created_at);
alter table public.follow_events enable row level security;
drop policy if exists "dono vê seus seguidores" on public.follow_events;
create policy "dono vê seus seguidores" on public.follow_events for select to authenticated using (following_id = auth.uid());

create or replace function public.trg_follow_events() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into follow_events (following_id, follower_id, kind) values (new.following_id, new.follower_id, 'follow');
    return new;
  else
    -- conta apagada: não registra (o perfil já saiu do banco)
    if exists (select 1 from profiles where id = old.follower_id) and exists (select 1 from profiles where id = old.following_id) then
      insert into follow_events (following_id, follower_id, kind) values (old.following_id, old.follower_id, 'unfollow');
    end if;
    return old;
  end if;
end $$;
drop trigger if exists follow_events_log on public.follows;
create trigger follow_events_log after insert or delete on public.follows for each row execute function public.trg_follow_events();

-- ===================== 0021_nota_das_lives =====================
-- Nota da live (1 a 5 estrelas), dada por quem assistiu, no fim da live.
-- A média entra no score de quem fez a live e impulsiona as próximas lives dela (aparecem antes para mais gente).

create table if not exists public.battle_ratings (
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);
alter table public.battle_ratings enable row level security;

drop policy if exists "ver notas" on public.battle_ratings;
create policy "ver notas" on public.battle_ratings for select to authenticated using (true);

-- só quem assistiu dá nota (quem fez a live não se avalia)
drop policy if exists "dar nota" on public.battle_ratings;
create policy "dar nota" on public.battle_ratings for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.battles b
    where b.id = battle_id and b.status in ('live', 'ended')
      and b.host_id <> auth.uid() and coalesce(b.opponent_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
  )
);
drop policy if exists "trocar nota" on public.battle_ratings;
create policy "trocar nota" on public.battle_ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- soma e quantidade de notas de cada pessoa que fez live (como anfitrião ou como o outro lado)
create or replace view public.live_rating_totals with (security_invoker = true) as
select p.user_id, sum(r.stars)::int as total, count(*)::int as votes
from public.battle_ratings r
join public.battles b on b.id = r.battle_id
cross join lateral (values (b.host_id), (b.opponent_id)) as p(user_id)
where p.user_id is not null
group by p.user_id;
grant select on public.live_rating_totals to authenticated;

-- ===================== 0022_admin_apagar_e_senha =====================
-- Admin: apagar usuário e trocar a senha de um usuário. Também mostra o e-mail na lista de usuários.

-- lista de usuários agora com e-mail (e busca por e-mail)
drop function if exists public.admin_users(text);
create or replace function public.admin_users(search text default '') returns table (
  id uuid, username text, name text, email text, account_type text, verified boolean, is_admin boolean,
  city text, state text, created_at timestamptz, last_active_at timestamptz, posts bigint, followers bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  return query
    select p.id, p.username, p.name, u.email::text, p.account_type, p.verified, p.is_admin, p.city, p.state, p.created_at, p.last_active_at,
      (select count(*) from posts x where x.user_id = p.id),
      (select count(*) from follows f where f.following_id = p.id)
    from profiles p
    left join auth.users u on u.id = p.id
    where coalesce(search, '') = '' or p.username ilike '%' || search || '%' or p.name ilike '%' || search || '%'
       or u.email ilike '%' || search || '%'
    order by p.created_at desc
    limit 200;
end $$;

-- apaga a conta de vez (perfil, publicações, comentários, mensagens etc. saem junto)
create or replace function public.admin_delete_user(target uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if target = auth.uid() then raise exception 'Você não pode apagar a própria conta por aqui'; end if;
  if exists (select 1 from profiles where id = target and is_admin) then raise exception 'Não é possível apagar outro administrador'; end if;
  delete from auth.users where id = target;
end $$;

-- troca a senha de um usuário (mínimo 6 caracteres)
create or replace function public.admin_set_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if length(coalesce(new_password, '')) < 6 then raise exception 'A senha precisa ter pelo menos 6 caracteres'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now()
   where id = target;
  if not found then raise exception 'Usuário não encontrado'; end if;
end $$;

grant execute on function public.admin_users(text), public.admin_delete_user(uuid), public.admin_set_password(uuid, text) to authenticated;

-- ===================== 0023_corrige_apagar_conta =====================
-- Corrige: apagar uma conta dava erro no registro de "deixou de seguir" (o perfil já tinha saído do banco).
create or replace function public.trg_follow_events() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into follow_events (following_id, follower_id, kind) values (new.following_id, new.follower_id, 'follow');
    return new;
  else
    -- conta apagada: não registra (o perfil já saiu do banco)
    if exists (select 1 from profiles where id = old.follower_id) and exists (select 1 from profiles where id = old.following_id) then
      insert into follow_events (following_id, follower_id, kind) values (old.following_id, old.follower_id, 'unfollow');
    end if;
    return old;
  end if;
end $$;

-- ===================== 0024_sair_sem_encerrar =====================
-- Sair da live sem derrubar quem fica:
-- * o outro lado sai  -> a live continua só com o anfitrião (tela cheia)
-- * o anfitrião sai e tem o outro lado -> o outro lado vira o anfitrião e a live continua com ele
-- * o anfitrião sai e está sozinho -> a live termina
-- * convidado sai -> só ele sai
drop function if exists public.leave_battle(uuid);
create or replace function public.leave_battle(p_battle uuid) returns text
language plpgsql security definer set search_path = public as $$
declare b battles%rowtype;
begin
  select * into b from battles where id = p_battle for update;
  if not found then return 'nao_encontrada'; end if;

  update battle_guests set status = 'declined' where battle_id = p_battle and user_id = auth.uid();

  if b.status <> 'live' then
    -- desafio ainda não começou: quem sai cancela
    if b.host_id = auth.uid() or b.opponent_id = auth.uid() then
      update battles set status = 'ended' where id = p_battle;
      return 'encerrada';
    end if;
    return 'saiu';
  end if;

  if b.opponent_id = auth.uid() then
    update battles set opponent_id = null, score_opponent = 0 where id = p_battle;
    return 'continua';
  end if;

  if b.host_id = auth.uid() then
    if b.opponent_id is not null then
      update battles set host_id = b.opponent_id, opponent_id = null, score_host = b.score_opponent, score_opponent = 0
       where id = p_battle;
      return 'continua';
    end if;
    update battles set status = 'ended' where id = p_battle;
    return 'encerrada';
  end if;

  return 'saiu';
end $$;
grant execute on function public.leave_battle(uuid) to authenticated;

-- Chamar alguém para a live (ex.: o outro lado saiu e quero chamar um amigo).
-- Só quem está com a live (anfitrião) chama. Se a pessoa já tinha pedido/recusado antes, o convite é refeito.
create or replace function public.invite_to_live(p_battle uuid, p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from battles where id = p_battle and host_id = auth.uid() and status in ('live', 'scheduled', 'invited')) then
    raise exception 'Só quem está com a live pode chamar alguém';
  end if;
  if p_user = auth.uid() then raise exception 'Você já está na live'; end if;
  if exists (select 1 from battle_guests where battle_id = p_battle and user_id = p_user and status = 'accepted') then
    return 'ja_esta';
  end if;
  -- apaga o pedido antigo e cria o convite (o aviso chega para a pessoa)
  delete from battle_guests where battle_id = p_battle and user_id = p_user;
  insert into battle_guests (battle_id, user_id, status) values (p_battle, p_user, 'convidado');
  return 'convidado';
end $$;
grant execute on function public.invite_to_live(uuid, uuid) to authenticated;

-- ===================== 0025_impulsionamento =====================
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

-- ===================== 0026_controle_da_live =====================
-- Controles do anfitrião na live: silenciar microfone e desligar câmera de quem está participando.
-- Só quem criou a live grava aqui; o celular de cada participante obedece.
create table if not exists public.battle_moderation (
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mic_off boolean not null default false,
  cam_off boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);
alter table public.battle_moderation enable row level security;
drop policy if exists "ver controle da live" on public.battle_moderation;
create policy "ver controle da live" on public.battle_moderation for select to authenticated using (true);
drop policy if exists "anfitriao controla" on public.battle_moderation;
create policy "anfitriao controla" on public.battle_moderation for all to authenticated
  using (exists (select 1 from public.battles b where b.id = battle_id and b.host_id = auth.uid()))
  with check (exists (select 1 from public.battles b where b.id = battle_id and b.host_id = auth.uid()));

-- convidado que estava falando pode sair da live sozinho (antes o "Sair" dele não registrava)
drop policy if exists "convidado sai" on public.battle_guests;
create policy "convidado sai" on public.battle_guests for update to authenticated
  using (user_id = auth.uid() and status = 'accepted')
  with check (user_id = auth.uid() and status = 'declined');

-- tempo real
do $$ begin
  alter publication supabase_realtime add table public.battle_moderation;
exception when others then null; end $$;
