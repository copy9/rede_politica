-- Administração: conta de administrador aprova/recusa pedidos de perfil público, vê o painel da plataforma,
-- as denúncias e os usuários. Tudo passa por funções que conferem se quem chama é administrador.

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.reports add column if not exists status text not null default 'aberto';
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check check (status in ('aberto', 'aprovado', 'recusado', 'resolvido'));

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

-- ninguém se torna administrador (nem político) pelo app
drop policy if exists "editar o próprio perfil" on public.profiles;
create policy "editar o próprio perfil" on public.profiles for update to authenticated using (id = auth.uid()) with check (
  id = auth.uid()
  and verified = (select p.verified from public.profiles p where p.id = auth.uid())
  and account_type = (select p.account_type from public.profiles p where p.id = auth.uid())
  and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
);
drop policy if exists "criar o próprio perfil" on public.profiles;
create policy "criar o próprio perfil" on public.profiles for insert to authenticated
  with check (id = auth.uid() and verified = false and account_type = 'cidadao' and is_admin = false);

-- ---------- painel ----------
create or replace function public.admin_stats() returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  return json_build_object(
    'users', (select count(*) from profiles),
    'citizens', (select count(*) from profiles where account_type = 'cidadao'),
    'politicians', (select count(*) from profiles where account_type = 'politico'),
    'verified', (select count(*) from profiles where verified),
    'admins', (select count(*) from profiles where is_admin),
    'new_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'new_30d', (select count(*) from profiles where created_at > now() - interval '30 days'),
    'active_24h', (select count(*) from profiles where last_active_at > now() - interval '1 day'),
    'active_7d', (select count(*) from profiles where last_active_at > now() - interval '7 days'),
    'posts', (select count(*) from posts),
    'posts_7d', (select count(*) from posts where created_at > now() - interval '7 days'),
    'comments', (select count(*) from comments),
    'likes', (select count(*) from likes),
    'follows', (select count(*) from follows),
    'stories', (select count(*) from stories),
    'conversations', (select count(*) from conversations),
    'messages', (select count(*) from messages),
    'battles', (select count(*) from battles),
    'battles_live', (select count(*) from battles where status = 'live'),
    'supporters', (select count(*) from consents),
    'requests_open', (select count(*) from reports where target_type = 'verificacao' and status = 'aberto'),
    'reports_open', (select count(*) from reports where target_type <> 'verificacao' and status = 'aberto'),
    'by_state', (select coalesce(json_agg(x), '[]') from (
        select coalesce(state, '—') as label, count(*) as total from profiles group by 1 order by 2 desc limit 10) x),
    'signups_14d', (select coalesce(json_agg(x order by x.day), '[]') from (
        select to_char(d, 'DD/MM') as day, (select count(*) from profiles p where p.created_at::date = d::date) as total
        from generate_series(current_date - 13, current_date, interval '1 day') d) x)
  );
end $$;

-- ---------- pedidos de perfil público ----------
create or replace function public.admin_requests() returns table (
  id uuid, created_at timestamptz, status text, reason text, user_id uuid, username text, name text, account_type text, verified boolean
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  return query
    select r.id, r.created_at, r.status, r.reason, p.id, p.username, p.name, p.account_type, p.verified
    from reports r join profiles p on p.id = r.reporter_id
    where r.target_type = 'verificacao'
    order by (r.status = 'aberto') desc, r.created_at desc
    limit 300;
end $$;

create or replace function public.admin_decide_request(report_id uuid, approve boolean) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update reports set status = case when approve then 'aprovado' else 'recusado' end
    where id = report_id and target_type = 'verificacao' returning reporter_id into uid;
  if uid is null then return 'Pedido não encontrado'; end if;
  if approve then
    update profiles set account_type = 'politico', verified = true where id = uid;
  end if;
  insert into notifications (to_user_id, from_user_id, type, text) values (uid, auth.uid(), 'security',
    case when approve then 'Seu perfil público foi aprovado. Preencha seus dados de político em Editar perfil.'
         else 'Seu pedido de perfil público não foi aprovado. Confira os dados e envie de novo.' end);
  return case when approve then 'Aprovado' else 'Recusado' end;
end $$;

-- ---------- denúncias ----------
create or replace function public.admin_reports() returns table (
  id uuid, created_at timestamptz, status text, reason text, target_type text, target_id text, reporter_username text
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  return query
    select r.id, r.created_at, r.status, r.reason, r.target_type, r.target_id, p.username
    from reports r join profiles p on p.id = r.reporter_id
    where r.target_type <> 'verificacao'
    order by (r.status = 'aberto') desc, r.created_at desc
    limit 300;
end $$;

create or replace function public.admin_resolve_report(report_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update reports set status = 'resolvido' where id = report_id;
end $$;

-- ---------- usuários ----------
create or replace function public.admin_users(search text default '') returns table (
  id uuid, username text, name text, account_type text, verified boolean, is_admin boolean,
  city text, state text, created_at timestamptz, last_active_at timestamptz, posts bigint, followers bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  return query
    select p.id, p.username, p.name, p.account_type, p.verified, p.is_admin, p.city, p.state, p.created_at, p.last_active_at,
      (select count(*) from posts x where x.user_id = p.id),
      (select count(*) from follows f where f.following_id = p.id)
    from profiles p
    where coalesce(search, '') = '' or p.username ilike '%' || search || '%' or p.name ilike '%' || search || '%'
    order by p.created_at desc
    limit 200;
end $$;

-- liga/desliga perfil público de um usuário
create or replace function public.admin_set_politico(target uuid, on_off boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update profiles set account_type = case when on_off then 'politico' else 'cidadao' end, verified = on_off where id = target;
end $$;

grant execute on function public.admin_stats(), public.admin_requests(), public.admin_decide_request(uuid, boolean),
  public.admin_reports(), public.admin_resolve_report(uuid), public.admin_users(text), public.admin_set_politico(uuid, boolean),
  public.is_admin() to authenticated;

-- aviso para os administradores a cada pedido novo
create or replace function public.trg_request_notify_admins() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'verificacao' then
    insert into notifications (to_user_id, from_user_id, type, text)
    select a.id, new.reporter_id, 'security', 'Novo pedido de perfil público. Abra Configurações > Administração.'
    from profiles a where a.is_admin;
  end if;
  return new;
end $$;
drop trigger if exists request_notify_admins on public.reports;
create trigger request_notify_admins after insert on public.reports for each row execute function public.trg_request_notify_admins();

-- aprovação pelo SQL Editor continua funcionando (aviso com tipo que o app mostra)
create or replace function public.aprovar_perfil_publico(nome_usuario text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  update profiles set account_type = 'politico', verified = true where username = lower(nome_usuario) returning id into uid;
  if uid is null then return 'Usuário não encontrado'; end if;
  update reports set status = 'aprovado' where reporter_id = uid and target_type = 'verificacao' and status = 'aberto';
  insert into notifications (to_user_id, from_user_id, type, text)
  values (uid, uid, 'security', 'Seu perfil público foi aprovado. Preencha seus dados de político em Editar perfil.');
  return 'Aprovado';
end $$;
revoke execute on function public.aprovar_perfil_publico(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
