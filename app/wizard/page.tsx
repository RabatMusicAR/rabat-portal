'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { GENRES } from '@/lib/constants/genres';
import { STORES } from '@/lib/constants/stores';
import type {
  TrackDraft,
  CreditDraft,
  SplitDraft,
  ReleaseForm,
  CreditType,
} from '@/types/wizard';

// ── Valores iniciales ─────────────────────────────────────────────────────────

const EMPTY_RELEASE: ReleaseForm = {
  artist_name: '',
  title: '',
  label: 'RABAT',
  genre: '',
  title_language: '',
  previously_released: false,
  original_release_date: '',
  cover_filename: '',
  cover_preview: '',
  cover_drive_id: '',
  release_date_mode: 'specific',
  release_date: '',
  stores: [...STORES],
};

/**
 * Genera un ID legible para el Sheet: {slug-del-nombre}-{6chars-random}
 * Ej: "Mi Álbum" → "mi-album-a1b2c3" | "2PAC" → "2pac-d4e5f6"
 */
function makeId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')                 // separa letras de tildes
    .replace(/[̀-ͯ]/g, '') // elimina las tildes
    .replace(/[^a-z0-9\s-]/g, '')    // solo letras, números, espacios, guiones
    .trim()
    .replace(/\s+/g, '-')            // espacios → guiones
    .replace(/-+/g, '-')             // guiones múltiples → uno
    .slice(0, 24);
  const rand = Math.random().toString(36).slice(2, 8);
  return slug ? `${slug}-${rand}` : rand;
}

function emptyTrack(): TrackDraft {
  return {
    id: uuidv4(),
    title: '',
    recording_year: new Date().getFullYear(),
    version: '',
    isrc: '',
    has_vocals: true,
    explicit_content: 'not_explicit',
    has_lyrics: false,
    lyrics_text: '',
    audio_filename: '',
    audio_drive_id: '',
    origin: 'original',
    youtube_content_id: false,
    tiktok_preview_start: false,
    tiktok_preview_seconds: 0,
    credits: [],
    completed_steps: 0,
  };
}

function defaultSplit(): SplitDraft {
  return { id: uuidv4(), recipient_name: 'RABAT Music', percentage: 100 };
}

// ── Helpers de upload ─────────────────────────────────────────────────────────

// MIME types por extensión — WAV/FLAC a veces llegan vacíos en algunos browsers
const MIME_MAP: Record<string, string> = {
  wav: 'audio/wav',
  flac: 'audio/flac',
  mp3: 'audio/mpeg',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

function getMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

/**
 * Sube un archivo a Drive en trozos de 3 MB a través del servidor.
 *
 * Por qué no upload directo browser → Drive:
 *   Las sesiones de resumable upload de Drive están ligadas al cliente que las
 *   crea. Si el servidor crea la sesión y el browser intenta usarla, Drive
 *   devuelve 403 (sesión no portable). La solución es que el servidor que creó
 *   la sesión también haga los PUT de cada chunk.
 *
 * Por qué chunks:
 *   Vercel limita los request bodies a 4.5 MB. Con chunks de 3 MB cada petición
 *   entra dentro del límite aunque el archivo completo sea de 40-50 MB.
 */
const CHUNK_SIZE = 3 * 1024 * 1024; // 3 MB por chunk

async function uploadFileToDrive(
  file: File,
  folderId: string,
  filename: string,
): Promise<string> {
  const mimeType   = getMimeType(file);
  const totalSize  = file.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
  let sessionUrl: string | null = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end   = Math.min(start + CHUNK_SIZE, totalSize) - 1; // inclusive

    const form = new FormData();
    form.append('chunk',      file.slice(start, end + 1));
    form.append('start',      String(start));
    form.append('end',        String(end));
    form.append('totalSize',  String(totalSize));
    form.append('folderId',   folderId);
    form.append('filename',   filename);
    form.append('mimeType',   mimeType);
    if (sessionUrl) form.append('sessionUrl', sessionUrl);

    const res = await fetch('/api/drive/upload-chunk', { method: 'POST', body: form });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(error ?? `Error en chunk ${i + 1} de ${totalChunks}`);
    }

    const data = await res.json().catch(() => null) as { sessionUrl?: string; fileId?: string } | null;
    if (!data) throw new Error('Respuesta inválida del servidor al subir archivo');
    if (data.fileId) return data.fileId;
    if (data.sessionUrl) sessionUrl = data.sessionUrl;
  }

  throw new Error('Upload completado pero Drive no devolvió el ID del archivo');
}

// ── Componente principal ──────────────────────────────────────────────────────

// Suspense wrapper requerido por Next.js 15 cuando se usa useSearchParams()
export default function WizardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--off-white-dim)' }}>cargando…</div>}>
      <WizardPageInner />
    </Suspense>
  );
}

function WizardPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const artistEmail = params.get('email') ?? 'artista@rabat.com';

  const [step, setStep] = useState(1);
  const [release, setRelease] = useState<ReleaseForm>(EMPTY_RELEASE);
  const [tracks, setTracks] = useState<TrackDraft[]>([]);
  const [splits, setSplits] = useState<SplitDraft[]>([defaultSplit()]);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Archivos (no serializable → no se guardan en localStorage)
  const coverFileRef = useRef<File | null>(null);
  const audioFilesRef = useRef<Record<string, File>>({});

  // Track modal
  const [modalTrackId, setModalTrackId] = useState<string | null>(null);
  const [modalStep, setModalStep] = useState(1);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState('');
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [releaseId, setReleaseId] = useState('');

  // Limpiar cualquier dato previo que pudiera haber quedado en localStorage
  useEffect(() => {
    localStorage.removeItem('rabat_wizard');
  }, []);

  // ── Helpers de estado ───────────────────────────────────────────────────────

  const updateRelease = useCallback(
    <K extends keyof ReleaseForm>(key: K, value: ReleaseForm[K]) => {
      setRelease((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateTrack = useCallback((id: string, patch: Partial<TrackDraft>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const addTrack = useCallback(() => {
    const track = emptyTrack();
    setTracks((prev) => [...prev, track]);
    setModalTrackId(track.id);
    setModalStep(1);
  }, []);

  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    delete audioFilesRef.current[id];
  }, []);

  const openModal = useCallback((id: string) => {
    setModalTrackId(id);
    setModalStep(1);
  }, []);

  const closeModal = useCallback(() => {
    setModalTrackId(null);
  }, []);

  const currentTrack = tracks.find((t) => t.id === modalTrackId);

  const totalSplit = splits.reduce((s, r) => s + r.percentage, 0);
  const splitOk = Math.abs(totalSplit - 100) < 0.01;

  // ── Envío ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!splitOk || !termsAccepted) return;

    setSubmitting(true);
    // IDs legibles para el Sheet: {slug-del-nombre}-{6chars}
    const rid = makeId(release.title);
    setReleaseId(rid);

    try {
      // 1. Crear carpetas en Drive
      setSubmitStep('Creando carpetas en Drive…');
      setSubmitProgress(5);

      const folderRes = await fetch('/api/drive/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistEmail,
          artistName: release.artist_name || artistEmail.split('@')[0],
          releaseTitle: release.title,
          releaseId: rid,
        }),
      });
      const folderData = await folderRes.json().catch(() => null);
      if (!folderRes.ok || !folderData) {
        throw new Error(folderData?.error ?? `Error al crear carpetas en Drive (HTTP ${folderRes.status})`);
      }
      const { releaseFolderId, tracksFolderId } = folderData;

      // 2. Subir portada — solo variable local, no actualiza estado
      let coverDriveId = '';
      if (coverFileRef.current) {
        setSubmitStep('Subiendo portada…');
        setSubmitProgress(15);
        const ext = coverFileRef.current.name.split('.').pop() ?? 'jpg';
        coverDriveId = await uploadFileToDrive(
          coverFileRef.current,
          releaseFolderId,
          `cover.${ext}`,
        );
      }

      // 3. Subir audios — copia local, nunca se escribe al estado hasta el éxito total
      const localTracks = tracks.map((t) => ({ ...t }));
      const totalAudios = localTracks.filter((t) => audioFilesRef.current[t.id]).length;
      let audiosDone = 0;

      for (let i = 0; i < localTracks.length; i++) {
        const track = localTracks[i];
        const file = audioFilesRef.current[track.id];
        if (file) {
          setSubmitStep(`Subiendo audio ${i + 1} de ${localTracks.length}…`);
          setSubmitProgress(20 + Math.round((audiosDone / Math.max(totalAudios, 1)) * 60));
          const safeTitle = track.title.replace(/[/\\?%*:|"<>]/g, '-') || `track-${i + 1}`;
          const ext = file.name.split('.').pop() ?? 'wav';
          localTracks[i] = {
            ...track,
            audio_drive_id: await uploadFileToDrive(
              file,
              tracksFolderId,
              `${String(i + 1).padStart(2, '0')}_${safeTitle}.${ext}`,
            ),
          };
          audiosDone++;
        }
      }

      // 4. Guardar en Sheets
      setSubmitStep('Guardando en el sistema de RABAT…');
      setSubmitProgress(85);

      const tracksForSheet = localTracks.map((t, i) => ({
        ...t,
        id: makeId(t.title || `track-${i + 1}`),
        credits: t.credits.map((c) => ({
          ...c,
          id: makeId(`${c.first_name}-${c.last_name}`),
        })),
      }));
      const splitsForSheet = splits.map((s) => ({
        ...s,
        id: makeId(s.recipient_name || 'split'),
      }));

      const submitRes = await fetch('/api/release/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          release_id: rid,
          artist_email: artistEmail,
          release: { ...release, cover_drive_id: coverDriveId },
          tracks: tracksForSheet,
          splits: splitsForSheet,
        }),
      });
      const submitData = await submitRes.json().catch(() => null);
      if (!submitRes.ok || !submitData) {
        throw new Error(submitData?.error ?? `Error al guardar en Sheets (HTTP ${submitRes.status})`);
      }

      // 5. Solo aquí, con todo confirmado, limpiamos localStorage y mostramos éxito
      localStorage.removeItem('rabat_wizard');
      setSubmitProgress(100);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      // No actualizamos estado → el formulario queda intacto para reintentar
      setSubmitting(false);
      alert(`Error: ${(err as Error).message}. Por favor, inténtalo de nuevo.`);
    }
  };

  // ── Pantalla de éxito ───────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="success-screen">
        <div className="ss-check">✓</div>
        <h1 className="ss-title">lanzamiento<br />enviado</h1>
        <p className="ss-sub">
          RABAT ha recibido tu lanzamiento y los archivos están en Drive.
          Te avisaremos cuando esté subido a las plataformas.
        </p>
        <div className="ss-ref">ref: {releaseId.slice(0, 8).toUpperCase()}</div>
        <button
          className="btn-primary"
          onClick={() => {
            setSubmitted(false);
            setStep(1);
            setRelease(EMPTY_RELEASE);
            setTracks([]);
            setSplits([defaultSplit()]);
            setTermsAccepted(false);
            coverFileRef.current = null;
            audioFilesRef.current = {};
            router.push('/');
          }}
        >
          VOLVER AL INICIO
        </button>
      </div>
    );
  }

  // ── Overlay de envío ────────────────────────────────────────────────────────

  if (submitting) {
    return (
      <div className="submit-overlay">
        <div className="so-title">enviando<br />a rabat</div>
        <div className="submit-bar-wrap">
          <div className="submit-bar" style={{ width: `${submitProgress}%` }} />
        </div>
        <p className="so-step">{submitStep}</p>
      </div>
    );
  }

  // ── Wizard ──────────────────────────────────────────────────────────────────

  const stepLabels = ['datos', 'portada', 'pistas', 'envío', 'revisar'];

  return (
    <>
      {/* Top bar */}
      <header className="top-bar">
        <div className="logo" onClick={() => router.push('/')} role="button" tabIndex={0}>
          RABAT
        </div>
        <div className="user">
          <span>{artistEmail}</span>
          <div className="avatar">{artistEmail[0].toUpperCase()}</div>
        </div>
      </header>

      <main className="wizard-wrap">
        {/* Progress bar */}
        <div className="progress-bar">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`progress-seg ${step === n ? 'active' : ''} ${step > n ? 'done' : ''}`}
            />
          ))}
        </div>
        <div className="progress-labels">
          {stepLabels.map((label, i) => (
            <div
              key={label}
              className={`progress-label ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}
              onClick={() => step > i + 1 && setStep(i + 1)}
              role={step > i + 1 ? 'button' : undefined}
              tabIndex={step > i + 1 ? 0 : undefined}
            >
              {label}
            </div>
          ))}
        </div>

        {/* ── PASO 1 — Datos ── */}
        {step === 1 && (
          <div>
            <div className="wizard-title-row">
              <h1 className="wizard-title">datos del<br />lanzamiento</h1>
              <div className="wizard-step-num">PASO 1 / 5</div>
            </div>
            <div className="form-stack">
              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag">obligatorio</span>
                  <div className="field-block-title">artista &amp; título</div>
                </div>
                <div className="form-stack">
                  <div className="field">
                    <label className="field-label">nombre artístico</label>
                    <input
                      type="text"
                      className="input-pill"
                      placeholder="¿cómo se llama el artista?"
                      autoFocus
                      value={release.artist_name}
                      onChange={(e) => updateRelease('artist_name', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">título del lanzamiento</label>
                    <input
                      type="text"
                      className="input-pill"
                      placeholder="¿cómo se llama esto?"
                      value={release.title}
                      onChange={(e) => updateRelease('title', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">sello discográfico</label>
                    <input
                      type="text"
                      className="input-pill"
                      value={release.label}
                      onChange={(e) => updateRelease('label', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag">obligatorio</span>
                  <div className="field-block-title">género &amp; idioma</div>
                </div>
                <p className="field-block-help">
                  Las plataformas usan el género para clasificarte. Hay 138 opciones — elige el que mejor encaje.
                </p>
                <div className="field-grid">
                  <div className="field">
                    <label className="field-label">género</label>
                    <select
                      className="input-pill"
                      value={release.genre}
                      onChange={(e) => updateRelease('genre', e.target.value)}
                    >
                      <option value="" disabled>elige uno…</option>
                      {GENRES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">idioma del título</label>
                    <select
                      className="input-pill"
                      value={release.title_language}
                      onChange={(e) => updateRelease('title_language', e.target.value)}
                    >
                      <option value="" disabled>elige uno…</option>
                      {['Español', 'English', 'Português', 'Français', 'Italiano', 'Deutsch', 'Instrumental / sin idioma'].map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag">obligatorio</span>
                  <div className="field-block-title">¿se ha publicado antes?</div>
                </div>
                <p className="field-block-help">
                  Marca "sí" solo si este lanzamiento ya salió antes en otra plataforma.
                </p>
                <div className="radio-group">
                  <label className="radio-pill">
                    <input
                      type="radio"
                      name="prev"
                      checked={!release.previously_released}
                      onChange={() => updateRelease('previously_released', false)}
                    />
                    <span className="dot" />
                    <span>no, es nuevo</span>
                  </label>
                  <label className="radio-pill">
                    <input
                      type="radio"
                      name="prev"
                      checked={release.previously_released}
                      onChange={() => updateRelease('previously_released', true)}
                    />
                    <span className="dot" />
                    <span>sí, ya salió antes</span>
                  </label>
                </div>
                {release.previously_released && (
                  <div style={{ marginTop: 16, paddingTop: 20, borderTop: '1px dashed var(--off-white-faint)' }}>
                    <div className="field">
                      <label className="field-label">fecha de publicación original</label>
                      <input
                        type="date"
                        className="input-pill"
                        max={new Date().toISOString().split('T')[0]}
                        value={release.original_release_date}
                        onChange={(e) => updateRelease('original_release_date', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="wizard-nav">
                <button className="btn-secondary" onClick={() => router.push('/')}>cancelar</button>
                <button
                  className="btn-primary"
                  disabled={!release.artist_name || !release.title || !release.genre || !release.title_language}
                  onClick={() => setStep(2)}
                >
                  SIGUIENTE →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PASO 2 — Portada ── */}
        {step === 2 && (
          <div>
            <div className="wizard-title-row">
              <h1 className="wizard-title">portada</h1>
              <div className="wizard-step-num">PASO 2 / 5</div>
            </div>
            <div className="cover-uploader">
              <div className={`dropzone ${release.cover_preview ? 'has-cover' : ''}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    coverFileRef.current = file;
                    updateRelease('cover_filename', file.name);
                    const reader = new FileReader();
                    reader.onload = (ev) => updateRelease('cover_preview', ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
                {release.cover_preview ? (
                  <>
                    <img src={release.cover_preview} alt="portada" />
                    <div className="dz-overlay">
                      <div className="dz-cta">cambiar</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="cloud">↑</div>
                    <div className="dz-label">arrastra y suelta la portada aquí</div>
                    <div className="dz-cta">explorar archivos</div>
                  </>
                )}
              </div>
              <div className="cover-info">
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '-0.02em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
                  requisitos
                </strong>
                <ul>
                  <li>cuadrada, formato .jpg o .png</li>
                  <li>mínimo 1400×1400 px (recomendado 3000×3000)</li>
                  <li>nítida, sin pixelado ni desenfoque</li>
                  <li>puede incluir nombre de artista y/o título — nada más</li>
                </ul>
                <div className="warn">
                  › si no cumple, las tiendas la rechazan y bloquea el lanzamiento entero.
                </div>
                {release.cover_filename && (
                  <p style={{ marginTop: 16, fontSize: 12, color: 'var(--yellow)' }}>
                    ✓ {release.cover_filename}
                  </p>
                )}
              </div>
            </div>
            <div className="wizard-nav">
              <button className="btn-secondary" onClick={() => setStep(1)}>atrás</button>
              <button
                className="btn-primary"
                disabled={!release.cover_filename}
                onClick={() => setStep(3)}
              >
                SIGUIENTE →
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3 — Pistas ── */}
        {step === 3 && (
          <div>
            <div className="wizard-title-row">
              <h1 className="wizard-title">lista de<br />pistas</h1>
              <div className="wizard-step-num">PASO 3 / 5</div>
            </div>

            {tracks.length === 0 ? (
              <div className="tracks-empty">
                <div className="te-title">aún no hay pistas</div>
                <p className="te-help">añade al menos una pista para continuar.</p>
                <button className="btn-primary" onClick={addTrack}>+ AÑADIR PISTA</button>
              </div>
            ) : (
              <>
                <div className="track-list">
                  {tracks.map((track, i) => (
                    <div key={track.id} className="track-row">
                      <div className="track-num">{String(i + 1).padStart(2, '0')}</div>
                      <div className="track-info">
                        <div className="tr-title">{track.title || 'pista sin título'}</div>
                        <div className="tr-sub">
                          {track.completed_steps} de 4 pasos ·{' '}
                          {track.audio_filename ? 'audio cargado' : 'sin audio'}
                        </div>
                      </div>
                      <div className="track-mini-progress">
                        {[1, 2, 3, 4].map((n) => (
                          <span key={n} className={track.completed_steps >= n ? 'done' : ''} />
                        ))}
                      </div>
                      <div className="track-actions">
                        <button className="icon-btn" title="editar" onClick={() => openModal(track.id)}>›</button>
                        <button className="icon-btn" title="eliminar" onClick={() => removeTrack(track.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="add-track-btn" onClick={addTrack}>+ añadir otra pista</button>
              </>
            )}

            <div className="wizard-nav">
              <button className="btn-secondary" onClick={() => setStep(2)}>atrás</button>
              <button
                className="btn-primary"
                disabled={tracks.length === 0}
                onClick={() => setStep(4)}
              >
                SIGUIENTE →
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 4 — Envío ── */}
        {step === 4 && (
          <div>
            <div className="wizard-title-row">
              <h1 className="wizard-title">opciones<br />de envío</h1>
              <div className="wizard-step-num">PASO 4 / 5</div>
            </div>
            <div className="form-stack">
              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag">obligatorio</span>
                  <div className="field-block-title">fecha de lanzamiento</div>
                </div>
                <p className="field-block-help">
                  RABAT necesita 5-7 días para procesar. Elige con al menos una semana de margen.
                </p>
                <div className="radio-card-group">
                  <label className="radio-card">
                    <input
                      type="radio"
                      name="rdmode"
                      checked={release.release_date_mode === 'asap'}
                      onChange={() => updateRelease('release_date_mode', 'asap')}
                    />
                    <span className="dot" />
                    <div>
                      <div className="rc-title">tan pronto como sea posible</div>
                      <div className="rc-help">RABAT lo sube cuando esté listo</div>
                    </div>
                  </label>
                  <label className="radio-card">
                    <input
                      type="radio"
                      name="rdmode"
                      checked={release.release_date_mode === 'specific'}
                      onChange={() => updateRelease('release_date_mode', 'specific')}
                    />
                    <span className="dot" />
                    <div>
                      <div className="rc-title">fecha específica</div>
                      <div className="rc-help">elige el día exacto del lanzamiento</div>
                    </div>
                  </label>
                </div>
                {release.release_date_mode === 'specific' && (
                  <div style={{ marginTop: 18 }}>
                    <div className="field">
                      <label className="field-label">fecha</label>
                      <input
                        type="date"
                        className="input-pill"
                        min={(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })()}
                        value={release.release_date}
                        onChange={(e) => updateRelease('release_date', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag">obligatorio</span>
                  <div className="field-block-title">tiendas y plataformas</div>
                </div>
                <p className="field-block-help">
                  Por defecto va a todas. Toca las que quieras desactivar.
                </p>
                <label
                  className="toggle-row"
                  onClick={() => {
                    const allOn = release.stores.length === STORES.length;
                    updateRelease('stores', allOn ? [] : [...STORES]);
                  }}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer', marginBottom: 14 }}
                >
                  <span className="tg-label">enviar a todas las tiendas</span>
                  <span className={`toggle ${release.stores.length === STORES.length ? 'on' : ''}`} />
                </label>
                <div className="stores-grid">
                  {STORES.map((store) => {
                    const isOn = release.stores.includes(store);
                    return (
                      <div
                        key={store}
                        className={`store-pill ${isOn ? 'on' : ''}`}
                        onClick={() => {
                          const next = isOn
                            ? release.stores.filter((s) => s !== store)
                            : [...release.stores, store];
                          updateRelease('stores', next);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="sp-name">{store}</span>
                        <span className="sp-check" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="wizard-nav">
              <button className="btn-secondary" onClick={() => setStep(3)}>atrás</button>
              <button className="btn-primary" onClick={() => setStep(5)}>SIGUIENTE →</button>
            </div>
          </div>
        )}

        {/* ── PASO 5 — Revisar ── */}
        {step === 5 && (
          <div>
            <div className="wizard-title-row">
              <h1 className="wizard-title">revisar &amp;<br />enviar</h1>
              <div className="wizard-step-num">PASO 5 / 5</div>
            </div>
            <div className="form-stack">
              {/* Reparto */}
              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag">obligatorio</span>
                  <div className="field-block-title">reparto de regalías</div>
                </div>
                <p className="field-block-help">
                  Por defecto RABAT recibe el 100% y reparte según contrato.
                  Si quieres otro reparto, edita aquí. Debe sumar exactamente 100%.
                </p>
                <div className="splits-list">
                  {splits.map((split) => (
                    <div key={split.id} className="split-row">
                      <input
                        type="text"
                        className="input-pill"
                        placeholder="nombre del receptor"
                        value={split.recipient_name}
                        onChange={(e) =>
                          setSplits((prev) =>
                            prev.map((s) => s.id === split.id ? { ...s, recipient_name: e.target.value } : s)
                          )
                        }
                      />
                      <div className="split-pct">
                        <input
                          type="number"
                          className="input-pill"
                          min={0}
                          max={100}
                          step={0.01}
                          value={split.percentage}
                          onChange={(e) =>
                            setSplits((prev) =>
                              prev.map((s) => s.id === split.id ? { ...s, percentage: parseFloat(e.target.value) || 0 } : s)
                            )
                          }
                        />
                      </div>
                      <button
                        className="split-remove"
                        disabled={splits.length <= 1}
                        onClick={() => setSplits((prev) => prev.filter((s) => s.id !== split.id))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="link-add"
                  onClick={() => setSplits((prev) => [...prev, { id: uuidv4(), recipient_name: '', percentage: 0 }])}
                >
                  añadir reparto
                </button>
                <div className={`splits-total ${splitOk ? 'ok' : 'bad'}`}>
                  <span>total reparto</span>
                  <span className="st-num">{totalSplit.toFixed(2)} %</span>
                </div>
              </div>

              {/* Resumen */}
              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag summary">resumen</span>
                  <div className="field-block-title">así queda</div>
                </div>
                <div className="summary-block">
                  <div className="summary-row"><span className="sr-label">artista</span><span className="sr-value">{release.artist_name || '—'}</span></div>
                  <div className="summary-row"><span className="sr-label">título</span><span className="sr-value">{release.title || '—'}</span></div>
                  <div className="summary-row"><span className="sr-label">sello</span><span className="sr-value">{release.label || 'RABAT'}</span></div>
                  <div className="summary-row"><span className="sr-label">género</span><span className="sr-value thin">{release.genre || '—'}</span></div>
                  <div className="summary-row"><span className="sr-label">idioma</span><span className="sr-value thin">{release.title_language || '—'}</span></div>
                  <div className="summary-row"><span className="sr-label">pistas</span><span className="sr-value">{tracks.length} pista{tracks.length !== 1 ? 's' : ''}</span></div>
                  <div className="summary-row">
                    <span className="sr-label">fecha</span>
                    <span className="sr-value thin">
                      {release.release_date_mode === 'asap' ? 'lo antes posible' : (release.release_date || '—')}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="sr-label">tiendas</span>
                    <span className="sr-value thin">
                      {release.stores.length === STORES.length
                        ? 'todas las plataformas'
                        : `${release.stores.length}: ${release.stores.slice(0, 3).join(', ')}${release.stores.length > 3 ? '…' : ''}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Términos */}
              <div className="field-block">
                <div
                  className={`check-row ${termsAccepted ? 'on' : ''}`}
                  onClick={() => setTermsAccepted((v) => !v)}
                  role="checkbox"
                  aria-checked={termsAccepted}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === ' ' && setTermsAccepted((v) => !v)}
                >
                  <div className="cb" />
                  <div className="cb-text">
                    <strong>confirmo que es mío</strong>
                    <span>
                      los archivos que subo son míos o tengo permisos para distribuirlos. acepto los términos de RABAT.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="wizard-nav">
              <button className="btn-secondary" onClick={() => setStep(4)}>atrás</button>
              <button
                className="btn-primary"
                disabled={!splitOk || !termsAccepted}
                onClick={handleSubmit}
              >
                ENVIAR A RABAT →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Track Modal ── */}
      {modalTrackId && currentTrack && (
        <TrackModal
          track={currentTrack}
          trackNumber={tracks.findIndex((t) => t.id === modalTrackId) + 1}
          modalStep={modalStep}
          onStepChange={setModalStep}
          onUpdate={(patch) => updateTrack(modalTrackId, patch)}
          onAudioFile={(file) => { audioFilesRef.current[modalTrackId] = file; }}
          onFinalize={() => {
            updateTrack(modalTrackId, { completed_steps: 4 });
            closeModal();
          }}
          onClose={closeModal}
        />
      )}
    </>
  );
}

// ── TrackModal ────────────────────────────────────────────────────────────────

interface TrackModalProps {
  track: TrackDraft;
  trackNumber: number;
  modalStep: number;
  onStepChange: (n: number) => void;
  onUpdate: (patch: Partial<TrackDraft>) => void;
  onAudioFile: (file: File) => void;
  onFinalize: () => void;
  onClose: () => void;
}

function TrackModal({
  track,
  trackNumber,
  modalStep,
  onStepChange,
  onUpdate,
  onAudioFile,
  onFinalize,
  onClose,
}: TrackModalProps) {
  type FormFields = { role: string; first_name: string; last_name: string; apple_music_url: string; spotify_url: string };
  type FormState = FormFields & { open: boolean };
  const EMPTY_FIELDS: FormFields = { role: '', first_name: '', last_name: '', apple_music_url: '', spotify_url: '' };

  // Cada tipo tiene su propio formulario independiente; todos abiertos al inicio (sin créditos aún)
  const [forms, setForms] = useState<Record<CreditType, FormState>>({
    performer: { open: true, ...EMPTY_FIELDS },
    author:    { open: true, ...EMPTY_FIELDS },
    production:{ open: true, ...EMPTY_FIELDS },
  });

  const updateForm = (type: CreditType, patch: Partial<FormState>) =>
    setForms((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  const titlesPerStep = ['datos de la pista', 'letra', 'audio', 'artistas y créditos'];

  const addCredit = (type: CreditType) => {
    const f = forms[type];
    if (!f.role || !f.first_name || !f.last_name) {
      alert('Completa rol, nombre y apellido.');
      return;
    }
    if (type === 'production' && f.role === 'Productor' && (!f.apple_music_url || !f.spotify_url)) {
      alert('El rol Productor requiere los enlaces de Apple Music y Spotify.');
      return;
    }
    const newCredit: CreditDraft = {
      id: uuidv4(), credit_type: type, role: f.role,
      first_name: f.first_name, last_name: f.last_name,
      apple_music_url: f.apple_music_url, spotify_url: f.spotify_url,
    };
    onUpdate({ credits: [...track.credits, newCredit] });
    // Cerrar formulario tras agregar; el usuario puede reabrir con "+ añadir"
    setForms((prev) => ({ ...prev, [type]: { open: false, ...EMPTY_FIELDS } }));
  };

  const cancelForm = (type: CreditType) => {
    // Solo se puede cerrar si ya existe al menos 1 crédito de ese tipo
    if (track.credits.some((c) => c.credit_type === type)) {
      setForms((prev) => ({ ...prev, [type]: { open: false, ...EMPTY_FIELDS } }));
    }
  };

  const removeCredit = (id: string) => {
    const removed = track.credits.find((c) => c.id === id);
    const remaining = track.credits.filter((c) => c.id !== id);
    // Si se elimina el último de un tipo, reabrir el formulario de ese tipo
    if (removed && !remaining.some((c) => c.credit_type === removed.credit_type)) {
      setForms((prev) => ({ ...prev, [removed.credit_type]: { open: true, ...EMPTY_FIELDS } }));
    }
    onUpdate({ credits: remaining });
  };

  // Habilita "FINALIZAR" solo cuando los 3 tipos tienen ≥1 crédito y no hay formularios con datos a medias
  const creditsComplete = (['performer', 'author', 'production'] as const).every(
    (type) => track.credits.some((c) => c.credit_type === type),
  );

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        <div className="modal-header">
          <div className="modal-title-block">
            <div className="mt-eyebrow">pista {trackNumber}</div>
            <div className="mt-title">{titlesPerStep[modalStep - 1]}</div>
          </div>
          <div className="modal-step-info">
            <div className="modal-step-num">PASO {modalStep} / 4</div>
            <div className="modal-progress">
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={modalStep === n ? 'active' : modalStep > n ? 'done' : ''}
                />
              ))}
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* MODAL PASO 1 — Info básica */}
        {modalStep === 1 && (
          <div>
            <div className="form-stack">
              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag">obligatorio</span>
                  <div className="field-block-title">título &amp; año</div>
                </div>
                <div className="form-stack">
                  <div className="field">
                    <label className="field-label">título de la pista</label>
                    <input
                      type="text"
                      className="input-pill"
                      placeholder="¿cómo se llama esta canción?"
                      value={track.title}
                      onChange={(e) => onUpdate({ title: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="field-grid">
                    <div className="field">
                      <label className="field-label">año de grabación</label>
                      <input
                        type="number"
                        className="input-pill"
                        value={track.recording_year}
                        min={1900}
                        max={2030}
                        onChange={(e) => onUpdate({ recording_year: parseInt(e.target.value) || new Date().getFullYear() })}
                      />
                    </div>
                    <div className="field">
                      <label className="field-label">versión (opcional)</label>
                      <select
                        className="input-pill"
                        value={track.version}
                        onChange={(e) => onUpdate({ version: e.target.value })}
                      >
                        <option value="">—</option>
                        {['Remix', 'Live', 'Acoustic', 'Instrumental', 'Demo'].map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag optional">opcional</span>
                  <div className="field-block-title">ISRC</div>
                </div>
                <p className="field-block-help">
                  Código único de la grabación. Si no tienes, RABAT lo genera al subir.
                </p>
                <div className="field">
                  <input
                    type="text"
                    className="input-pill"
                    placeholder="CCXXXYYNNNNN"
                    maxLength={12}
                    value={track.isrc}
                    onChange={(e) => onUpdate({ isrc: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag">obligatorio</span>
                  <div className="field-block-title">¿tiene voces?</div>
                </div>
                <div className="radio-group">
                  <label className="radio-pill">
                    <input type="radio" checked={track.has_vocals} onChange={() => onUpdate({ has_vocals: true })} />
                    <span className="dot" /><span>sí, tiene voces</span>
                  </label>
                  <label className="radio-pill">
                    <input type="radio" checked={!track.has_vocals} onChange={() => onUpdate({ has_vocals: false })} />
                    <span className="dot" /><span>no, instrumental</span>
                  </label>
                </div>
              </div>

              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag">obligatorio</span>
                  <div className="field-block-title">contenido explícito</div>
                </div>
                <div className="radio-card-group">
                  {([
                    ['explicit', 'explícita', 'incluye blasfemias o lenguaje ofensivo'],
                    ['clean', 'versión limpia', 'hay otra versión explícita; esta es la limpia'],
                    ['not_explicit', 'no explícito', 'la pista NO incluye lenguaje ofensivo en letra ni título'],
                  ] as const).map(([val, title, help]) => (
                    <label key={val} className="radio-card">
                      <input
                        type="radio"
                        checked={track.explicit_content === val}
                        onChange={() => onUpdate({ explicit_content: val })}
                      />
                      <span className="dot" />
                      <div>
                        <div className="rc-title">{title}</div>
                        <div className="rc-help">{help}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="wizard-nav">
              <button className="btn-secondary" onClick={onClose}>cancelar</button>
              <button
                className="btn-primary"
                disabled={!track.title}
                onClick={() => onStepChange(2)}
              >
                SIGUIENTE →
              </button>
            </div>
          </div>
        )}

        {/* MODAL PASO 2 — Letra */}
        {modalStep === 2 && (
          <div>
            <div className="form-stack">
              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag optional">opcional</span>
                  <div className="field-block-title">letra</div>
                </div>
                <label
                  className="toggle-row"
                  onClick={() => onUpdate({ has_lyrics: !track.has_lyrics })}
                  role="button"
                  tabIndex={0}
                >
                  <span className="tg-label">añadir letra a esta pista</span>
                  <span className={`toggle ${track.has_lyrics ? 'on' : ''}`} />
                </label>
                <p className="field-block-help" style={{ marginTop: 14 }}>
                  Solo si la pista tiene voces. La letra debe coincidir exactamente con lo cantado.
                </p>
              </div>
              {track.has_lyrics && (
                <div className="field-block">
                  <div className="field">
                    <label className="field-label">escribe o pega la letra aquí</label>
                    <textarea
                      className="input-pill"
                      placeholder={'[verso 1]\n...\n\n[estribillo]\n...'}
                      value={track.lyrics_text}
                      onChange={(e) => onUpdate({ lyrics_text: e.target.value })}
                      style={{ minHeight: 200 }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="wizard-nav">
              <button className="btn-secondary" onClick={() => onStepChange(1)}>atrás</button>
              <button className="btn-primary" onClick={() => onStepChange(3)}>SIGUIENTE →</button>
            </div>
          </div>
        )}

        {/* MODAL PASO 3 — Audio + origen */}
        {modalStep === 3 && (
          <div>
            <div className="form-stack">
              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag">obligatorio</span>
                  <div className="field-block-title">audio máster</div>
                </div>
                <p className="field-block-help">
                  WAV o FLAC, mínimo 16-bit 44.1 kHz, máximo 24-bit 192 kHz, estéreo.
                </p>
                <div className={`audio-uploader ${track.audio_filename ? 'uploaded' : ''}`}>
                  <input
                    type="file"
                    accept=".wav,.flac,audio/wav,audio/flac"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      onAudioFile(file);
                      onUpdate({ audio_filename: file.name });
                    }}
                  />
                  {track.audio_filename ? (
                    <>
                      <span>{track.audio_filename}</span>
                      <span className="au-meta">listo para subir</span>
                    </>
                  ) : (
                    <span>+ AÑADIR AUDIO</span>
                  )}
                </div>
              </div>

              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag">obligatorio</span>
                  <div className="field-block-title">origen de la pista</div>
                </div>
                <div className="radio-card-group">
                  <label className="radio-card">
                    <input type="radio" checked={track.origin === 'original'} onChange={() => onUpdate({ origin: 'original' })} />
                    <span className="dot" />
                    <div>
                      <div className="rc-title">original</div>
                      <div className="rc-help">es la grabación original de esta canción, o un remix de un tema mío</div>
                    </div>
                  </label>
                  <label className="radio-card">
                    <input type="radio" checked={track.origin === 'cover'} onChange={() => onUpdate({ origin: 'cover' })} />
                    <span className="dot" />
                    <div>
                      <div className="rc-title">cover</div>
                      <div className="rc-help">es mi interpretación de palabras y/o composición de otro creador</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag optional">opcional</span>
                  <div className="field-block-title">youtube content id</div>
                </div>
                <div
                  className={`check-row ${track.youtube_content_id ? 'on' : ''}`}
                  onClick={() => onUpdate({ youtube_content_id: !track.youtube_content_id })}
                  role="checkbox"
                  aria-checked={track.youtube_content_id}
                  tabIndex={0}
                >
                  <div className="cb" />
                  <div className="cb-text">
                    <strong>proteger con content id</strong>
                    <span>reclama ganancias por UGC en YouTube y TikTok.</span>
                  </div>
                </div>
              </div>

              <div className="field-block">
                <div className="field-block-head">
                  <span className="field-block-tag optional">opcional</span>
                  <div className="field-block-title">tiempo de inicio en tiktok</div>
                </div>
                <div
                  className={`check-row ${track.tiktok_preview_start ? 'on' : ''}`}
                  onClick={() => onUpdate({ tiktok_preview_start: !track.tiktok_preview_start })}
                  role="checkbox"
                  aria-checked={track.tiktok_preview_start}
                  tabIndex={0}
                >
                  <div className="cb" />
                  <div className="cb-text">
                    <strong>especificar segundo de preview</strong>
                    <span>en qué segundo empezará la vista previa en TikTok</span>
                  </div>
                </div>
                {track.tiktok_preview_start && (
                  <div className="field" style={{ marginTop: 14 }}>
                    <label className="field-label">segundo de inicio</label>
                    <input
                      type="number"
                      className="input-pill"
                      min={0}
                      placeholder="ej. 30"
                      value={track.tiktok_preview_seconds || ''}
                      onChange={(e) => onUpdate({ tiktok_preview_seconds: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="wizard-nav">
              <button className="btn-secondary" onClick={() => onStepChange(2)}>atrás</button>
              <button
                className="btn-primary"
                disabled={!track.audio_filename}
                onClick={() => onStepChange(4)}
              >
                SIGUIENTE →
              </button>
            </div>
          </div>
        )}

        {/* MODAL PASO 4 — Créditos */}
        {modalStep === 4 && (
          <div>
            {/* Artista primario */}
            <div className="credits-section">
              <div className="credits-head"><h3>artistas</h3></div>
              <div className="credits-list">
                <div className="credit-row">
                  <div className="ci-avatar">A</div>
                  <div className="ci-main">
                    <div className="ci-name">artista primario</div>
                    <div className="ci-role">artista primario</div>
                  </div>
                  <span />
                </div>
              </div>
            </div>

            {(['performer', 'author', 'production'] as const).map((type) => {
              const meta: Record<CreditType, { title: string; help: string; noun: string; roles: string[] }> = {
                performer: {
                  title: 'créditos de interpretación',
                  help: 'Obligatorio: al menos un intérprete. Una persona puede tener más de un rol — añade un crédito por cada uno.',
                  noun: 'intérprete',
                  roles: ['Acordeón','Voces de fondo','Banjo','Bajo','Fagot','Campanas','Violoncelo','Clarinete','Batería','Violín "fiddle"','Flauta','Guitarra','Armónica','Arpa','Trompa','Teclados','Laúd','Metalófono','Artista mezclado','Oboe','Órgano','Percusión','Piano','Programación (DAW)','Rap','Flauta dulce','Artista sampleado','Saxofón','Sintetizador','Pandereta','Trombón','Trompeta','Viola','Viola de gamba','Violín','Vocales','Silbido','Xilófono'],
                },
                author: {
                  title: 'créditos de autoría',
                  help: 'Obligatorio: al menos un compositor. Si es un cover, acredita a los autores originales.',
                  noun: 'autor',
                  roles: ['Compositor','Letrista','Adaptador','Arreglista'],
                },
                production: {
                  title: 'créditos de producción',
                  help: 'Obligatorio: al menos un colaborador técnico. El rol Productor requiere enlaces de Apple Music y Spotify.',
                  noun: 'colaborador',
                  roles: ['Productor','Co-productor','Ingeniero de mezcla','Ingeniero de masterización','Ingeniero de grabación','Ingeniero','Ingeniero asistente','Diseño gráfico'],
                },
              };

              const existing = track.credits.filter((c) => c.credit_type === type);
              const f = forms[type];
              const hasMin = existing.length > 0;

              return (
                <div key={type} className="credits-section">
                  <div className="credits-head">
                    <h3>{meta[type].title}</h3>
                    {/* Botón "+ añadir" solo visible cuando el formulario está cerrado */}
                    {hasMin && !f.open && (
                      <button className="link-add" onClick={() => updateForm(type, { open: true })}>
                        añadir {meta[type].noun}
                      </button>
                    )}
                  </div>
                  <p className="field-block-help">{meta[type].help}</p>

                  {/* Lista de créditos ya añadidos */}
                  {existing.length > 0 && (
                    <div className="credits-list">
                      {existing.map((c) => (
                        <div key={c.id} className="credit-row">
                          <div className="ci-avatar">{c.first_name[0]?.toUpperCase() ?? '?'}</div>
                          <div className="ci-main">
                            <div className="ci-name">{c.first_name} {c.last_name}</div>
                            <div className="ci-role">{c.role}</div>
                            {c.role === 'Productor' && (c.apple_music_url || c.spotify_url) && (
                              <div className="ci-extra">
                                {c.apple_music_url && <a href={c.apple_music_url} target="_blank" rel="noreferrer">apple music</a>}
                                {c.apple_music_url && c.spotify_url && ' · '}
                                {c.spotify_url && <a href={c.spotify_url} target="_blank" rel="noreferrer">spotify</a>}
                              </div>
                            )}
                          </div>
                          <button className="ci-remove" onClick={() => removeCredit(c.id)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulario: siempre visible si no hay créditos; abierto/cerrado si ya hay alguno */}
                  {f.open && (
                    <div className="credit-form">
                      <div className="cf-title">
                        {hasMin ? `añadir otro ${meta[type].noun}` : `añadir ${meta[type].noun}`}
                        {!hasMin && <span style={{ color: 'var(--yellow)', fontSize: 11, marginLeft: 8 }}>obligatorio</span>}
                      </div>
                      <div className="field">
                        <label className="field-label">rol</label>
                        <select
                          className="input-pill"
                          value={f.role}
                          onChange={(e) => updateForm(type, { role: e.target.value })}
                        >
                          <option value="" disabled>elige un rol…</option>
                          {meta[type].roles.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="field-grid">
                        <div className="field">
                          <label className="field-label">nombre</label>
                          <input type="text" className="input-pill" value={f.first_name}
                            onChange={(e) => updateForm(type, { first_name: e.target.value })} />
                        </div>
                        <div className="field">
                          <label className="field-label">apellido</label>
                          <input type="text" className="input-pill" value={f.last_name}
                            onChange={(e) => updateForm(type, { last_name: e.target.value })} />
                        </div>
                      </div>
                      {type === 'production' && f.role === 'Productor' && (
                        <div className="producer-fields show">
                          <div className="pf-eyebrow">› solo para rol = productor: ambos enlaces obligatorios</div>
                          <div className="field">
                            <label className="field-label">apple music — página del productor</label>
                            <input type="url" className="input-pill" placeholder="https://music.apple.com/..."
                              value={f.apple_music_url} onChange={(e) => updateForm(type, { apple_music_url: e.target.value })} />
                          </div>
                          <div className="field">
                            <label className="field-label">spotify — página del productor</label>
                            <input type="url" className="input-pill" placeholder="https://open.spotify.com/artist/..."
                              value={f.spotify_url} onChange={(e) => updateForm(type, { spotify_url: e.target.value })} />
                          </div>
                        </div>
                      )}
                      <div className="cf-actions">
                        {/* Cancelar solo habilitado si ya existe al menos 1 crédito de este tipo */}
                        <button
                          className="btn-secondary"
                          onClick={() => cancelForm(type)}
                          disabled={!hasMin}
                          title={!hasMin ? 'debes añadir al menos uno' : undefined}
                          style={{ opacity: hasMin ? 1 : 0.3 }}
                        >
                          cancelar
                        </button>
                        <button className="btn-add" onClick={() => addCredit(type)}>agregar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Aviso de qué tipos faltan */}
            {!creditsComplete && (
              <p style={{ fontSize: 12, color: 'var(--off-white-dim)', marginTop: 8, textAlign: 'right' }}>
                faltan créditos de:{' '}
                {(['performer', 'author', 'production'] as const)
                  .filter((t) => !track.credits.some((c) => c.credit_type === t))
                  .map((t) => ({ performer: 'interpretación', author: 'autoría', production: 'producción' }[t]))
                  .join(', ')}
              </p>
            )}

            <div className="wizard-nav">
              <button className="btn-secondary" onClick={() => onStepChange(3)}>atrás</button>
              <button
                className="btn-primary"
                disabled={!creditsComplete}
                title={!creditsComplete ? 'añade al menos 1 crédito de cada tipo' : undefined}
                onClick={onFinalize}
              >
                FINALIZAR PISTA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
