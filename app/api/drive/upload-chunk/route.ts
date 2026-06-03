/**
 * POST /api/drive/upload-chunk
 *
 * Recibe un trozo (chunk) del archivo y lo sube a Drive usando la sesión
 * de resumable upload del service account. El servidor hace el PUT a Drive,
 * no el browser, así evitamos el problema de portabilidad de sesiones y el
 * límite de Vercel (cada chunk es ≤ 3 MB, bien dentro de los 4.5 MB del límite).
 *
 * Body (FormData):
 *   chunk      — Blob con los bytes del trozo
 *   start      — byte de inicio (0-indexed)
 *   end        — byte de fin (inclusive)
 *   totalSize  — tamaño total del archivo en bytes
 *   folderId   — carpeta destino en Drive
 *   filename   — nombre del archivo final
 *   mimeType   — MIME type del archivo
 *   sessionUrl — (opcional, desde el 2º chunk) URL de la sesión de Drive
 *
 * Response:
 *   { sessionUrl }  — mientras queden más chunks
 *   { fileId }      — cuando Drive confirma que el upload está completo
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
    const form = await req.formData();
    const chunk    = form.get('chunk')      as File;
    const start    = Number(form.get('start'));
    const end      = Number(form.get('end'));
    const total    = Number(form.get('totalSize'));
    const folderId = form.get('folderId')   as string;
    const filename = form.get('filename')   as string;
    const mimeType = (form.get('mimeType') as string) || 'application/octet-stream';
    let   session  = form.get('sessionUrl') as string | null;

    if (!chunk || isNaN(start) || isNaN(end) || isNaN(total) || !folderId || !filename) {
      return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
    }

    const buffer = Buffer.from(await chunk.arrayBuffer());

    // ── Primer chunk: crear la sesión de upload en Drive ─────────────────────
    if (!session) {
      const { token } = await getAuth().getAccessToken();
      if (!token) throw new Error('No se pudo obtener token de Google');

      const init = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': String(total),
          },
          body: JSON.stringify({ name: filename, parents: [folderId] }),
        },
      );

      if (!init.ok) {
        const msg = await init.text();
        throw new Error(`No se pudo crear la sesión Drive: ${init.status} — ${msg}`);
      }

      session = init.headers.get('Location');
      if (!session) throw new Error('Drive no devolvió la URL de sesión (Location header)');
    }

    // ── Subir el chunk a la sesión ────────────────────────────────────────────
    const put = await fetch(session, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Type': mimeType,
      },
      body: buffer,
    });

    // 200 / 201 → upload completo, Drive devuelve el fileId
    if (put.status === 200 || put.status === 201) {
      const data = await put.json();
      return NextResponse.json({ fileId: data.id as string });
    }

    // 308 Resume Incomplete → chunk aceptado, quedan más
    if (put.status === 308) {
      return NextResponse.json({ sessionUrl: session });
    }

    const errText = await put.text();
    throw new Error(`Drive rechazó el chunk: ${put.status} — ${errText}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[drive/upload-chunk]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
