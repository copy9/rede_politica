-- 1) Notificações de batalha (desafio, lembrete, começou)
alter table public.notifications add column if not exists battle_id uuid references public.battles(id) on delete cascade;

create table if not exists public.battle_reminders (
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);
alter table public.battle_reminders enable row level security;
drop policy if exists "meus lembretes" on public.battle_reminders;
create policy "meus lembretes" on public.battle_reminders for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.trg_battle_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into notifications (to_user_id, from_user_id, type, battle_id, text)
    values (new.opponent_id, new.host_id, 'battle', new.id,
      case when new.status = 'live' then 'te desafiou para uma batalha ao vivo agora: ' || new.topic
           else 'agendou uma batalha com você: ' || new.topic end);
  elsif new.status = 'live' and old.status = 'scheduled' then
    insert into notifications (to_user_id, from_user_id, type, battle_id, text)
    select r.user_id, new.host_id, 'battle', new.id, 'começou a batalha: ' || new.topic
    from battle_reminders r where r.battle_id = new.id and r.user_id <> new.host_id
    union
    select new.opponent_id, new.host_id, 'battle', new.id, 'começou a batalha: ' || new.topic;
  end if;
  return new;
end $$;
drop trigger if exists battle_notify on public.battles;
create trigger battle_notify after insert or update of status on public.battles for each row execute function public.trg_battle_notify();

-- 2) Aparelhos conectados e alerta de login (ficam no banco, valem para todos os aparelhos)
create table if not exists public.devices (
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  name text not null,
  platform text,
  last_active_at timestamptz not null default now(),
  primary key (user_id, device_id)
);
alter table public.devices enable row level security;
drop policy if exists "meus aparelhos" on public.devices;
create policy "meus aparelhos" on public.devices for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.register_login(p_device_id text, p_name text, p_platform text, p_alert boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into devices (user_id, device_id, name, platform, last_active_at)
  values (auth.uid(), left(p_device_id, 80), left(p_name, 80), left(p_platform, 20), now())
  on conflict (user_id, device_id) do update set last_active_at = now(), name = excluded.name;
  if p_alert then
    insert into notifications (to_user_id, from_user_id, type, text)
    values (auth.uid(), auth.uid(), 'security', 'Novo acesso à sua conta: ' || left(p_name, 80) || '. Se não foi você, troque a senha.');
  end if;
end $$;
grant execute on function public.register_login(text, text, text, boolean) to authenticated;

-- 3) Denúncias e pedidos de verificação: tipo "verificacao"
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check check (target_type in ('post','comment','profile','battle','app','verificacao'));
