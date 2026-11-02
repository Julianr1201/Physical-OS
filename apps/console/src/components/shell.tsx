'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Pill } from '@physical-os/ui';
import { api, ApiError, type Overview } from '@/lib/api';
import { messages, type Copy, type Locale } from '@/lib/i18n';
import { loginHref } from '@/lib/safe-next';
import { DeviceWeatherProvider } from '@/components/device-weather';

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
  const [gate, setGate] = useState<'checking' | 'open'>('checking');
  const [locale, setLocaleState] = useState<Locale>('en');
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState('');
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
    let cancel = false;
    void api<{ authenticated: boolean; enrolled: boolean }>('/api/v1/session')
      .then((session) => {
        if (cancel) return undefined;
        if (!session.authenticated && session.enrolled) {
          router.replace(loginHref(pathname));
          return undefined;
        }
        setGate('open');
        if (session.authenticated) return refresh();
        return undefined;
      })
      .catch((reason: unknown) => {
        if (cancel) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load');
        setGate('open');
      });
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 15000);
    const source = new EventSource('/api/v1/events');
    source.onmessage = () => {
      void refresh().catch(() => undefined);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancel = true;
      window.clearInterval(timer);
      source.close();
      window.removeEventListener('keydown', onKey);
    };
  }, [router, pathname]);

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

  if (gate !== 'open') {
    return (
      <div className="tv grid min-h-screen place-items-center">
        <p className="tv-display text-5xl">{copy.product}</p>
      </div>
    );
  }

  const simulated = overview?.environments.some((environment) => environment.simulated) ?? false;
  const stage = pathname === '/' || pathname === '/presence' || pathname === '/profiles';
  const section = settingsLinks.find(([href]) => pathname === href || pathname.startsWith(`${href}/`));
  const destinations = [
    ['/', 'backHome'],
    ['/presence', 'presence'],
    ['/profiles', 'profiles'],
    ...settingsLinks,
  ] as const;
  const matches = destinations.filter(([, key]) => copy[key].toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <FrameContext.Provider value={value}>
      <DeviceWeatherProvider>
      {palette ? (
        <dialog open className="mt-16 p-4" aria-label={copy.command} onClose={() => setPalette(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const next = matches[0];
              if (!next) return;
              setPalette(false);
              setQuery('');
              router.push(next[0]);
            }}
          >
            <label className="text-sm text-muted" htmlFor="command-query">
              {copy.commandHint}
              <input
                id="command-query"
                value={query}
                autoFocus
                className="mt-2"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setPalette(false);
                }}
              />
            </label>
            <ul className="mt-3 grid gap-1">
              {matches.map(([href, key]) => (
                <li key={href}>
                  <Link href={href} className="block px-2 py-2 text-sm hover:bg-[var(--bg)]" onClick={() => setPalette(false)}>
                    {copy[key]}
                  </Link>
                </li>
              ))}
            </ul>
          </form>
        </dialog>
      ) : null}
      {stage ? (
        children
      ) : (
        <div className="min-h-screen">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-6">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted">
                <Link href="/">{copy.backHome}</Link>
                {section ? ` / ${copy[section[1]]}` : null}
              </p>
              <p className="font-serif text-2xl">{section ? copy[section[1]] : copy.product}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" tone="quiet" onClick={() => setPalette(true)}>
                {copy.command}
              </Button>
              {overview ? <Pill tone="ok">{copy.connected}</Pill> : <Pill>{copy.offline}</Pill>}
              {simulated ? <Pill tone="sim">{copy.simulation}</Pill> : null}
              {overview?.estop.latched ? <Pill tone="danger">{copy.estop}</Pill> : null}
              <Button
                type="button"
                tone="quiet"
                onClick={() => {
                  const root = document.documentElement;
                  root.classList.toggle('light');
                  window.localStorage.setItem('pos-theme', root.classList.contains('light') ? 'light' : 'dark');
                }}
              >
                {copy.appearance}
              </Button>
            </div>
          </header>
          <div className="md:grid md:grid-cols-[220px_1fr]">
            <nav className="studio-nav flex gap-1 overflow-x-auto border-b border-line px-3 py-3 md:block md:border-b-0 md:border-r md:px-2" aria-label={copy.product}>
              {settingsLinks.map(([href, key]) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined}
                  className="block whitespace-nowrap rounded-[2px] px-3 py-2 text-sm text-muted hover:text-ink"
                >
                  {copy[key]}
                </Link>
              ))}
            </nav>
            <div>
              {error ? <p className="border-b border-clay px-6 py-3 text-sm text-clay" role="alert">{error}</p> : null}
              <main className="px-4 py-6 md:px-6">{children}</main>
            </div>
          </div>
        </div>
      )}
      </DeviceWeatherProvider>
    </FrameContext.Provider>
  );
}
