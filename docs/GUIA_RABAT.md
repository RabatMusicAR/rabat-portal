# 📘 Guía de uso y mantenimiento — Portal RABAT

> Documento de traspaso. Pensado para que **cualquier persona de RABAT** pueda
> operar, modificar y mantener la plataforma, aunque quien la construyó no esté.
> Última actualización: junio 2026.

---

## 0. Resumen en 30 segundos

- La web es un **puente Artista → RABAT → Amuse**. El artista entra, rellena su
  lanzamiento y sube los archivos. RABAT recibe todo y **sube manualmente a Amuse**.
- **No hay base de datos.** Los datos van a un **Google Sheet** y los archivos a
  **Google Drive**. RABAT trabaja desde ahí.
- Cada envío dispara un **email de aviso** a `ar@rabatmusicgroup.com`.
- La web está en **https://rabat-portal.vercel.app** (alojada en Vercel).
- Para publicar cambios: **`git push` a la rama `main`** → Vercel despliega solo.

---

## 1. ¿Qué hace la plataforma? (flujo completo)

1. El artista entra a la web y pone su email.
2. Rellena el asistente de 5 pasos:
   **Datos → Portada → Pistas → Envío → Revisar.**
   Cada pista tiene su propio sub-asistente de 4 pasos
   (**Info → Letra → Audio → Créditos**).
3. Al darle a **"Enviar a RABAT"**:
   - La **portada** y los **másters** se suben directos a **Google Drive**.
   - La **metadata** (datos, pistas, créditos, reparto) se escribe en el **Google Sheet**.
   - Se envía un **email de aviso** a RABAT.
4. RABAT recibe el aviso, abre la carpeta de Drive, coge los archivos, lee la
   metadata del Sheet y **lo sube a Amuse a mano**.

> No hay integración con Amuse: el último paso (subir a Amuse) lo hace una persona.
> Eso es a propósito — simplifica todo y evita romperse cuando Amuse cambia.

---

## 2. Operativa diaria de RABAT (lo que usa el equipo)

### 2.1 Cuándo llega un envío
Llega un correo a **`ar@rabatmusicgroup.com`** con asunto
**"🎵 Nuevo envío — [artista] — [título]"**. Incluye artista, título, nº de pistas,
género, fecha de salida y un botón **"Abrir carpeta en Drive"**.

### 2.2 Dónde están los datos — el Google Sheet
Es el Sheet **"RABAT_releases"** (en el Drive de RABAT). Tiene 5 pestañas:

| Pestaña | Qué contiene |
|---|---|
| `releases` | Una fila por lanzamiento: artista, título, sello, género, idioma, fecha, **hora de salida (España)**, tiendas, etc. |
| `tracks` | Una fila por pista: título, año, ISRC, explícito, letra, **ID del máster en Drive**, etc. |
| `credits` | Una fila por crédito: tipo (`artist`/`performer`/`author`/`production`), rol(es), nombre y enlaces de Spotify/Apple |
| `royalty_splits` | Reparto de regalías por lanzamiento (suma 100%) |
| `artists` | Lista de artistas (para el futuro control de acceso) |

> 💡 Para encontrar todo lo de un envío, busca el `release_id` de la pestaña
> `releases` y fíltralo en `tracks`, `credits` y `royalty_splits`.

### 2.3 Dónde están los archivos — Google Drive
Estructura dentro de la Unidad compartida de RABAT:

```
RABAT Music (Unidad compartida)
└── {nombre del artista}/
    └── {título del lanzamiento}__{id corto}/
        ├── cover.jpg              ← la PORTADA está aquí
        └── tracks/                ← ⚠️ los MÁSTERS están en esta subcarpeta
            ├── cancion-1__a1b2c3.wav
            └── cancion-2__d4e5f6.wav
```

> ⚠️ **Lo más importante para el día a día:** el máster **no** está suelto en la
> carpeta del lanzamiento, sino dentro de la subcarpeta **`tracks/`**. Si no lo ves,
> es que estás mirando la carpeta de arriba.

### 2.4 Cómo procesar un envío (paso a paso)
1. Abre el email → botón **"Abrir carpeta en Drive"**.
2. Descarga la `cover` (carpeta del release) y los `.wav` (subcarpeta `tracks/`).
3. Abre el Sheet y lee la metadata de ese `release_id`
   (créditos, ISRC, fechas, reparto, tiendas, hora de salida…).
