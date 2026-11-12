-- Menção (@usuario) na legenda de uma publicação também gera notificação
create or replace function public.trg_post_mention() returns trigger language plpgsql security definer set search_path = public as $$
declare u record;
begin
  for u in select p.id, p.who_can_mention from profiles p
           where p.id <> new.user_id
             and p.username = any (array(select lower(m[1]) from regexp_matches(new.caption, '@([a-z0-9._]+)', 'gi') m)) loop
    if public.allows(u.id, u.who_can_mention) then perform public.notify(u.id, 'mention', new.id, new.caption); end if;
  end loop;
  return new;
end $$;
drop trigger if exists post_mention_notify on public.posts;
create trigger post_mention_notify after insert on public.posts for each row execute function public.trg_post_mention();
