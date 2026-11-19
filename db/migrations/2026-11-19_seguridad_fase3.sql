-- Seguridad fase 3 (auditoría 2026-11-19, revisión de políticas en vivo).
-- PASO 1: ejecutar ya en Supabase → SQL Editor. No depende de publicar código.
-- PASO 2 (al final, comentado): ejecutar SOLO después de que Keko publique el panel con
--          ColaboradorDashboard usando get_hotel_publico.

-- ═══════════════════════════════ PASO 1 ═══════════════════════════════
begin;

-- 1. Fotos de colaboradores: cualquier usuario con sesión (de cualquier negocio) podía subir
--    o REEMPLAZAR cualquier foto del bucket. Las fotos se guardan como <colaborador_id>.<ext>
--    y esos ids son públicos. Ahora solo el gerente de ese negocio o atlas_admin.
drop policy if exists "subir fotos autenticado" on storage.objects;
drop policy if exists "actualizar fotos autenticado" on storage.objects;
drop policy if exists colaboradores_fotos_insert on storage.objects;
drop policy if exists colaboradores_fotos_update on storage.objects;

create policy colaboradores_fotos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'colaboradores'
    and position('/' in name) = 0
    and exists (select 1 from public.colaboradores c
                where c.id::text = split_part(name, '.', 1)
                  and public.puede_gestionar_hotel(c.hotel_id))
  );
create policy colaboradores_fotos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'colaboradores'
    and exists (select 1 from public.colaboradores c
                where c.id::text = split_part(name, '.', 1)
                  and public.puede_gestionar_hotel(c.hotel_id))
  )
  with check (
    bucket_id = 'colaboradores'
    and position('/' in name) = 0
    and exists (select 1 from public.colaboradores c
                where c.id::text = split_part(name, '.', 1)
                  and public.puede_gestionar_hotel(c.hotel_id))
  );

-- Solo imágenes de hasta 2 MB (igual que valida el panel)
update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'colaboradores';

-- 2. Expediente: un colaborador podía leer teléfono, notas y fecha de ingreso de TODOS sus
--    compañeros. Ahora: atlas_admin y gerente ven su negocio; el colaborador solo su propia ficha.
drop policy if exists "acceso a colaboradores" on public.colaboradores;
drop policy if exists colaboradores_select_portal on public.colaboradores;
create policy colaboradores_select_portal on public.colaboradores for select to authenticated
  using (
    public.puede_gestionar_hotel(hotel_id)
    or id = (select p.colaborador_id from public.perfiles p where p.id = (select auth.uid()))
  );

-- 3. Propinas: un colaborador veía las propinas de todos sus compañeros.
--    Ahora: atlas_admin y gerente ven su negocio; el colaborador solo las suyas.
--    (La política de reseñas "acceso a resenas" depende de esta y se ajusta sola.)
drop policy if exists "acceso a propinas" on public.propinas;
drop policy if exists propinas_select_portal on public.propinas;
create policy propinas_select_portal on public.propinas for select to authenticated
  using (
    public.puede_gestionar_hotel(hotel_id)
    or colaborador_id = (select p.colaborador_id from public.perfiles p where p.id = (select auth.uid()))
  );

-- 4. Reseñas: anon tenía permiso UPDATE y DELETE. Hoy RLS lo bloquea (no hay políticas),
--    pero se quita el permiso para que una política futura no lo abra por accidente.
revoke update, delete on public.resenas from anon;

-- 5. Formulario de contacto: la función se podía llamar directo (sin pasar por /api/lead)
--    con textos de cualquier tamaño. Mismos límites que api/lead.js.
create or replace function public.registrar_lead(p_nombre text, p_negocio text, p_tipo text, p_correo text, p_mensaje text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(char_length(trim(p_nombre)), 0) not between 1 and 120
     or coalesce(char_length(trim(p_negocio)), 0) not between 1 and 160
     or coalesce(char_length(trim(p_tipo)), 0) not between 1 and 40
     or coalesce(char_length(trim(p_correo)), 0) not between 3 and 200
     or coalesce(char_length(trim(p_mensaje)), 0) not between 1 and 3000
     or trim(p_correo) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'datos inválidos';
  end if;
  insert into public.leads (nombre, negocio, tipo, correo, mensaje)
  values (trim(p_nombre), trim(p_negocio), trim(p_tipo), lower(trim(p_correo)), trim(p_mensaje));
end
$$;
revoke all on function public.registrar_lead(text, text, text, text, text) from public;
grant execute on function public.registrar_lead(text, text, text, text, text) to anon, authenticated;

commit;

-- ── Verificación del PASO 1 (solo lectura; debe mostrar las políticas nuevas) ──
-- select tablename, policyname, cmd from pg_policies
--  where policyname in ('colaboradores_fotos_insert','colaboradores_fotos_update',
--                       'colaboradores_select_portal','propinas_select_portal');

-- ── Deshacer el PASO 1 si algo se rompe (vuelve a como estaba) ──
-- begin;
-- drop policy colaboradores_fotos_insert on storage.objects;
-- drop policy colaboradores_fotos_update on storage.objects;
-- create policy "subir fotos autenticado" on storage.objects for insert to public with check ((bucket_id = 'colaboradores') and (auth.role() = 'authenticated'));
-- create policy "actualizar fotos autenticado" on storage.objects for update to public using ((bucket_id = 'colaboradores') and (auth.role() = 'authenticated'));
-- drop policy colaboradores_select_portal on public.colaboradores;
-- create policy "acceso a colaboradores" on public.colaboradores for select to public using ((hotel_id = (select perfiles.hotel_id from perfiles where perfiles.id = auth.uid())) or ((select perfiles.rol from perfiles where perfiles.id = auth.uid()) = 'atlas_admin'));
-- drop policy propinas_select_portal on public.propinas;
-- create policy "acceso a propinas" on public.propinas for select to public using ((hotel_id = (select perfiles.hotel_id from perfiles where perfiles.id = auth.uid())) or ((select perfiles.rol from perfiles where perfiles.id = auth.uid()) = 'atlas_admin'));
-- commit;


-- ═══════════════════════════════ PASO 2 ═══════════════════════════════
-- Ejecutar SOLO después de que Keko publique el panel nuevo (ColaboradorDashboard lee el nombre
-- del negocio con get_hotel_publico). Si se corre antes, el panel de colaborador pierde el nombre.
-- Motivo: un colaborador podía leer toda la fila de su negocio (precio_mensual, stripe_api_key, modulos).
--
-- begin;
-- drop policy if exists "hotel_admin ve su hotel" on public.hotels;
-- drop policy if exists hotels_select_portal on public.hotels;
-- create policy hotels_select_portal on public.hotels for select to authenticated
--   using (public.puede_gestionar_hotel(id));
-- commit;
