/**
 * Notificación a RABAT cuando un artista envía un lanzamiento.
 *
 * Envía un email vía la API REST de Resend (https://resend.com).
 * Se llama desde POST /api/release/submit, después de guardar en Sheets.
 * Es best-effort: si falla, NO debe romper el envío del artista.
 *
 * Variables de entorno (configúralas en Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY   (obligatoria)  → API key de Resend, empieza por "re_"
 *   NOTIFY_EMAIL     (opcional)     → destino(s), separados por coma. Default: ar@rabatmusicgroup.com
 *   NOTIFY_FROM      (opcional)     → remitente. Default: onboarding@resend.dev
 *
 * IMPORTANTE (Resend): para enviar a cualquier dirección hay que verificar el
 * dominio en Resend y usar un NOTIFY_FROM de ese dominio (p.ej. portal@rabatmusicgroup.com).
 * Sin dominio verificado, con onboarding@resend.dev solo se puede enviar al email
 * con el que se creó la cuenta de Resend.
 */

import type { SubmitPayload } from '@/types/wizard';

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function notifyNewSubmission(payload: SubmitPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_SERVER_PASSWORD;
  const to = (process.env.NOTIFY_EMAIL || 'ar@rabatmusicgroup.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const from = process.env.NOTIFY_FROM || process.env.EMAIL_FROM || 'RABAT <onboarding@resend.dev>';

  if (!apiKey || to.length === 0) {
    console.warn('[notify] RESEND_API_KEY o NOTIFY_EMAIL no configurados — se omite el email');
    return;
  }

  const { release, tracks, artist_email, release_folder_id } = payload;

  const folderUrl = release_folder_id
    ? `https://drive.google.com/drive/folders/${release_folder_id}`
    : 'https://drive.google.com/';

  const fecha =
    release.release_date_mode === 'asap'
      ? 'lo antes posible'
      : `${release.release_date || '—'}${release.release_time ? ` · ${release.release_time} (ES)` : ''}`;

  const subject = `🎵 Nuevo envío — ${release.artist_name} — "${release.title}"`;

  const text = [
    'Nuevo envío en el portal RABAT.',
    '',
    `Artista: ${release.artist_name}`,
    `Lanzamiento: ${release.title}`,
    `Pistas: ${tracks.length}`,
    `Género: ${release.genre}`,
    `Idioma: ${release.title_language}`,
    `Fecha de salida: ${fecha}`,
    `Email del artista: ${artist_email}`,
    '',
    `Carpeta en Drive: ${folderUrl}`,
  ].join('\n');

  const row = (label: string, value: string) =>
    `<tr><td style="color:#8a8a82;padding:3px 18px 3px 0;white-space:nowrap;vertical-align:top">${label}</td><td style="vertical-align:top">${value}</td></tr>`;

  const html = `
  <div style="background:#111;color:#EFEFE4;font-family:'Courier New',monospace;padding:28px;border-radius:16px;max-width:540px;margin:0 auto">
    <div style="font-size:24px;font-weight:800;letter-spacing:-0.02em">RABAT</div>
    <div style="font-size:12px;color:#F9FF00;text-transform:uppercase;letter-spacing:.14em;margin:6px 0 22px">nuevo envío de un artista</div>
    <table style="font-size:14px;line-height:1.5;border-collapse:collapse">
      ${row('artista', `<b>${esc(release.artist_name)}</b>`)}
      ${row('lanzamiento', `<b>${esc(release.title)}</b>`)}
      ${row('pistas', String(tracks.length))}
      ${row('género', esc(release.genre))}
      ${row('idioma', esc(release.title_language))}
      ${row('fecha', esc(fecha))}
      ${row('email', esc(artist_email))}
    </table>
    <a href="${esc(folderUrl)}" style="display:inline-block;margin-top:24px;background:#F9FF00;color:#000;text-decoration:none;font-weight:800;padding:13px 24px;border-radius:999px">Abrir carpeta en Drive →</a>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
}