4. Sube todo a **Amuse** a mano con esos datos.

---

## 3. Cómo se publica un cambio (DEPLOY)

La web está conectada de GitHub a Vercel. **Cada `git push` a la rama `main`
despliega solo a producción.** No hay que tocar el panel de Vercel.

### Pasos exactos (desde la terminal)
```bash
# 1. Entra SIEMPRE en la carpeta del proyecto (ahí vive el .git)
cd "ruta/al/proyecto/rabat-portal"

# 2. Comprueba que compila (si falla aquí, fallará en Vercel)
npm run build

# 3. Mira qué cambiaste
git status
git diff

# 4. Guarda los cambios
git add -A
git commit -m "describe el cambio en una frase"

# 5. Publica → esto lanza el deploy de producción
git push origin main
```

Vercel construye en ~1–2 min y queda en vivo en **rabat-portal.vercel.app**.
Se ve el progreso en **vercel.com → proyecto `rabat-portal` → Deployments**.

### Cosas a tener en cuenta
- **`main` = producción.** Si subes a otra rama, Vercel hace un *Preview* (no producción).
- **Si el build falla en Vercel, producción NO cambia** (se queda el deploy anterior). Corriges y vuelves a pushear.
- **Los typos de CSS no los detecta el build** (compila igual). Revisa el `git diff` antes de subir.
- **Cambiar variables de entorno en Vercel requiere un redeploy** para que se apliquen (Deployments → ⋯ del último → *Redeploy*, o un push nuevo).

---

## 4. Dónde vive cada parte del código

```
rabat-portal/
├── app/
│   ├── page.tsx                 ← pantalla de LOGIN (la home con el RABAT grande)
│   ├── wizard/page.tsx          ← TODO el asistente + el modal de pista (archivo grande)
│   ├── layout.tsx               ← carga las fuentes oficiales
│   ├── globals.css              ← TODOS los estilos (colores, tipografía, responsive…)
│   ├── fonts/                   ← archivos de las fuentes oficiales (.ttf)
│   └── api/
│       ├── release/submit/      ← recibe el envío: escribe en Sheets + manda el email
│       └── drive/
│           ├── create-folder/   ← crea las carpetas del release en Drive
│           ├── prepare-upload/  ← prepara la subida directa del archivo a Drive
│           └── upload-chunk/    ← (en desuso, posible fallback)
├── lib/
│   ├── sheets.ts                ← escribe/lee el Google Sheet
│   ├── drive.ts                 ← crea carpetas en Drive
│   ├── notify.ts                ← envía el email de aviso (Resend)
│   └── constants/
│       ├── genres.ts            ← lista de ~138 géneros
│       └── stores.ts            ← lista de tiendas/DSPs (12)
├── types/                       ← "forma" de los datos (TypeScript)
└── docs/
    ├── GUIA_RABAT.md            ← este documento
    └── RABAT_esquema_de_datos.md← detalle técnico del esquema de datos
```

---

## 5. Cómo cambiar las cosas más habituales

> Todo cambio: editar el archivo → `npm run build` → `git commit` → `git push`. (Sección 3)

| Quiero cambiar… | Archivo a tocar | Detalle |
|---|---|---|
| **Lista de tiendas/DSPs** | `lib/constants/stores.ts` | Añade/quita líneas del array `STORES`. |
| **Lista de géneros** | `lib/constants/genres.ts` | Array `GENRES`. |
| **Roles de crédito** (intérprete, autoría, producción, artista) | `app/wizard/page.tsx` → busca `CREDIT_META` | Cada tipo tiene su array `roles`. Ahí añadiste "Remixer", "Voz principal", etc. |
| **Versiones de pista** (Remix, Live…) | `app/wizard/page.tsx` → busca `'Remix','Live'` | Array dentro del campo "versión". |
| **Textos / copys del asistente** | `app/wizard/page.tsx` | Busca el texto literal y cámbialo. |
| **Textos del login** | `app/page.tsx` | Mensaje, email de contacto, badge. |
| **Colores y tipografía** | `app/globals.css` (arriba del todo, `:root`) | Variables `--black`, `--yellow`, `--blue`, `--off-white`, `--font-display`, `--font-mono`. |
| **Cómo se ve en móvil** | `app/globals.css` (al final) | Bloques `@media (max-width: 720px)` y `@media (max-width: 560px)`. |
| **A quién llega el email de aviso** | Vercel → variables `NOTIFY_EMAIL` / `NOTIFY_FROM` | No es código. Ver sección 6. |
| **Columnas del Sheet** | `lib/sheets.ts` + la cabecera del propio Sheet | ⚠️ Si añades una columna en el código, añádela también en la cabecera del Sheet (misma posición). |

