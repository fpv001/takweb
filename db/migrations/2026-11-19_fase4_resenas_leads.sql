-- Fase 4 (2026-11-19). Ejecutar en Supabase → SQL Editor ANTES o al mismo tiempo que Keko publique.
-- Si el código nuevo se publica antes que esto, nada se rompe: simplemente sigue el bug actual.

begin;

-- 1. Bug: en /tip, cuando el huésped pasa por Google y luego agrega comentario o propina, la reseña
--    no se actualizaba (anon no tiene permiso UPDATE en resenas, y no debe tenerlo).
--    Esta función actualiza SOLO una reseña de ese mismo colaborador, creada hace menos de 30 minutos.
--    El id de la reseña lo genera el navegador del huésped (crypto.randomUUID), nadie más lo conoce.
create or replace function public.actualizar_resena_huesped(
  p_link text,
  p_resena_id uuid,
  p_estrellas smallint default null,
  p_comentario text default null,
  p_publica boolean default null,
  p_propina_id uuid default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_colaborador_id uuid;
  v_n integer;
begin
  select c.id into v_colaborador_id from public.colaboradores c where c.link_unico = p_link and c.activo;
  if v_colaborador_id is null then return false; end if;

  if p_estrellas is not null and p_estrellas not between 1 and 5 then
    raise exception 'estrellas inválidas';
  end if;

  if p_propina_id is not null and not exists (
    select 1 from public.propinas p
    where p.id = p_propina_id and p.colaborador_id = v_colaborador_id and p.created_at > now() - interval '30 minutes'
  ) then
    raise exception 'propina no válida';
  end if;

  update public.resenas r set
    estrellas  = coalesce(p_estrellas, r.estrellas),
    comentario = case when p_comentario is null then r.comentario else nullif(left(trim(p_comentario), 2000), '') end,
    publica    = coalesce(p_publica, r.publica),
    propina_id = coalesce(p_propina_id, r.propina_id)
  where r.id = p_resena_id
    and r.colaborador_id = v_colaborador_id
    and r.created_at > now() - interval '30 minutes';

  get diagnostics v_n = row_count;
  return v_n = 1;
end
$$;
revoke all on function public.actualizar_resena_huesped(text, uuid, smallint, text, boolean, uuid) from public;
grant execute on function public.actualizar_resena_huesped(text, uuid, smallint, text, boolean, uuid) to anon, authenticated;

-- 2. Al borrar un colaborador, el panel intentaba desligar su acceso con un UPDATE a perfiles que
--    RLS bloquea en silencio. Esta función lo hace, solo para el gerente de ese negocio o atlas_admin.
create or replace function public.desligar_perfil_colaborador(p_colaborador_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_hotel uuid;
  v_n integer;
begin
  select c.hotel_id into v_hotel from public.colaboradores c where c.id = p_colaborador_id;
  if v_hotel is null or not public.puede_gestionar_hotel(v_hotel) then
    raise exception 'no autorizado';
  end if;
  update public.perfiles set colaborador_id = null
   where colaborador_id = p_colaborador_id and rol = 'colaborador';
  get diagnostics v_n = row_count;
  return v_n;
end
$$;
revoke all on function public.desligar_perfil_colaborador(uuid) from public;
grant execute on function public.desligar_perfil_colaborador(uuid) to authenticated;

-- 3. Formulario de contacto: límites contra spam (además de los de largo de la fase 3).
--    Máx. 3 mensajes por correo al día y 30 mensajes en total por hora.
create or replace function public.registrar_lead(p_nombre text, p_negocio text, p_tipo text, p_correo text, p_mensaje text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(char_length(trim(p_nombre)), 0) not between 1 and 120
     or coalesce(char_length(trim(p_negocio)), 0) not between 1 and 160
     or coalesce(char_length(trim(p_tipo)), 0) not between 1 and 40
     or coalesce(char_length(trim(p_correo)), 0) not between 3 and 200
     or coalesce(char_length(trim(p_mensaje)), 0) not between 1 and 3000
     or trim(p_correo) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'datos inválidos';
  end if;
  if (select count(*) from public.leads l
      where l.correo = lower(trim(p_correo)) and l.created_at > now() - interval '1 day') >= 3
     or (select count(*) from public.leads l where l.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'demasiados envíos';
  end if;
  insert into public.leads (nombre, negocio, tipo, correo, mensaje)
  values (trim(p_nombre), trim(p_negocio), trim(p_tipo), lower(trim(p_correo)), trim(p_mensaje));
end
$$;
revoke all on function public.registrar_lead(text, text, text, text, text) from public;
grant execute on function public.registrar_lead(text, text, text, text, text) to anon, authenticated;

commit;
