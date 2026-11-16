-- Canal dos apoiadores: o perfil publica, os apoiadores só reagem com emoji (não respondem).
create or replace function public.is_supporter_of(pol uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from consents where user_id = auth.uid() and politician_id = pol)
$$;

create table if not exists public.supporter_posts (
  id uuid primary key default gen_random_uuid(),
  politician_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists supporter_posts_pol_idx on public.supporter_posts(politician_id, created_at desc);
alter table public.supporter_posts enable row level security;
drop policy if exists "ver canal" on public.supporter_posts;
create policy "ver canal" on public.supporter_posts for select to authenticated
  using (politician_id = auth.uid() or public.is_supporter_of(politician_id));
drop policy if exists "publicar no meu canal" on public.supporter_posts;
create policy "publicar no meu canal" on public.supporter_posts for insert to authenticated with check (politician_id = auth.uid());
drop policy if exists "apagar do meu canal" on public.supporter_posts;
create policy "apagar do meu canal" on public.supporter_posts for delete to authenticated using (politician_id = auth.uid());

create table if not exists public.supporter_reactions (
  post_id uuid not null references public.supporter_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '👏', '🔥', '😮', '😢')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.supporter_reactions enable row level security;
create or replace function public.can_see_supporter_post(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from supporter_posts p where p.id = pid and (p.politician_id = auth.uid() or public.is_supporter_of(p.politician_id)))
$$;
create or replace function public.is_supporter_post_of_my_politician(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from supporter_posts p where p.id = pid and public.is_supporter_of(p.politician_id))
$$;
drop policy if exists "ver reações" on public.supporter_reactions;
create policy "ver reações" on public.supporter_reactions for select to authenticated using (public.can_see_supporter_post(post_id));
drop policy if exists "reagir" on public.supporter_reactions;
create policy "reagir" on public.supporter_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_supporter_post_of_my_politician(post_id));
drop policy if exists "trocar reação" on public.supporter_reactions;
create policy "trocar reação" on public.supporter_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "tirar reação" on public.supporter_reactions;
create policy "tirar reação" on public.supporter_reactions for delete to authenticated using (user_id = auth.uid());

-- aviso para os apoiadores a cada publicação nova no canal
create or replace function public.trg_supporter_post_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (to_user_id, from_user_id, type, text)
  select c.user_id, new.politician_id, 'mention', 'publicou no canal de apoiadores: ' || left(new.text, 80)
  from consents c where c.politician_id = new.politician_id and c.user_id <> new.politician_id;
  return new;
exception when others then return new;
end $$;
drop trigger if exists supporter_post_notify on public.supporter_posts;
create trigger supporter_post_notify after insert on public.supporter_posts for each row execute function public.trg_supporter_post_notify();

do $$ begin
  alter publication supabase_realtime add table public.supporter_posts, public.supporter_reactions;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
