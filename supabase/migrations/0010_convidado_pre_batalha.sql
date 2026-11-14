-- Terceira pessoa convidada na criação da batalha: entra na live quando aceitar.
alter table public.battle_guests drop constraint if exists battle_guests_status_check;
alter table public.battle_guests add constraint battle_guests_status_check check (status in ('convidado', 'pending', 'accepted', 'declined'));

-- quem criou a batalha convida alguém antes de começar
drop policy if exists "host convida" on public.battle_guests;
create policy "host convida" on public.battle_guests for insert to authenticated with check (
  status = 'convidado'
  and exists (select 1 from battles b where b.id = battle_id and b.host_id = auth.uid() and b.status in ('invited', 'scheduled', 'live'))
);

-- o convidado aceita ou recusa
drop policy if exists "convidado responde" on public.battle_guests;
create policy "convidado responde" on public.battle_guests for update to authenticated
  using (user_id = auth.uid() and status = 'convidado')
  with check (status in ('accepted', 'declined'));

-- aviso para o convidado
create or replace function public.trg_guest_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare host_name text; topic_txt text;
begin
  select p.name, b.topic into host_name, topic_txt
  from battles b join profiles p on p.id = b.host_id where b.id = new.battle_id;
  insert into notifications (to_user_id, from_user_id, type, battle_id, text)
  values (new.user_id, (select host_id from battles where id = new.battle_id), 'battle', new.battle_id,
    coalesce(host_name, 'Alguém') || ' convidou você para participar da batalha: ' || coalesce(topic_txt, '') || ' (aceite ou recuse)');
  return new;
end $$;
drop trigger if exists guest_notify on public.battle_guests;
create trigger guest_notify after insert on public.battle_guests for each row
  when (new.status = 'convidado') execute function public.trg_guest_notify();
