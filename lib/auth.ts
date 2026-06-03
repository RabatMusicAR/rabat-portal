/**
 * NextAuth (Auth.js v5) — magic link por email.
 *
 * Pendiente de configurar:
 * 1. npm install next-auth@beta nodemailer
 * 2. Rellenar EMAIL_SERVER_* y NEXTAUTH_* en .env.local
 *    (recomendado: SendGrid, Resend, o Postmark como provider SMTP)
 * 3. Generar NEXTAUTH_SECRET con `openssl rand -base64 32`
 * 4. Implementar este archivo con la config de Auth.js
 * 5. Crear app/api/auth/[...nextauth]/route.ts
 * 6. Validar el email contra la pestaña `artists` del Sheet
 *    (solo emails de artistas firmados pueden entrar — al menos en fase privada)
 *
 * Ver: https://authjs.dev/getting-started/providers/nodemailer
 */

// import NextAuth from 'next-auth';
// import EmailProvider from 'next-auth/providers/nodemailer';
// import { findArtistByEmail } from '@/lib/sheets';

// export const { handlers, signIn, signOut, auth } = NextAuth({
//   providers: [
//     EmailProvider({
//       server: {
//         host: process.env.EMAIL_SERVER_HOST,
//         port: Number(process.env.EMAIL_SERVER_PORT),
//         auth: {
//           user: process.env.EMAIL_SERVER_USER,
//           pass: process.env.EMAIL_SERVER_PASSWORD,
//         },
//       },
//       from: process.env.EMAIL_FROM,
//     }),
//   ],
//   callbacks: {
//     async signIn({ user }) {
//       // Fase privada: solo artistas firmados pueden entrar.
//       const artist = await findArtistByEmail(user.email!);
//       return artist !== null && artist.active;
//     },
//   },
// });

export {};
