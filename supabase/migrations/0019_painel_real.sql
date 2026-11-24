-- Painel do político com números reais.
-- 1) content_views: cada visualização de publicação, vídeo, story, live e visita ao perfil,
--    e cada compartilhamento. Só o dono do conteúdo lê as próprias linhas.
-- 2) follow_events: guarda quando alguém segue e deixa de seguir (para "Deixaram de seguir").

create table if not exists public.content_views (
  id bigserial primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('post', 'video', 'story', 'battle', 'profile', 'share')),
  ref_id text,
  created_at timestamptz not null default now(),
  check (owner_id <> viewer_id)
);
create index if not exists content_views_owner_time on public.content_views (owner_id, created_at);
alter table public.content_views enable row level security;
drop policy if exists "registrar visualização" on public.content_views;
create policy "registrar visualização" on public.content_views for insert to authenticated with check (viewer_id = auth.uid());
drop policy if exists "dono vê as visualizações" on public.content_views;
create policy "dono vê as visualizações" on public.content_views for select to authenticated using (owner_id = auth.uid());

create table if not exists public.follow_events (
  id bigserial primary key,
  following_id uuid not null references public.profiles(id) on delete cascade,
  follower_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('follow', 'unfollow')),
  created_at timestamptz not null default now()
);
create index if not exists follow_events_following_time on public.follow_events (following_id, created_at);
alter table public.follow_events enable row level security;
drop policy if exists "dono vê seus seguidores" on public.follow_events;
create policy "dono vê seus seguidores" on public.follow_events for select to authenticated using (following_id = auth.uid());

create or replace function public.trg_follow_events() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into follow_events (following_id, follower_id, kind) values (new.following_id, new.follower_id, 'follow');
    return new;
  else
    -- conta apagada: não registra (o perfil já saiu do banco)
    if exists (select 1 from profiles where id = old.follower_id) and exists (select 1 from profiles where id = old.following_id) then
      insert into follow_events (following_id, follower_id, kind) values (old.following_id, old.follower_id, 'unfollow');
    end if;
    return old;
  end if;
end $$;
drop trigger if exists follow_events_log on public.follows;
create trigger follow_events_log after insert or delete on public.follows for each row execute function public.trg_follow_events();
