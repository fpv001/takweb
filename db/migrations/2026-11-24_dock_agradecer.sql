-- Dock con "¿A quién quieres agradecer?"
-- Cada dock (puntos_resena) tiene un modo:
--   'resena'    -> solo reseña del lugar (lo de siempre; valor por defecto, ningún dock existente cambia)
--   'agradecer' -> la ventana plegable con el equipo elegido para ese dock
--   'ambos'     -> la ventana con el equipo + "Prefiero calificar el lugar"
-- Los colaboradores que aparecen en cada dock se eligen a mano (dock_colaboradores).
--
-- EJECUTAR EN SUPABASE ANTES de publicar la versión del panel que usa dock_colaboradores.
-- Antes de aplicar, compara get_punto_publico con la definición actual:
--   select pg_get_functiondef('public.get_punto_publico'::regproc);

-- ═══════════ 1. Configuración del dock ═══════════
alter table public.puntos_resena
  add column if not exists modo text not null default 'resena',
  add column if not exists pregunta text;

do $$ begin
  alter table public.puntos_resena
    add constraint puntos_resena_modo_check check (modo in ('resena', 'agradecer', 'ambos'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.puntos_resena
    add constraint puntos_resena_pregunta_len check (pregunta is null or char_length(pregunta) <= 80);
exception when duplicate_object then null; end $$;

-- ═══════════ 2. Colaboradores que aparecen en cada dock ═══════════
create table if not exists public.dock_colaboradores (
  punto_id uuid not null references public.puntos_resena(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (punto_id, colaborador_id)
);
create index if not exists dock_colaboradores_colaborador_idx on public.dock_colaboradores(colaborador_id);

-- El colaborador y el dock tienen que ser del mismo negocio (evita mezclar negocios)
create or replace function public.dock_colaboradores_mismo_negocio()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.puntos_resena p
    join public.colaboradores c on c.hotel_id = p.hotel_id
    where p.id = new.punto_id and c.id = new.colaborador_id
  ) then
    raise exception 'El colaborador y el dock deben ser del mismo negocio' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.dock_colaboradores_mismo_negocio() from public;

drop trigger if exists dock_colaboradores_mismo_negocio on public.dock_colaboradores;
create trigger dock_colaboradores_mismo_negocio
  before insert or update on public.dock_colaboradores
  for each row execute function public.dock_colaboradores_mismo_negocio();

-- RLS: solo el gerente del negocio (o atlas_admin). El huésped usa get_colaboradores_dock.
alter table public.dock_colaboradores enable row level security;
revoke all on public.dock_colaboradores from anon;

-- Negocio del dock, para las políticas (security definer: no depende del RLS de puntos_resena)
create or replace function public.hotel_de_punto(p_punto_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select hotel_id from public.puntos_resena where id = p_punto_id
$$;
revoke all on function public.hotel_de_punto(uuid) from public;
grant execute on function public.hotel_de_punto(uuid) to authenticated;

drop policy if exists dock_colaboradores_select on public.dock_colaboradores;
drop policy if exists dock_colaboradores_insert on public.dock_colaboradores;
drop policy if exists dock_colaboradores_update on public.dock_colaboradores;
drop policy if exists dock_colaboradores_delete on public.dock_colaboradores;
create policy dock_colaboradores_select on public.dock_colaboradores for select to authenticated
  using (public.puede_gestionar_hotel(public.hotel_de_punto(punto_id)));
create policy dock_colaboradores_insert on public.dock_colaboradores for insert to authenticated
  with check (public.puede_gestionar_hotel(public.hotel_de_punto(punto_id)));
create policy dock_colaboradores_update on public.dock_colaboradores for update to authenticated
  using (public.puede_gestionar_hotel(public.hotel_de_punto(punto_id)))
  with check (public.puede_gestionar_hotel(public.hotel_de_punto(punto_id)));
create policy dock_colaboradores_delete on public.dock_colaboradores for delete to authenticated
  using (public.puede_gestionar_hotel(public.hotel_de_punto(punto_id)));

-- ═══════════ 3. Dock público: ahora también devuelve modo y pregunta ═══════════
-- Cambia el tipo de retorno, por eso drop + create.
drop function if exists public.get_punto_publico(text);
create function public.get_punto_publico(p_link text)
returns table (punto_id uuid, punto_nombre text, hotel_id uuid, negocio_nombre text, tipo text, google_place_id text, modo text, pregunta text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, h.id, h.nombre, h.tipo,
         coalesce(nullif(trim(s.google_place_id), ''), nullif(trim(h.google_place_id), '')),
         p.modo, nullif(trim(p.pregunta), '')
  from public.puntos_resena p
  join public.hotels h on h.id = p.hotel_id
  left join public.sucursales s on s.id = p.sucursal_id
  where p.link_unico = p_link and p.activo
$$;
revoke all on function public.get_punto_publico(text) from public;
grant execute on function public.get_punto_publico(text) to anon, authenticated;

-- ═══════════ 4. Equipo público de un dock ═══════════
-- Solo colaboradores ACTIVOS asignados a un dock ACTIVO con modo agradecer/ambos.
-- Sin teléfono, notas ni ids internos. link_unico es la misma liga pública de la pulsera;
-- solo se obtiene teniendo la liga del dock (no permite enumerar otros negocios).
create or replace function public.get_colaboradores_dock(p_link text)
returns table (nombre text, puesto text, foto_url text, link_unico text)
language sql stable security definer set search_path = '' as $$
  select c.nombre, c.puesto, c.foto_url, c.link_unico
  from public.puntos_resena p
  join public.dock_colaboradores dc on dc.punto_id = p.id
  join public.colaboradores c on c.id = dc.colaborador_id and c.hotel_id = p.hotel_id
  where p.link_unico = p_link and p.activo and p.modo in ('agradecer', 'ambos') and c.activo
  order by dc.orden, c.nombre
  limit 60
$$;
revoke all on function public.get_colaboradores_dock(text) from public;
grant execute on function public.get_colaboradores_dock(text) to anon, authenticated;

-- ═══════════ 5. Verificación ═══════════
-- a) La política de insert de reseñas del huésped (resenas_insert_huesped) debe permitir
--    punto_id y colaborador_id juntos. Revisa su condición:
--      select polname, pg_get_expr(polwithcheck, polrelid) from pg_policy
--      where polrelid = 'public.resenas'::regclass;
--    Si exige "punto_id is null" cuando hay colaborador_id, hay que ajustarla.
-- b) Con la llave anon, debe dar permission denied:
--      select * from public.dock_colaboradores;
-- c) Con la llave anon, debe devolver el equipo del dock:
--      select * from public.get_colaboradores_dock('<liga-del-dock>');
