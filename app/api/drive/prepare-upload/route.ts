/**
 * POST /api/drive/prepare-upload
 *
 * Crea una sesión de resumable upload en Drive y devuelve la URL + token
 * para que el browser suba el archivo DIRECTO a Drive (sin pasar por Vercel).
 *
 * El Origin del browser se incluye al crear la sesión para habilitar CORS.
 * El accessToken permite al browser autenticarse en el PUT.
 *
 * Body: { folderId, filename, mimeType }
 * Response: { uploadUrl, accessToken }
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin') ?? 'https://rabat-portal.vercel.app';
    const { folderId, filename, mimeType } = await req.json();

    if (!folderId || !filename || !mimeType) {
      return NextResponse.json({ error: 'folderId, filename y mimeType son obligatorios' }, { status: 400 });
    }

    const auth = getAuth();
    const { token } = await auth.getAccessToken();
    if (!token) throw new Error('No se pudo obtener token de Google');

    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType,
          Origin: origin,
        },
        body: JSON.stringify({ name: filename, parents: [folderId] }),
      },
    );

    if (!initRes.ok) {
      const txt = await initRes.text();
      throw new Error(`Drive session error ${initRes.status}: ${txt}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) throw new Error('Drive no devolvió Location header');

    return NextResponse.json({ uploadUrl, accessToken: token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[drive/prepare-upload]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
