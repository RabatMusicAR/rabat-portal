# Esquema de datos — Plataforma RABAT (v2)

Actualizado tras cerrar enums y lógica condicional. Sustituye a v1.

## Cambios desde v1

- Lista completa de géneros (138 opciones, Apéndice A)
- Listas cerradas de roles: intérprete (36), producción (8), autoría (4)
- Créditos de producción con `role = Productor`: dos URLs obligatorias adicionales (Apple Music + Spotify del productor)
- `previously_released = true` solo dispara `original_release_date` (sin UPC)
- Reparto de regalías por defecto: 100 % RABAT, modificable por el artista
- Carátula la sube el artista (con validación de dimensiones en cliente)

---

## Storage

### Google Sheet — `RABAT_releases.gsheet`

Cinco pestañas:

1. `releases` — un row por lanzamiento
2. `tracks` — un row por pista (FK → release)
3. `credits` — un row por persona acreditada (FK → track + `credit_type`)
4. `royalty_splits` — un row por línea de reparto (FK → release)
5. `artists` — catálogo de artistas firmados

### Estructura de carpetas en Drive

```
/RABAT/
  /{artist_name}/
    /{release_title}__{release_id_short}/
      cover.jpg
      /tracks/
        01_{track_title}.wav
        02_{track_title}.wav
        lyrics_01.txt
        lyrics_02.txt
```

---

## RELEASE — Datos del lanzamiento

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `release_id` | uuid | sí | generado por nosotros |
| `artist_id` | FK | sí | artista primario (ver decisión pendiente sobre co-primarios) |
| `title` | string | sí | |
| `label` | string | sí | default "RABAT" |
| `genre` | enum | sí | una de las 138 opciones del Apéndice A |
| `title_language` | enum (ISO 639-1) | sí | dropdown |
| `previously_released` | bool | sí | |
| `original_release_date` | date | si `previously_released = true` | único campo extra |
| `cover_drive_id` | string | sí | JPG/PNG cuadrado, min 1400×1400, recomendado 3000×3000 |
| `status` | enum | sí | `draft` / `submitted` / `in_review` / `uploaded_to_amuse` / `live` |
| `created_at` | timestamp | sí | |
| `submitted_at` | timestamp | no | |

---

## TRACK — Datos de la pista

### Paso 1 · Información básica

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `track_id` | uuid | sí | |
| `release_id` | FK | sí | |
| `track_number` | int | sí | |
| `title` | string | sí | |
| `recording_year` | int (YYYY) | sí | |
| `version` | enum | no | dropdown — lista pendiente de Amuse |
| `isrc` | string | no | regex `CCXXXYYNNNNN` |
| `has_vocals` | bool | sí | |
| `explicit_content` | enum | sí | `explicit` / `clean` / `not_explicit` |

### Paso 2 · Letra (opcional)

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `has_lyrics` | bool | sí | toggle |
| `lyrics_text` | text | si has_lyrics y no archivo | pegar directo |
| `lyrics_file_drive_id` | string | si has_lyrics y no texto | .txt |

### Paso 3 · Audio, origen, plataformas

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `audio_master_drive_id` | string | sí | WAV o FLAC. 16-bit 44.1 kHz mín, máx 24-bit 192 kHz, estéreo |
| `origin` | enum | sí | `original` / `cover` |
| `youtube_content_id` | bool | sí | |
| `tiktok_preview_start_seconds` | int | no | |

### Paso 4 · Artistas y créditos

Va a la tabla `credits` (relacional). Ver siguiente sección.

---

## CREDITS — tabla unificada de personas acreditadas

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `credit_id` | uuid | sí | |
| `track_id` | FK | sí | |
| `credit_type` | enum | sí | `performer` / `author` / `production` / `featured_artist` |
| `role` | enum | sí | depende del `credit_type` — ver listas abajo |
| `first_name` | string | sí | |
| `last_name` | string | sí | |
| `apple_music_url` | url | si `credit_type = production` y `role = Productor` | link a página del productor en Apple Music |
| `spotify_url` | url | si `credit_type = production` y `role = Productor` | link a página del productor en Spotify |

### Roles permitidos por `credit_type`

