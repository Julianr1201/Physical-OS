'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { api, type CommandResult, type Device, type Overview } from '@/lib/api';
import { useDeviceWeather } from '@/components/device-weather';
import { useFrame } from '@/components/shell';
import { Wallpaper } from '@/components/wallpaper';
import { weatherCopy } from '@/lib/device-weather';
import { playableDestinations } from '@/lib/media';
import { comfort, greeting, groundUtterance, matchRoom, places, ribbonFor, type StatusDevice } from '@/lib/room-status';
import { moveFocus, restoreFocus, type FocusItem } from '@/lib/spatial';
import { tvMessages, type TvCopy } from '@/lib/tv-copy';
import { createBrowserTone, type ToneEngine } from './tone';

type Overlay = 'none' | 'player' | 'apps' | 'spaces' | 'lights' | 'climate' | 'assistant';
type PlaceId = (typeof places)[number]['id'];

export function TvHome() {
  const frame = useFrame();
  const tv = tvMessages(frame.locale);
  const [booted, setBooted] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  useEffect(() => {
    setOnboarded(window.localStorage.getItem('pos-tv-ready') === '1');
    setBooted(true);
  }, []);
  if (!booted) return <Screen tv={tv} />;
  if (!onboarded) {
    return (
      <Screen tv={tv}>
        <FirstRun
          tv={tv}
          overview={frame.overview}
          refresh={frame.refresh}
          onDone={() => setOnboarded(true)}
        />
      </Screen>
    );
  }
  return <Stage tv={tv} />;
}

function Screen({ children, tv }: { children?: ReactNode; tv: TvCopy }) {
  const weather = useDeviceWeather();
  const forecast = weather.status === 'ready' ? weather.forecast : null;
  return (
    <div className="tv relative flex min-h-[100dvh] flex-col overflow-x-hidden">
      <Wallpaper kind={forecast?.kind ?? null} day={forecast?.day ?? true} />
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        {children ?? <p className="tv-display m-auto text-5xl">{tv.home}</p>}
      </div>
    </div>
  );
}

function FirstRun({
  tv,
  overview,
  refresh,
  onDone,
}: {
  tv: TvCopy;
  overview: Overview | null;
  refresh: () => Promise<void>;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [place, setPlace] = useState<PlaceId>('sala');
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [focus, setFocus] = useState('primary');
  const items = firstRunItems(step, place);
  useFocus(focus, items);

  async function begin() {
    setMessage(null);
    try {
      const session = await api<{ authenticated: boolean; enrolled: boolean }>('/api/v1/session');
      if (!session.authenticated) {
        if (session.enrolled) {
          window.location.assign('/login');
          return;
        }
        await api('/api/v1/demo/session', { method: 'POST' });
        await refresh();
      }
      setStep(1);
      setFocus('sala');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : tv.failed);
    }
  }

  async function finish(createHome: boolean) {
    setMessage(null);
    try {
      if (createHome && (overview?.environments.length ?? 0) === 0) {
        await api('/api/v1/demo/simulated-home', { method: 'POST' });
        await refresh();
      }
      window.localStorage.setItem('pos-tv-place', place);
      window.localStorage.setItem('pos-tv-custom', custom);
      window.localStorage.setItem('pos-tv-ready', '1');
      setStep(3);
      setFocus('enter');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : tv.failed);
    }
  }

  return (
    <section
      className="flex flex-1 flex-col justify-end"
      onKeyDown={(event) => onArrows(event, items, focus, setFocus)}
    >
      {step === 0 ? (
        <>
          <h1 className="tv-display max-w-4xl text-[clamp(48px,3.4vw,72px)] leading-none">{tv.welcome}</h1>
          <p className="mt-6 max-w-xl text-2xl text-[var(--text-secondary)]">{tv.welcomeBody}</p>
          <TvButton id="primary" className="mt-10" onClick={() => void begin()}>{tv.start}</TvButton>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <h1 className="tv-display text-[clamp(40px,3vw,64px)] leading-none">{tv.where}</h1>
          <div className="mt-8 flex flex-wrap gap-4">
            {places.map((item) => (
              <TvButton key={item.id} id={item.id} tone={place === item.id ? 'raised' : 'surface'} onClick={() => setPlace(item.id)}>
                {tv.places[item.id]}
              </TvButton>
            ))}
          </div>
          {place === 'otro' ? (
            <input
              id="custom"
              className="mt-6 max-w-md text-xl"
              aria-label={tv.otherName}
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
            />
          ) : null}
          <TvButton id="next" className="mt-8" onClick={() => { setStep(2); setFocus('demo'); }}>{tv.start}</TvButton>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <h1 className="tv-display text-[clamp(40px,3vw,64px)] leading-none">{tv.searching}</h1>
          <p className="mt-6 max-w-2xl text-2xl text-[var(--text-secondary)]">{tv.searchingBody}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <TvButton id="demo" onClick={() => void finish(true)}>{tv.useDemo}</TvButton>
            <TvButton id="skip" tone="surface" onClick={() => void finish(false)}>{tv.skip}</TvButton>
          </div>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <h1 className="tv-display text-[clamp(48px,3.4vw,72px)] leading-none">{tv.ready}</h1>
          <TvButton id="enter" className="mt-10" onClick={onDone}>{tv.enter}</TvButton>
        </>
      ) : null}
      {message ? <p className="mt-6 text-xl text-[var(--danger)]">{message}</p> : null}
    </section>
  );
}

