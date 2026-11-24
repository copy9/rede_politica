-- Sair da live sem derrubar quem fica:
-- * o outro lado sai  -> a live continua só com o anfitrião (tela cheia)
-- * o anfitrião sai e tem o outro lado -> o outro lado vira o anfitrião e a live continua com ele
-- * o anfitrião sai e está sozinho -> a live termina
-- * convidado sai -> só ele sai
drop function if exists public.leave_battle(uuid);
create or replace function public.leave_battle(p_battle uuid) returns text
language plpgsql security definer set search_path = public as $$
declare b battles%rowtype;
begin
  select * into b from battles where id = p_battle for update;
  if not found then return 'nao_encontrada'; end if;

  update battle_guests set status = 'declined' where battle_id = p_battle and user_id = auth.uid();

  if b.status <> 'live' then
    -- desafio ainda não começou: quem sai cancela
    if b.host_id = auth.uid() or b.opponent_id = auth.uid() then
      update battles set status = 'ended' where id = p_battle;
      return 'encerrada';
    end if;
    return 'saiu';
  end if;

  if b.opponent_id = auth.uid() then
    update battles set opponent_id = null, score_opponent = 0 where id = p_battle;
    return 'continua';
  end if;

  if b.host_id = auth.uid() then
    if b.opponent_id is not null then
      update battles set host_id = b.opponent_id, opponent_id = null, score_host = b.score_opponent, score_opponent = 0
       where id = p_battle;
      return 'continua';
    end if;
    update battles set status = 'ended' where id = p_battle;
    return 'encerrada';
  end if;

  return 'saiu';
end $$;
grant execute on function public.leave_battle(uuid) to authenticated;

-- Chamar alguém para a live (ex.: o outro lado saiu e quero chamar um amigo).
-- Só quem está com a live (anfitrião) chama. Se a pessoa já tinha pedido/recusado antes, o convite é refeito.
create or replace function public.invite_to_live(p_battle uuid, p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from battles where id = p_battle and host_id = auth.uid() and status in ('live', 'scheduled', 'invited')) then
    raise exception 'Só quem está com a live pode chamar alguém';
  end if;
  if p_user = auth.uid() then raise exception 'Você já está na live'; end if;
  if exists (select 1 from battle_guests where battle_id = p_battle and user_id = p_user and status = 'accepted') then
    return 'ja_esta';
  end if;
  -- apaga o pedido antigo e cria o convite (o aviso chega para a pessoa)
  delete from battle_guests where battle_id = p_battle and user_id = p_user;
  insert into battle_guests (battle_id, user_id, status) values (p_battle, p_user, 'convidado');
  return 'convidado';
end $$;
grant execute on function public.invite_to_live(uuid, uuid) to authenticated;
