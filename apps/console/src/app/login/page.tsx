'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { messages, type Locale } from '@/lib/i18n';
import { tvMessages } from '@/lib/tv-copy';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>('es');
  const copy = messages(locale);
  const tv = tvMessages(locale);

  useEffect(() => {
    const stored = window.localStorage.getItem('pos-locale');
    const next: Locale = stored === 'es' || stored === 'en' ? stored : navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
    setLocale(next);
    void api<{ authenticated: boolean; enrolled: boolean }>('/api/v1/session').then((session) => {
      if (session.authenticated) router.replace('/');
      else if (!session.enrolled) router.replace('/');
    });
  }, [router]);

  return (
    <main className="tv flex min-h-screen flex-col justify-end">
      <h1 className="tv-display text-[clamp(48px,3.4vw,72px)] leading-none">{copy.login}</h1>
      <p className="mt-4 max-w-xl text-2xl text-[var(--text-secondary)]">{tv.welcomeBody}</p>
      <form
        className="mt-8 grid max-w-md gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void api('/api/v1/session', { method: 'POST', body: JSON.stringify({ password }) })
            .then(() => router.replace(new URLSearchParams(window.location.search).get('next') === '/kiosk' ? '/kiosk' : '/'))
            .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : copy.notVerified));
        }}
      >
        <label className="text-xl" htmlFor="password">
          {copy.password}
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required autoFocus />
        </label>
        <button type="submit" className="tv-target bg-[var(--accent-primary)] px-6 py-4 text-xl text-[var(--bg-primary)]">
          {tv.enter}
        </button>
      </form>
      {error ? <p className="mt-4 text-xl text-[var(--danger)]">{error}</p> : null}
    </main>
  );
}
