/**
 * POST /api/drive/upload-url
 *
 * Crea una sesión de resumable upload en Drive y devuelve:
 *   - uploadUrl: el browser hace PUT directo a esta URL (sin pasar por Vercel)
 *   - accessToken: el browser lo incluye en el header Authorization del PUT
 *
 * Sin el accessToken en el PUT, Google devuelve 403 aunque el CORS esté correcto.
 * El token dura ~1 hora y solo da acceso a Drive.
 *
 * Body: { folderId, filename, mimeType }
 * Response: { uploadUrl, accessToken }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUploadSession } from '@/lib/drive';

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin') ?? 'http://localhost:3000';
    const { folderId, filename, mimeType } = await req.json();

    if (!folderId || !filename || !mimeType) {
      return NextResponse.json(
        { error: 'folderId, filename y mimeType son obligatorios' },
        { status: 400 },
      );
    }

    const { uploadUrl, accessToken } = await createUploadSession(folderId, filename, mimeType, origin);
    return NextResponse.json({ uploadUrl, accessToken });
  } catch (err) {
    console.error('[drive/upload-url]', err);
    return NextResponse.json({ error: 'Error al crear sesión de upload en Drive' }, { status: 500 });
  }
}
