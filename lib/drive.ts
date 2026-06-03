/**
 * Helpers para Google Drive API.
 *
 * REQUISITO: usar una Shared Drive (Unidad compartida) como raíz.
 * Los service accounts NO tienen cuota de almacenamiento propia, por lo que
 * no pueden subir archivos a un Drive personal. Las Shared Drives sí tienen
 * cuota y sí admiten service accounts como miembros.
 *
 * SETUP:
 * 1. Google Drive → Unidades compartidas → Nueva → "RABAT Music"
 * 2. Añadir el service account (GOOGLE_CLIENT_EMAIL) como "Gestor de contenido"
 * 3. Copiar el ID de la URL de la Shared Drive → GOOGLE_DRIVE_ROOT_FOLDER_ID
 * 4. Todas las llamadas incluyen supportsAllDrives: true
 */

import { google } from 'googleapis';

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

async function createFolder(name: string, parentId: string): Promise<string> {
  const drive = google.drive({ version: 'v3', auth: getAuth() });
  const res = await drive.files.create({
    supportsAllDrives: true, // obligatorio para Shared Drives
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  if (!res.data.id) throw new Error(`Drive: no ID returned for folder "${name}"`);
  return res.data.id;
}

/**
 * Crea /RABAT Music/{artistName}/ la primera vez que se firma a un artista.
 */
export async function createArtistFolder(artistName: string): Promise<string> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID no configurado');
  return createFolder(artistName, rootId);
}

/**
 * Crea la carpeta del release y la subcarpeta de pistas:
 *   /RABAT Music/{artistName}/{releaseTitle}__{shortId}/
 *   /RABAT Music/{artistName}/{releaseTitle}__{shortId}/tracks/
 */
export async function createReleaseFolder(
  artistFolderId: string,
  releaseTitle: string,
  releaseId: string,
): Promise<{ releaseFolderId: string; tracksFolderId: string }> {
  const safeName = releaseTitle.replace(/[/\\?%*:|"<>]/g, '-').trim();
  const folderName = `${safeName}__${releaseId.slice(0, 8)}`;
  const releaseFolderId = await createFolder(folderName, artistFolderId);
  const tracksFolderId = await createFolder('tracks', releaseFolderId);
  return { releaseFolderId, tracksFolderId };
}

/**
 * Busca la carpeta del artista por nombre; si no existe, la crea.
 * Incluye búsqueda en Shared Drives.
 */
export async function findOrCreateArtistFolder(
  artistEmail: string,
  artistName: string,
): Promise<string> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID no configurado');

  const drive = google.drive({ version: 'v3', auth: getAuth() });
  const query = `name = '${artistName}' and '${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    pageSize: 1,
    supportsAllDrives: true,         // buscar en Shared Drives
    includeItemsFromAllDrives: true,
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  const name = artistName || artistEmail.split('@')[0];
  return createFolder(name, rootId);
}

/**
 * Lista archivos en una carpeta (para panel admin).
 */
export async function listFolderContents(folderId: string): Promise<unknown[]> {
  const drive = google.drive({ version: 'v3', auth: getAuth() });
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, createdTime)',
    orderBy: 'createdTime',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files ?? [];
}
