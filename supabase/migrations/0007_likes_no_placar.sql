-- Curtidas contam para o lado escolhido pela plateia: a barra de placar anda com curtidas + presentes.
-- A curtida passa a levar o lado (host/opponent) e soma 1 ponto por toque nesse lado.

-- quem pode enviar: curtida pode ir com lado (ou sem lado, só para o total)
drop policy if exists "comentar/apoiar" on public.battle_events;
create policy "comentar/apoiar" on public.battle_events for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from battles b where b.id = battle_id and b.status = 'live')
  and (
    kind = 'chat'
    or (kind = 'like' and amount is not null and points is null and (side is null or side in ('host','opponent')))
    or (kind = 'support' and side is not null and points is not null
        and user_id not in (select host_id from battles where id = battle_id union select opponent_id from battles where id = battle_id))
  )
);

-- o gatilho soma presentes (points) e curtidas (amount) no lado indicado
create or replace function public.trg_battle_support() returns trigger language plpgsql security definer set search_path = public as $$
declare add_pts int := 0;
begin
  if new.kind in ('support', 'like') then
    add_pts := case when new.kind = 'support' then coalesce(new.points, 0) else coalesce(new.amount, 0) end;
    perform set_config('rede.score_update', 'on', true);
    update battles set
      score_host = score_host + case when new.side = 'host' then add_pts else 0 end,
      score_opponent = score_opponent + case when new.side = 'opponent' then add_pts else 0 end,
      likes = likes + case when new.kind = 'like' then coalesce(new.amount, 0) else 0 end
    where id = new.battle_id;
    perform set_config('rede.score_update', 'off', true);
  end if;
  return new;
end $$;
