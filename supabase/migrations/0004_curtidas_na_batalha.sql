-- Curtidas na batalha ao vivo (coraçõezinhos da plateia).
-- O app junta os toques de ~1 segundo num evento só (amount = quantos toques).
alter table public.battles add column if not exists likes int not null default 0;
alter table public.battle_events add column if not exists amount int check (amount between 1 and 50);
alter table public.battle_events drop constraint if exists battle_events_kind_check;
alter table public.battle_events add constraint battle_events_kind_check check (kind in ('chat','support','like'));

-- quem pode enviar: qualquer pessoa logada numa batalha ao vivo (curtida precisa de amount)
drop policy if exists "comentar/apoiar" on public.battle_events;
create policy "comentar/apoiar" on public.battle_events for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from battles b where b.id = battle_id and b.status = 'live')
  and (
    kind = 'chat'
    or (kind = 'like' and amount is not null and side is null and points is null)
    or (kind = 'support' and side is not null and points is not null
        and user_id not in (select host_id from battles where id = battle_id union select opponent_id from battles where id = battle_id))
  )
);

-- o host também não mexe no total de curtidas pelo update
create or replace function public.trg_battle_guard() returns trigger language plpgsql as $$
begin
  if current_setting('rede.score_update', true) is distinct from 'on' then
    new.score_host := old.score_host; new.score_opponent := old.score_opponent; new.likes := old.likes;
    new.host_id := old.host_id; new.opponent_id := old.opponent_id; new.topic := old.topic;
  end if;
  if new.status = 'live' and old.status = 'scheduled' then new.starts_at := now(); end if;
  return new;
end $$;

create or replace function public.trg_battle_support() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind in ('support', 'like') then
    perform set_config('rede.score_update', 'on', true);
    update battles set
      score_host = score_host + case when new.kind = 'support' and new.side = 'host' then new.points else 0 end,
      score_opponent = score_opponent + case when new.kind = 'support' and new.side = 'opponent' then new.points else 0 end,
      likes = likes + case when new.kind = 'like' then new.amount else 0 end
    where id = new.battle_id;
    perform set_config('rede.score_update', 'off', true);
  end if;
  return new;
end $$;
