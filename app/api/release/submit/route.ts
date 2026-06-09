/**
 * POST /api/release/submit
 *
 * Recibe el payload completo de un lanzamiento (ya con los Drive IDs tras los uploads)
 * y lo escribe en el Google Sheet.
 *
 * Body: SubmitPayload (ver types/wizard.ts)
 * Response: { ok: true, release_id }
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeSubmission } from '@/lib/sheets';
import { notifyNewSubmission } from '@/lib/notify';
import type { SubmitPayload } from '@/types/wizard';

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as SubmitPayload;

    if (!payload.release_id || !payload.artist_email || !payload.release?.title) {
      return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 });
    }

    if (!payload.tracks || payload.tracks.length === 0) {
      return NextResponse.json({ error: 'El release necesita al menos una pista' }, { status: 400 });
    }

    const totalSplit = payload.splits.reduce((sum, s) => sum + s.percentage, 0);
    if (Math.abs(totalSplit - 100) > 0.01) {
      return NextResponse.json({ error: 'El reparto de regalías debe sumar 100%' }, { status: 400 });
    }

    await writeSubmission(payload);

    // Avisar a RABAT por email (best-effort: no rompe el envío si el email falla)
    try {
      await notifyNewSubmission(payload);
    } catch (e) {
      console.error('[release/submit] notificación falló (no bloquea el envío):', e);
    }

    return NextResponse.json({ ok: true, release_id: payload.release_id });
  } catch (err) {
    console.error('[release/submit]', err);
    return NextResponse.json({ error: 'Error al guardar en Google Sheets' }, { status: 500 });
  }
}