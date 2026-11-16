-- Live sozinho: a batalha pode não ter o outro lado. Quem assiste pode pedir para entrar.
alter table public.battles alter column opponent_id drop not null;

drop policy if exists "criar batalha" on public.battles;
create policy "criar batalha" on public.battles for insert to authenticated with check (
  host_id = auth.uid() and score_host = 0 and score_opponent = 0
  and (
    opponent_id is null
    or (opponent_id <> auth.uid() and public.allows(opponent_id, (select who_can_challenge from profiles where id = opponent_id)))
  )
);

-- avisos: sem outro lado, não há convite para mandar
create or replace function public.trg_battle_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.opponent_id is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into notifications (to_user_id, from_user_id, type, battle_id, text)
    values (new.opponent_id, new.host_id, 'battle', new.id,
      case when new.status = 'invited' then 'te desafiou para uma batalha: ' || new.topic || ' (aceite ou recuse)'
           when new.status = 'live' then 'te desafiou para uma batalha ao vivo agora: ' || new.topic
           else 'agendou uma batalha com você: ' || new.topic end);
  elsif old.status = 'invited' and new.status = 'live' then
    insert into notifications (to_user_id, from_user_id, type, battle_id, text)
    values (new.host_id, new.opponent_id, 'battle', new.id, 'aceitou seu desafio: ' || new.topic);
  elsif old.status = 'invited' and new.status = 'ended' then
    insert into notifications (to_user_id, from_user_id, type, battle_id, text)
    values (new.host_id, new.opponent_id, 'battle', new.id, 'recusou seu desafio: ' || new.topic);
  elsif new.status = 'live' and old.status = 'scheduled' then
    insert into notifications (to_user_id, from_user_id, type, battle_id, text)
    select r.user_id, new.host_id, 'battle', new.id, 'começou a batalha: ' || new.topic
    from battle_reminders r where r.battle_id = new.id and r.user_id <> new.host_id
    union
    select new.opponent_id, new.host_id, 'battle', new.id, 'começou a batalha: ' || new.topic;
  end if;
  return new;
end $$;

-- publicações só de texto (caso a 0016 ainda não tenha sido rodada)
alter table public.posts drop constraint if exists posts_type_check;
alter table public.posts add constraint posts_type_check check (type in ('image', 'video', 'text'));
alter table public.posts alter column media_url drop not null;

notify pgrst, 'reload schema';