---

## 6. El aviso por email (cómo funciona)

- **Servicio:** [Resend](https://resend.com) (gratis hasta 3.000 emails/mes).
- **Código:** `lib/notify.ts`. Se llama desde `app/api/release/submit/route.ts`
  justo después de guardar en el Sheet.
- **Es "best-effort":** si el email falla, **el envío del artista se guarda igual**
  (no se rompe nada). El error se ve en los *Logs* de Vercel.
- **Variables (en Vercel → Settings → Environment Variables):**

| Variable | Valor actual | Para qué |
|---|---|---|
| `RESEND_API_KEY` | la API key de Resend (`re_…`) | Permiso para enviar |
| `NOTIFY_EMAIL` | `ar@rabatmusicgroup.com` | A quién llega (varios separados por coma) |
| `NOTIFY_FROM` | `RABAT <onboarding@resend.dev>` | Desde qué dirección sale |

### ⚠️ Limitación importante ahora mismo
El dominio `rabatmusicgroup.com` **NO está verificado en Resend** todavía. Mientras
no se verifique:
- El email **solo puede llegar a `ar@rabatmusicgroup.com`** (la dirección de la
  cuenta de Resend). Si pones otra en `NOTIFY_EMAIL`, fallará.
- El remitente es `onboarding@resend.dev` (dirección de pruebas de Resend).

**Para mejorar esto** (enviar a más correos del equipo y desde una dirección de RABAT):
1. Entra en **resend.com → Domains → Add Domain → `rabatmusicgroup.com`**.
2. Añade los registros DNS que da Resend (en el proveedor del dominio).
3. Cuando esté verificado, en Vercel cambia:
   - `NOTIFY_FROM` → `RABAT <portal@rabatmusicgroup.com>`
   - `NOTIFY_EMAIL` → los correos que quieras, separados por coma
4. **Redeploy** (sección 3).

---

## 7. Cuentas, accesos y secretos (¡guardar bien!)

La plataforma depende de 4 servicios externos. **Hay que conservar el acceso a las
4 cuentas.** Si se pierde alguna, deja de funcionar la parte correspondiente.

| Servicio | Para qué | Quién/qué cuenta |
|---|---|---|
| **GitHub** (`RabatMusicAR/rabat-portal`) | Guarda el código | Organización RabatMusicAR |
| **Vercel** (`rabat-portal`) | Aloja la web y guarda las variables | Equipo `rabat-music-s-projects` |
| **Google** (Drive + Sheet) | Guarda archivos y metadata | Cuenta de Google de RABAT + una "cuenta de servicio" |
| **Resend** | Envía el email de aviso | Cuenta creada con `ar@rabatmusicgroup.com` |

### Los "secretos" (claves) y dónde viven
Las claves **nunca están en el código** (sería un agujero de seguridad). Viven en
dos sitios:
- **En Vercel** → Settings → Environment Variables (las de **producción**).
- **En tu ordenador** → archivo `.env.local` (para pruebas locales; está en
  `.gitignore`, **no se sube nunca a GitHub**).

Variables que existen:
```
GOOGLE_CLIENT_EMAIL          ← cuenta de servicio de Google (Drive+Sheets)
GOOGLE_PRIVATE_KEY           ← clave privada de esa cuenta de servicio
GOOGLE_DRIVE_ROOT_FOLDER_ID  ← ID de la Unidad compartida raíz en Drive
GOOGLE_SHEET_ID              ← ID del Sheet "RABAT_releases"
RESEND_API_KEY               ← clave de Resend (email)
NOTIFY_EMAIL / NOTIFY_FROM   ← destinatario y remitente del aviso
```

> 🔒 **Regla de oro:** si una clave se filtra (se ve en un sitio público), hay que
> **regenerarla** en su servicio (Google Cloud / Resend) y actualizarla en Vercel.
> Nunca pegues una clave dentro de un archivo de código.

### Las fuentes
Las tipografías oficiales (**Helvetica Neue Condensed Black** + **Monospac821 BT**)
están en `app/fonts/`. Son de pago/licenciadas — no se redistribuyen fuera del proyecto.

---

## 8. Cosas que tener muy en cuenta (límites conocidos)

1. **No hay control de acceso real todavía.** Hoy el login solo pide un email con
   formato válido y deja entrar a cualquiera que conozca la URL. **Cualquiera podría
   enviar un tema.** Pendiente: activar el "magic link" y restringir a los emails de
   la pestaña `artists`. Mientras tanto, **no difundir la URL públicamente**.
2. **El email solo llega a `ar@rabatmusicgroup.com`** hasta verificar el dominio en
   Resend (sección 6).
3. **Los másters están en la subcarpeta `tracks/`** de cada release (sección 2.3).
4. **El reparto de regalías debe sumar exactamente 100%** o el envío no se completa.
5. **Los datos viven en Google (Drive + Sheets), no hay base de datos.** El "backup"
   es el propio Google. No borres ni reordenes las **cabeceras** de las pestañas del
   Sheet: el código escribe por posición de columna.
6. **Subidas grandes (WAV):** van **directas del navegador a Drive** (no pasan por la
   web), por eso requiere una **Unidad compartida** de Drive (una carpeta personal no
   sirve: las cuentas de servicio no tienen cuota propia).
7. **Apple Music es opcional** en los créditos; **Spotify es obligatorio** para
   artistas y para el rol Productor. Si no ponen el de Apple, Amuse crea un perfil nuevo.

---

## 9. Primeros auxilios (si algo falla)

| Síntoma | Dónde mirar / qué hacer |
|---|---|
| **La web no carga / da error** | Vercel → proyecto `rabat-portal` → *Deployments*. Si el último está en rojo, mira los *Logs* del build. Como apaño rápido, en el último deploy verde → ⋯ → *Promote to Production*. |
| **No llega el email de aviso** | 1) ¿Está el envío en el Sheet? Si sí, el envío funcionó y el problema es solo el email. 2) Vercel → deployment → *Logs* (busca `[notify]`). 3) Revisa que las 3 variables de Resend estén bien escritas en Vercel y que se haya hecho *Redeploy*. 4) Resend → *Logs* para ver si el email salió. |
| **Un envío no aparece en el Sheet** | Revisa que la **cuenta de servicio** (`GOOGLE_CLIENT_EMAIL`) siga compartida como editora del Sheet y de la Unidad compartida de Drive. |
| **No suben los archivos a Drive** | Lo mismo: permisos de la cuenta de servicio en la Unidad compartida. Tiene que ser **Unidad compartida**, no carpeta personal. |
| **Cambié una variable en Vercel y no surte efecto** | Las variables solo se aplican con un **build nuevo**. Haz *Redeploy* o un `git push`. |
| **Una clave se ha filtrado** | Regenérala en su servicio (Google Cloud / Resend), actualízala en Vercel y haz *Redeploy*. |

