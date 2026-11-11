-- Permite que a pessoa apague a própria conta pelo app (Configurações > Informações pessoais).
-- Apaga o usuário do login; o resto (perfil, posts, mensagens...) some junto por "on delete cascade".
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Participantes (não só quem abriu) podem encerrar a batalha quando o tempo acaba
-- e qualquer pessoa logada pode chamar o encerramento das vencidas.
grant execute on function public.end_expired_battles() to authenticated;
