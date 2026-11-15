-- Todos se cadastram como usuário normal. Virar político só por pedido de verificação aprovado pela equipe.

-- 1) cadastro sempre como usuário normal
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, name, account_type, role, party, city, state, birth_year)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8))),
    coalesce(new.raw_user_meta_data->>'name', 'Usuário'),
    'cidadao',
    'Cidadão',
    null,
    new.raw_user_meta_data->>'city',
    upper(new.raw_user_meta_data->>'state'),
    nullif(new.raw_user_meta_data->>'birth_year', '')::int
  );
  return new;
end $$;

-- 2) a própria pessoa não muda o tipo de conta nem o selo
drop policy if exists "editar o próprio perfil" on public.profiles;
create policy "editar o próprio perfil" on public.profiles for update to authenticated using (id = auth.uid()) with check (
  id = auth.uid()
  and verified = (select p.verified from public.profiles p where p.id = auth.uid())
  and account_type = (select p.account_type from public.profiles p where p.id = auth.uid())
);
drop policy if exists "criar o próprio perfil" on public.profiles;
create policy "criar o próprio perfil" on public.profiles for insert to authenticated
  with check (id = auth.uid() and verified = false and account_type = 'cidadao');

-- 3) aprovar um pedido (rodar no SQL Editor): libera perfil público de político e o selo
create or replace function public.aprovar_perfil_publico(nome_usuario text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  update profiles set account_type = 'politico', verified = true where username = lower(nome_usuario) returning id into uid;
  if uid is null then return 'Usuário não encontrado'; end if;
  insert into notifications (to_user_id, from_user_id, type, text)
  values (uid, uid, 'system', 'Seu perfil público foi aprovado. Agora você pode preencher seus dados de político em Editar perfil.');
  return 'Aprovado';
exception when others then
  return 'Aprovado (sem aviso: ' || sqlerrm || ')';
end $$;
revoke execute on function public.aprovar_perfil_publico(text) from public, anon, authenticated;
