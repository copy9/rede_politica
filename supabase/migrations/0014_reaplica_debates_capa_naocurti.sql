-- Reaplica com segurança tudo de debate/convites (0009, 0010, 0011) e adiciona capa do perfil e "não curti" nos posts.
-- Pode rodar mais de uma vez sem problema.

-- ===== 0008: convidados =====

create table if not exists public.battle_guests (
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);
alter table public.battle_guests enable row level security;

drop policy if exists "ver convidados" on public.battle_guests;
create policy "ver convidados" on public.battle_guests for select to authenticated using (true);

drop policy if exists "pedir para entrar" on public.battle_guests;
create policy "pedir para entrar" on public.battle_guests for insert to authenticated with check (
  user_id = auth.uid() and status = 'pending'
  and exists (select 1 from battles b where b.id = battle_id and b.status = 'live')
);

drop policy if exists "pedir de novo" on public.battle_guests;
create policy "pedir de novo" on public.battle_guests for update to authenticated
  using (user_id = auth.uid() and status = 'declined')
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "host responde" on public.battle_guests;
create policy "host responde" on public.battle_guests for update to authenticated
  using (exists (select 1 from battles b where b.id = battle_id and b.host_id = auth.uid()))
  with check (status in ('pending', 'accepted', 'declined'));

do $$ begin
  alter publication supabase_realtime add table public.battle_guests;
exception when duplicate_object then null;
end $$;

-- ===== 0009: convite com aceite =====
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

-- ===== 0010: convidados escolhidos na criação =====
alter table public.battle_guests drop constraint if exists battle_guests_status_check;
alter table public.battle_guests add constraint battle_guests_status_check check (status in ('convidado', 'pending', 'accepted', 'declined'));

drop policy if exists "host convida" on public.battle_guests;
create policy "host convida" on public.battle_guests for insert to authenticated with check (
  status = 'convidado'
  and exists (select 1 from battles b where b.id = battle_id and b.host_id = auth.uid() and b.status in ('invited', 'scheduled', 'live'))
);

drop policy if exists "convidado responde" on public.battle_guests;
create policy "convidado responde" on public.battle_guests for update to authenticated
  using (user_id = auth.uid() and status = 'convidado')
  with check (status in ('accepted', 'declined'));

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

-- ===== 0011: descrição do debate =====
alter table public.battles add column if not exists description text check (char_length(description) <= 1000);

-- ===== capa do perfil (como no Twitter) =====
alter table public.profiles add column if not exists cover_url text;

-- ===== "não curti" nos posts: ninguém vê quem deu, só o total =====
alter table public.posts add column if not exists dislikes int not null default 0;
create table if not exists public.post_dislikes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_dislikes enable row level security;
drop policy if exists "vejo só o meu não curti" on public.post_dislikes;
create policy "vejo só o meu não curti" on public.post_dislikes for select to authenticated using (user_id = auth.uid());
drop policy if exists "dou não curti" on public.post_dislikes;
create policy "dou não curti" on public.post_dislikes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "tiro não curti" on public.post_dislikes;
create policy "tiro não curti" on public.post_dislikes for delete to authenticated using (user_id = auth.uid());

create or replace function public.trg_post_dislikes_count() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update posts set dislikes = dislikes + 1 where id = new.post_id;
  else update posts set dislikes = greatest(0, dislikes - 1) where id = old.post_id; end if;
  return null;
end $$;
drop trigger if exists post_dislikes_count on public.post_dislikes;
create trigger post_dislikes_count after insert or delete on public.post_dislikes for each row execute function public.trg_post_dislikes_count();

notify pgrst, 'reload schema';
