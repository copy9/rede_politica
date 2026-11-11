-- Rede Política · estrutura inicial do banco (Supabase / Postgres)
-- Todas as tabelas têm RLS (cada pessoa só mexe no que é dela).

-- ========== PERFIS ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9._]{3,30}$'),
  name text not null,
  avatar_url text,
  bio text not null default '',
  role text,
  party text,
  website text,
  account_type text not null default 'cidadao' check (account_type in ('cidadao','politico')),
  verified boolean not null default false,
  city text,
  state text,
  gender text check (gender in ('F','M','O')),
  birth_year int,
  interests text[] not null default '{}',
  private_account boolean not null default false,
  show_activity boolean not null default true,
  who_can_comment text not null default 'todos',
  who_can_message text not null default 'todos',
  who_can_mention text not null default 'todos',
  who_can_challenge text not null default 'seguidores',
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "perfis visíveis para usuários logados" on public.profiles for select to authenticated using (true);
create policy "editar o próprio perfil" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and verified = (select p.verified from public.profiles p where p.id = auth.uid()));
create policy "criar o próprio perfil" on public.profiles for insert to authenticated with check (id = auth.uid() and verified = false);

-- Cria o perfil automaticamente no cadastro (dados vêm do signUp)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, name, account_type, role, party, city, state, birth_year)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8))),
    coalesce(new.raw_user_meta_data->>'name', 'Usuário'),
    coalesce(new.raw_user_meta_data->>'account_type', 'cidadao'),
    coalesce(new.raw_user_meta_data->>'role', 'Cidadão'),
    new.raw_user_meta_data->>'party',
    new.raw_user_meta_data->>'city',
    upper(new.raw_user_meta_data->>'state'),
    nullif(new.raw_user_meta_data->>'birth_year', '')::int
  );
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ========== RELAÇÕES ==========
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create table if not exists public.follow_requests (
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  primary key (blocker_id, blocked_id)
);
create table if not exists public.mutes (
  muter_id uuid not null references public.profiles(id) on delete cascade,
  muted_id uuid not null references public.profiles(id) on delete cascade,
  primary key (muter_id, muted_id)
);
create table if not exists public.close_friends (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  primary key (owner_id, friend_id)
);
alter table public.follows enable row level security;
alter table public.follow_requests enable row level security;
alter table public.blocks enable row level security;
alter table public.mutes enable row level security;
alter table public.close_friends enable row level security;
create policy "ver seguidores" on public.follows for select to authenticated using (true);
create policy "seguir como eu" on public.follows for insert to authenticated with check (
  follower_id = auth.uid()
  and not (select private_account from public.profiles where id = following_id)
);
-- quem foi seguido aceita pedido (insere follow em nome de quem pediu)
create policy "aceitar pedido" on public.follows for insert to authenticated with check (
  following_id = auth.uid() and exists (select 1 from public.follow_requests r where r.from_id = follower_id and r.to_id = auth.uid())
);
create policy "deixar de seguir / remover seguidor" on public.follows for delete to authenticated using (follower_id = auth.uid() or following_id = auth.uid());
create policy "ver meus pedidos" on public.follow_requests for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());
create policy "pedir para seguir" on public.follow_requests for insert to authenticated with check (from_id = auth.uid());
create policy "cancelar/responder pedido" on public.follow_requests for delete to authenticated using (from_id = auth.uid() or to_id = auth.uid());
create policy "meus bloqueios" on public.blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "quem me bloqueou" on public.blocks for select to authenticated using (blocked_id = auth.uid());
create policy "meus silenciados" on public.mutes for all to authenticated using (muter_id = auth.uid()) with check (muter_id = auth.uid());
create policy "melhores amigos" on public.close_friends for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "estou na lista de alguém" on public.close_friends for select to authenticated using (friend_id = auth.uid());

