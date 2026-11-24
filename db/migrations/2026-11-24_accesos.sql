-- Accesos: desactivar / reactivar cuentas sin borrarlas.
-- Roles (sin cambios): atlas_admin (admin de tak!), hotel_admin (gerente), colaborador.
--
-- Al desactivar un acceso, la Edge Function crear-usuario hace dos cosas:
--   1. Bloquea la cuenta en Supabase Auth (ban): ya no puede iniciar sesión ni renovar su sesión.
--   2. Pone perfiles.activo = false: las reglas de abajo le quitan los permisos de inmediato,
--      sin esperar a que caduque la sesión que ya tenía abierta (hasta 1 hora).
--
-- EJECUTAR EN SUPABASE ANTES de desplegar la nueva versión de la Edge Function crear-usuario.

begin;

-- 1. Estado del acceso
alter table public.perfiles add column if not exists activo boolean not null default true;

-- 2. Gerente y admin de tak!: solo con el acceso activo
create or replace function public.puede_gestionar_hotel(p_hotel_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid())
      and p.activo
      and (p.rol = 'atlas_admin' or (p.rol = 'hotel_admin' and p.hotel_id = p_hotel_id))
  )
$$;

-- 3. Portal del colaborador: solo con el acceso activo
drop policy if exists colaboradores_select_portal on public.colaboradores;
create policy colaboradores_select_portal on public.colaboradores for select to authenticated
  using (
    public.puede_gestionar_hotel(hotel_id)
    or id = (select p.colaborador_id from public.perfiles p where p.id = (select auth.uid()) and p.activo)
  );

drop policy if exists propinas_select_portal on public.propinas;
create policy propinas_select_portal on public.propinas for select to authenticated
  using (
    public.puede_gestionar_hotel(hotel_id)
    or colaborador_id = (select p.colaborador_id from public.perfiles p where p.id = (select auth.uid()) and p.activo)
  );

commit;

-- Verificación
--   select rol, activo, count(*) from public.perfiles group by 1, 2;   -- todos deben salir activo = true
-- Revisa también si hay otras políticas que lean perfiles directamente y no pasen por
-- puede_gestionar_hotel (esas no sabrán del estado activo):
--   select tablename, policyname, qual from pg_policies
--   where schemaname = 'public' and qual ilike '%perfiles%' and qual not ilike '%puede_gestionar_hotel%';
