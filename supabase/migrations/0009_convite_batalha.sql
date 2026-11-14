-- Convite de batalha: quem é desafiado precisa aceitar antes de a batalha começar.
alter table public.battles drop constraint if exists battles_status_check;
alter table public.battles add constraint battles_status_check check (status in ('invited', 'scheduled', 'live', 'ended'));

-- o desafiado responde ao convite: aceita (vira ao vivo) ou recusa (encerra)
drop policy if exists "adversario responde convite" on public.battles;
create policy "adversario responde convite" on public.battles for update to authenticated
  using (opponent_id = auth.uid() and status = 'invited')
  with check (status in ('live', 'ended'));

-- ao aceitar, o tempo da batalha começa agora
create or replace function public.trg_battle_guard() returns trigger language plpgsql as $$
begin
  if current_setting('rede.score_update', true) is distinct from 'on' then
    new.score_host := old.score_host; new.score_opponent := old.score_opponent;
    new.host_id := old.host_id; new.opponent_id := old.opponent_id; new.topic := old.topic;
  end if;
  if new.status = 'live' and old.status in ('scheduled', 'invited') then new.starts_at := now(); end if;
  return new;
end $$;

-- avisos: convite, aceite, recusa, agendada e começou
create or replace function public.trg_battle_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
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