-- ========== FUNÇÕES DE PERMISSÃO ==========
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
create or replace function public.can_see_content(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
    or (not public.is_blocked_between(owner, auth.uid())
        and (not (select private_account from profiles where id = owner)
             or exists (select 1 from follows where follower_id = auth.uid() and following_id = owner)));
$$;
-- regra "quem pode ..." de uma conta para mim: 'todos' | 'seguidores' (quem ela segue) | 'ninguem'
create or replace function public.allows(owner uuid, rule text) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or (
    not public.is_blocked_between(owner, auth.uid()) and (
      case rule
        when 'todos' then true
        when 'ninguem' then false
        else exists (select 1 from follows where follower_id = owner and following_id = auth.uid())
      end));
$$;

-- ========== PUBLICAÇÕES ==========
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('image','video')),
  media_url text not null,
  thumbnail_url text,
  caption text not null default '' check (length(caption) <= 2200),
  location text,
  created_at timestamptz not null default now()
);
create index if not exists posts_user_idx on public.posts(user_id, created_at desc);
create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments(post_id, created_at);
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (comment_id, user_id)
);
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
create policy "ver publicações permitidas" on public.posts for select to authenticated using (public.can_see_content(user_id));
create policy "publicar como eu" on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy "apagar minhas publicações" on public.posts for delete to authenticated using (user_id = auth.uid());
create policy "ver curtidas" on public.likes for select to authenticated using (true);
create policy "curtir como eu" on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "descurtir" on public.likes for delete to authenticated using (user_id = auth.uid());
create policy "meus salvos" on public.saves for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ver comentários" on public.comments for select to authenticated using (
  exists (select 1 from posts p where p.id = post_id and public.can_see_content(p.user_id)) and not public.is_blocked_between(user_id, auth.uid())
);
create policy "comentar se permitido" on public.comments for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from posts p join profiles pr on pr.id = p.user_id where p.id = post_id and public.allows(p.user_id, pr.who_can_comment))
);
create policy "apagar meu comentário ou no meu post" on public.comments for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
);
create policy "ver curtidas de comentário" on public.comment_likes for select to authenticated using (true);
create policy "curtir comentário" on public.comment_likes for insert to authenticated with check (user_id = auth.uid());
create policy "descurtir comentário" on public.comment_likes for delete to authenticated using (user_id = auth.uid());

-- ========== STORIES ==========
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  close_friends boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (story_id, user_id)
);
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
create policy "ver stories" on public.stories for select to authenticated using (
  created_at > now() - interval '24 hours' and public.can_see_content(user_id)
  and (not close_friends or user_id = auth.uid() or exists (select 1 from close_friends c where c.owner_id = user_id and c.friend_id = auth.uid()))
);
create policy "postar story" on public.stories for insert to authenticated with check (user_id = auth.uid());
create policy "apagar meu story" on public.stories for delete to authenticated using (user_id = auth.uid());
create policy "marcar visto" on public.story_views for insert to authenticated with check (user_id = auth.uid());
create policy "ver visualizações" on public.story_views for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from stories s where s.id = story_id and s.user_id = auth.uid())
);

