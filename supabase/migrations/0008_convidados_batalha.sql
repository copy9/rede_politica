-- Batalha com mais de duas pessoas: convidados pedem para entrar e quem criou a batalha aceita.
-- Quem é aceito transmite câmera e microfone como os dois lados da batalha.

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

-- qualquer pessoa logada pede para entrar numa batalha ao vivo
drop policy if exists "pedir para entrar" on public.battle_guests;
create policy "pedir para entrar" on public.battle_guests for insert to authenticated with check (
  user_id = auth.uid() and status = 'pending'
  and exists (select 1 from battles b where b.id = battle_id and b.status = 'live')
);

-- quem foi recusado pode pedir de novo
drop policy if exists "pedir de novo" on public.battle_guests;
create policy "pedir de novo" on public.battle_guests for update to authenticated
  using (user_id = auth.uid() and status = 'declined')
  with check (user_id = auth.uid() and status = 'pending');

-- só quem criou a batalha aceita ou recusa
drop policy if exists "host responde" on public.battle_guests;
create policy "host responde" on public.battle_guests for update to authenticated
  using (exists (select 1 from battles b where b.id = battle_id and b.host_id = auth.uid()))
  with check (status in ('pending', 'accepted', 'declined'));

-- atualização em tempo real da lista de convidados
do $$ begin
  alter publication supabase_realtime add table public.battle_guests;
exception when duplicate_object then null;
end $$;
