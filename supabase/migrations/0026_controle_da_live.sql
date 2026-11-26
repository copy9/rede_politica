-- Controles do anfitrião na live: silenciar microfone e desligar câmera de quem está participando.
-- Só quem criou a live grava aqui; o celular de cada participante obedece.
create table if not exists public.battle_moderation (
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mic_off boolean not null default false,
  cam_off boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);
alter table public.battle_moderation enable row level security;
drop policy if exists "ver controle da live" on public.battle_moderation;
create policy "ver controle da live" on public.battle_moderation for select to authenticated using (true);
drop policy if exists "anfitriao controla" on public.battle_moderation;
create policy "anfitriao controla" on public.battle_moderation for all to authenticated
  using (exists (select 1 from public.battles b where b.id = battle_id and b.host_id = auth.uid()))
  with check (exists (select 1 from public.battles b where b.id = battle_id and b.host_id = auth.uid()));

-- convidado que estava falando pode sair da live sozinho (antes o "Sair" dele não registrava)
drop policy if exists "convidado sai" on public.battle_guests;
create policy "convidado sai" on public.battle_guests for update to authenticated
  using (user_id = auth.uid() and status = 'accepted')
  with check (user_id = auth.uid() and status = 'declined');

-- tempo real
do $$ begin
  alter publication supabase_realtime add table public.battle_moderation;
exception when others then null; end $$;