-- ========== MENSAGENS ==========
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
create or replace function public.is_member(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members where conversation_id = conv and user_id = auth.uid());
$$;
create policy "ver minhas conversas" on public.conversations for select to authenticated using (public.is_member(id));
create policy "ver membros" on public.conversation_members for select to authenticated using (public.is_member(conversation_id));
create policy "ver mensagens" on public.messages for select to authenticated using (public.is_member(conversation_id));
create policy "enviar mensagem" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and public.is_member(conversation_id)
  and not exists (
    select 1 from conversation_members m join profiles p on p.id = m.user_id
    where m.conversation_id = messages.conversation_id and m.user_id <> auth.uid() and not public.allows(m.user_id, p.who_can_message)
  )
);
-- abre (ou reaproveita) conversa 1:1 respeitando "quem pode enviar mensagens"
create or replace function public.open_conversation(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare conv uuid;
begin
  select m1.conversation_id into conv from conversation_members m1
    join conversation_members m2 on m2.conversation_id = m1.conversation_id and m2.user_id = other
    where m1.user_id = auth.uid() limit 1;
  if conv is not null then return conv; end if;
  if not public.allows(other, (select who_can_message from profiles where id = other)) then
    raise exception 'Essa conta não recebe mensagens de você';
  end if;
  insert into conversations default values returning id into conv;
  insert into conversation_members values (conv, auth.uid()), (conv, other);
  return conv;
end $$;

-- ========== NOTIFICAÇÕES (criadas por gatilhos) ==========
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  from_user_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  post_id uuid references public.posts(id) on delete cascade,
  text text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notif_to_idx on public.notifications(to_user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "minhas notificações" on public.notifications for select to authenticated using (to_user_id = auth.uid());
create policy "marcar como lida" on public.notifications for update to authenticated using (to_user_id = auth.uid());
create policy "apagar notificação" on public.notifications for delete to authenticated using (to_user_id = auth.uid());

create or replace function public.notify(to_id uuid, kind text, post uuid, body text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (to_user_id, from_user_id, type, post_id, text)
  select to_id, auth.uid(), kind, post, body where to_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000');
$$;
create or replace function public.trg_like() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify((select user_id from posts where id = new.post_id), 'like', new.post_id, null); return new; end $$;
create or replace function public.trg_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare u record;
begin
  perform public.notify((select user_id from posts where id = new.post_id), 'comment', new.post_id, new.text);
  for u in select p.id, p.who_can_mention from profiles p where p.username = any (array(select lower(m[1]) from regexp_matches(new.text, '@([a-z0-9._]+)', 'gi') m)) loop
    if public.allows(u.id, u.who_can_mention) then perform public.notify(u.id, 'mention', new.post_id, new.text); end if;
  end loop;
  return new;
end $$;
create or replace function public.trg_follow() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify(new.following_id, 'follow', null, null); return new; end $$;
create or replace function public.trg_request() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify(new.to_id, 'request', null, null); return new; end $$;
drop trigger if exists like_notify on public.likes;
create trigger like_notify after insert on public.likes for each row execute function public.trg_like();
drop trigger if exists comment_notify on public.comments;
create trigger comment_notify after insert on public.comments for each row execute function public.trg_comment();
drop trigger if exists follow_notify on public.follows;
create trigger follow_notify after insert on public.follows for each row execute function public.trg_follow();
drop trigger if exists request_notify on public.follow_requests;
create trigger request_notify after insert on public.follow_requests for each row execute function public.trg_request();

-- ========== AUTORIZAÇÕES (LGPD) ==========
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  politician_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  fields text[] not null,
  email text,
  whatsapp text,
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (politician_id, user_id)
);
alter table public.consents enable row level security;
create policy "minhas autorizações" on public.consents for all to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and (select account_type from profiles where id = politician_id) = 'politico'
);
create policy "político vê quem o autorizou" on public.consents for select to authenticated using (politician_id = auth.uid());
-- Apoiadores com só os campos autorizados
create or replace function public.my_supporters() returns table (
  consent_id uuid, user_id uuid, name text, username text, avatar_url text, city text, state text,
  age_range text, interests text[], email text, whatsapp text, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select c.id, c.user_id,
    case when 'nome' = any(c.fields) then p.name end,
    case when 'nome' = any(c.fields) then p.username end,
    case when 'nome' = any(c.fields) then p.avatar_url end,
    case when 'cidade' = any(c.fields) then p.city end,
    case when 'cidade' = any(c.fields) then p.state end,
    case when 'faixaEtaria' = any(c.fields) and p.birth_year is not null then
      case when extract(year from now()) - p.birth_year < 25 then '18-24'
           when extract(year from now()) - p.birth_year < 35 then '25-34'
           when extract(year from now()) - p.birth_year < 45 then '35-44'
           when extract(year from now()) - p.birth_year < 60 then '45-59' else '60+' end end,
    case when 'interesses' = any(c.fields) then c.interests else '{}' end,
    case when 'email' = any(c.fields) then c.email end,
    case when 'whatsapp' = any(c.fields) then c.whatsapp end,
    c.created_at
  from consents c join profiles p on p.id = c.user_id
  where c.politician_id = auth.uid()
  order by c.created_at desc;
$$;

-- ========== BATALHAS ==========
create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null check (length(topic) between 3 and 90),
  status text not null default 'live' check (status in ('scheduled','live','ended')),
  starts_at timestamptz not null default now(),
  duration_sec int not null default 300 check (duration_sec between 60 and 3600),
  score_host int not null default 0,
  score_opponent int not null default 0,
  viewers int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.battle_events (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('chat','support')),
  text text check (length(text) <= 300),
  side text check (side in ('host','opponent')),
  points int check (points in (1,5,20,100)),
  created_at timestamptz not null default now()
);
create index if not exists battle_events_idx on public.battle_events(battle_id, created_at);
alter table public.battles enable row level security;
alter table public.battle_events enable row level security;
create policy "ver batalhas" on public.battles for select to authenticated using (not public.is_blocked_between(host_id, auth.uid()));
create policy "criar batalha" on public.battles for insert to authenticated with check (
  host_id = auth.uid() and opponent_id <> auth.uid() and score_host = 0 and score_opponent = 0
  and public.allows(opponent_id, (select who_can_challenge from profiles where id = opponent_id))
);
-- só quem abriu pode começar/encerrar (o placar só muda pelos gatilhos)
create policy "host muda status" on public.battles for update to authenticated using (host_id = auth.uid());
create policy "ver eventos" on public.battle_events for select to authenticated using (true);
create policy "comentar/apoiar" on public.battle_events for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from battles b where b.id = battle_id and b.status = 'live')
  and (kind = 'chat' or (side is not null and points is not null
       and user_id not in (select host_id from battles where id = battle_id union select opponent_id from battles where id = battle_id)))
);
-- impede o host de mexer no placar pelo update
create or replace function public.trg_battle_guard() returns trigger language plpgsql as $$
begin
  if current_setting('rede.score_update', true) is distinct from 'on' then
    new.score_host := old.score_host; new.score_opponent := old.score_opponent;
    new.host_id := old.host_id; new.opponent_id := old.opponent_id; new.topic := old.topic;
  end if;
  if new.status = 'live' and old.status = 'scheduled' then new.starts_at := now(); end if;
  return new;
