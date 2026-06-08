/**
 * Helpers para Google Sheets API.
 *
 * El Sheet "RABAT_releases" tiene 5 pestañas (crear manualmente):
 *   releases | tracks | credits | royalty_splits | artists
 *
 * SETUP:
 * 1. Crear el Sheet en el Drive de RABAT con esas 5 pestañas
 * 2. Primera fila de cada pestaña = headers (igual que las columnas de abajo)
 * 3. Compartirlo con el mismo service account que usa Drive
 * 4. Añadir a .env.local: GOOGLE_SHEET_ID=...
 */

import { google } from 'googleapis';
import type { Artist } from '@/types/schema';
import type { SubmitPayload } from '@/types/wizard';

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ID no configurado');
  return id;
}

/** Añade filas al final de la pestaña indicada. */
async function appendRows(tab: string, rows: (string | number | boolean | undefined | null)[][]): Promise<void> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: rows.map((r) => r.map((v) => (v === undefined || v === null ? '' : String(v)))),
    },
  });
}

// ============================================================
// HEADERS — deben coincidir exactamente con los de la primera fila del Sheet
// ============================================================

// releases: release_id | artist_email | artist_name | title | label | genre | title_language |
//           previously_released | original_release_date | cover_drive_id | status |
//           created_at | submitted_at | release_date_mode | release_date | stores
//
// tracks: track_id | release_id | track_number | title | recording_year | version |
//         isrc | has_vocals | explicit_content | has_lyrics | lyrics_text |
//         audio_master_drive_id | origin | youtube_content_id | tiktok_preview_seconds |
//         release_time_es   (hora de salida en horario de España, HH:MM)
//
// credits: credit_id | track_id | credit_type | role | first_name | last_name |
//          apple_music_url | spotify_url
//   credit_type ∈ { artist | performer | author | production }
//     - artist     = artistas principales adicionales + invitados (feat.); role =
//                    "Artista principal" / "Artista invitado (feat.)"; links opcionales
//     - performer/author/production = créditos técnicos/creativos
//   role puede contener VARIOS roles separados por ", " (una persona, varios roles)
//
// royalty_splits: split_id | release_id | recipient_name | percentage
//
// artists: artist_id | name | legal_name | email | drive_folder_id | created_at | active

/**
 * Escribe en Sheets el payload completo de un release enviado por el artista.
 * Llama a esta función desde POST /api/release/submit.
 */
export async function writeSubmission(payload: SubmitPayload): Promise<void> {
  const { release_id, artist_email, release, tracks, splits } = payload;
  const now = new Date().toISOString();

  // ── releases ──────────────────────────────────────────────
  await appendRows('releases', [[
    release_id,
    artist_email,
    release.artist_name,
    release.title,
    release.label,
    release.genre,
    release.title_language,
    String(release.previously_released),
    release.original_release_date,
    release.cover_drive_id,
    'submitted',
    now,
    now,
    release.release_date_mode,
    release.release_date,
    release.stores.join(', '),
  ]]);

  // ── tracks ────────────────────────────────────────────────
  const trackRows = tracks.map((t, i) => [
    t.id,
    release_id,
    String(i + 1),
    t.title,
    String(t.recording_year),
    t.version,
    t.isrc,
    String(t.has_vocals),
    t.explicit_content,
    String(t.has_lyrics),
    t.lyrics_text,
    t.audio_drive_id,
    t.origin,
    String(t.youtube_content_id),
    t.tiktok_preview_start ? String(t.tiktok_preview_seconds) : '',
    t.release_time,
  ]);
  if (trackRows.length > 0) await appendRows('tracks', trackRows);

  // ── credits ───────────────────────────────────────────────
  const creditRows = tracks.flatMap((t) =>
    t.credits.map((c) => [
      c.id,
      t.id,
      c.credit_type,
      (c.roles ?? []).join(', '),
      c.first_name,
      c.last_name,
      c.apple_music_url,
      c.spotify_url,
    ]),
  );
  if (creditRows.length > 0) await appendRows('credits', creditRows);

  // ── royalty_splits ────────────────────────────────────────
  const splitRows = splits.map((s) => [
    s.id,
    release_id,
    s.recipient_name,
    String(s.percentage),
  ]);
  if (splitRows.length > 0) await appendRows('royalty_splits', splitRows);
}

/**
 * Busca un artista por email (para validar login con magic link).
 * Espera la pestaña `artists` con header en fila 1.
 */
export async function findArtistByEmail(email: string): Promise<Artist | null> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: 'artists!A2:G',
  });

  const rows = res.data.values ?? [];
  for (const row of rows) {
    const [artist_id, name, legal_name, rowEmail, drive_folder_id, created_at, active] = row;
    if (rowEmail === email) {
      return {
        artist_id,
        name,
        legal_name,
        email: rowEmail,
        drive_folder_id,
        created_at,
        active: active === 'true' || active === 'TRUE',
      };
    }
  }
  return null;
}

/**
 * Añade un artista nuevo a la pestaña `artists`.
 * Llamar cuando RABAT firme a alguien.
 */
export async function appendArtist(artist: Artist): Promise<void> {
  await appendRows('artists', [[
    artist.artist_id,
    artist.name,
    artist.legal_name,
    artist.email,
    artist.drive_folder_id,
    artist.created_at,
    String(artist.active),
  ]]);
}