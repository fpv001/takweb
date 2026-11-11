-- Sucursales por negocio y docks por sucursal.
-- NO ejecutar sin revisar. Revisar también las políticas RLS existentes de puntos_resena antes de aplicar.

-- 1. Tipo "comercio" pasa a llamarse "tienda"
update hotels set tipo = 'tienda' where tipo = 'comercio';

-- 2. Sucursales: un negocio (hotels) tiene N sucursales
create table if not exists sucursales (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  nombre text not null,
  direccion text,
  google_place_id text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists sucursales_hotel_id_idx on sucursales(hotel_id);

-- 3. Docks cuelgan de una sucursal
alter table puntos_resena
  add column if not exists sucursal_id uuid references sucursales(id) on delete cascade;
create index if not exists puntos_resena_sucursal_id_idx on puntos_resena(sucursal_id);

-- 4. Migrar docks existentes: una sucursal por negocio que ya tenga docks
insert into sucursales (hotel_id, nombre, google_place_id)
select h.id, h.nombre, h.google_place_id
from hotels h
where exists (select 1 from puntos_resena p where p.hotel_id = h.id)
  and not exists (select 1 from sucursales s where s.hotel_id = h.id);

update puntos_resena p
set sucursal_id = s.id
from sucursales s
where s.hotel_id = p.hotel_id
  and p.sucursal_id is null;

-- Pendiente de decidir: cuando todos los docks tengan sucursal_id, hacer NOT NULL.
-- alter table puntos_resena alter column sucursal_id set not null;
