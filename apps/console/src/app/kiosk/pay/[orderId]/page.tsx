'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { kioskMessages } from '@/lib/kiosk-copy';

interface Handoff {
  status: string;
  totalCents: number;
  currency: string;
  simulated: true;
  lines: Array<{ name: { en: string; es: string }; qty: number }>;
  paymentCaptured: boolean;
}

export default function PayHandoffPage() {
  const params = useParams<{ orderId: string }>();
  const search = useSearchParams();
  const token = search.get('t') ?? '';
  const copy = kioskMessages('es');
  const [order, setOrder] = useState<Handoff | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void api<Handoff>(`/api/v1/commerce/handoff/${params.orderId}?token=${encodeURIComponent(token)}`)
      .then(setOrder)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Error'));
  }, [params.orderId, token]);

  async function pay() {
    setError(null);
    try {
      const next = await api<Handoff>(`/api/v1/commerce/handoff/${params.orderId}/pay-simulation`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setOrder(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error');
    }
  }

  return (
    <main className="tv flex min-h-screen flex-col justify-end">
      <p className="text-lg text-[var(--accent-warm)]">{copy.badge}</p>
      <h1 className="tv-display mt-6 text-5xl">{copy.pay}</h1>
      {order ? <p className="mt-4 text-3xl">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(order.totalCents / 100)}</p> : null}
      <p className="mt-3 text-xl text-[var(--text-secondary)]">{order?.status ?? copy.waiting}</p>
      {order?.status === 'AWAITING_PAYMENT' ? (
        <button type="button" className="tv-target mt-8 bg-[var(--accent-primary)] px-6 py-4 text-xl text-[var(--bg-primary)]" onClick={() => void pay()}>
          {copy.simulate}
        </button>
      ) : null}
      {order?.paymentCaptured ? <p className="mt-6 text-2xl">{copy.done}</p> : null}
      {error ? <p className="mt-4 text-xl text-[var(--danger)]">{error}</p> : null}
    </main>
  );
}
