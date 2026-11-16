-- Platillos por restaurante y calificación por platillo desde el dock NFC.
-- NO ejecutar sin revisar. Aplicar antes de publicar la versión del panel que los usa.

-- 1. Menú: platillos con foto. sucursal_id nulo = disponible en todas las sucursales.
create table if not exists platillos (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 80),
  descripcion text check (char_length(descripcion) <= 200),
  foto_path text,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists platillos_hotel_id_idx on platillos(hotel_id);
create index if not exists platillos_sucursal_id_idx on platillos(sucursal_id);

-- 2. Calificación de cada platillo dentro de una reseña de dock.
-- restrict: un platillo con calificaciones no se borra, se oculta (activo = false).
create table if not exists calificaciones_platillo (
  id uuid primary key default gen_random_uuid(),
  resena_id uuid not null references resenas(id) on delete cascade,
  platillo_id uuid not null references platillos(id) on delete restrict,
  hotel_id uuid not null references hotels(id) on delete cascade,
  estrellas smallint not null check (estrellas between 1 and 5),
  comentario text check (char_length(comentario) <= 500),
  created_at timestamptz not null default now(),
  unique (resena_id, platillo_id)
);
create index if not exists calificaciones_platillo_hotel_id_idx on calificaciones_platillo(hotel_id);
create index if not exists calificaciones_platillo_platillo_id_idx on calificaciones_platillo(platillo_id);

-- 3. RLS: solo el gerente del negocio (o atlas_admin) lee y administra. El huésped usa las funciones de abajo.
alter table platillos enable row level security;
alter table calificaciones_platillo enable row level security;

create or replace function public.puede_gestionar_hotel(p_hotel_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid())
      and (p.rol = 'atlas_admin' or (p.rol = 'hotel_admin' and p.hotel_id = p_hotel_id))
  )
$$;

drop policy if exists platillos_select on platillos;
drop policy if exists platillos_insert on platillos;
drop policy if exists platillos_update on platillos;
drop policy if exists platillos_delete on platillos;
create policy platillos_select on platillos for select to authenticated using (public.puede_gestionar_hotel(hotel_id));
create policy platillos_insert on platillos for insert to authenticated with check (public.puede_gestionar_hotel(hotel_id));
create policy platillos_update on platillos for update to authenticated using (public.puede_gestionar_hotel(hotel_id)) with check (public.puede_gestionar_hotel(hotel_id));
create policy platillos_delete on platillos for delete to authenticated using (public.puede_gestionar_hotel(hotel_id));

drop policy if exists calificaciones_platillo_select on calificaciones_platillo;
create policy calificaciones_platillo_select on calificaciones_platillo for select to authenticated using (public.puede_gestionar_hotel(hotel_id));
-- Sin políticas de insert/update/delete: el historial de calificaciones no se edita desde el cliente.

-- 4. Menú público de un dock: solo platillos activos del negocio y de su sucursal (o de todas).
create or replace function public.get_platillos_publicos(p_link text)
returns table (id uuid, nombre text, descripcion text, foto_path text)
language sql stable security definer set search_path = '' as $$
  select pl.id, pl.nombre, pl.descripcion, pl.foto_path
  from public.puntos_resena pr
  join public.platillos pl on pl.hotel_id = pr.hotel_id
  where pr.link_unico = p_link and pr.activo
    and pl.activo
    and (pl.sucursal_id is null or pl.sucursal_id = pr.sucursal_id)
  order by pl.orden, pl.nombre
  limit 60
$$;
revoke all on function public.get_platillos_publicos(text) from public;
grant execute on function public.get_platillos_publicos(text) to anon, authenticated;

-- 5. Guarda las calificaciones de platillos de una reseña recién creada en ese mismo dock.
-- Valida: dock activo, reseña del dock con menos de 30 min, platillos del negocio, máx. 20, una sola vez.
create or replace function public.calificar_platillos(p_link text, p_resena_id uuid, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_punto public.puntos_resena%rowtype;
  v_n integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 20 then
    raise exception 'items inválidos';
  end if;

  select * into v_punto from public.puntos_resena where link_unico = p_link and activo;
  if not found then raise exception 'dock no disponible'; end if;

  if not exists (
    select 1 from public.resenas r
    where r.id = p_resena_id and r.punto_id = v_punto.id and r.created_at > now() - interval '30 minutes'
  ) then raise exception 'reseña no válida'; end if;

  if exists (select 1 from public.calificaciones_platillo c where c.resena_id = p_resena_id) then
    return 0;
  end if;

  insert into public.calificaciones_platillo (resena_id, platillo_id, hotel_id, estrellas, comentario)
  select p_resena_id, pl.id, v_punto.hotel_id, (i->>'estrellas')::smallint,
         nullif(left(trim(coalesce(i->>'comentario', '')), 500), '')
  from jsonb_array_elements(p_items) i
  join public.platillos pl on pl.id = (i->>'platillo_id')::uuid
  where pl.hotel_id = v_punto.hotel_id and pl.activo
    and (pl.sucursal_id is null or pl.sucursal_id = v_punto.sucursal_id)
  on conflict (resena_id, platillo_id) do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end
$$;
revoke all on function public.calificar_platillos(text, uuid, jsonb) from public;
grant execute on function public.calificar_platillos(text, uuid, jsonb) to anon, authenticated;

-- 6. Fotos: bucket público de lectura; solo el gerente escribe dentro de la carpeta <hotel_id>/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('platillos', 'platillos', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists platillos_fotos_insert on storage.objects;
drop policy if exists platillos_fotos_update on storage.objects;
drop policy if exists platillos_fotos_delete on storage.objects;
create policy platillos_fotos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'platillos' and public.puede_gestionar_hotel(((storage.foldername(name))[1])::uuid));
create policy platillos_fotos_update on storage.objects for update to authenticated
  using (bucket_id = 'platillos' and public.puede_gestionar_hotel(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'platillos' and public.puede_gestionar_hotel(((storage.foldername(name))[1])::uuid));
create policy platillos_fotos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'platillos' and public.puede_gestionar_hotel(((storage.foldername(name))[1])::uuid));
