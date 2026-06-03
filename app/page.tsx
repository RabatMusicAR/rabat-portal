'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  // TODO (auth): reemplazar navegación directa por signIn('email', { email })
  // de NextAuth cuando lib/auth.ts esté implementado.
  const handleEnter = useCallback(() => {
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setError('Introduce un email válido para continuar.');
      return;
    }
    setError('');
    router.push(`/wizard?email=${encodeURIComponent(trimmed)}`);
  }, [email, router]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleEnter();
    },
    [handleEnter],
  );

  return (
    <main id="login">
      {/* Logo fijo esquina superior izquierda */}
      <img src="/rabat-logo.png" alt="RABAT logo" className="login-logo" />
      <div className="login-corner-cat">
        <span>›</span>&nbsp;portal de artistas
      </div>

      <div className="login-container">
        {/* Logo central grande */}
        <div className="login-hero">
          <img src="/rabat-logo.png" alt="RABAT" className="login-hero-logo" />
        </div>
        <p className="login-tagline">DONDE FIRMAS Y NO TE F*LLAN</p>

        {/* form semántico: mejora accesibilidad y comportamiento mobile (teclado submit) */}
        <form
          className="login-form"
          onSubmit={(e) => { e.preventDefault(); handleEnter(); }}
          noValidate
        >
          <input
            type="email"
            className="input-pill"
            placeholder="tu@email.com"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKey}
            aria-label="Email"
            aria-describedby={error ? 'login-error' : undefined}
          />
          <button type="submit" className="btn-primary big">
            ENTRAR
          </button>
        </form>

        {error && (
          <p id="login-error" className="login-error" role="alert">
            {error}
          </p>
        )}

        <p className="login-help">
          te mandaremos un enlace mágico para entrar — sin contraseñas.
        </p>
        <p className="login-footer">
          ¿problemas?{' '}
          <a href="mailto:hola@rabat.es" className="btn-secondary login-footer-link">
            escríbenos
          </a>
        </p>
      </div>

      <div className="login-corner-badge">v0.4 · next.js scaffold</div>
    </main>
  );
}
