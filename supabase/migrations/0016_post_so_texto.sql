-- Publicação só com texto (sem foto nem vídeo).
alter table public.posts drop constraint if exists posts_type_check;
alter table public.posts add constraint posts_type_check check (type in ('image', 'video', 'text'));
alter table public.posts alter column media_url drop not null;
alter table public.posts drop constraint if exists posts_text_has_caption;
alter table public.posts add constraint posts_text_has_caption check (type <> 'text' or length(trim(caption)) > 0);
notify pgrst, 'reload schema';
