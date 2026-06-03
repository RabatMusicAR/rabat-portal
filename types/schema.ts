/**
 * Tipos TypeScript derivados de RABAT_esquema_de_datos_v2.md.
 *
 * Si actualizas el esquema (docs/RABAT_esquema_de_datos.md),
 * actualiza estos tipos en paralelo.
 */

// ============================================
// Enums
// ============================================

export type ReleaseStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'uploaded_to_amuse'
  | 'live';

export type ExplicitContent = 'explicit' | 'clean' | 'not_explicit';

export type TrackOrigin = 'original' | 'cover';

export type CreditType =
  | 'performer'
  | 'author'
  | 'production'
  | 'featured_artist';

export type AuthorRole = 'Compositor' | 'Letrista' | 'Adaptador' | 'Arreglista';

export type ProductionRole =
  | 'Productor'
  | 'Co-productor'
  | 'Ingeniero de mezcla'
  | 'Ingeniero de masterización'
  | 'Ingeniero de grabación'
  | 'Ingeniero'
  | 'Ingeniero asistente'
  | 'Diseño gráfico';

export type PerformerRole =
  | 'Acordeón'
  | 'Voces de fondo'
  | 'Banjo'
  | 'Bajo'
  | 'Fagot'
  | 'Campanas'
  | 'Violoncelo'
  | 'Clarinete'
  | 'Batería'
  | 'Violín "fiddle"'
  | 'Flauta'
  | 'Guitarra'
  | 'Armónica'
  | 'Arpa'
  | 'Trompa'
  | 'Teclados'
  | 'Laúd'
  | 'Metalófono'
  | 'Artista mezclado'
  | 'Oboe'
  | 'Órgano'
  | 'Percusión'
  | 'Piano'
  | 'Programación (DAW)'
  | 'Rap'
  | 'Flauta dulce'
  | 'Artista sampleado'
  | 'Saxofón'
  | 'Sintetizador'
  | 'Pandereta'
  | 'Trombón'
  | 'Trompeta'
  | 'Viola'
  | 'Viola de gamba'
  | 'Violín'
  | 'Vocales'
  | 'Silbido'
  | 'Xilófono';

export type TrackVersion =
  | 'Remix'
  | 'Live'
  | 'Acoustic'
  | 'Instrumental'
  | 'Demo';

// ============================================
// Entities
// ============================================

export interface Release {
  release_id: string;
  artist_id: string;
  title: string;
  label: string; // default "RABAT"
  genre: string; // una de las 138 opciones del esquema
  title_language: string; // ISO 639-1
  previously_released: boolean;
  original_release_date?: string; // ISO date string, si previously_released
  cover_drive_id: string;
  status: ReleaseStatus;
  created_at: string;
  submitted_at?: string;
}

export interface Track {
  track_id: string;
  release_id: string;
  track_number: number;
  title: string;
  recording_year: number;
  version?: TrackVersion;
  isrc?: string; // regex CCXXXYYNNNNN
  has_vocals: boolean;
  explicit_content: ExplicitContent;
  has_lyrics: boolean;
  lyrics_text?: string;
  lyrics_file_drive_id?: string;
  audio_master_drive_id: string;
  origin: TrackOrigin;
  youtube_content_id: boolean;
  tiktok_preview_start_seconds?: number;
}

export interface Credit {
  credit_id: string;
  track_id: string;
  credit_type: CreditType;
  role: string; // PerformerRole | AuthorRole | ProductionRole | string libre para featured_artist
  first_name: string;
  last_name: string;
  // Solo cuando credit_type === 'production' && role === 'Productor'
  apple_music_url?: string;
  spotify_url?: string;
}

export interface RoyaltySplit {
  split_id: string;
  release_id: string;
  recipient_name: string;
  percentage: number; // suma por release_id debe = 100.00
}

export interface Artist {
  artist_id: string;
  name: string;
  legal_name: string;
  email: string;
  drive_folder_id: string;
  created_at: string;
  active: boolean;
}

// ============================================
// Constantes útiles
// ============================================

export const GENRES = [
  'Alternative',
  'Alternative / College Rock',
  'Alternative / Emo',
  'Alternative / Goth Rock',
  'Alternative / Grunge',
  'Alternative / Indie Rock',
  'Alternative / New Wave',
  'Alternative / Punk',
  // ... 130 más en docs/RABAT_esquema_de_datos.md (Apéndice A)
  // TODO: importar lista completa cuando portemos el dropdown de género
] as const;

export const TITLE_LANGUAGES = [
  'Español',
  'English',
  'Português',
  'Français',
  'Italiano',
  'Deutsch',
  'Instrumental / sin idioma',
] as const;
