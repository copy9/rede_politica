-- Nota da live (1 a 5 estrelas), dada por quem assistiu, no fim da live.
-- A média entra no score de quem fez a live e impulsiona as próximas lives dela (aparecem antes para mais gente).

create table if not exists public.battle_ratings (
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);
alter table public.battle_ratings enable row level security;

drop policy if exists "ver notas" on public.battle_ratings;
create policy "ver notas" on public.battle_ratings for select to authenticated using (true);

-- só quem assistiu dá nota (quem fez a live não se avalia)
drop policy if exists "dar nota" on public.battle_ratings;
create policy "dar nota" on public.battle_ratings for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.battles b
    where b.id = battle_id and b.status in ('live', 'ended')
      and b.host_id <> auth.uid() and coalesce(b.opponent_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
  )
);
drop policy if exists "trocar nota" on public.battle_ratings;
create policy "trocar nota" on public.battle_ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- soma e quantidade de notas de cada pessoa que fez live (como anfitrião ou como o outro lado)
create or replace view public.live_rating_totals with (security_invoker = true) as
select p.user_id, sum(r.stars)::int as total, count(*)::int as votes
from public.battle_ratings r
join public.battles b on b.id = r.battle_id
cross join lateral (values (b.host_id), (b.opponent_id)) as p(user_id)
where p.user_id is not null
group by p.user_id;
grant select on public.live_rating_totals to authenticated;
