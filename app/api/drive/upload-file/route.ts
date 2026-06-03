/**
 * POST /api/drive/upload-file
 *
 * Recibe un archivo (multipart/form-data) y lo sube a Drive usando el service account.
 * El upload pasa por aquí (servidor) porque el browser no puede hacer PUT directo a
 * googleapis.com con credenciales de service account (restricción CORS de Google).
 *
 * Body (FormData): { file, folderId, filename }
 * Response: { id }  ← Drive file ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folderId = formData.get('folderId') as string;
    const filename = formData.get('filename') as string;

    if (!file || !folderId || !filename) {
      return NextResponse.json({ error: 'file, folderId y filename son obligatorios' }, { status: 400 });
    }

    const drive = google.drive({ version: 'v3', auth: getAuth() });

    // Convertir el File a Buffer → Readable para la API de Drive
    const buffer = Buffer.from(await file.arrayBuffer());

    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: Readable.from(buffer),
      },
      fields: 'id',
    });

    if (!res.data.id) throw new Error('Drive no devolvió el ID del archivo');

    return NextResponse.json({ id: res.data.id });
  } catch (err) {
    console.error('[drive/upload-file]', err);
    return NextResponse.json({ error: 'Error al subir el archivo a Drive' }, { status: 500 });
  }
}
