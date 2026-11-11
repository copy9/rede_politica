-- Para conseguir apagar (e listar) os próprios arquivos pelo app, a pessoa precisa "enxergar" a própria pasta.
-- As fotos e vídeos continuam públicos pelo link (o bucket "media" é público).
create policy "ver minha pasta" on storage.objects for select to authenticated using (
  bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
);