end $$;
drop trigger if exists battle_guard on public.battles;
create trigger battle_guard before update on public.battles for each row execute function public.trg_battle_guard();
create or replace function public.trg_battle_support() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'support' then
    perform set_config('rede.score_update', 'on', true);
    update battles set
      score_host = score_host + case when new.side = 'host' then new.points else 0 end,
      score_opponent = score_opponent + case when new.side = 'opponent' then new.points else 0 end
    where id = new.battle_id;
    perform set_config('rede.score_update', 'off', true);
  end if;
  return new;
end $$;
drop trigger if exists battle_support on public.battle_events;
create trigger battle_support after insert on public.battle_events for each row execute function public.trg_battle_support();
-- encerra batalhas vencidas (chamado pelo app)
create or replace function public.end_expired_battles() returns void language sql security definer set search_path = public as $$
  update battles set status = 'ended' where status = 'live' and starts_at + make_interval(secs => duration_sec) < now();
$$;

-- ========== DENÚNCIAS E RELATOS ==========
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','profile','battle','app')),
  target_id text,
  reason text not null check (length(reason) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "denunciar" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "ver minhas denúncias" on public.reports for select to authenticated using (reporter_id = auth.uid());

-- ========== ESTATÍSTICAS AGREGADAS DO PÚBLICO (anônimas) ==========
create or replace function public.audience_stats(pid uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when pid <> auth.uid() or (select account_type from profiles where id = pid) <> 'politico' then null else (
    with f as (select p.* from follows fo join profiles p on p.id = fo.follower_id where fo.following_id = pid)
    select json_build_object(
      'followers', (select count(*) from f),
      'gender', (select coalesce(json_object_agg(g, n), '{}') from (select coalesce(gender,'O') g, count(*) n from f group by 1) x),
      'age', (select coalesce(json_object_agg(r, n), '{}') from (
         select case when birth_year is null then 'n/i'
                     when extract(year from now()) - birth_year < 25 then '18-24'
                     when extract(year from now()) - birth_year < 35 then '25-34'
                     when extract(year from now()) - birth_year < 45 then '35-44'
                     when extract(year from now()) - birth_year < 60 then '45-59' else '60+' end r, count(*) n from f group by 1) x),
      'cities', (select coalesce(json_object_agg(c, n), '{}') from (select coalesce(city,'n/i') c, count(*) n from f group by 1 order by 2 desc limit 8) x),
      'interests', (select coalesce(json_object_agg(i, n), '{}') from (select unnest(interests) i, count(*) n from f group by 1) x)
    )) end;
$$;

-- ========== REALTIME ==========
alter publication supabase_realtime add table public.battles, public.battle_events, public.messages, public.notifications;

-- ========== ARQUIVOS (fotos e vídeos) ==========
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do nothing;
create policy "enviar na minha pasta" on storage.objects for insert to authenticated with check (
  bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "apagar da minha pasta" on storage.objects for delete to authenticated using (
  bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
);
