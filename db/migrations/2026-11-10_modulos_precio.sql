-- Módulos activos por negocio, plan y precio mensual (captura manual desde admin).
-- NO ejecutar sin revisar. Las políticas RLS se revisan aparte, junto con sucursales.

-- Negocios existentes conservan propinas (ya las usan); los nuevos toman el default del tipo desde admin.
alter table hotels
  add column if not exists modulos jsonb not null default '{"docks": true, "propinas": true}';

-- Precio mensual en MXN que se le cobra al negocio. Lo captura admin; no hay precio fijo en código.
alter table hotels
  add column if not exists precio_mensual numeric(10, 2);
