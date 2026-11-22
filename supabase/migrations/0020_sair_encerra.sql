-- "Sair" da live: quem está debatendo (anfitrião OU o outro lado) encerra a live para todos.
-- Antes só o anfitrião conseguia encerrar; o outro lado saía, mas a live continuava aberta.
create or replace function public.leave_battle(p_battle uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update battles set status = 'ended'
   where id = p_battle and status in ('live', 'invited', 'scheduled')
     and (host_id = auth.uid() or opponent_id = auth.uid());
  update battle_guests set status = 'declined'
   where battle_id = p_battle and user_id = auth.uid();
end $$;
grant execute on function public.leave_battle(uuid) to authenticated;