**`performer`** (Créditos de interpretación — mínimo uno por track):

```
Acordeón, Voces de fondo, Banjo, Bajo, Fagot, Campanas, Violoncelo,
Clarinete, Batería, Violín "fiddle", Flauta, Guitarra, Armónica, Arpa,
Trompa, Teclados, Laúd, Metalófono, Artista mezclado, Oboe, Órgano,
Percusión, Piano, Programación (DAW), Rap, Flauta dulce,
Artista sampleado, Saxofón, Sintetizador, Pandereta, Trombón, Trompeta,
Viola, Viola de gamba, Violín, Vocales, Silbido, Xilófono
```

**`author`** (Créditos de autoría — mínimo un compositor obligatorio; si origin = cover, son los autores originales):

```
Compositor, Letrista, Adaptador, Arreglista
```

**`production`** (Créditos de producción — mínimo uno obligatorio):

```
Productor, Co-productor, Ingeniero de mezcla, Ingeniero de masterización,
Ingeniero de grabación, Ingeniero, Ingeniero asistente, Diseño gráfico
```

> **Regla condicional:** cuando `credit_type = production` y `role = Productor`, los campos `apple_music_url` y `spotify_url` son obligatorios. El front debe revelar esos dos inputs solo cuando se elige Productor en el dropdown.

**`featured_artist`** (artistas invitados al track, no el primario):

- `role`: libre (típicamente "feat.") o sin role
- `first_name`, `last_name`

---

## ROYALTY_SPLITS — Reparto de regalías

**Comportamiento por defecto:** al crear el release, se inserta automáticamente una fila:

```
{ recipient_name: "RABAT Music", percentage: 100.00 }
```

El artista puede dejarlo así o modificarlo añadiendo otras filas. UI: botón "Modificar reparto" que abre el editor; si no lo toca, sale 100 % RABAT.

| Campo | Tipo | Notas |
|---|---|---|
| `split_id` | uuid | |
| `release_id` | FK | nivel release (no por track) |
| `recipient_name` | string | |
| `percentage` | decimal(5,2) | |

**Regla:** suma de `percentage` por `release_id` debe ser exactamente 100.00. Validar en cliente y servidor.

---

## ARTISTS — catálogo de artistas firmados

| Campo | Tipo | Notas |
|---|---|---|
| `artist_id` | uuid | |
| `name` | string | nombre artístico |
| `legal_name` | string | nombre legal |
| `email` | string | para magic link |
| `drive_folder_id` | string | |
| `created_at` | timestamp | |
| `active` | bool | |

RABAT crea estos registros manualmente. La creación dispara: (1) crear carpeta del artista en Drive, (2) enviar magic link de bienvenida.

---

## Decisiones aún pendientes

1. **Co-primarios** en un release (dos artistas RABAT como artistas principales, no feat). De momento `artist_id` es único.
2. **Idioma de la interfaz web** (no del título del release). Si solo español, ahorra trabajo; si i18n desde el inicio, lo metemos en la arquitectura desde el día uno.
3. **Lista de `version` de track** (Remix, Live, Acoustic, Instrumental, ...) — necesitamos el set exacto de Amuse.

---

## Apéndice A · Lista completa de géneros (138)

