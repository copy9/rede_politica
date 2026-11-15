-- Debate: descrição com link, sem tempo fixo (quem criou encerra), e apoiadores de qualquer perfil.

-- 1) descrição do debate (pode ter link)
alter table public.battles add column if not exists description text check (char_length(description) <= 1000);

-- 2) sem tempo de duração: o debate só termina quando quem criou encerra.
--    Segurança: um debate esquecido ao vivo encerra sozinho depois de 12 horas.
create or replace function public.end_expired_battles() returns void language sql security definer set search_path = public as $$
  update battles set status = 'ended' where status = 'live' and starts_at < now() - interval '12 hours';
$$;

-- 3) "Quero receber novidades" vale para qualquer perfil (não só político)
drop policy if exists "minhas autorizações" on public.consents;
create policy "minhas autorizações" on public.consents for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and politician_id <> auth.uid());
