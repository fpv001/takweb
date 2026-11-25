-- Pulseras tak! de los admins: linktree "Conoce tak!" en /k/<codigo>
--
-- El chip NFC guarda una URL fija (https://thanksarekind.com/k/<codigo>) que no se vuelve a grabar.
-- Todo lo que puede cambiar (dueño, video, Place ID) vive aquí:
--   tak_config   -> una sola fila: negocio "tak!" (hotel_id), URL del video, URL de "Conoce tak!"
--   tak_tarjetas -> una fila por pulsera (código permanente + admin al que pertenece)
--   tak_resenas  -> qué pulsera trajo cada reseña (la reseña vive en public.resenas)
--   tak_eventos  -> toques y clics por pulsera (abrir, conoce, resena, video, google)
--
-- tak! es un negocio más (fila en hotels, se crea aquí si no existe). Sus reseñas se guardan en
-- public.resenas con su hotel_id, sin colaborador ni dock, así que se ven en Negocios -> tak! ->
-- Reseñas como las de cualquier establecimiento. El Place ID de Google es el de ese negocio.
--
-- Solo el admin de tak! (atlas_admin activo) lee o edita las tablas.
-- El público (anon) solo entra por las RPC security definer de abajo.
--
-- EJECUTAR EN SUPABASE ANTES de desplegar el código de /k y la pestaña "Mi tak!".

begin;

-- ── Quién es admin de tak! (con acceso activo) ───────────────────────────────
create or replace function public.es_tak_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and p.rol = 'atlas_admin'
  )
$$;

-- ── Tablas ───────────────────────────────────────────────────────────────────
create table if not exists public.tak_config (
  id boolean primary key default true check (id),      -- fuerza una sola fila
  hotel_id uuid references public.hotels(id) on delete set null,   -- el negocio "tak!"
  video_url text,
  conoce_url text not null default '/',
  updated_at timestamptz not null default now()
);
-- Si ya se había corrido la primera versión de este archivo, la tabla existe sin hotel_id:
-- se agrega la columna y se quita google_place_id (ahora el Place ID es el del negocio tak!)
alter table public.tak_config add column if not exists hotel_id uuid references public.hotels(id) on delete set null;
alter table public.tak_config drop column if exists google_place_id;
insert into public.tak_config (id) values (true) on conflict (id) do nothing;

-- Negocio "tak!": se crea una sola vez (sin propinas: solo reseñas) y se liga a la config
do $$
declare v_hotel uuid;
begin
  if (select hotel_id from public.tak_config) is null then
    insert into public.hotels (nombre, modulos) values ('tak!', '{"docks": true, "propinas": false}')
    returning id into v_hotel;
    update public.tak_config set hotel_id = v_hotel;
  end if;
end $$;

create table if not exists public.tak_tarjetas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[a-z0-9]{6,16}$'),
  perfil_id uuid references public.perfiles(id) on delete set null,
  nombre_publico text not null check (char_length(nombre_publico) between 1 and 60),
  foto_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Primera versión de este archivo: tak_resenas guardaba estrellas y comentario aparte.
-- Nada en producción la usaba todavía, así que se reemplaza (cascade quita la vista vieja; se recrea abajo).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'tak_resenas' and column_name = 'estrellas') then
    drop table public.tak_resenas cascade;
  end if;
end $$;

