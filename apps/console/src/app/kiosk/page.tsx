'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { type Locale } from '@/lib/i18n';
import { kioskMessages } from '@/lib/kiosk-copy';

interface Item {
  sku: string;
  name: { en: string; es: string };
  priceCents: number;
  available: number;
}

interface Order {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  paymentCaptured: boolean;
  dispenseIssued: boolean;
  dispenseVerified: boolean;
  failureReason: string | null;
  lines: Array<{ sku: string; qty: number; lineCents: number; name: { en: string; es: string } }>;
}

interface Receipt {
  totalCents: number;
  lines: Array<{ sku: string; qty: number; lineCents: number }>;
  state: string;
  simulated: true;
  paymentVerified: boolean;
  fulfillmentVerified: boolean;
}

export default function KioskPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('es');
  const copy = kioskMessages(locale);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<Order | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nfcNote, setNfcNote] = useState(false);
  const count = useMemo(() => Object.values(cart).reduce((sum, qty) => sum + qty, 0), [cart]);

  useEffect(() => {
    const stored = window.localStorage.getItem('pos-locale');
    const next: Locale = stored === 'en' || stored === 'es' ? stored : navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
    setLocale(next);
    void api<{ authenticated: boolean; enrolled: boolean }>('/api/v1/session')
      .then(async (session) => {
        if (!session.authenticated && session.enrolled) {
          router.replace('/login?next=/kiosk');
          return;
        }
        if (!session.authenticated) await api('/api/v1/demo/session', { method: 'POST' });
        const catalog = await api<{ items: Item[]; nfc: { available: boolean } }>('/api/v1/commerce/catalog');
        setItems(catalog.items);
        setNfcNote(!catalog.nfc.available);
        setReady(true);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Error'));
  }, [router]);

  useEffect(() => {
    if (!order || receipt) return;
    if (order.status !== 'FULFILLED' && order.status !== 'REFUNDED') return;
    void api<Receipt>(`/api/v1/commerce/orders/${order.id}/receipt`).then(setReceipt).catch(() => undefined);
  }, [order, receipt]);

  useEffect(() => {
    if (!order || order.status === 'FULFILLED' || order.status === 'FAILED' || order.status === 'REFUNDED') return;
    const timer = window.setInterval(() => {
      void api<Order>(`/api/v1/commerce/orders/${order.id}`)
        .then((next) => setOrder(next))
        .catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [order]);

  useEffect(() => {
    if (!ready || order) return;
    const timer = window.setTimeout(() => setCart({}), 90_000);
    return () => window.clearTimeout(timer);
  }, [cart, ready, order]);

  function add(sku: string) {
    setCart((current) => ({ ...current, [sku]: Math.min(5, (current[sku] ?? 0) + 1) }));
  }

  async function checkout() {
    setError(null);
    const lines = Object.entries(cart).filter(([, qty]) => qty > 0).map(([sku, qty]) => ({ sku, qty }));
    try {
      const result = await api<{ order: Order; qrSvg: string }>('/api/v1/commerce/checkout', {
        method: 'POST',
        body: JSON.stringify({ lines, handoffOrigin: window.location.origin }),
      });
      setOrder(result.order);
      setQr(result.qrSvg);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error');
    }
  }

  async function act(path: string) {
    if (!order) return;
    setError(null);
    try {
      const next = await api<Order>(`/api/v1/commerce/orders/${order.id}/${path}`, { method: 'POST' });
      setOrder(next);
      if (next.status === 'FULFILLED' || next.status === 'REFUNDED') {
        setReceipt(await api<Receipt>(`/api/v1/commerce/orders/${order.id}/receipt`));
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : 'Error');
    }
  }

  function reset() {
    setCart({});
    setOrder(null);
    setQr(null);
    setReceipt(null);
    setError(null);
  }

  function hear() {
    const agent = window as Window & { SpeechRecognition?: new () => BrowserSpeech; webkitSpeechRecognition?: new () => BrowserSpeech };
    const Recognition = agent.SpeechRecognition ?? agent.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = locale === 'es' ? 'es-MX' : 'en-US';
    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript.toLowerCase() ?? '';
      const match = items.find((item) => heard.includes(item.name.es.toLowerCase()) || heard.includes(item.name.en.toLowerCase()) || heard.includes(item.sku));
      if (match) add(match.sku);
    };
    recognition.start();
  }

  if (!ready) {
    return <main className="tv grid min-h-screen place-items-center text-2xl">{error ?? copy.attract}</main>;
  }

  return (
    <main className="tv flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4">
        <p className="text-lg text-[var(--accent-warm)]">{copy.badge}</p>
        <button
          type="button"
          className="tv-target px-4 py-3 text-xl"
          onClick={() => {
            const next = locale === 'es' ? 'en' : 'es';
            window.localStorage.setItem('pos-locale', next);
            setLocale(next);
          }}
        >
          {locale === 'es' ? 'EN' : 'ES'}
        </button>
      </header>
      {!order ? (
        <Shop
          copy={copy}
          items={items}
          cart={cart}
          count={count}
          locale={locale}
          nfcNote={nfcNote}
          onAdd={add}
          onHear={typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) ? hear : null}
          onCheckout={() => void checkout()}
          onClear={() => setCart({})}
        />
      ) : (
        <Checkout copy={copy} order={order} qr={qr} receipt={receipt} locale={locale} onAct={(path) => void act(path)} onReset={reset} onCancel={() => void act('cancel').then(() => reset())} />
      )}
      {error ? <p className="mt-4 text-xl text-[var(--danger)]">{error}</p> : null}
    </main>
  );
}

function Shop({
  copy,
  items,
  cart,
  count,
  locale,
  nfcNote,
  onAdd,
  onHear,
  onCheckout,
  onClear,
}: {
  copy: ReturnType<typeof kioskMessages>;
  items: Item[];
  cart: Record<string, number>;
  count: number;
  locale: Locale;
  nfcNote: boolean;
  onAdd: (sku: string) => void;
  onHear: (() => void) | null;
  onCheckout: () => void;
  onClear: () => void;
}) {
  return (
    <section className="mt-8 flex flex-1 flex-col">
      <h1 className="tv-display text-[clamp(40px,3vw,64px)] leading-none">{count === 0 ? copy.attract : copy.shop}</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <button key={item.sku} type="button" className="tv-tile tv-target min-h-40 bg-[var(--surface)] p-6 text-left" onClick={() => onAdd(item.sku)} disabled={item.available < 1}>
            <span className="tv-display text-4xl">{item.name[locale]}</span>
            <span className="mt-4 block text-2xl">{money(item.priceCents, locale)}</span>
            <span className="mt-2 block text-lg text-[var(--text-secondary)]">{cart[item.sku] ? `× ${cart[item.sku]}` : item.available}</span>
          </button>
        ))}
      </div>
      {nfcNote ? <p className="mt-6 text-lg text-[var(--text-secondary)]">{copy.unavailable}</p> : null}
      <div className="mt-auto flex flex-wrap gap-4 pt-8">
        {onHear ? <button type="button" className="tv-target bg-[var(--surface)] px-6 py-4 text-xl" onClick={onHear}>{copy.say}</button> : null}
        <button type="button" className="tv-target bg-[var(--surface)] px-6 py-4 text-xl" onClick={onClear}>{copy.cancel}</button>
        <button type="button" className="tv-target bg-[var(--accent-primary)] px-8 py-4 text-xl text-[var(--bg-primary)]" disabled={count === 0} onClick={onCheckout}>
          {copy.pay} {count > 0 ? `(${count})` : ''}
        </button>
      </div>
    </section>
  );
}

