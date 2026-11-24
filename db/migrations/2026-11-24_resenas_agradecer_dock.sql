-- Agradecimientos desde un dock: la reseña trae colaborador_id Y punto_id.
-- La política resenas_insert_huesped solo aceptaba uno u otro, así que Supabase rechazaba
-- estas reseñas. Se agrega un tercer caso, sin tocar los dos que ya existían.
-- Requiere 2026-11-24_dock_agradecer.sql (tabla dock_colaboradores y columna modo).

-- Valida el tercer caso. Es security definer porque el huésped (anon) no puede leer
-- puntos_resena ni dock_colaboradores.
-- Solo acepta: dock activo del mismo negocio, en modo agradecer/ambos, y un colaborador
-- activo de ese negocio que esté asignado a ese dock.
create or replace function public.agradecimiento_dock_valido(p_punto_id uuid, p_colaborador_id uuid, p_hotel_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.puntos_resena p
    join public.dock_colaboradores dc on dc.punto_id = p.id
    join public.colaboradores c on c.id = dc.colaborador_id
    where p.id = p_punto_id
      and p.hotel_id = p_hotel_id
      and p.activo
      and p.modo in ('agradecer', 'ambos')
      and c.id = p_colaborador_id
      and c.hotel_id = p_hotel_id
      and c.activo
  )
$$;
revoke all on function public.agradecimiento_dock_valido(uuid, uuid, uuid) from public;
grant execute on function public.agradecimiento_dock_valido(uuid, uuid, uuid) to anon, authenticated;

-- alter policy conserva el comando y los roles actuales de la política; solo cambia la condición.
-- Los dos primeros casos son la condición actual, copiada tal cual.
alter policy resenas_insert_huesped on public.resenas
  with check (
    (
      (colaborador_id is not null) and (punto_id is null) and exists (
        select 1 from public.colaboradores c
        where c.id = resenas.colaborador_id and c.hotel_id = resenas.hotel_id and c.activo
      )
    )
    or (
      (colaborador_id is null) and (punto_id is not null) and public.punto_resena_valido(punto_id, hotel_id)
    )
    or (
      -- Nuevo: agradecimiento a un colaborador desde un dock
      (colaborador_id is not null) and (punto_id is not null)
      and public.agradecimiento_dock_valido(punto_id, colaborador_id, hotel_id)
    )
  );

-- Verificación: la condición debe mostrar los tres casos.
--   select pg_get_expr(polwithcheck, polrelid) from pg_policy
--   where polrelid = 'public.resenas'::regclass and polname = 'resenas_insert_huesped';