-- La reseña (estrellas, comentario, si pasó a Google) vive en public.resenas; aquí solo la pulsera
create table if not exists public.tak_resenas (
  resena_id uuid primary key references public.resenas(id) on delete cascade,
  tarjeta_id uuid not null references public.tak_tarjetas(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists tak_resenas_tarjeta_idx on public.tak_resenas (tarjeta_id, created_at desc);

create table if not exists public.tak_eventos (
  id bigint generated always as identity primary key,
  tarjeta_id uuid not null references public.tak_tarjetas(id) on delete cascade,
  tipo text not null check (tipo in ('abrir', 'conoce', 'resena', 'video', 'google')),
  created_at timestamptz not null default now()
);
create index if not exists tak_eventos_tarjeta_idx on public.tak_eventos (tarjeta_id, tipo);

-- ── RLS: solo admin de tak! ──────────────────────────────────────────────────
alter table public.tak_config   enable row level security;
alter table public.tak_tarjetas enable row level security;
alter table public.tak_resenas  enable row level security;
alter table public.tak_eventos  enable row level security;

revoke all on public.tak_config, public.tak_tarjetas, public.tak_resenas, public.tak_eventos from anon;

drop policy if exists tak_config_admin on public.tak_config;
create policy tak_config_admin on public.tak_config for all to authenticated
  using (public.es_tak_admin()) with check (public.es_tak_admin());

drop policy if exists tak_tarjetas_admin on public.tak_tarjetas;
create policy tak_tarjetas_admin on public.tak_tarjetas for all to authenticated
  using (public.es_tak_admin()) with check (public.es_tak_admin());

drop policy if exists tak_resenas_admin on public.tak_resenas;
create policy tak_resenas_admin on public.tak_resenas for select to authenticated
  using (public.es_tak_admin());

drop policy if exists tak_eventos_admin on public.tak_eventos;
create policy tak_eventos_admin on public.tak_eventos for select to authenticated
  using (public.es_tak_admin());

-- Números por pulsera (respeta RLS de quien consulta)
create or replace view public.tak_tarjetas_stats with (security_invoker = true) as
  select t.id as tarjeta_id,
    count(e.*) filter (where e.tipo = 'abrir')  as abrir,
    count(e.*) filter (where e.tipo = 'conoce') as conoce,
    count(e.*) filter (where e.tipo = 'resena') as resena,
    count(e.*) filter (where e.tipo = 'video')  as video,
    count(e.*) filter (where e.tipo = 'google') as google,
    (select count(*) from public.tak_resenas tr where tr.tarjeta_id = t.id) as resenas,
    (select round(avg(r.estrellas)::numeric, 1) from public.tak_resenas tr
       join public.resenas r on r.id = tr.resena_id where tr.tarjeta_id = t.id) as promedio
  from public.tak_tarjetas t
  left join public.tak_eventos e on e.tarjeta_id = t.id
  group by t.id;
revoke all on public.tak_tarjetas_stats from anon;

-- ── RPC públicas (anon) ──────────────────────────────────────────────────────
-- Datos de la página /k/<codigo>. Sin fila si la pulsera no existe o está inactiva.
create or replace function public.get_tak_tarjeta_publica(p_codigo text)
returns table (nombre text, foto_url text, google_place_id text, video_url text, conoce_url text)
language sql stable security definer set search_path = '' as $$
  select t.nombre_publico, t.foto_url, h.google_place_id, c.video_url, c.conoce_url
  from public.tak_tarjetas t
  cross join public.tak_config c
  left join public.hotels h on h.id = c.hotel_id
  where t.codigo = p_codigo and t.activo
$$;

create or replace function public.registrar_tak_evento(p_codigo text, p_tipo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_tipo not in ('abrir', 'conoce', 'resena', 'video', 'google') then return; end if;
  select id into v_id from public.tak_tarjetas where codigo = p_codigo and activo;
  if v_id is null then return; end if;
  insert into public.tak_eventos (tarjeta_id, tipo) values (v_id, p_tipo);
end $$;

create or replace function public.registrar_tak_resena(p_codigo text, p_estrellas int, p_comentario text, p_publica boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tarjeta uuid; v_hotel uuid; v_id uuid := gen_random_uuid();
begin
  if p_estrellas is null or p_estrellas not between 1 and 5 then
    raise exception 'estrellas inválidas' using errcode = '22023';
  end if;
  select id into v_tarjeta from public.tak_tarjetas where codigo = p_codigo and activo;
  if v_tarjeta is null then
    raise exception 'pulsera no disponible' using errcode = 'P0002';
  end if;
  select hotel_id into v_hotel from public.tak_config;
  if v_hotel is null then
    raise exception 'falta el negocio tak! en tak_config' using errcode = 'P0002';
  end if;
  -- Reseña normal del negocio tak!: sin colaborador ni dock
  insert into public.resenas (id, estrellas, comentario, publica, hotel_id, punto_id, colaborador_id)
  values (v_id, p_estrellas, nullif(left(btrim(coalesce(p_comentario, '')), 1000), ''), coalesce(p_publica, false), v_hotel, null, null);
  insert into public.tak_resenas (resena_id, tarjeta_id) values (v_id, v_tarjeta);
  return v_id;
end $$;

revoke all on function public.get_tak_tarjeta_publica(text) from public;
revoke all on function public.registrar_tak_evento(text, text) from public;
revoke all on function public.registrar_tak_resena(text, int, text, boolean) from public;
grant execute on function public.get_tak_tarjeta_publica(text) to anon, authenticated;
grant execute on function public.registrar_tak_evento(text, text) to anon, authenticated;
grant execute on function public.registrar_tak_resena(text, int, text, boolean) to anon, authenticated;

commit;

-- ── Verificación ──
--   select c.hotel_id, h.nombre from public.tak_config c left join public.hotels h on h.id = c.hotel_id;  -- debe salir "tak!"
-- Con la llave anon pública:
-- Debe dar permission denied (42501):
--   curl -s -H "apikey: <anon>" -H "Authorization: Bearer <anon>" "https://<proj>.supabase.co/rest/v1/tak_tarjetas?select=*"
-- Con un código activo debe devolver 1 fila (inactivo o inexistente: []):
--   curl -s -X POST -H "apikey: <anon>" -H "Authorization: Bearer <anon>" -H "Content-Type: application/json" \
--     -d '{"p_codigo":"<codigo>"}' "https://<proj>.supabase.co/rest/v1/rpc/get_tak_tarjeta_publica"