function Checkout({
  copy,
  order,
  qr,
  receipt,
  locale,
  onAct,
  onReset,
  onCancel,
}: {
  copy: ReturnType<typeof kioskMessages>;
  order: Order;
  qr: string | null;
  receipt: Receipt | null;
  locale: Locale;
  onAct: (path: string) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const waiting = order.status === 'AWAITING_PAYMENT';
  const needsRecovery = order.paymentCaptured && (order.status === 'FAILED' || order.status === 'FULFILLING');
  return (
    <section className="mt-8 flex flex-1 flex-col">
      <h1 className="tv-display text-[clamp(40px,3vw,64px)] leading-none">
        {order.status === 'FULFILLED' ? copy.done : order.status === 'REFUNDED' ? copy.refunded : waiting ? copy.qr : copy.delivering}
      </h1>
      <p className="mt-4 text-3xl">{money(order.totalCents, locale)}</p>
      <ul className="mt-4 text-2xl text-[var(--text-secondary)]">
        {order.lines.map((line) => (
          <li key={line.sku}>{line.qty} × {line.name[locale]}</li>
        ))}
      </ul>
      {waiting && qr ? <div className="mt-6 max-w-xs bg-[var(--text-primary)] p-3" dangerouslySetInnerHTML={{ __html: qr }} /> : null}
      {waiting ? <p className="mt-4 text-xl">{copy.waiting}</p> : null}
      {needsRecovery ? <p className="mt-4 max-w-xl text-2xl">{copy.paidNotDelivered}</p> : null}
      {receipt ? (
        <div className="mt-6 max-w-md bg-[var(--surface)] p-5 text-xl">
          <p>{copy.receipt}</p>
          <p className="mt-2">{money(receipt.totalCents, locale)}</p>
          <p className="text-[var(--text-secondary)]">{receipt.paymentVerified ? copy.done : copy.waiting}</p>
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-4 pt-8">
        {waiting ? <button type="button" className="tv-target bg-[var(--accent-primary)] px-6 py-4 text-xl text-[var(--bg-primary)]" onClick={() => onAct('pay-simulation')}>{copy.simulate}</button> : null}
        {waiting ? <button type="button" className="tv-target bg-[var(--surface)] px-6 py-4 text-xl" onClick={onCancel}>{copy.cancel}</button> : null}
        {needsRecovery && !order.dispenseIssued ? <button type="button" className="tv-target bg-[var(--surface)] px-6 py-4 text-xl" onClick={() => onAct('retry')}>{copy.retry}</button> : null}
        {needsRecovery && order.dispenseIssued ? <button type="button" className="tv-target bg-[var(--surface)] px-6 py-4 text-xl" onClick={() => onAct('verify')}>{copy.verify}</button> : null}
        {needsRecovery ? <button type="button" className="tv-target bg-[var(--surface)] px-6 py-4 text-xl" onClick={() => onAct('refund')}>{copy.refund}</button> : null}
        {order.status === 'FULFILLED' || order.status === 'REFUNDED' ? <button type="button" className="tv-target bg-[var(--accent-primary)] px-6 py-4 text-xl text-[var(--bg-primary)]" onClick={onReset}>{copy.next}</button> : null}
      </div>
    </section>
  );
}

function money(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency: 'MXN' }).format(cents / 100);
}

interface BrowserSpeech {
  lang: string;
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  start: () => void;
}
