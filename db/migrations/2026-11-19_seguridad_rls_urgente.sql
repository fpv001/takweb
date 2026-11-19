-- Correcciones urgentes de RLS (auditoría de seguridad 2026-11-19).
-- Se puede ejecutar sin publicar código nuevo. La fase 2 del punto 4 y el punto 7 van comentados:
-- se activan después de publicar TipPage.tsx y de confirmar el flujo de propinas.

begin;

-- 1. CRÍTICO: perfiles tenía una política ALL para {public} con true/true. Cualquiera (incluso anon)
--    podía leer, crear, editar y borrar perfiles, y ponerse rol = 'atlas_admin'.
--    service_role no necesita política: se salta RLS. Queda solo "acceso a perfiles" (leer el propio).
drop policy if exists "service_role gestiona perfiles" on public.perfiles;
alter table public.perfiles enable row level security;

-- 2. sucursales y dispositivos_nfc no tienen ninguna política. Si RLS está apagado, anon puede
--    borrar sucursales (y en cascada docks y platillos).
alter table public.sucursales enable row level security;
drop policy if exists sucursales_select on public.sucursales;
drop policy if exists sucursales_insert on public.sucursales;
drop policy if exists sucursales_update on public.sucursales;
drop policy if exists sucursales_delete on public.sucursales;
create policy sucursales_select on public.sucursales for select to authenticated using (public.puede_gestionar_hotel(hotel_id));
create policy sucursales_insert on public.sucursales for insert to authenticated with check (public.puede_gestionar_hotel(hotel_id));
create policy sucursales_update on public.sucursales for update to authenticated using (public.puede_gestionar_hotel(hotel_id)) with check (public.puede_gestionar_hotel(hotel_id));
create policy sucursales_delete on public.sucursales for delete to authenticated using (public.puede_gestionar_hotel(hotel_id));

-- Sin uso desde el cliente: solo service_role.
alter table public.dispositivos_nfc enable row level security;

-- 3. resenas: "insertar resena" (true) anulaba la validación de resenas_insert_huesped
--    (las políticas permisivas se combinan con OR).
drop policy if exists "insertar resena" on public.resenas;

-- 4. colaboradores: "perfil publico colaborador" exponía a anon y a cualquier usuario de cualquier
--    negocio todos los colaboradores activos con teléfono y notas.
--    Fase 1 (ya): solo anon la usa; los usuarios con sesión ya no ven colaboradores de otros negocios.
alter policy "perfil publico colaborador" on public.colaboradores to anon;
revoke insert, update, delete on public.colaboradores from anon;
--    Fase 2: ejecutar SOLO después de publicar TipPage.tsx con columnas explícitas.
--    Antes de eso rompe /tip/:id en producción. Quita teléfono y notas a anon.
-- revoke select on public.colaboradores from anon;
-- grant select (id, nombre, puesto, foto_url, hotel_id, link_unico, activo) on public.colaboradores to anon;

-- 5. equipos / equipo_miembros: la política ALL dejaba a un colaborador crear, editar y borrar
--    equipos de su negocio. Lectura igual que antes; escritura solo gerente o atlas_admin.
drop policy if exists "acceso a equipos" on public.equipos;
create policy equipos_select on public.equipos for select to authenticated
  using (hotel_id = (select p.hotel_id from public.perfiles p where p.id = (select auth.uid()))
         or public.puede_gestionar_hotel(hotel_id));
create policy equipos_write on public.equipos for all to authenticated
  using (public.puede_gestionar_hotel(hotel_id)) with check (public.puede_gestionar_hotel(hotel_id));

drop policy if exists "acceso a equipo_miembros" on public.equipo_miembros;
create policy equipo_miembros_select on public.equipo_miembros for select to authenticated
  using (exists (select 1 from public.equipos e where e.id = equipo_id
                 and (e.hotel_id = (select p.hotel_id from public.perfiles p where p.id = (select auth.uid()))
                      or public.puede_gestionar_hotel(e.hotel_id))));
create policy equipo_miembros_write on public.equipo_miembros for all to authenticated
  using (exists (select 1 from public.equipos e where e.id = equipo_id and public.puede_gestionar_hotel(e.hotel_id)))
  with check (exists (select 1 from public.equipos e where e.id = equipo_id and public.puede_gestionar_hotel(e.hotel_id)));

-- 6. Permisos que la app no usa. TRUNCATE además se salta RLS.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on public.perfiles, public.hotels, public.leads, public.equipos, public.equipo_miembros,
              public.sucursales, public.puntos_resena, public.platillos, public.calificaciones_platillo,
              public.dispositivos, public.dispositivos_nfc
  from anon;

-- 7. Propinas falsas: "insertar propina" y "insertar reparto" aceptan cualquier fila de cualquiera.
--    Descomentar cuando confirmes que hoy no se cobran propinas reales desde /tip (ver notas):
-- drop policy if exists "insertar propina" on public.propinas;
-- drop policy if exists "insertar reparto" on public.repartos;
-- revoke insert, update, delete on public.propinas, public.repartos from anon;

commit;
