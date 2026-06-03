# CLAUDE.md — Contexto del proyecto RABAT Portal

> Léeme primero. Este archivo es el handoff de contexto entre la conversación
> de chat (claude.ai) donde se diseñó el proyecto, y tú (Claude Code en VS Code).
> Asume que la persona con la que hablas es el dueño del proyecto.

---

## Qué es RABAT

RABAT es un **sello discográfico + agencia de management y booking** con base en
España. Su tagline: *"donde firmas y no te f*llan"*. Se posiciona contra los
sellos predatorios y pone al artista en el centro.

Marca con estética **videojuego / streetwear**, paleta negro + azul (#0000FF) +
off-white (#EFEFE4) + amarillo shock (#F9FF00). Inspiraciones: VICIO y NUDE PROJECT.

---

## Qué estamos construyendo

Una **web puente Artista → RABAT → Amuse**:

1. El artista entra con magic-link, llena el flujo de creación de lanzamiento
   (datos, portada, pistas con sus 4 sub-pasos, opciones de envío, reparto de
   regalías), sube los archivos.
2. La metadata cae en un **Google Sheet** dentro del Drive de RABAT.
3. Los archivos (audio máster + portada) caen en **carpetas de Drive** por artista
   y por lanzamiento.
4. RABAT recibe la entrega y **sube manualmente a Amuse** desde su lado (no hay
   integración con Amuse — eso simplifica un montón el alcance técnico).

La web replica el flujo de captura de Amuse pero con identidad RABAT.

---

## Stack

- **Next.js 15** (app router) + **TypeScript** + **React 19**
- **Vercel** para hosting
- **GitHub** para repo
- **Google Drive + Sheets** como storage (no DB)
- **NextAuth (Auth.js v5)** con magic link por email
- **Vanilla CSS** con CSS custom properties (no Tailwind — el brand pide
  una estética muy específica que casa mejor con CSS escrito a mano)

### Por qué Drive + Sheets en vez de DB tradicional
- <20 artistas en fase privada — no necesitamos Postgres
- RABAT ya vive en Drive y prefieren ver datos en familiar (Sheet)
- Cero coste, cero mantenimiento, cero vendor lock-in
- Migrable a Supabase/Postgres si crece — los datos ya están estructurados

---

## Estado actual del código

### ✅ Hecho
- Estructura Next.js inicializada y runnable (`npm install && npm run dev`)
- **Login screen** portado de HTML a componente React funcional (`app/page.tsx`)
- **Sistema de diseño completo** en `app/globals.css`:
  CSS vars del brand, tipografía (Anton + Space Mono), botones (primary/secondary
  con la convención de `[brackets]`), inputs pill, radios pill + cards, toggles,
  checkboxes, login layout, wizard layout, progress bars
- **Tipos TypeScript** completos del esquema en `types/schema.ts`
- **Prototipo HTML** funcional en `public/prototype.html` —
  flujo completo de 5 pasos + modal de pista de 4 sub-pasos +
  editor de créditos con lógica condicional del Productor +
  editor de reparto de regalías con validación. Abre `/prototype.html`
  en el navegador para ver el destino visual de cada pantalla.
- **Esquema completo** en `docs/RABAT_esquema_de_datos.md` (138 géneros,
  todos los roles, reglas condicionales, estructura de Drive, layout del Sheet)

### 🚧 Por hacer (en orden de prioridad)
1. **Portar el wizard a componentes React**.
   El prototipo `public/prototype.html` es la referencia visual exacta.
   Estructura sugerida:
   ```
   components/wizard/
     WizardShell.tsx        — layout + progress bar + nav
     Step1Datos.tsx
     Step2Portada.tsx
     Step3Pistas.tsx        — incluye apertura del TrackModal
     Step4Envio.tsx
     Step5Revisar.tsx       — incluye SplitsEditor + Summary
   components/track-modal/
     TrackModal.tsx         — contenedor con 4 sub-steps
     MStep1Info.tsx
     MStep2Letra.tsx
     MStep3Audio.tsx
     MStep4Creditos.tsx     — el más complejo: 3 secciones de créditos
   components/credits/
     CreditForm.tsx
     CreditList.tsx
   components/splits/
     SplitsEditor.tsx       — la del reparto con validación de suma = 100
   ```
   - State global del wizard: `useReducer` con `{ release: Release, tracks: Track[], credits: Credit[], splits: RoyaltySplit[] }`
   - Validación: usar **react-hook-form + zod** (recomendado, instalar)
   - Persistencia local mientras se llena: **localStorage** o IndexedDB para no perder
     datos en refresh (importante: los formularios son largos)

2. **Custom dropdown buscable para los 138 géneros**.
   El `<select>` nativo no escala. Crear `components/ui/SearchableSelect.tsx`.
   Lista completa en `docs/RABAT_esquema_de_datos.md` (Apéndice A) o
   moverla a `lib/constants/genres.ts`.

3. **Integración Google Drive** (`lib/drive.ts`).
   El patrón clave: el cliente sube directo a Drive vía resumable upload URL,
   nunca a través de Vercel (4.5 MB límite). Ver comentarios en el archivo.
   - Crear service account en Google Cloud Console
   - Compartir la carpeta raíz "RABAT" en Drive con ese service account
   - `npm install googleapis`
   - Implementar `createArtistFolder`, `createReleaseFolder`, `generateSignedUploadUrl`

4. **Integración Google Sheets** (`lib/sheets.ts`).
   Crear el Sheet "RABAT_releases" con 5 pestañas (headers en `types/schema.ts`).
   Implementar `appendRelease`, `appendTrack`, `appendCredits`,
   `appendRoyaltySplits`, `findArtistByEmail`.

5. **Auth con magic link** (`lib/auth.ts` + `app/api/auth/[...nextauth]/route.ts`).
   - `npm install next-auth@beta nodemailer`
   - Configurar SMTP (Resend / Postmark / SendGrid son buenas opciones)
   - Solo emails que estén en la pestaña `artists` del Sheet pueden entrar
     (fase privada). Después abrimos self-signup.

6. **Panel admin para RABAT (opcional pero útil)**.
   Una vista interna donde el equipo de RABAT ve lanzamientos entrantes,
   filtra por estado, abre el link directo a la carpeta en Drive, etc.
   Estado mínimo: si todo va al Sheet, RABAT puede trabajar desde ahí
   (lo cual era la premisa original). Pero un panel propio facilitaría el
   triage.

---

## Decisiones cerradas

- **Drive como "backend"** — sí, para esta escala
- **Magic link**, no contraseñas
- **5 pasos en el wizard principal**: Datos / Portada / Pistas / Envío / Revisar
- **4 sub-pasos en el modal de pista**: Info / Letra / Audio / Créditos
- **Reparto de regalías a nivel release** (no por track), default 100% RABAT, editable
- **`role = Productor`** dispara 2 campos extra obligatorios: Apple Music URL + Spotify URL
- **Carátula** la sube el artista, no RABAT
- **`previously_released = true`** dispara solo `original_release_date` (no UPC)
- **Audio uploads directos cliente → Drive** (no via Vercel)
- **Google Sheets**, no .xlsx

---

## Decisiones aún abiertas (validar con el dueño antes de implementar)

1. **Co-primarios** en un release. ¿Soportamos dos artistas RABAT como
   primarios o siempre uno solo? Por ahora: uno solo (`artist_id` único en Release).
2. **Idioma de la interfaz web**. ¿Solo español o también inglés? Por ahora: solo
   español. Si después i18n, lo metemos con `next-intl`.
3. **Lista de tiendas/DSPs**. En el prototipo metí 12 razonables (Spotify, Apple Music,
   Amazon Music, YouTube Music, TikTok, Tidal, Deezer, Pandora, SoundCloud, IG/FB,
   Napster, Anghami). La lista real debe reflejar a qué plataformas distribuye RABAT
   vía Amuse. Pendiente de confirmar.
4. **Versiones de track** (Remix, Live, Acoustic, ...). El prototipo tiene un set
   inicial; la lista exacta hay que sacarla de Amuse.

---

## Brand guide aplicado al producto

Reglas no negociables al diseñar nuevos componentes:

- **Fondo siempre negro** (#000000)
- **Off-white** (#EFEFE4) para texto principal
- **Amarillo** (#F9FF00) **solo** en CTAs primarios y momentos de atención.
  Si lo meto en más sitios, lo banalizo.
- **Azul** (#0000FF) para acentos secundarios (avatar, accent rare)
- **Botones primarios** = pill amarillo macizo, sin brackets
- **Botones secundarios** = texto con `[brackets]` amarillos
  (el brandguide marca que todo lo entre `[ ]` es clickable)
- **Display = Anton**, en MAYÚSCULAS, condensed, line-height 0.85
- **Body / UI = Space Mono**, en minúsculas dentro de párrafos
- **Inputs en pill completo** (border-radius 999px) — esto da identidad inmediata
  y diferencia visualmente de cualquier SaaS genérico
- **Progress bar segmentada** estilo barra de vida arcade (metáfora de "videojuego"
  del brandguide)

Cuando RABAT licencie las fuentes oficiales (Helvetica Neue Extra Black Condensed
+ Monospac821 BT), sustituir con `next/font/local` en `app/layout.tsx` y eliminar
el `<link>` de Google Fonts.

---

## Estructura de archivos

```
rabat-portal/
├── CLAUDE.md                    ← este archivo
├── README.md
├── package.json
├── tsconfig.json
├── next.config.js
├── .gitignore
├── .env.example                 → copiar a .env.local y rellenar
├── app/
│   ├── layout.tsx               ← root layout + carga fuentes
│   ├── page.tsx                 ← login (portado ✓)
│   ├── globals.css              ← sistema de diseño completo
│   └── wizard/
│       └── page.tsx             ← stub, hay que portar el flujo entero
├── components/                  ← vacío, crear según se vaya portando
├── lib/
│   ├── drive.ts                 ← stub Google Drive helpers
│   ├── sheets.ts                ← stub Google Sheets helpers
│   └── auth.ts                  ← stub NextAuth config
├── types/
│   └── schema.ts                ← tipos TypeScript del esquema
├── public/
│   └── prototype.html           ← prototipo HTML completo (referencia visual)
└── docs/
    └── RABAT_esquema_de_datos.md  ← esquema completo de datos
```

---

## Cómo abordar nuevas tareas (sugerencias)

- **Antes de codear un componente nuevo**, abre `public/prototype.html` en el
  navegador y mira cómo se ve y se comporta el componente equivalente en el
  prototipo. La estética está cerrada.
- **Antes de cambiar el esquema**, revisa `docs/RABAT_esquema_de_datos.md`.
  Si necesitas cambiarlo, actualízalo también ahí + en `types/schema.ts`.
- **Cuando portes un componente del prototipo**, copia el CSS al `globals.css`
  si todavía no está allá. Mucho ya está copiado.
- **Antes de instalar deps grandes** (Tailwind, otra lib de UI, otra lib de
  state), valida con el dueño — hay decisiones de stack hechas a propósito.

---

## Información histórica útil

- El esquema completo se sacó leyendo las capturas del flujo de Amuse + la
  documentación que envió el dueño. Está en `docs/RABAT_esquema_de_datos.md`.
- El prototipo HTML pasó por 3 versiones (v1 / v2 / v3). La v3 es la final y
  está en `public/prototype.html`.
- El dueño es diseñador + programador (no super técnico, pero capaz). Habla
  español. Prefiere explicaciones directas, sin paja.
