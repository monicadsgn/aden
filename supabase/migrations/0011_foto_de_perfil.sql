-- Foto de perfil dos sócios.
-- A foto fica no Storage (bucket "avatares", pasta = org_id) e o endereço em pessoas.foto_url.
-- Leitura pública pelo endereço (para a imagem carregar direto), escrita só de sócio (admin) da org.

alter table pessoas add column if not exists foto_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "avatares: membro ve os da org" on storage.objects for select to authenticated
  using (bucket_id = 'avatares' and public.eh_membro(((storage.foldername(name))[1])::uuid));
create policy "avatares: admin envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and public.eh_admin(((storage.foldername(name))[1])::uuid));
create policy "avatares: admin troca" on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and public.eh_admin(((storage.foldername(name))[1])::uuid));
create policy "avatares: admin apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and public.eh_admin(((storage.foldername(name))[1])::uuid));