---

## 10. Glosario rápido

- **Repositorio / GitHub:** donde vive el código (el "original"). `git push` = subir cambios.
- **Vercel:** el servidor que sirve la web. Se actualiza solo cuando subes a GitHub.
- **Deploy / desplegar:** publicar una versión nueva.
- **Build:** el proceso que compila el código antes de publicarlo. Si falla, no se publica.
- **Variable de entorno:** una "clave" o ajuste que se guarda fuera del código (en Vercel).
- **Cuenta de servicio (Google):** un "usuario robot" de Google con el que la web
  escribe en el Sheet y sube a Drive sin que un humano inicie sesión.
- **Resend:** el servicio que envía los emails de aviso.
- **DSP:** plataforma de música (Spotify, Apple Music, etc.).
- **Máster:** el archivo de audio final de la canción (.wav/.flac).

---

## 11. Pendiente / mejoras futuras (mapa de ruta)

- **Control de acceso (magic link):** restringir el login a los emails de la pestaña
  `artists`. Hoy el login está abierto.
- **Verificar el dominio en Resend** para enviar el aviso a varios correos y desde
  una dirección de RABAT.
- **Panel de administración** para RABAT (ver envíos sin entrar al Sheet). Opcional.
- (Técnico) `app/wizard/page.tsx` es un archivo grande; se podría partir en
  componentes si en el futuro se mantiene mucho. No es urgente.

---

*Cualquier duda con esta guía o con el código, mantenedla actualizada: cuando cambie
algo importante (una clave, un flujo, una pantalla), anotadlo aquí mismo.*
