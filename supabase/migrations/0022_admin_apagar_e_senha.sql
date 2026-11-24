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
