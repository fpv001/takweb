-- Propinas sin pago solo en negocios demo, hasta conectar el sandbox de Conekta.
-- Clientes reales (La Antigua Burgalesa, Cochinita La Bomba) y cualquier negocio nuevo quedan bloqueados.
-- Al conectar Conekta: borrar estas tres políticas; las propinas las crea la Edge Function.

begin;

drop policy if exists "insertar propina" on public.propinas;
drop policy if exists "insertar reparto" on public.repartos;

create or replace function public.es_negocio_demo(p_hotel_id uuid)
returns boolean language sql immutable set search_path = '' as $$
  select p_hotel_id in (
    'a1000000-0000-0000-0000-000000000001',  -- Hotel Camino Real (ejemplo)
    'a1000000-0000-0000-0000-000000000002',  -- Grand Fiesta Americana (ejemplo)
    'a1000000-0000-0000-0000-000000000003',  -- Hotel Presidente (ejemplo)
    'f56a7ba5-21e7-43df-9c12-2d866afc76b8'   -- Hotel Camino Real (demo con cuentas)
  )
$$;

drop policy if exists propinas_demo_insert on public.propinas;
drop policy if exists propinas_demo_select on public.propinas;
drop policy if exists repartos_demo_insert on public.repartos;

create policy propinas_demo_insert on public.propinas for insert to anon, authenticated
  with check (public.es_negocio_demo(hotel_id));
-- Necesaria para que /tip pueda leer la propina recién creada (hoy esa lectura falla para anon).
create policy propinas_demo_select on public.propinas for select to anon
  using (public.es_negocio_demo(hotel_id));
create policy repartos_demo_insert on public.repartos for insert to anon, authenticated
  with check (exists (select 1 from public.propinas p
                      where p.id = propina_id and public.es_negocio_demo(p.hotel_id)));

revoke update, delete on public.propinas, public.repartos from anon;

commit;
