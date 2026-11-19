-- Hallazgo pentest 2026-11-19 (prueba en vivo con la llave anon):
-- Un usuario ANÓNIMO podía enumerar TODO el directorio de colaboradores de TODOS los negocios
-- (id, nombre, puesto, hotel_id y link_unico), incluidos clientes reales, sin filtrar por liga.
-- Alcance observado: 21 colaboradores de 5 hoteles (3 demo "ejemplo", 1 demo con cuentas y
-- 1 cliente real 3a54f96e-...). Riesgo: fuga cross-tenant del personal + cosecha de todas las
-- ligas /tip (habilita reseñas/calificaciones falsas y, con dinero real, dirigir propinas).
-- OWASP A01 Broken Access Control / API3 Broken Object Property Level Authorization.
-- Causa: la política anon "perfil publico colaborador" hace SELECT sin filtrar por link_unico.
-- Arreglo: RPC security definer que devuelve SOLO el colaborador de esa liga (mismo patrón que
-- get_punto_publico / get_hotel_publico) y se le quita a anon el SELECT directo sobre la tabla.

-- ═══════════════════════════ PASO 1 (aditivo: ejecutar ya; no rompe nada) ═══════════════════════════
-- Crea la RPC. Mientras el código viejo siga leyendo la tabla, ambos caminos conviven.
create or replace function public.get_colaborador_publico(p_link text)
returns table (id uuid, nombre text, puesto text, foto_url text, hotel_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nombre, c.puesto, c.foto_url, c.hotel_id
  from public.colaboradores c
  where c.link_unico = p_link and c.activo
$$;
revoke all on function public.get_colaborador_publico(text) from public;
grant execute on function public.get_colaborador_publico(text) to anon, authenticated;

-- ═══════════════════════════ PASO 2 (ejecutar SOLO DESPUÉS de publicar el código) ═══════════════════
-- Requiere que ya estén en producción TipPage.tsx y api/_colaborador.js usando
-- get_colaborador_publico. Si se corre antes, /tip/:id y la vista previa dejan de encontrar al
-- colaborador. Quita a anon el SELECT directo -> ya no se puede enumerar la tabla.
-- Nota: los usuarios con sesión no se ven afectados (su lectura va por colaboradores_select_portal,
-- que es "to authenticated").
--
-- begin;
--   drop policy if exists "perfil publico colaborador" on public.colaboradores;
--   revoke select on public.colaboradores from anon;
-- commit;

-- ── Verificación tras el PASO 2 (con la llave anon pública) ──
-- Debe dar permission denied (42501):
--   curl -s -H "apikey: <anon>" -H "Authorization: Bearer <anon>" \
--     "https://<proj>.supabase.co/rest/v1/colaboradores?select=nombre,link_unico&limit=1"
-- Debe devolver 1 fila:
--   curl -s -X POST -H "apikey: <anon>" -H "Authorization: Bearer <anon>" \
--     -H "Content-Type: application/json" -d '{"p_link":"demo-jorge-martinez"}' \
--     "https://<proj>.supabase.co/rest/v1/rpc/get_colaborador_publico"
-- Y comprobar que /tip/<liga real> y /r/<liga> siguen cargando en el navegador.

-- ── Deshacer el PASO 2 si algo se rompe ──
-- begin;
--   grant select (id, nombre, puesto, foto_url, hotel_id, link_unico, activo) on public.colaboradores to anon;
--   create policy "perfil publico colaborador" on public.colaboradores for select to anon using (activo);
-- commit;
