import nodemailer from 'nodemailer'

// Lista de espera: guarda el correo en Supabase y manda un correo de bienvenida (una sola vez por correo)
// en el idioma en que la persona vio la página.

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

const PERFILES = ['negocio', 'equipo', 'cliente', 'otro']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })
  let body
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {} }
  catch { return res.status(400).json({ error: 'Datos incompletos' }) }
  if (body.website) return res.status(200).json({ ok: true })

  const correo = String(body.correo ?? '').trim().toLowerCase()
  const nombre = String(body.nombre ?? '').trim().slice(0, 120)
  const perfil = PERFILES.includes(body.perfil) ? body.perfil : 'otro'
  const idioma = body.idioma === 'en' ? 'en' : 'es'
  const interes = String(body.interes ?? '').trim().slice(0, 60)
  if (correo.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return res.status(400).json({ error: 'Correo inválido' })
  if (!url || !key) return res.status(500).json({ error: 'Servicio no configurado' })

  const r = await fetch(`${url}/rest/v1/rpc/registrar_espera`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_correo: correo, p_nombre: nombre || null, p_perfil: perfil, p_idioma: idioma, p_interes: interes || null }),
  })
  if (!r.ok) return res.status(502).json({ error: 'No se pudo registrar' })
  const nuevo = (await r.json().catch(() => false)) === true
  // Misma respuesta si ya estaba registrado: así nadie puede averiguar qué correos están en la lista.
  if (nuevo) await bienvenida({ correo, nombre, idioma }).catch(e => console.error('espera: correo no enviado', e.message))
  res.status(200).json({ ok: true })
}

const TEXTOS = {
  es: {
    asunto: 'Ya estás en la lista de espera de tak!',
    saludo: (n) => (n ? `Hola, ${n}:` : 'Hola:'),
    cuerpo: 'Gracias por unirte a la lista de espera de tak! — thanks are kind!\n\nEstamos preparando el lanzamiento oficial. Serás de los primeros en enterarte: te escribiremos a este correo con la fecha, las novedades y el acceso anticipado.\n\nMientras tanto, puedes conocer cómo funciona en https://www.thanksarekind.com\n\nSi ya no quieres recibir noticias, responde a este correo y te quitamos de la lista.\n\nGracias,\nEl equipo de tak!',
  },
  en: {
    asunto: "You're on the tak! waiting list",
    saludo: (n) => (n ? `Hi ${n},` : 'Hi,'),
    cuerpo: "Thanks for joining the tak! — thanks are kind! waiting list.\n\nWe're getting ready for the official launch. You'll be among the first to know: we'll email you here with the date, news and early access.\n\nIn the meantime, see how it works at https://www.thanksarekind.com\n\nIf you no longer want to hear from us, just reply to this email and we'll remove you from the list.\n\nThanks,\nThe tak! team",
  },
}

async function bienvenida({ correo, nombre, idioma }) {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) return
  const t = TEXTOS[idioma]
  const transporte = nodemailer.createTransport({ host: 'smtp.titan.email', port: 465, secure: true, auth: { user, pass } })
  await transporte.sendMail({
    from: `tak! <${user}>`,
    to: correo,
    replyTo: process.env.LEADS_TO || 'hello@thanksarekind.com',
    subject: t.asunto,
    text: `${t.saludo(nombre.split(' ')[0])}\n\n${t.cuerpo}`,
  })
}
