-- El dock toma el Google Place ID de su sucursal; si la sucursal no tiene, usa el del negocio.
-- Antes de aplicar, compara con la definición actual:
--   select pg_get_functiondef('public.get_punto_publico'::regproc);
-- Si la actual filtra algo más (p. ej. negocio activo), agrégalo aquí. Las columnas devueltas no cambian.

create or replace function public.get_punto_publico(p_link text)
returns table (punto_id uuid, punto_nombre text, hotel_id uuid, negocio_nombre text, tipo text, google_place_id text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, h.id, h.nombre, h.tipo,
         coalesce(nullif(trim(s.google_place_id), ''), nullif(trim(h.google_place_id), ''))
  from public.puntos_resena p
  join public.hotels h on h.id = p.hotel_id
  left join public.sucursales s on s.id = p.sucursal_id
  where p.link_unico = p_link and p.activo
$$;
revoke all on function public.get_punto_publico(text) from public;
grant execute on function public.get_punto_publico(text) to anon, authenticated;
