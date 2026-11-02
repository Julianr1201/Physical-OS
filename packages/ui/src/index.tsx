import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Mark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8">
      <rect x="1" y="1" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 22 V10 H16 V16 H24 V22" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Button({
  children,
  tone = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'brass' | 'danger' | 'quiet' }) {
  const tones = {
    default: 'border-line bg-paper text-ink hover:border-brass',
    brass: 'border-brass bg-brass text-[var(--bg)] hover:opacity-90',
    danger: 'border-clay text-clay hover:bg-clay hover:text-[var(--bg)]',
    quiet: 'border-transparent text-muted hover:text-ink',
  };
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[2px] border px-3 py-2 text-sm font-semibold tracking-wide disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[2px] border border-line bg-paper shadow-[var(--shadow)]">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="font-serif text-lg">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'sim' }) {
  const tones = {
    neutral: 'border-line text-muted',
    ok: 'border-pine text-pine',
    warn: 'border-brass text-brass',
    danger: 'border-clay text-clay',
    sim: 'border-brass text-brass',
  };
  return <span className={`inline-flex rounded-[2px] border px-2 py-0.5 text-xs uppercase tracking-[0.14em] ${tones[tone]}`}>{children}</span>;
}
