-- Lista de espera (2026-11-27): personas que quieren enterarse del lanzamiento oficial de tak!.
-- La landing la llena desde /api/espera. Se ve en el panel de admin → Interesados → Lista de espera.
--
-- EJECUTAR EN SUPABASE → SQL Editor ANTES (o al mismo tiempo) de que Keko publique.
-- Si el código se publica antes, el formulario de la lista de espera mostrará error hasta correr esto.

begin;

-- Mismo helper que 2026-11-24_tak_tarjetas.sql (se repite por si ese archivo no se corrió).
create or replace function public.es_tak_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and p.rol = 'atlas_admin'
  )
$$;

create table if not exists public.lista_espera (
  id uuid primary key default gen_random_uuid(),
  correo text not null unique check (char_length(correo) between 3 and 200),
  nombre text check (nombre is null or char_length(nombre) <= 120),
  perfil text not null default 'negocio' check (perfil in ('negocio', 'equipo', 'cliente', 'otro')),
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  interes text check (interes is null or char_length(interes) <= 60),   -- p. ej. plan Business
  avisado_at timestamptz,                                                -- cuándo se le mandó el aviso de lanzamiento
  created_at timestamptz not null default now()
);
create index if not exists lista_espera_created_at_idx on public.lista_espera (created_at desc);

-- Solo el admin de tak! lee, marca o borra. El público entra solo por la función de abajo.
alter table public.lista_espera enable row level security;
revoke all on public.lista_espera from anon, authenticated;
grant select, update, delete on public.lista_espera to authenticated;

drop policy if exists lista_espera_admin_select on public.lista_espera;
create policy lista_espera_admin_select on public.lista_espera for select to authenticated using (public.es_tak_admin());
drop policy if exists lista_espera_admin_update on public.lista_espera;
create policy lista_espera_admin_update on public.lista_espera for update to authenticated using (public.es_tak_admin()) with check (public.es_tak_admin());
drop policy if exists lista_espera_admin_delete on public.lista_espera;
create policy lista_espera_admin_delete on public.lista_espera for delete to authenticated using (public.es_tak_admin());

-- Registro público. Devuelve true si el correo es nuevo (para mandar el correo de bienvenida una sola vez)
-- y false si ya estaba. Límite contra spam: 60 registros nuevos por hora en total.
create or replace function public.registrar_espera(
  p_correo text,
  p_nombre text default null,
  p_perfil text default 'negocio',
  p_idioma text default 'es',
  p_interes text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_correo text := lower(trim(coalesce(p_correo, '')));
  v_n integer;
begin
  if char_length(v_correo) not between 3 and 200
     or v_correo !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
     or char_length(coalesce(p_nombre, '')) > 120
     or char_length(coalesce(p_interes, '')) > 60
     or coalesce(p_perfil, '') not in ('negocio', 'equipo', 'cliente', 'otro')
     or coalesce(p_idioma, '') not in ('es', 'en') then
    raise exception 'datos inválidos';
  end if;
  if (select count(*) from public.lista_espera l where l.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'demasiados envíos';
  end if;
  insert into public.lista_espera (correo, nombre, perfil, idioma, interes)
  values (v_correo, nullif(trim(p_nombre), ''), p_perfil, p_idioma, nullif(trim(p_interes), ''))
  on conflict (correo) do nothing;
  get diagnostics v_n = row_count;
  return v_n = 1;
end
$$;
revoke all on function public.registrar_espera(text, text, text, text, text) from public;
grant execute on function public.registrar_espera(text, text, text, text, text) to anon, authenticated;

commit;

-- Verificación (solo lectura):
-- select count(*), idioma from public.lista_espera group by idioma;
