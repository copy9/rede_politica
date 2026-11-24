-- Corrige: apagar uma conta dava erro no registro de "deixou de seguir" (o perfil já tinha saído do banco).
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
