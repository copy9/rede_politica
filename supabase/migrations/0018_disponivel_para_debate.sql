-- "Disponível para debate" ligado = qualquer pessoa pode convidar.
-- Quem estava no padrão antigo ("só quem eu sigo") aparecia como disponível no próprio perfil, mas indisponível para os outros.
update public.profiles set who_can_challenge = 'todos' where who_can_challenge = 'seguidores';
alter table public.profiles alter column who_can_challenge set default 'todos';
