/**
 * POST /api/drive/create-folder
 *
 * Crea la estructura de carpetas para un release nuevo:
 *   /RABAT/{artistName}/{releaseTitle}__{shortId}/
 *   /RABAT/{artistName}/{releaseTitle}__{shortId}/tracks/
 *
 * Body: { artistEmail, artistName, releaseTitle, releaseId }
 * Response: { releaseFolderId, tracksFolderId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { findOrCreateArtistFolder, createReleaseFolder } from '@/lib/drive';

export async function POST(req: NextRequest) {
  try {
    const { artistEmail, artistName, releaseTitle, releaseId } = await req.json();

    if (!artistEmail || !releaseTitle || !releaseId) {
      return NextResponse.json(
        { error: 'artistEmail, releaseTitle y releaseId son obligatorios' },
        { status: 400 },
      );
    }

    const artistFolderId = await findOrCreateArtistFolder(
      artistEmail,
      artistName || artistEmail.split('@')[0],
    );

    const { releaseFolderId, tracksFolderId } = await createReleaseFolder(
      artistFolderId,
      releaseTitle,
      releaseId,
    );

    return NextResponse.json({ releaseFolderId, tracksFolderId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[drive/create-folder]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
