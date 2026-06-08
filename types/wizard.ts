// Tipos de borrador usados durante el wizard (distintos de los tipos finales del esquema)

export type ExplicitContent = 'explicit' | 'clean' | 'not_explicit';
export type TrackOrigin = 'original' | 'cover';
export type CreditType = 'performer' | 'author' | 'production';
export type ReleaseDateMode = 'asap' | 'specific';

export interface CreditDraft {
  id: string;
  credit_type: CreditType;
  // Una misma persona puede acreditarse con varios roles a la vez
  roles: string[];
  first_name: string;
  last_name: string;
  apple_music_url: string;
  spotify_url: string;
}

export interface TrackDraft {
  id: string;
  // MStep 1
  title: string;
  recording_year: number;
  version: string;
  isrc: string;
  has_vocals: boolean;
  explicit_content: ExplicitContent;
  // MStep 2
  has_lyrics: boolean;
  lyrics_text: string;
  // MStep 3
  audio_filename: string;
  audio_drive_id: string;
  origin: TrackOrigin;
  youtube_content_id: boolean;
  tiktok_preview_start: boolean;
  tiktok_preview_seconds: number;
  // MStep 4
  credits: CreditDraft[];
  // Estado de progreso (0-4 pasos completados)
  completed_steps: number;
}

export interface SplitDraft {
  id: string;
  recipient_name: string;
  percentage: number;
}

export interface ReleaseForm {
  artist_name: string;
  title: string;
  label: string;
  genre: string;
  title_language: string;
  previously_released: boolean;
  original_release_date: string;
  cover_filename: string;
  cover_preview: string;
  cover_drive_id: string;
  release_date_mode: ReleaseDateMode;
  release_date: string;
  stores: string[];
}

// Payload que se envía al endpoint /api/release/submit
export interface SubmitPayload {
  release_id: string;
  artist_email: string;
  release: ReleaseForm;
  tracks: TrackDraft[];
  splits: SplitDraft[];
}