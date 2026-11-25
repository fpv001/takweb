-- Fotos de las pulseras tak! (se suben como archivo desde "Mi tak!", ya no como liga).
-- Requiere 2026-11-24_tak_tarjetas.sql (tabla tak_tarjetas y función es_tak_admin).
--
-- Bucket público de lectura (la foto se ve en /k/<codigo>). Solo el admin de tak! sube.
-- Nombre del archivo: <tarjeta_id>.<marca de tiempo>.webp  (sin carpetas)
-- Cada subida usa un nombre nuevo, así que no hace falta permiso de update.
--
-- Las fotos de colaboradores siguen en el bucket "colaboradores" con sus reglas de
-- 2026-11-19_seguridad_fase3.sql; el panel ahora sube <colaborador_id>.<marca>.webp, que esas
-- reglas ya aceptan (validan lo que va antes del primer punto). No requieren cambios.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tak', 'tak', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists tak_fotos_insert on storage.objects;
drop policy if exists tak_fotos_delete on storage.objects;

create policy tak_fotos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tak'
    and position('/' in name) = 0
    and public.es_tak_admin()
    and exists (select 1 from public.tak_tarjetas t where t.id::text = split_part(name, '.', 1))
  );

create policy tak_fotos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tak' and public.es_tak_admin());

commit;

-- Verificación
--   select id, public, file_size_limit from storage.buckets where id = 'tak';
--   select policyname from pg_policies where schemaname = 'storage' and policyname like 'tak_fotos_%';
