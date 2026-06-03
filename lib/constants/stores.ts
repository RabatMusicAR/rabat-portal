// Plataformas de distribución — confirmar con RABAT cuáles habilita Amuse
export const STORES = [
  'Spotify',
  'Apple Music',
  'Amazon Music',
  'YouTube Music',
  'TikTok',
  'Tidal',
  'Deezer',
  'Pandora',
  'SoundCloud',
  'Instagram / FB',
  'Napster',
  'Anghami',
] as const;

export type Store = (typeof STORES)[number];