function Stage({ tv }: { tv: TvCopy }) {
  const router = useRouter();
  const { overview, locale, refresh, error, copy } = useFrame();
  const weather = useDeviceWeather();
  const outside = weatherCopy(locale);
  const [now, setNow] = useState<Date | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [focus, setFocus] = useState('nav-home');
  const previous = useRef('nav-home');
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.2);
  const tone = useRef<ToneEngine | null>(null);
  const [mic, setMic] = useState<'off' | 'on'>('off');
  const [utterance, setUtterance] = useState('');
  const [assistant, setAssistant] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const place = useStoredPlace();
  const room = overview ? matchRoom(overview.rooms, place.id, place.custom) : null;
  const devices = (overview?.devices ?? []) as StatusDevice[];
  const roomDevices = overview?.devices.filter((device) => device.roomId === room?.id) ?? [];
  const lights = roomDevices.filter((device) => device.metadata.kind === 'light' && device.capabilities.includes('on_off'));
  const climate = roomDevices.some((device) => device.capabilities.includes('temperature_sensor'));
  const ribbon = ribbonFor(devices, room?.id ?? null, {
    interior: tv.interior,
    humidity: tv.humidity,
    lights: tv.lightsOn,
    climate: tv.climateLabel,
  });
  const mood = comfort(devices, room?.id ?? null);
  const items = overlay === 'none' ? stageItems(lights.length > 0, climate) : overlayItems(overlay, lights);
  const active = items.some((item) => item.id === focus) ? focus : items[0]?.id ?? '';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    setNow(new Date());
    return () => window.clearInterval(timer);
  }, []);
  useFocus(active, items);

  function open(next: Overlay, id: string) {
    if (overlay === 'none') previous.current = active;
    setOverlay(next);
    setFocus(id);
  }
  function close() {
    setOverlay('none');
    setMic('off');
    setFocus(restoreFocus(previous.current, stageItems(lights.length > 0, climate)));
  }

  async function run(task: () => Promise<void>) {
    setAssistant(null);
    try {
      await task();
      await refresh();
    } catch (reason) {
      setAssistant(reason instanceof Error ? reason.message : tv.failed);
    }
  }

  const forecast = weather.status === 'ready' ? weather.forecast : null;
  const weatherLine = forecast
    ? `${outside.outside} ${Math.round(forecast.celsius)}° · ${outside[forecast.kind]}`
    : weather.status === 'denied'
      ? outside.denied
      : weather.status === 'unavailable'
        ? outside.unavailable
        : outside.locating;
  const label = place.id === 'otro' && place.custom.trim() ? place.custom.trim() : tv.places[place.id];
  const context = mood === 'comfortable' ? tv.comfortable : mood === 'watch' ? tv.watch : tv.noReadings;
  const playable = playableDestinations()[0];

  return (
    <div className="tv flex min-h-screen flex-col" onKeyDown={(event) => onArrows(event, items, active, setFocus, overlay === 'none' ? undefined : close)}>
      <header className="tv-home-header flex items-start justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <p className="tv-display text-2xl tracking-wide">Physical OS</p>
          <nav className="flex flex-wrap gap-2" aria-label={tv.home}>
            <FocusButton id="nav-home" onClick={close}>{tv.home}</FocusButton>
            <FocusButton id="nav-tv" onClick={() => open('player', 'play')}>{tv.tv}</FocusButton>
            <FocusButton id="nav-apps" onClick={() => open('apps', 'preview-demo')}>{tv.apps}</FocusButton>
            <FocusButton id="nav-spaces" onClick={() => open('spaces', 'place-sala')}>{tv.spaces}</FocusButton>
          </nav>
        </div>
        <div className="tv-home-tools flex items-center gap-5 text-lg text-[var(--text-secondary)]">
          <span>{weatherLine}</span>
          {weather.status === 'denied' ? <button type="button" className="tv-target min-h-11 px-3" onClick={weather.retry}>{outside.retry}</button> : null}
          <span>{error ? tv.offline : tv.local}</span>
          <span>{mic === 'on' ? tv.listening : tv.micOff}</span>
          <time className="text-[var(--text-primary)]" dateTime={now?.toISOString()}>{now ? now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '––:––'}</time>
          <Link id="nav-settings" href="/settings" className="tv-target text-[var(--text-primary)]" aria-label={tv.settings}>{tv.settings}</Link>
        </div>
      </header>

      <section className="mt-10 max-w-5xl">
        <h1 className="tv-display text-[clamp(48px,3.4vw,72px)] leading-none">{now ? greeting(now.getHours(), locale) : tv.welcome}</h1>
        <p className="mt-4 text-[clamp(22px,1.6vw,32px)] text-[var(--text-secondary)]">{label} · {context}</p>
        <p className="mt-2 text-lg text-[var(--text-primary)]">{tv.spark}</p>
        <p className="mt-3 text-lg text-[var(--text-secondary)]">{devices.length} · {copy.devices}</p>
      </section>

      {ribbon.length > 0 ? (
        <ul className="mt-8 flex flex-wrap gap-3" aria-label={label}>
          {ribbon.map((item) => (
            <li key={item.id} className="min-w-36 bg-[var(--surface)] px-5 py-4">
              <p className="text-2xl text-[var(--text-primary)]">{item.value}</p>
              <p className="text-lg text-[var(--text-secondary)]">{item.label}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="mt-auto" aria-label={tv.music}>
        {playable ? (
          <button id="media" type="button" className="tv-tile tv-target mt-8 flex h-44 w-full max-w-xl flex-col justify-between bg-[var(--surface)] p-6 text-left md:h-52" onClick={() => open('player', 'play')}>
            <span className="text-lg text-[var(--text-secondary)]">{playing ? tv.pause : tv.music}</span>
            <span className="tv-display text-[clamp(28px,2vw,40px)]">{tv.music}</span>
            <span className="text-lg text-[var(--text-secondary)]">{tv.musicBody}</span>
          </button>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-4">
          <FocusButton id="assist" prominent onClick={() => router.push('/presence')}>{tv.ask}</FocusButton>
          <FocusButton id="profiles" onClick={() => router.push('/profiles')}>{tv.profiles}</FocusButton>
          {lights.length > 0 ? <FocusButton id="lights" onClick={() => open('lights', lights[0] ? `light-${lights[0].id}` : 'all-off')}>{tv.lights}</FocusButton> : null}
          {climate ? <FocusButton id="climate" onClick={() => open('climate', 'climate-close')}>{tv.climate}</FocusButton> : null}
        </div>
      </section>

      {overlay !== 'none' ? (
        <div className="tv-scrim" role="presentation">
          <div role="dialog" aria-modal="true" aria-label={dialogLabel(overlay, tv)} className="tv-panel">
            {overlay === 'player' ? (
              <Player tv={tv} playing={playing} volume={volume} onVolume={(value) => { setVolume(value); tone.current?.setVolume(value); }} onToggle={() => {
                tone.current ??= createBrowserTone();
                if (playing) {
                  tone.current.stop();
                  setPlaying(false);
                } else {
                  tone.current.start(volume);
                  setPlaying(true);
                }
              }} onClose={close} />
            ) : null}
            {overlay === 'apps' ? (
              <div>
                <p className="text-2xl">{tv.preview}</p>
                <TvButton id="preview-demo" className="mt-6" onClick={() => open('player', 'play')}>{tv.openDemo}</TvButton>
                <TvButton id="apps-close" tone="surface" className="mt-4" onClick={close}>{tv.close}</TvButton>
              </div>
            ) : null}
            {overlay === 'spaces' ? (
              <SpaceList tv={tv} place={place.id} onPick={(id) => { window.localStorage.setItem('pos-tv-place', id); window.dispatchEvent(new Event('pos-tv-place')); close(); }} onClose={close} />
            ) : null}
            {overlay === 'lights' ? (
              <LightPanel tv={tv} lights={lights} levels={levels} setLevels={setLevels} onRun={run} onClose={close} setAssistant={setAssistant} assistant={assistant} />
            ) : null}
            {overlay === 'climate' ? <ClimatePanel tv={tv} devices={roomDevices} onClose={close} /> : null}
            {overlay === 'assistant' ? (
              <Assistant
                tv={tv}
                placeId={place.id}
                roomName={room?.name ?? null}
                utterance={utterance}
                setUtterance={setUtterance}
                message={assistant}
                planId={planId}
                environmentId={overview?.environments[0]?.id ?? null}
                onSpeak={() => speak(locale, (text) => { setMic('on'); setUtterance(text); })}
                onInterpret={(text) => void interpret(text, overview?.environments[0]?.id ?? null, place.id, room?.name ?? null, setAssistant, setPlanId)}
                onApprove={() => void approve(planId, refresh, tv, setAssistant, setPlanId)}
                onReject={() => void reject(planId, setPlanId, setAssistant)}
                onClose={close}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Player({ tv, playing, volume, onToggle, onVolume, onClose }: { tv: TvCopy; playing: boolean; volume: number; onToggle: () => void; onVolume: (value: number) => void; onClose: () => void }) {
  return (
    <div>
      <h2 className="tv-display text-4xl">{tv.music}</h2>
      <p className="mt-3 max-w-xl text-xl text-[var(--text-secondary)]">{tv.musicBody}</p>
      <div className="mt-8 flex flex-wrap gap-4">
        <TvButton id="play" onClick={onToggle}>{playing ? tv.pause : tv.play}</TvButton>
        <TvButton id="player-close" tone="surface" onClick={onClose}>{tv.close}</TvButton>
      </div>
      <label className="mt-8 block max-w-md text-lg" htmlFor="volume">
        {tv.volume}
        <input id="volume" type="range" min={0} max={0.4} step={0.01} value={volume} onChange={(event) => onVolume(Number(event.target.value))} />
      </label>
    </div>
  );
}

function SpaceList({ tv, place, onPick, onClose }: { tv: TvCopy; place: PlaceId; onPick: (id: PlaceId) => void; onClose: () => void }) {
  return (
    <div>
      <h2 className="tv-display text-4xl">{tv.where}</h2>
      <div className="mt-6 flex flex-wrap gap-4">
        {places.filter((item) => item.id !== 'otro').map((item) => (
          <TvButton key={item.id} id={`place-${item.id}`} tone={place === item.id ? 'raised' : 'surface'} onClick={() => onPick(item.id)}>
            {tv.places[item.id]}
          </TvButton>
        ))}
        <TvButton id="spaces-close" tone="surface" onClick={onClose}>{tv.close}</TvButton>
      </div>
    </div>
  );
}

function LightPanel({
  tv,
  lights,
  levels,
  setLevels,
  onRun,
  onClose,
  assistant,
  setAssistant,
}: {
  tv: TvCopy;
  lights: Device[];
  levels: Record<string, number>;
  setLevels: (value: Record<string, number>) => void;
  onRun: (task: () => Promise<void>) => Promise<void>;
  onClose: () => void;
  assistant: string | null;
  setAssistant: (value: string | null) => void;
}) {
  return (
    <div>
      <h2 className="tv-display text-4xl">{tv.lights}</h2>
      <div className="mt-6 flex flex-wrap gap-4">
        <TvButton id="all-on" onClick={() => void onRun(() => setLights(lights, true, tv, setAssistant))}>{tv.allOn}</TvButton>
        <TvButton id="all-off" tone="surface" onClick={() => void onRun(() => setLights(lights, false, tv, setAssistant))}>{tv.allOff}</TvButton>
        <TvButton id="lights-close" tone="surface" onClick={onClose}>{tv.close}</TvButton>
      </div>
      <ul className="mt-6 grid gap-4">
        {lights.map((light) => {
          const on = light.observed.on_off?.on === true;
          const level = levels[light.id] ?? Number(light.observed.brightness?.level ?? 0);
          return (
            <li key={light.id} className="bg-[var(--bg-secondary)] p-4">
              <TvButton id={`light-${light.id}`} tone={on ? 'raised' : 'surface'} onClick={() => void onRun(async () => { await command(light.id, 'on_off', 'set', { on: !on }); setAssistant(null); })}>
                {light.name} · {on ? tv.allOff : tv.allOn}
              </TvButton>
              {light.capabilities.includes('brightness') ? (
                <label className="mt-3 block text-lg" htmlFor={`bright-${light.id}`}>
                  {tv.brightness}
                  <input
                    id={`bright-${light.id}`}
                    type="range"
                    min={0}
                    max={100}
                    value={level}
                    onChange={(event) => setLevels({ ...levels, [light.id]: Number(event.target.value) })}
                    onPointerUp={(event) => {
                      const next = Number(event.currentTarget.value);
                      void onRun(() => command(light.id, 'brightness', 'set', { level: next }).then((record) => { setAssistant(record.verified ? null : outcome(record, tv)); }));
                    }}
                    onKeyUp={(event) => {
                      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                      const next = Number(event.currentTarget.value);
                      void onRun(() => command(light.id, 'brightness', 'set', { level: next }).then((record) => { setAssistant(record.verified ? null : outcome(record, tv)); }));
                    }}
                  />
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
      {assistant ? <p className="mt-4 text-xl">{assistant}</p> : null}
    </div>
  );
}

function ClimatePanel({ tv, devices, onClose }: { tv: TvCopy; devices: Device[]; onClose: () => void }) {
  const sensor = devices.find((device) => typeof device.observed.temperature_sensor?.celsius === 'number');
  const humidity = devices.find((device) => typeof device.observed.humidity_sensor?.percent === 'number');
  const locked = devices.some((device) => device.capabilities.includes('temperature_setpoint'));
  return (
    <div>
      <h2 className="tv-display text-4xl">{tv.climate}</h2>
      <p className="mt-4 text-3xl">{typeof sensor?.observed.temperature_sensor?.celsius === 'number' ? `${sensor.observed.temperature_sensor.celsius}°` : tv.noReadings}</p>
      {typeof humidity?.observed.humidity_sensor?.percent === 'number' ? <p className="mt-2 text-2xl text-[var(--text-secondary)]">{humidity.observed.humidity_sensor.percent}% {tv.humidity}</p> : null}
      {locked ? <p className="mt-4 text-xl text-[var(--text-secondary)]">{tv.setpointLocked}</p> : null}
      <TvButton id="climate-close" className="mt-8" onClick={onClose}>{tv.close}</TvButton>
    </div>
  );
}

function Assistant({
  tv,
  placeId,
  roomName,
  utterance,
  setUtterance,
  message,
  planId,
  environmentId,
  onInterpret,
  onApprove,
  onReject,
  onSpeak,
  onClose,
}: {
  tv: TvCopy;
  placeId: PlaceId;
  roomName: string | null;
  utterance: string;
  setUtterance: (value: string) => void;
  message: string | null;
  planId: string | null;
  environmentId: string | null;
  onInterpret: (text: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onSpeak: () => void;
  onClose: () => void;
}) {
  const suggestions = [
    groundUtterance('Apaga todas las luces de la sala', placeId, roomName),
    groundUtterance('Cual es la temperatura en la sala', placeId, roomName),
  ];
  return (
    <div>
      <h2 className="tv-display text-4xl">{tv.ask}</h2>
      <textarea id="ask" className="mt-6 min-h-28 text-xl" value={utterance} onChange={(event) => setUtterance(event.target.value)} />
      <div className="mt-4 flex flex-wrap gap-3">
        {suggestions.map((text, index) => (
          <TvButton key={text} id={`suggest-${index}`} tone="surface" disabled={!environmentId} onClick={() => { setUtterance(text); onInterpret(text); }}>{text}</TvButton>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <TvButton id="interpret" disabled={!environmentId || utterance.trim().length === 0} onClick={() => onInterpret(utterance)}>{tv.ask}</TvButton>
        <TvButton id="speak" tone="surface" onClick={onSpeak}>{tv.listening}</TvButton>
        <TvButton id="assistant-close" tone="surface" onClick={onClose}>{tv.close}</TvButton>
      </div>
      {message ? <p className="mt-6 text-2xl">{message}</p> : null}
      {planId ? (
        <div className="mt-6 flex gap-3">
          <TvButton id="approve" onClick={onApprove}>{tv.approve}</TvButton>
          <TvButton id="cancel-plan" tone="surface" onClick={onReject}>{tv.reject}</TvButton>
        </div>
      ) : null}
    </div>
  );
}

function TvButton({ id, children, onClick, tone = 'accent', className = '', disabled = false }: { id: string; children: ReactNode; onClick: () => void; tone?: 'accent' | 'surface' | 'raised'; className?: string; disabled?: boolean }) {
  const tones = {
    accent: 'bg-[var(--accent-primary)] text-[var(--bg-primary)]',
    surface: 'bg-[var(--surface)] text-[var(--text-primary)]',
    raised: 'bg-[var(--surface-raised)] text-[var(--text-primary)]',
  };
  return (
    <button id={id} type="button" disabled={disabled} className={`tv-target px-6 py-4 text-xl ${tones[tone]} ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}

function FocusButton({ id, children, onClick, prominent = false }: { id: string; children: ReactNode; onClick: () => void; prominent?: boolean }) {
  const tone = prominent ? 'bg-[var(--accent-primary)] px-6 text-[var(--bg-primary)]' : 'text-[var(--text-primary)]';
  return (
    <button id={id} type="button" className={`tv-target px-4 py-3 text-xl ${tone}`} onClick={onClick}>
      {children}
    </button>
  );
}

function useStoredPlace(): { id: PlaceId; custom: string } {
  const [place, setPlace] = useState<{ id: PlaceId; custom: string }>({ id: 'sala', custom: '' });
  useEffect(() => {
    const read = () => {
      const stored = window.localStorage.getItem('pos-tv-place');
      const id = places.some((item) => item.id === stored) ? (stored as PlaceId) : 'sala';
      setPlace({ id, custom: window.localStorage.getItem('pos-tv-custom') ?? '' });
    };
    read();
    window.addEventListener('pos-tv-place', read);
    return () => window.removeEventListener('pos-tv-place', read);
  }, []);
  return place;
}

function useFocus(id: string, items: FocusItem[]) {
  useEffect(() => {
    if (!items.some((item) => item.id === id)) return;
    document.getElementById(id)?.focus();
  }, [id, items]);
}

function onArrows(event: KeyboardEvent<HTMLElement>, items: FocusItem[], focus: string, setFocus: (id: string) => void, close?: () => void) {
  if ((event.key === 'Escape' || event.key === 'Backspace') && close && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
    event.preventDefault();
    close();
    return;
  }
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  if (event.target instanceof HTMLTextAreaElement) return;
  if (event.target instanceof HTMLInputElement && event.target.type === 'range' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return;
  if (event.target instanceof HTMLInputElement && event.target.type !== 'range') return;
  event.preventDefault();
  setFocus(moveFocus(items, focus, event.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'));
}

function stageItems(lights: boolean, climate: boolean): FocusItem[] {
  const items: FocusItem[] = [
    { id: 'nav-home', row: 0, col: 0 },
    { id: 'nav-tv', row: 0, col: 1 },
    { id: 'nav-apps', row: 0, col: 2 },
    { id: 'nav-spaces', row: 0, col: 3 },
    { id: 'nav-settings', row: 0, col: 4 },
    { id: 'media', row: 1, col: 0 },
    { id: 'assist', row: 2, col: 0 },
    { id: 'profiles', row: 2, col: 3 },
  ];
  if (lights) items.push({ id: 'lights', row: 2, col: 1 });
  if (climate) items.push({ id: 'climate', row: 2, col: 2 });
  return items;
}

function overlayItems(overlay: Overlay, lights: Device[]): FocusItem[] {
  if (overlay === 'player') return [{ id: 'play', row: 0, col: 0 }, { id: 'player-close', row: 0, col: 1 }, { id: 'volume', row: 1, col: 0 }];
  if (overlay === 'apps') return [{ id: 'preview-demo', row: 0, col: 0 }, { id: 'apps-close', row: 1, col: 0 }];
  if (overlay === 'spaces') {
    return [
      ...places.filter((item) => item.id !== 'otro').map((item, index) => ({ id: `place-${item.id}`, row: 0, col: index })),
      { id: 'spaces-close', row: 1, col: 0 },
    ];
  }
  if (overlay === 'climate') return [{ id: 'climate-close', row: 0, col: 0 }];
  if (overlay === 'lights') {
    return [
      { id: 'all-on', row: 0, col: 0 },
      { id: 'all-off', row: 0, col: 1 },
      { id: 'lights-close', row: 0, col: 2 },
      ...lights.map((light, index) => ({ id: `light-${light.id}`, row: index + 1, col: 0 })),
    ];
  }
  return [
    { id: 'ask', row: 0, col: 0 },
    { id: 'suggest-0', row: 1, col: 0 },
    { id: 'suggest-1', row: 1, col: 1 },
    { id: 'interpret', row: 2, col: 0 },
    { id: 'speak', row: 2, col: 1 },
    { id: 'assistant-close', row: 2, col: 2 },
    { id: 'approve', row: 3, col: 0 },
    { id: 'cancel-plan', row: 3, col: 1 },
  ];
}

function firstRunItems(step: number, place: PlaceId): FocusItem[] {
  if (step === 0) return [{ id: 'primary', row: 0, col: 0 }];
  if (step === 1) {
    return [
      ...places.map((item, index) => ({ id: item.id, row: 0, col: index })),
      ...(place === 'otro' ? [{ id: 'custom', row: 1, col: 0 }] : []),
      { id: 'next', row: 2, col: 0 },
    ];
  }
  if (step === 2) return [{ id: 'demo', row: 0, col: 0 }, { id: 'skip', row: 0, col: 1 }];
  return [{ id: 'enter', row: 0, col: 0 }];
}

function dialogLabel(overlay: Overlay, tv: TvCopy): string {
  if (overlay === 'player') return tv.music;
  if (overlay === 'apps') return tv.apps;
  if (overlay === 'spaces') return tv.spaces;
  if (overlay === 'lights') return tv.lights;
  if (overlay === 'climate') return tv.climate;
  return tv.ask;
}

async function command(deviceId: string, capability: string, action: string, params: Record<string, unknown>) {
  return api<CommandResult>(`/api/v1/devices/${deviceId}/commands`, {
    method: 'POST',
    body: JSON.stringify({ capability, action, params, approval: 'explicit_ui' }),
  });
}

async function setLights(lights: Device[], on: boolean, tv: TvCopy, setAssistant: (value: string | null) => void) {
  const records = [];
  for (const light of lights) records.push(await command(light.id, 'on_off', 'set', { on }));
  setAssistant(records.every((record) => record.verified) ? tv.confirmed : records.map((record) => outcome(record, tv)).join(' '));
}

function outcome(record: CommandResult, tv: TvCopy): string {
  if (record.verified) return tv.confirmed;
  if (record.outcome === 'delivered') return tv.sent;
  return record.errorMessage ?? tv.failed;
}

async function interpret(
  text: string,
  environmentId: string | null,
  placeId: PlaceId,
  roomName: string | null,
  setAssistant: (value: string | null) => void,
  setPlanId: (value: string | null) => void,
) {
  if (!environmentId) return;
  const result = await api<{ type: string; planId?: string; message?: string; explanation?: string; plan?: { explanation?: string } }>(
    '/api/v1/intelligence/interpret',
    { method: 'POST', body: JSON.stringify({ environmentId, utterance: groundUtterance(text, placeId, roomName) }) },
  );
  setPlanId(result.type === 'plan' ? result.planId ?? null : null);
  setAssistant(result.plan?.explanation ?? result.explanation ?? result.message ?? result.type);
}

async function approve(planId: string | null, refresh: () => Promise<void>, tv: TvCopy, setAssistant: (value: string | null) => void, setPlanId: (value: string | null) => void) {
  if (!planId) return;
  const result = await api<{ commands: CommandResult[] }>(`/api/v1/intelligence/${planId}/approve`, { method: 'POST' });
  setPlanId(null);
  const verified = result.commands.every((command) => command.verified);
  const delivered = result.commands.every((command) => command.verified || command.outcome === 'delivered');
  setAssistant(verified ? tv.confirmed : delivered ? tv.sent : tv.failed);
  await refresh();
}

async function reject(planId: string | null, setPlanId: (value: string | null) => void, setAssistant: (value: string | null) => void) {
  if (!planId) return;
  await api(`/api/v1/intelligence/${planId}/reject`, { method: 'POST' });
  setPlanId(null);
  setAssistant(null);
}

function speak(locale: string, onText: (text: string) => void) {
  const agent = window as Window & {
    SpeechRecognition?: new () => BrowserSpeech;
    webkitSpeechRecognition?: new () => BrowserSpeech;
  };
  const Recognition = agent.SpeechRecognition ?? agent.webkitSpeechRecognition;
  if (!Recognition) return;
  const recognition = new Recognition();
  recognition.lang = locale === 'es' ? 'es-MX' : 'en-US';
  recognition.onresult = (event) => {
    const text = event.results[0]?.[0]?.transcript;
    if (text) onText(text);
  };
  recognition.start();
}

interface BrowserSpeech {
  lang: string;
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  start: () => void;
}
