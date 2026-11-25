-- Restaurante Demo tak! (dock /r/restaurante-demo-tak) entra a la lista de negocios demo
-- para que sus propinas de prueba (sin pago) se puedan guardar. Mismo patrón que 2026-11-19_propinas_solo_demo.sql.

create or replace function public.es_negocio_demo(p_hotel_id uuid)
returns boolean language sql immutable set search_path = '' as $$
  select p_hotel_id in (
    'a1000000-0000-0000-0000-000000000001',  -- Hotel Camino Real (ejemplo)
    'a1000000-0000-0000-0000-000000000002',  -- Grand Fiesta Americana (ejemplo)
    'a1000000-0000-0000-0000-000000000003',  -- Hotel Presidente (ejemplo)
    'f56a7ba5-21e7-43df-9c12-2d866afc76b8',  -- Hotel Camino Real (demo con cuentas)
    '6383fcc3-a115-42ab-a03c-50e59f569294'   -- Restaurante Demo tak! (dock con menú y 4 colaboradores)
  )
$$;
