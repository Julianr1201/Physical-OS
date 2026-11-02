'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Pill } from '@physical-os/ui';
import { api, ApiError, type Overview } from '@/lib/api';
import { messages, type Copy, type Locale } from '@/lib/i18n';

interface Frame {
  overview: Overview | null;
  error: string | null;
  locale: Locale;
  copy: Copy;
  refresh: () => Promise<void>;
  setLocale: (locale: Locale) => void;
}

const FrameContext = createContext<Frame | null>(null);

export function useFrame(): Frame {
  const value = useContext(FrameContext);
  if (!value) throw new Error('Frame missing');
  return value;
}

const settingsLinks = [
  ['/spaces', 'spaces'],
  ['/devices', 'devices'],
  ['/automations', 'automations'],
  ['/intelligence', 'intelligence'],
  ['/activity', 'activity'],
  ['/integrations', 'integrations'],
  ['/settings', 'settings'],
  ['/developer', 'developer'],
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [locale, setLocaleState] = useState<Locale>('en');
  const copy = messages(locale);

  async function refresh() {
    try {
      const data = await api<Overview>('/api/v1/overview');
      setOverview(data);
      setError(null);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load');
    }
  }

  useEffect(() => {
    const stored = window.localStorage.getItem('pos-locale');
    if (stored === 'es' || stored === 'en') setLocaleState(stored);
    else if (navigator.language.toLowerCase().startsWith('es')) setLocaleState('es');
    void api<{ authenticated: boolean; enrolled: boolean }>('/api/v1/session')
      .then((session) => {
        if (!session.authenticated && session.enrolled) router.replace('/login');
        else if (session.authenticated) return refresh();
        return undefined;
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load'))
      .finally(() => setReady(true));
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 3000);
    const source = new EventSource('/api/v1/events');
    source.onmessage = () => {
      void refresh().catch(() => undefined);
    };
    return () => {
      window.clearInterval(timer);
      source.close();
    };
  }, [router]);

  const value = useMemo(
    () => ({
      overview,
      error,
      locale,
      copy,
      refresh,
      setLocale: (next: Locale) => {
        window.localStorage.setItem('pos-locale', next);
        setLocaleState(next);
      },
    }),
    [overview, error, locale, copy],
  );

  if (!ready) {
    return (
      <div className="tv grid min-h-screen place-items-center">
        <p className="tv-display text-5xl">{copy.product}</p>
      </div>
    );
  }

  const simulated = overview?.environments.some((environment) => environment.simulated) ?? false;
  const stage = pathname === '/' || pathname === '/presence' || pathname === '/profiles';

  return (
    <FrameContext.Provider value={value}>
      {stage ? (
        children
      ) : (
        <div className="min-h-screen">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-6">
            <Link href="/" className="font-serif text-xl">
              {copy.backHome}
            </Link>
            <div className="flex items-center gap-2">
              {simulated ? <Pill tone="sim">{copy.simulation}</Pill> : null}
              {overview?.estop.latched ? <Pill tone="danger">{copy.estop}</Pill> : null}
              <Button
                type="button"
                tone="quiet"
                onClick={() => {
                  const root = document.documentElement;
                  root.classList.toggle('dark');
                  window.localStorage.setItem('pos-theme', root.classList.contains('dark') ? 'dark' : 'light');
                }}
              >
                Theme
              </Button>
            </div>
          </header>
          <div className="md:grid md:grid-cols-[220px_1fr]">
            <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-3 md:block md:border-b-0 md:border-r md:px-2">
              {settingsLinks.map(([href, key]) => (
                <Link
                  key={href}
                  href={href}
                  className={`block whitespace-nowrap px-3 py-2 text-sm ${pathname === href ? 'bg-ink text-paper' : 'text-muted hover:text-ink'}`}
                >
                  {copy[key]}
                </Link>
              ))}
            </nav>
            <div>
              {error ? <p className="border-b border-clay px-6 py-3 text-sm text-clay">{error}</p> : null}
              <main className="px-4 py-6 md:px-6">{children}</main>
            </div>
          </div>
        </div>
      )}
    </FrameContext.Provider>
  );
}
