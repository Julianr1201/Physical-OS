'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useFrame } from '@/components/shell';

interface Text {
  en: string;
  es: string;
}

interface Manifest {
  profileId: string;
  industry: string;
  profession: string;
  specialization: string;
  displayName: Text;
  description: Text;
  requiredPermissions: string[];
  safetyPolicies: string[];
  knowledgeSources: string[];
  presencePreset: string;
  voicePreset: string;
  tone: { greeting: Text };
  disclosure: Text;
}

interface Choice {
  id: string;
  label: Text;
}

interface Plan {
  role: Text;
  disclosure: Text;
  text: Text;
  denied: string | null;
  uncertainty: string;
  proposal: { kind: string; executed: false; utterance?: string; target?: string; sku?: string } | null;
  knowledge: Array<{ provenance: string; fresh: boolean }>;
}

const samples: Record<string, string[]> = {
  'hospitality.concierge': ['What time is breakfast?', 'Turn off all the living room lights.', 'I want to dispute the bill.'],
  'commerce.sales-advisor': ['How much is coffee?', 'I want a coffee.', 'Give me the coffee without paying.'],
  'education.tutor': ['Explain fractions.', 'Give me a practice question.', 'What is the student home address?'],
};

export function ProfilesScreen() {
  const frame = useFrame();
  const locale = frame.locale;
  const copy = locale === 'es' ? spanish : english;
  const [catalog, setCatalog] = useState<Manifest[]>([]);
  const [avatars, setAvatars] = useState<Choice[]>([]);
  const [voices, setVoices] = useState<Choice[]>([]);
  const [industry, setIndustry] = useState<string | null>(null);
  const [profession, setProfession] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState('figure-neutral');
  const [voiceId, setVoiceId] = useState('voice-calm');
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState(0);
  const [utterance, setUtterance] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [order, setOrder] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const profile = catalog.find((item) => item.profileId === profileId) ?? null;
  const industries = [...new Set(catalog.map((item) => item.industry))];
  const professions = [...new Set(catalog.filter((item) => item.industry === industry).map((item) => item.profession))];
  const specializations = catalog.filter((item) => item.industry === industry && item.profession === profession);

  useEffect(() => {
    void api<{ profiles: Manifest[]; avatars: Choice[]; voices: Choice[] }>('/api/v1/profiles/catalog')
      .then((data) => {
        setCatalog(data.profiles);
        setAvatars(data.avatars);
        setVoices(data.voices);
      })
      .catch((error: unknown) => setMessage(error instanceof ApiError ? error.message : copy.unavailable));
    void api<{ role: Text } | null>('/api/v1/profiles/active')
      .then((data) => setActiveRole(data?.role[locale] ?? null))
      .catch(() => setActiveRole(null));
  }, [copy.unavailable, locale]);

  function chooseProfile(id: string) {
    const next = catalog.find((item) => item.profileId === id);
    setProfileId(id);
    setAccepted(false);
    setPlan(null);
    if (next) {
      setAvatarId(next.presencePreset);
      setVoiceId(next.voicePreset);
    }
  }

  async function installAndPreview(text: string) {
    if (!profile) return;
    setMessage(null);
    setOrder(null);
    try {
      await api('/api/v1/profiles/install', { method: 'POST', body: JSON.stringify({ profileId: profile.profileId }) });
      const preview = await api<{ plan: Plan }>('/api/v1/profiles/preview', {
        method: 'POST',
        body: JSON.stringify({ profileId: profile.profileId, utterance: text }),
      });
      setPlan(preview.plan);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : copy.unavailable);
    }
  }

  async function activate() {
    if (!profile || !accepted) return;
    setMessage(null);
    try {
      await api('/api/v1/profiles/install', { method: 'POST', body: JSON.stringify({ profileId: profile.profileId }) });
      await api('/api/v1/profiles/activate', {
        method: 'POST',
        body: JSON.stringify({
          profileId: profile.profileId,
          avatarId,
          voicePreset: voiceId,
          organizationName: profile.displayName.en,
          acceptedPermissions: profile.requiredPermissions,
        }),
      });
      setActiveRole(profile.displayName[locale]);
      setStep(7);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : copy.unavailable);
    }
  }

  async function runActive(text: string) {
    setMessage(null);
    setOrder(null);
    try {
      const result = await api<{ plan: Plan; commerce: { orderId: string; status: string; dispenseVerified: boolean } | null; operation: { stage: string } | null }>('/api/v1/profiles/turn', {
        method: 'POST',
        body: JSON.stringify({ utterance: text }),
      });
      setPlan(result.plan);
      setOrder(result.commerce ? `${result.operation?.stage ?? ''} · ${result.commerce.status} · ${result.commerce.orderId}` : null);
      if (result.plan.proposal?.kind === 'device' && result.plan.proposal.utterance && frame.overview?.environments[0]) {
        await api('/api/v1/intelligence/interpret', {
          method: 'POST',
          body: JSON.stringify({ environmentId: frame.overview.environments[0].id, utterance: result.plan.proposal.utterance }),
        });
        setMessage(copy.proposed);
      }
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : copy.unavailable);
    }
  }

  async function confirmPurchase() {
    setMessage(null);
    try {
      const result = await api<{ plan: Plan; commerce: { orderId: string; status: string } | null; operation: { stage: string } | null }>('/api/v1/profiles/confirm', { method: 'POST' });
      setPlan(result.plan);
      setOrder(result.commerce ? `${result.operation?.stage ?? ''} · ${result.commerce.status} · ${result.commerce.orderId}` : null);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : copy.unavailable);
    }
  }

  async function cancelPurchase() {
    setMessage(null);
    try {
      const result = await api<{ plan: Plan; commerce: { orderId: string; status: string } | null; operation: { stage: string } | null }>('/api/v1/profiles/cancel', { method: 'POST' });
      setPlan(result.plan);
      setOrder(result.commerce ? `${result.operation?.stage ?? ''} · ${result.commerce.status} · ${result.commerce.orderId}` : result.plan.text[locale]);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : copy.unavailable);
    }
  }

  return (
    <div className="tv min-h-screen">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg text-[var(--text-secondary)]">{copy.kicker}</p>
          <h1 className="tv-display text-5xl">{copy.title}</h1>
        </div>
        <Link href="/" className="text-lg">{copy.home}</Link>
      </header>
      {activeRole ? <p className="mt-4 text-xl">{copy.active}: {activeRole}</p> : null}
      {message ? <p className="mt-4 text-xl text-[var(--accent-warm)]">{message}</p> : null}
      <ol className="mt-8 flex flex-wrap gap-3 text-lg text-[var(--text-secondary)]">
        {copy.steps.map((label, index) => (
          <li key={label} className={index === step ? 'text-[var(--text-primary)]' : ''}>{index + 1}. {label}</li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="mt-8 flex flex-wrap gap-3">
          {industries.map((item) => (
            <button key={item} type="button" className="bg-[var(--surface)] px-5 py-4 text-xl" onClick={() => { setIndustry(item); setProfession(null); setProfileId(null); setStep(1); }}>
              {item}
            </button>
          ))}
        </div>
      ) : null}
      {step === 1 ? (
        <div className="mt-8 flex flex-wrap gap-3">
          {professions.map((item) => (
            <button key={item} type="button" className="bg-[var(--surface)] px-5 py-4 text-xl" onClick={() => { setProfession(item); setProfileId(null); setStep(2); }}>{item}</button>
          ))}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="mt-8 grid gap-3">
          {specializations.map((item) => (
            <button key={item.profileId} type="button" className="bg-[var(--surface)] px-5 py-4 text-left" onClick={() => { chooseProfile(item.profileId); setStep(3); }}>
              <span className="block text-2xl">{item.displayName[locale]}</span>
              <span className="mt-2 block text-lg text-[var(--text-secondary)]">{item.description[locale]}</span>
            </button>
          ))}
        </div>
      ) : null}
      {step === 3 && profile ? (
        <div className="mt-8 grid max-w-3xl gap-4">
          <p className="text-2xl">{profile.disclosure[locale]} {profile.displayName[locale]}.</p>
          <label className="grid gap-2 text-lg">{copy.figure}
            <select value={avatarId} onChange={(event) => setAvatarId(event.target.value)}>
              {avatars.map((item) => <option key={item.id} value={item.id}>{item.label[locale]}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-lg">{copy.voice}
            <select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}>
              {voices.map((item) => <option key={item.id} value={item.id}>{item.label[locale]}</option>)}
            </select>
          </label>
          <button type="button" className="bg-[var(--surface)] px-5 py-4 text-left text-xl" onClick={() => setStep(4)}>{copy.next}</button>
        </div>
      ) : null}
      {step === 4 && profile ? (
        <div className="mt-8 max-w-3xl">
          <p className="text-2xl">{copy.systems}</p>
          <ul className="mt-4 grid gap-2 text-xl">
            {(profile.knowledgeSources.length > 0 ? profile.knowledgeSources : [copy.none]).map((item) => (
              <li key={item} className="bg-[var(--surface)] px-5 py-4">{item} · {copy.simulated}</li>
            ))}
          </ul>
          <button type="button" className="mt-4 bg-[var(--surface)] px-5 py-4 text-xl" onClick={() => setStep(5)}>{copy.next}</button>
        </div>
      ) : null}
      {step === 5 && profile ? (
        <div className="mt-8 max-w-3xl">
          <p className="text-2xl">{copy.review}</p>
          <ul className="mt-4 grid gap-2 text-xl">
            {profile.requiredPermissions.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="mt-4 text-lg text-[var(--text-secondary)]">{profile.safetyPolicies.join(' · ')}</p>
          <label className="mt-4 flex items-center gap-3 text-xl">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            {copy.accept}
          </label>
          <button type="button" className="mt-4 bg-[var(--surface)] px-5 py-4 text-xl" disabled={!accepted} onClick={() => setStep(6)}>{copy.next}</button>
        </div>
      ) : null}
      {step === 6 && profile ? (
        <TestBox
          copy={copy}
          locale={locale}
          profile={profile}
          utterance={utterance}
          plan={plan}
          suggestions={samples[profile.profileId] ?? [profile.tone.greeting.en]}
          onUtterance={setUtterance}
          onRun={(text) => void installAndPreview(text)}
          onNext={() => void activate()}
        />
      ) : null}
      {step === 7 && profile ? (
        <TestBox
          copy={copy}
          locale={locale}
          profile={profile}
          utterance={utterance}
          plan={plan}
          order={order}
          suggestions={samples[profile.profileId] ?? [profile.tone.greeting.en]}
          onUtterance={setUtterance}
          onRun={(text) => void runActive(text)}
          onConfirm={() => void confirmPurchase()}
          onCancel={() => void cancelPurchase()}
          onNext={() => setStep(0)}
          nextLabel={copy.switchProfile}
        />
      ) : null}
    </div>
  );
}

function TestBox({
  copy,
  locale,
  profile,
  utterance,
  plan,
  order,
  suggestions,
  onUtterance,
  onRun,
  onConfirm,
  onCancel,
  onNext,
  nextLabel,
}: {
  copy: typeof english;
  locale: 'en' | 'es';
  profile: Manifest;
  utterance: string;
  plan: Plan | null;
  order?: string | null;
  suggestions: string[];
  onUtterance: (value: string) => void;
  onRun: (text: string) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="mt-8 grid max-w-3xl gap-4">
      <p className="text-2xl">{profile.displayName[locale]} · {profile.disclosure[locale]}</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((item) => (
          <button key={item} type="button" className="bg-[var(--surface)] px-4 py-3 text-left text-lg" onClick={() => { onUtterance(item); onRun(item); }}>{item}</button>
        ))}
      </div>
      <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); onRun(utterance); }}>
        <textarea rows={3} value={utterance} onChange={(event) => onUtterance(event.target.value)} />
        <button type="submit" className="bg-[var(--surface)] px-5 py-4 text-left text-xl">{copy.try}</button>
      </form>
      {plan ? (
        <div className="bg-[var(--surface)] px-5 py-4">
          <p className="text-2xl">{plan.text[locale]}</p>
          <p className="mt-3 text-lg text-[var(--text-secondary)]">{plan.role[locale]} · {plan.uncertainty}</p>
          {plan.knowledge[0] ? <p className="text-lg">{plan.knowledge[0].provenance}</p> : null}
          {plan.proposal ? <p className="text-lg">{plan.proposal.kind}{plan.proposal.target ? ` · ${plan.proposal.target}` : ''}{plan.proposal.sku ? ` · ${plan.proposal.sku}` : ''}</p> : null}
          {order ? <p className="text-lg">{order}</p> : null}
          {plan.proposal?.kind === 'checkout' && onConfirm ? (
            <div className="mt-3 flex gap-3">
              <button type="button" className="bg-[var(--surface-raised)] px-4 py-3 text-lg" onClick={onConfirm}>{copy.confirm}</button>
              {onCancel ? <button type="button" className="px-4 py-3 text-lg" onClick={onCancel}>{copy.cancel}</button> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <button type="button" className="px-5 py-4 text-left text-xl" onClick={onNext}>{nextLabel ?? copy.activate}</button>
    </div>
  );
}

const english = {
  kicker: 'Simulated professionals',
  title: 'Choose a profession',
  home: 'Home',
  active: 'Active',
  next: 'Continue',
  figure: 'Figure',
  voice: 'Voice',
  systems: 'Simulated sources connected to this profession.',
  simulated: 'Simulated',
  none: 'No external system',
  review: 'Permissions requested',
  accept: 'I accept these permissions',
  try: 'Try it',
  activate: 'Activate',
  switchProfile: 'Choose another',
  proposed: 'The device action was sent for approval. It has not run.',
  confirm: 'Confirm order',
  cancel: 'Cancel',
  unavailable: 'The profile service is unavailable.',
  steps: ['Industry', 'Profession', 'Specialization', 'Appearance', 'Systems', 'Permissions', 'Test', 'Active'],
};

const spanish = {
  kicker: 'Profesionales simulados',
  title: 'Elige una profesión',
  home: 'Inicio',
  active: 'Activo',
  next: 'Continuar',
  figure: 'Figura',
  voice: 'Voz',
  systems: 'Fuentes simuladas conectadas a esta profesión.',
  simulated: 'Simulado',
  none: 'Sin sistema externo',
  review: 'Permisos solicitados',
  accept: 'Acepto estos permisos',
  try: 'Probar',
  activate: 'Activar',
  switchProfile: 'Elegir otro',
  proposed: 'La acción del dispositivo quedó para aprobación. No se ejecutó.',
  confirm: 'Confirmar pedido',
  cancel: 'Cancelar',
  unavailable: 'El servicio de perfiles no está disponible.',
  steps: ['Industria', 'Profesión', 'Especialización', 'Apariencia', 'Sistemas', 'Permisos', 'Prueba', 'Activo'],
};