```
Alternative
Alternative / College Rock
Alternative / Emo
Alternative / Goth Rock
Alternative / Grunge
Alternative / Indie Rock
Alternative / New Wave
Alternative / Punk
Blues
Blues / Acoustic Blues
Blues / Chicago Blues
Blues / Classic Blues
Blues / Contemporary Blues
Blues / Country Blues
Blues / Delta Blues
Blues / Electric Blues
Children's Music
Children's Music / Lullabies
Children's Music / Sing-Along
Country
Country / Alternative Country
Country / Americana
Country / Bluegrass
Country / Contemporary Bluegrass
Country / Contemporary Country
Country / Country Gospel
Country / Honky Tonk
Country / Outlaw Country
Country / Traditional Bluegrass
Country / Traditional Country
Country / Urban Cowboy
Dance
Dance / Afro House
Dance / Breakbeat
Dance / Drum & Bass/Jungle
Dance / Hardstyle/Hardcore
Dance / House
Dance / Techno
Dance / Trance
Dance / UK Garage
Easy Listening / Lounge
Easy Listening / Swing
Electronic
Electronic / Amapiano
Electronic / Ambient
Electronic / Bass
Electronic / Downtempo
Electronic / Dubstep
Electronic / Electronica
Electronic / Funk Carioca/Baile Funk
Electronic / IDM/Experimental
Electronic / Industrial
Electronic / Levant Electronic
Electronic / Maghreb Electronic
Folk
Hip Hop/Rap
Hip Hop/Rap / Alternative Rap
Hip Hop/Rap / Dirty South
Hip Hop/Rap / East Coast Rap
Hip Hop/Rap / Gangsta Rap
Hip Hop/Rap / Hardcore Rap
Hip Hop/Rap / Hip-Hop
Hip Hop/Rap / Latin Rap
Hip Hop/Rap / Old School Rap
Hip Hop/Rap / Rap
Hip Hop/Rap / Trap
Hip Hop/Rap / UK Hip Hop
Hip Hop/Rap / Underground Rap
Hip Hop/Rap / West Coast Rap
Holiday
Holiday / Christmas
Holiday / Christmas: Children's
Holiday / Christmas: Classic
Holiday / Christmas: Country
Holiday / Christmas: Jazz
Holiday / Christmas: Modern
Holiday / Christmas: Pop
Holiday / Christmas: R&B
Holiday / Christmas: Religious
Holiday / Christmas: Rock
Holiday / Easter
Holiday / Halloween
Holiday / Thanksgiving
Inspirational
Jazz
Jazz / Avant-Garde Jazz
Jazz / Big Band
Jazz / Bop
Jazz / Bossa Nova
Jazz / Contemporary Jazz
Jazz / Cool
Jazz / Crossover Jazz
Jazz / Dixieland
Jazz / Easy Listening
Jazz / Fusion
Jazz / Hard Bop
Jazz / Latin Jazz
Jazz / Mainstream Jazz
Jazz / Ragtime
Jazz / Smooth Jazz
Jazz / Trad Jazz
Latin
Latin / Alternativo & Rock Latino
Latin / Baladas y Boleros
Latin / Contemporary Latin
Latin / Flamenco
Latin / Pop Latino
Latin / Raíces
Latin / Reggaeton y Hip-Hop
Latin / Regional Mexicano
Latin / Salsa y Tropical
New Age
New Age / Meditation
New Age / Travel
New Age / Yoga
Pop
Pop / Adult Contemporary
Pop / Alternative Pop
Pop / Britpop
Pop / Indie Pop
Pop / Pop/Rock
Pop / Singer/Songwriter
Pop / Soft Rock
Pop / Teen Pop
R&B/Soul
R&B/Soul / Contemporary R&B
R&B/Soul / Disco
R&B/Soul / Doo Wop
R&B/Soul / Funk
R&B/Soul / Motown
R&B/Soul / Neo-Soul
R&B/Soul / Soul
Reggae
Reggae / Dub
Reggae / Lovers Rock
Reggae / Modern Dancehall
Reggae / Roots Reggae
Reggae / Ska
Rock
Rock / Adult Alternative
Rock / American Trad Rock
Rock / Arena Rock
Rock / Blues-Rock
Rock / British Invasion
Rock / Death Metal/Black Metal
Rock / Glam Rock
Rock / Hair Metal
Rock / Hard Rock
Rock / Heavy Metal
Rock / Jam Bands
Rock / Prog-Rock/Art Rock
Rock / Psychedelic
Rock / Rock & Roll
Rock / Rockabilly
Rock / Roots Rock
Rock / Southern Rock
Rock / Surf
Rock / Tex-Mex
Soundtrack
Soundtrack / Foreign Cinema
Soundtrack / Musicals
Soundtrack / Original Score
Soundtrack / TV Soundtrack
Soundtrack / Video Game
Vocal
Vocal / Standards
Vocal / Traditional Pop
Vocal / Vocal Jazz
Vocal / Vocal Pop
World
World / Afro Pop
World / Afrobeats
World / Christian & Gospel
World / Klezmer
World / Polka
```
