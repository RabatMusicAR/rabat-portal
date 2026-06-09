# RABAT Portal

Portal web del artista para RABAT — captura metadata, audio máster, portada,
créditos y reparto de regalías, y los entrega a RABAT vía Google Drive + Sheets.

**Tagline:** _donde firmas y no te f*llan_

---

## Cómo arrancar en local

Requisitos: **Node.js 18+** y **npm**.

```bash
# 1. Instala dependencias
npm install

# 2. Arranca el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

Para ver el prototipo HTML completo (todas las pantallas que faltan por portar):
[http://localhost:3000/prototype.html](http://localhost:3000/prototype.html)

---

## Estado actual

| Pantalla / Feature | Estado |
|---|---|
| Login con email | ✅ portada a React |
| Sistema de diseño (CSS, tipos) | ✅ hecho |
| Wizard de 5 pasos | 🚧 stub — prototipo HTML en `public/prototype.html` |
| Modal de pista con 4 sub-pasos | 🚧 stub |
| Editor de créditos (intérprete/autor/producción) | 🚧 stub |
| Editor de reparto de regalías | 🚧 stub |
| Auth con magic link (NextAuth) | 🚧 stub en `lib/auth.ts` |
| Integración Google Drive | 🚧 stub en `lib/drive.ts` |
| Integración Google Sheets | 🚧 stub en `lib/sheets.ts` |

---

## Documentación

- **`CLAUDE.md`** — contexto completo del proyecto (léelo si vienes con
  Claude Code o entras al proyecto por primera vez)
- **`docs/RABAT_esquema_de_datos.md`** — esquema completo de datos
  (Releases, Tracks, Credits, Royalty Splits, Artists + 138 géneros + roles)
- **`public/prototype.html`** — prototipo visual de todas las pantallas

---

## Stack

- Next.js 15 (app router) + TypeScript + React 19
- Vanilla CSS con CSS custom properties
- Google Drive + Sheets como storage (no DB)
- NextAuth (Auth.js v5) con magic link por email — pendiente
- Vercel para hosting, GitHub para repo

---

## Variables de entorno

Copia `.env.example` a `.env.local` y rellena las variables cuando vayas
configurando Drive, Sheets y auth.

```bash
cp .env.example .env.local
```
## ASI SE HACE EL DEPLOY 
## Requisito: trabaja siempre dentro de la carpeta del proyecto (ahí está el .git):

# cd "/Users/SadocJr/Downloads/Rabat Portal/rabat-portal"
# Pasos exactos:

# cd "/Users/SadocJr/Downloads/Rabat Portal/rabat-portal"
# npm run build          # opcional pero recomendado: si falla, no subas
# git add -A
# git commit -m "tu mensaje"
# git push origin main   # ← esto deploya a producción automáticamente