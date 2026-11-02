'use client';

import Link from 'next/link';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { Button, Panel, Pill } from '@physical-os/ui';
import { api, type AuditEntry, type CommandResult, type Device, type Overview } from '@/lib/api';
import { useFrame } from '@/components/shell';
import type { Copy } from '@/lib/i18n';

export function OverviewView() {
  const { overview, copy, refresh } = useFrame();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!overview) return null;
  if (overview.environments.length === 0) {
    return (
      <section className="flex flex-1 flex-col justify-end px-6 pb-16 md:px-10">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">{copy.product}</p>
        <h1 className="mt-3 max-w-3xl font-serif text-6xl leading-none md:text-7xl">{copy.plugTitle}</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">{copy.plugBody}</p>
        <Button
          type="button"
          tone="brass"
          autoFocus
          className="mt-8 h-16 w-full max-w-sm text-lg"
          onClick={() => {
            setMessage(null);
            void api('/api/v1/demo/simulated-home', { method: 'POST' })
              .then(() => refresh())
              .catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : copy.notVerified));
          }}
        >
          {copy.start}
        </Button>
        {message ? <p className="mt-4 text-sm text-clay">{message}</p> : null}
      </section>
    );
  }
  const selected = overview.rooms.find((room) => room.id === roomId) ?? overview.rooms[0];
  const roomDevices = selected ? overview.devices.filter((device) => device.roomId === selected.id) : [];
  return (
    <section
      className="flex flex-1 flex-col justify-end pb-10"
      onKeyDown={(event) => moveTvFocus(event)}
    >
      <div className="px-6 md:px-10">
        <h1 className="font-serif text-4xl">{selected?.name ?? copy.spaces}</h1>
        {selected ? <RoomIndicators devices={roomDevices} copy={copy} /> : null}
        {message ? <p className="mt-3 text-sm text-clay">{message}</p> : null}
      </div>
      <div className="tv-row mt-6 flex gap-4 overflow-x-auto px-6 pb-2 md:px-10" role="tablist" aria-label={copy.spaces}>
        {overview.rooms.map((room) => {
          const devices = overview.devices.filter((device) => device.roomId === room.id);
          const active = room.id === selected?.id;
          return (
            <button
              key={room.id}
              type="button"
              role="tab"
              data-zone="room"
              aria-selected={active}
              className={`tv-tile flex h-40 w-64 shrink-0 flex-col justify-between border p-5 text-left ${active ? 'border-brass' : 'border-line'}`}
              onClick={() => setRoomId(room.id)}
              onFocus={() => setRoomId(room.id)}
            >
              <span className="font-serif text-3xl leading-none">{room.name}</span>
              <RoomIndicators devices={devices} copy={copy} compact />
            </button>
          );
        })}
      </div>
      <div className="mt-8 px-6 md:px-10">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">{copy.roomNow}</p>
      </div>
      <div className="tv-row mt-3 flex gap-4 overflow-x-auto px-6 md:px-10" role="group" aria-label={selected?.name ?? copy.devices}>
        {roomDevices.map((device) => (
          <DeviceTile
            key={device.id}
            device={device}
            copy={copy}
            busy={busy === device.id}
            onAction={() => {
              setBusy(device.id);
              setMessage(null);
              void actOnDevice(device)
                .then((text) => {
                  if (text) setMessage(text);
                  return refresh();
                })
                .catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : copy.notVerified))
                .finally(() => setBusy(null));
            }}
          />
        ))}
      </div>
    </section>
  );
}

export function SpacesView() {
  const { overview, refresh, copy } = useFrame();
  const [roomName, setRoomName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [kind, setKind] = useState('light');
  if (!overview) return null;
  return (
    <div className="grid gap-4">
      {overview.environments.length === 0 ? (
        <Panel title={copy.empty}>
          <Button
            type="button"
            tone="brass"
            onClick={() => void api('/api/v1/demo/simulated-home', { method: 'POST' }).then(() => refresh())}
          >
            {copy.createHome}
          </Button>
          <form
            className="mt-4 grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = roomName.trim();
              if (!name) return;
              void api('/api/v1/environments', { method: 'POST', body: JSON.stringify({ name }) }).then(() => {
                setRoomName('');
                return refresh();
              });
            }}
          >
            <input aria-label={copy.name} value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder={copy.name} required />
            <Button type="submit">{copy.createEnv}</Button>
          </form>
        </Panel>
      ) : null}
      {overview.rooms.map((room) => (
        <Panel key={room.id} title={room.name}>
          <ul className="space-y-2 text-sm">
            {overview.devices
              .filter((device) => device.roomId === room.id)
              .map((device) => (
                <li key={device.id}>
                  <Link href={`/devices/${device.id}`} className="underline-offset-4 hover:underline">
                    {device.name}
                  </Link>
                  <span className="ml-2 text-muted">{device.capabilities.join(', ')}</span>
                </li>
              ))}
          </ul>
        </Panel>
      ))}
      <Panel title={copy.spaces}>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const environment = overview.environments[0]?.id;
            if (!environment) return;
            void api('/api/v1/rooms', { method: 'POST', body: JSON.stringify({ environmentId: environment, name: roomName }) })
              .then(() => refresh())
              .finally(() => setRoomName(''));
          }}
        >
          <input aria-label={copy.name} value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Room" required />
          <Button type="submit">{copy.spaces}</Button>
        </form>
        <form
          className="mt-4 grid gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            const environment = overview.environments[0];
            const room = roomId || overview.rooms[0]?.id;
            if (!environment || !room) return;
            const capabilities = kind === 'motion_sensor' ? ['motion_sensor'] : kind === 'environment_sensor' ? ['temperature_sensor', 'humidity_sensor'] : ['on_off'];
            void api('/api/v1/devices', {
              method: 'POST',
              body: JSON.stringify({ environmentId: environment.id, roomId: room, name: deviceName, kind, capabilities }),
            }).then(() => {
              setDeviceName('');
              return refresh();
            });
          }}
        >
          <input aria-label="Device name" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="Device" required />
          <select aria-label="Room" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            {overview.rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
          <select aria-label="Kind" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="light">light</option>
            <option value="switch">switch</option>
            <option value="motion_sensor">motion sensor</option>
            <option value="environment_sensor">environment sensor</option>
          </select>
          <Button type="submit">{copy.devices}</Button>
        </form>
      </Panel>
    </div>
  );
}

export function DevicesView() {
  const { overview } = useFrame();
  if (!overview) return null;
  return (
    <div className="grid gap-3">
      {overview.devices.map((device) => (
        <DeviceCard key={device.id} device={device} rooms={overview.rooms} />
      ))}
    </div>
  );
}

export function DeviceDetail({ id }: { id: string }) {
  const { overview, refresh, copy } = useFrame();
  const [result, setResult] = useState<string | null>(null);
  const device = overview?.devices.find((item) => item.id === id);
  if (!device) return <p className="text-muted">Unknown device.</p>;
  const room = overview?.rooms.find((item) => item.id === device.roomId);
  return (
    <Panel title={device.name} action={<Pill tone={device.metadata.simulated === true ? 'sim' : 'neutral'}>{device.adapterId}</Pill>}>
      <p className="text-sm text-muted">{room?.name} · {device.manufacturer ?? 'Unknown manufacturer'} · {device.connectivity}</p>
      <p className="mt-2 text-sm">Observed {device.observedAt ? new Date(device.observedAt).toLocaleString() : 'never'}</p>
      <div className="mt-4 grid gap-3">
        {device.capabilities.includes('on_off') ? (
          <Button
            type="button"
            tone="brass"
            onClick={() =>
              void command(device.id, 'on_off', 'toggle', {}).then((record) => {
                setResult(outcomeText(record, copy.verified, copy.notVerified));
                return refresh();
              })
            }
          >
            {device.observed.on_off?.on === true ? 'Turn off' : 'Turn on'}
          </Button>
        ) : null}
        {device.capabilities.includes('brightness') ? (
          <label className="text-sm">
            Brightness {String(device.observed.brightness?.level ?? 0)}
            <input
              type="range"
              min={0}
              max={100}
              value={Number(device.observed.brightness?.level ?? 0)}
              onChange={(event) =>
                void command(device.id, 'brightness', 'set', { level: Number(event.target.value) }).then(() => refresh())
              }
            />
          </label>
        ) : null}
        {device.capabilities.includes('motion_sensor') ? (
          <Button
            type="button"
            onClick={() =>
              void api(`/api/v1/devices/${device.id}/readings`, {
                method: 'POST',
                body: JSON.stringify({ capability: 'motion_sensor', value: { detected: device.observed.motion_sensor?.detected !== true } }),
              }).then(() => refresh())
            }
          >
            {device.observed.motion_sensor?.detected === true ? 'Clear motion' : 'Simulate motion'}
          </Button>
        ) : null}
        {device.capabilities.includes('temperature_setpoint') ? (
          <p className="border border-line p-3 text-sm">
            Setpoint {String((device.observed.temperature_setpoint?.celsius as number | undefined) ?? '—')}°C. High-risk actuation is disabled.
            Reading {String((device.observed.temperature_sensor?.celsius as number | undefined) ?? '—')}°C.
          </p>
        ) : null}
        {device.capabilities.includes('temperature_sensor') && !device.capabilities.includes('temperature_setpoint') ? (
          <p className="text-sm">{String(device.observed.temperature_sensor?.celsius ?? '—')}°C · {String(device.observed.humidity_sensor?.percent ?? '—')}% humidity</p>
        ) : null}
      </div>
      {result ? <p className="mt-4 text-sm">{result}</p> : null}
    </Panel>
  );
}

export function AutomationsView() {
  const { overview, refresh, copy } = useFrame();
  const [name, setName] = useState('Evening lights');
  const [deviceId, setDeviceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  if (!overview) return null;
  const sensors = overview.devices.filter((device) => device.capabilities.includes('motion_sensor'));
  const lights = overview.devices.filter((device) => device.metadata.kind === 'light');
  const environment = overview.environments[0];
  const sunset = overview.signals.find((signal) => signal.environmentId === environment?.id && signal.name === 'after_sunset');
  return (
    <div className="grid gap-4">
      {environment ? (
        <Panel title={copy.sunset}>
          <Button
            type="button"
            tone={sunset?.value === true ? 'brass' : 'default'}
            onClick={() =>
              void api('/api/v1/signals', {
                method: 'POST',
                body: JSON.stringify({ environmentId: environment.id, name: 'after_sunset', value: sunset?.value !== true }),
              }).then(() => refresh())
            }
          >
            {sunset?.value === true ? copy.on : copy.off}
          </Button>
          <p className="mt-3 text-sm text-muted">Configurable stand-in. No location or astronomical calculation.</p>
        </Panel>
      ) : null}
      {overview.automations.map((automation) => (
        <Panel
          key={automation.id}
          title={automation.name}
          action={<Pill tone={automation.enabled ? 'ok' : 'neutral'}>{automation.enabled ? 'Enabled' : 'Disabled'}</Pill>}
        >
          <p className="text-sm text-muted">{automation.trigger.type} · {automation.actions.length} action(s) {automation.dryRun ? '· dry run' : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() =>
                void api(`/api/v1/automations/${automation.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ enabled: !automation.enabled }),
                }).then(() => refresh())
              }
            >
              {automation.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button
              type="button"
              onClick={() =>
                void api<{ status: string; reason: string | null }>(`/api/v1/automations/${automation.id}/dry-run`, { method: 'POST' }).then(
                  (run) => setMessage(`${run.status}: ${run.reason ?? ''}`),
                )
              }
            >
              Dry run
            </Button>
          </div>
        </Panel>
      ))}
      <Panel title={copy.automations}>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const environment = overview.environments[0];
            const sensor = deviceId || sensors[0]?.id;
            const light = targetId || lights[0]?.id;
            if (!environment || !sensor || !light) return;
            void api('/api/v1/automations', {
              method: 'POST',
              body: JSON.stringify({
                environmentId: environment.id,
                name,
                enabled: true,
                dryRun: false,
                trigger: { type: 'event', event: 'device.state.changed', deviceId: sensor, capability: 'motion_sensor', match: { detected: true } },
                conditions: { type: 'signal', signal: 'after_sunset', equals: true },
                actions: [{ type: 'device_command', deviceId: light, capability: 'on_off', action: 'set', params: { on: true } }],
              }),
            }).then(() => refresh());
          }}
        >
          <input aria-label={copy.name} value={name} onChange={(event) => setName(event.target.value)} />
          <select aria-label="Sensor" value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
            {sensors.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
          </select>
          <select aria-label="Light" value={targetId} onChange={(event) => setTargetId(event.target.value)}>
            {lights.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
          </select>
          <Button type="submit" tone="brass">Save rule</Button>
        </form>
        {message ? <p className="mt-3 text-sm">{message}</p> : null}
      </Panel>
    </div>
  );
}

export function IntelligenceView() {
  const { overview, copy, refresh } = useFrame();
  const [utterance, setUtterance] = useState('Turn off all the living room lights.');
  const [plan, setPlan] = useState<{ planId?: string; explanation?: string; type: string; message?: string } | null>(null);
  const [execution, setExecution] = useState<string | null>(null);
  if (!overview?.environments[0]) return <p className="text-muted">{copy.empty}</p>;
  const environmentId = overview.environments[0].id;
  return (
    <Panel title={copy.intelligence}>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setExecution(null);
          void api<{ type: string; planId?: string; explanation?: string; message?: string; plan?: { explanation: string } }>(
            '/api/v1/intelligence/interpret',
            { method: 'POST', body: JSON.stringify({ environmentId, utterance }) },
          ).then((result) => setPlan({ ...result, explanation: result.plan?.explanation ?? result.explanation ?? result.message }));
        }}
      >
        <label className="text-sm" htmlFor="utterance">Command</label>
        <textarea id="utterance" rows={3} value={utterance} onChange={(event) => setUtterance(event.target.value)} />
        <Button type="submit" tone="brass">Interpret</Button>
      </form>
      {plan ? (
        <div className="mt-4 border border-line p-4">
          <p className="text-sm">{plan.explanation}</p>
          {plan.planId ? (
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                tone="brass"
                onClick={() =>
                  void api<{ explanation: string; status: string }>(`/api/v1/intelligence/${plan.planId}/approve`, { method: 'POST' }).then(
                    async (result) => {
                      setExecution(`${result.status}. ${result.explanation}`);
                      await refresh();
                    },
                  )
                }
              >
                {copy.approve}
              </Button>
              <Button type="button" tone="danger" onClick={() => void api(`/api/v1/intelligence/${plan.planId}/reject`, { method: 'POST' }).then(() => setPlan(null))}>
                {copy.reject}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {execution ? <p className="mt-4 text-sm text-pine">{execution}</p> : null}
    </Panel>
  );
}

export function ActivityView() {
  const { copy } = useFrame();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    void api<AuditEntry[]>('/api/v1/activity')
      .then(setEntries)
      .catch((error: unknown) => setFailed(error instanceof Error ? error.message : 'Failed'));
  }, []);
  return (
    <Panel title={copy.activity}>
      {failed ? <p className="text-clay">{failed}</p> : null}
      <ol className="space-y-3">
        {(entries ?? []).map((entry) => (
          <li key={entry.id} className="border-b border-line pb-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">{entry.action}</span>
              <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
            </div>
            <p className="text-muted">{entry.outcome} · {entry.actorId}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function IntegrationsView() {
  const { overview, refresh, copy } = useFrame();
  const [health, setHealth] = useState<Array<{ adapterId: string; status: string; message: string }>>([]);
  const [url, setUrl] = useState('mqtt://127.0.0.1:1883');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localId, setLocalId] = useState('porch-light');
  const [topic, setTopic] = useState('home/porch/light/state');
  const [commandTopic, setCommandTopic] = useState('home/porch/light/set');
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    void api<{ health: Array<{ adapterId: string; status: string; message: string }> }>('/api/v1/integrations').then((data) =>
      setHealth(data.health),
    );
  }, []);
  const roomId = overview?.rooms[0]?.id;
  return (
    <div className="grid gap-4">
      {health.map((item) => (
        <Panel key={item.adapterId} title={item.adapterId} action={<Pill tone={item.status === 'planned' ? 'warn' : item.status === 'healthy' ? 'ok' : 'neutral'}>{item.status}</Pill>}>
          <p className="text-sm">{item.message}</p>
        </Panel>
      ))}
      <Panel title="MQTT">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!roomId) return;
            void api('/api/v1/integrations/mqtt', {
              method: 'POST',
              body: JSON.stringify({
                url,
                username,
                password,
                clientId: 'physical-os',
                rejectUnauthorized: true,
                allowAnonymous: false,
                allowInsecurePlaintext: false,
                devices: [
                  {
                    localId,
                    name: localId,
                    roomId,
                    capabilities: ['on_off'],
                    stateTopic: topic,
                    commandTopic,
                    stateFormat: 'on_off_json',
                  },
                ],
              }),
            })
              .then(() => {
                setPassword('');
                setNote('Connected. The password is stored locally and is not shown again.');
                return refresh();
              })
              .catch((error: unknown) => setNote(error instanceof Error ? error.message : 'MQTT connection failed'));
          }}
        >
          <input aria-label="Broker URL" value={url} onChange={(event) => setUrl(event.target.value)} />
          <input aria-label="Username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
          <input aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
          <input aria-label="Local id" value={localId} onChange={(event) => setLocalId(event.target.value)} />
          <input aria-label="State topic" value={topic} onChange={(event) => setTopic(event.target.value)} />
          <input aria-label="Command topic" value={commandTopic} onChange={(event) => setCommandTopic(event.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" tone="brass">Connect</Button>
            <Button type="button" tone="danger" onClick={() => void api('/api/v1/integrations/mqtt', { method: 'DELETE' }).then(() => refresh())}>
              Disconnect
            </Button>
          </div>
        </form>
        {note ? <p className="mt-3 text-sm">{note}</p> : null}
        <p className="mt-3 text-sm text-muted">Plaintext MQTT is limited to localhost unless you explicitly allow it. TLS verification stays on.</p>
      </Panel>
      <p className="text-sm text-muted">{copy.planned}: Android TV, Home Assistant, Matter and ROS 2 have no controls because they are not implemented.</p>
    </div>
  );
}

export function SettingsView() {
  const { overview, refresh, copy, locale, setLocale } = useFrame();
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('Operator stop');
  if (!overview) return null;
  return (
    <div className="grid gap-4">
      <Panel title={copy.settings}>
        <label className="text-sm">
          Language
          <select aria-label="Language" value={locale} onChange={(event) => setLocale(event.target.value as 'en' | 'es')}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overview.settings.requireMediumConfirmation}
            onChange={(event) =>
              void api('/api/v1/settings', {
                method: 'PATCH',
                body: JSON.stringify({ requireMediumConfirmation: event.target.checked }),
              }).then(() => refresh())
            }
          />
          Require confirmation for medium-risk API calls that do not come from a direct control.
        </label>
        <Link href="/kiosk" className="mt-4 inline-block text-sm underline-offset-4 hover:underline">
          {copy.kiosk}
        </Link>
        <p className="mt-4 text-sm text-muted">
          {locale === 'es'
            ? 'Si pierdes la clave local, detén el servidor y ejecuta pnpm recover-admin. La clave nueva se imprime una vez.'
            : 'If the local key is lost, stop the server and run pnpm recover-admin. The new key is printed once.'}
        </p>
        <Button type="button" className="mt-4" tone="quiet" onClick={() => void api('/api/v1/session', { method: 'DELETE' }).then(() => window.location.assign('/login'))}>
          {copy.logout}
        </Button>
      </Panel>
      <Panel title={copy.estop}>
        <p className="text-sm text-muted">This is a software latch. It does not replace a hardware emergency stop.</p>
        {overview.estop.latched ? (
          <form
            className="mt-3 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void api('/api/v1/safety/estop/reset', { method: 'POST', body: JSON.stringify({ confirmation }) }).then(() => refresh());
            }}
          >
            <input aria-label="RESET" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="RESET" />
            <Button type="submit">Clear stop</Button>
          </form>
        ) : (
          <form
            className="mt-3 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void api('/api/v1/safety/estop', { method: 'POST', body: JSON.stringify({ reason }) }).then(() => refresh());
            }}
          >
            <input aria-label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
            <Button type="submit" tone="danger">Latch stop</Button>
          </form>
        )}
      </Panel>
    </div>
  );
}

export function DeveloperView() {
  const [body, setBody] = useState('Loading…');
  useEffect(() => {
    void api('/api/v1/integrations').then((data) => setBody(JSON.stringify(data, null, 2)));
  }, []);
  return (
    <Panel title="Developer" action={<a className="text-sm underline" href="/api/v1/openapi.json">OpenAPI</a>}>
      <pre className="overflow-auto text-xs leading-5">{body}</pre>
    </Panel>
  );
}

function DeviceCard({ device, rooms }: { device: Device; rooms: Overview['rooms'] }) {
  const room = rooms.find((item) => item.id === device.roomId);
  return (
    <article className="border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl">
            <Link href={`/devices/${device.id}`}>{device.name}</Link>
          </h3>
          <p className="text-sm text-muted">{room?.name} · {String(device.metadata.kind ?? 'device')}</p>
        </div>
        <Pill tone={device.connectivity === 'online' ? 'ok' : 'warn'}>{device.connectivity}</Pill>
      </div>
      <p className="mt-3 text-sm">{summarize(device)}</p>
    </article>
  );
}

function RoomIndicators({ devices, copy, compact = false }: { devices: Device[]; copy: Copy; compact?: boolean }) {
  const lights = devices.filter((device) => device.metadata.kind === 'light' && device.capabilities.includes('on_off'));
  const on = lights.filter((device) => device.observed.on_off?.on === true).length;
  const motion = devices.some((device) => device.observed.motion_sensor?.detected === true);
  const climate = devices.find((device) => typeof device.observed.temperature_sensor?.celsius === 'number');
  const offline = devices.filter((device) => device.connectivity !== 'online').length;
  const temp = climate?.observed.temperature_sensor?.celsius;
  return (
    <p className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted ${compact ? '' : 'mt-3'}`}>
      <span className="inline-flex items-center gap-2">
        <span className={`inline-block h-2 w-2 ${on > 0 ? 'bg-brass' : 'border border-current'}`} aria-hidden="true" />
        {on} {copy.lightsOn}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className={`inline-block h-2 w-2 ${motion ? 'bg-pine' : 'border border-current'}`} aria-hidden="true" />
        {motion ? copy.motionNow : copy.calm}
      </span>
      {typeof temp === 'number' ? <span>{temp}°C</span> : null}
      {offline > 0 ? <span className="text-clay">{offline} {copy.offline}</span> : null}
    </p>
  );
}

function DeviceTile({
  device,
  copy,
  busy,
  onAction,
}: {
  device: Device;
  copy: Copy;
  busy: boolean;
  onAction: () => void;
}) {
  const on = device.observed.on_off?.on === true;
  const motion = device.observed.motion_sensor?.detected === true;
  const controllable = device.capabilities.includes('on_off') || device.capabilities.includes('motion_sensor');
  const status = device.capabilities.includes('on_off')
    ? on
      ? copy.on
      : copy.off
    : device.capabilities.includes('motion_sensor')
      ? motion
        ? copy.motionNow
        : copy.calm
      : typeof device.observed.temperature_sensor?.celsius === 'number'
        ? `${String(device.observed.temperature_sensor.celsius)}°C`
        : device.connectivity;
  const className = `tv-tile flex h-48 w-56 shrink-0 flex-col justify-between border p-5 text-left ${on || motion ? 'border-brass' : 'border-line'}`;
  const label = (
    <>
      <span className="text-xs uppercase tracking-[0.16em] text-muted">{String(device.metadata.kind ?? device.capabilities[0] ?? 'device')}</span>
      <span className="font-serif text-2xl leading-tight">{device.name}</span>
      <span className="text-sm">{status}</span>
    </>
  );
  if (!controllable) {
    return (
      <Link href={`/devices/${device.id}`} data-zone="device" className={className}>
        {label}
        <span className="text-xs uppercase tracking-[0.14em] text-brass">{copy.adjust}</span>
      </Link>
    );
  }
  return (
    <div className={className}>
      <button type="button" data-zone="device" className="flex flex-1 flex-col justify-between text-left" disabled={busy} onClick={onAction}>
        {label}
      </button>
      {device.capabilities.includes('brightness') ? (
        <Link href={`/devices/${device.id}`} className="mt-3 text-xs uppercase tracking-[0.14em] text-brass">
          {copy.adjust}
        </Link>
      ) : null}
    </div>
  );
}

function moveTvFocus(event: KeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const current = document.activeElement;
  if (!(current instanceof HTMLElement) || !current.dataset.zone) return;
  const zone = current.dataset.zone;
  if ((event.key === 'ArrowDown' && zone === 'room') || (event.key === 'ArrowUp' && zone === 'device')) {
    event.preventDefault();
    const nextZone = zone === 'room' ? 'device' : 'room';
    event.currentTarget.querySelector<HTMLElement>(`[data-zone="${nextZone}"]`)?.focus();
    return;
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>(`[data-zone="${zone}"]`)];
  const index = nodes.indexOf(current);
  const next = nodes[index + (event.key === 'ArrowRight' ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
}

async function actOnDevice(device: Device): Promise<string | null> {
  if (device.capabilities.includes('on_off')) {
    const record = await command(device.id, 'on_off', 'toggle', {});
    return record.verified ? null : outcomeText(record, '', '');
  }
  if (device.capabilities.includes('motion_sensor')) {
    await api(`/api/v1/devices/${device.id}/readings`, {
      method: 'POST',
      body: JSON.stringify({
        capability: 'motion_sensor',
        value: { detected: device.observed.motion_sensor?.detected !== true },
      }),
    });
    return null;
  }
  return null;
}

function summarize(device: Device): string {
  if (device.observed.on_off) return device.observed.on_off.on === true ? 'On' : 'Off';
  if (device.observed.motion_sensor) return device.observed.motion_sensor.detected === true ? 'Motion' : 'Clear';
  if (device.observed.temperature_sensor) return `${String(device.observed.temperature_sensor.celsius)}°C`;
  return device.capabilities.join(', ');
}

async function command(deviceId: string, capability: string, action: string, params: Record<string, unknown>) {
  return api<CommandResult>(`/api/v1/devices/${deviceId}/commands`, {
    method: 'POST',
    body: JSON.stringify({ capability, action, params, approval: 'explicit_ui' }),
  });
}

function outcomeText(record: CommandResult, verified: string, notVerified: string): string {
  if (record.verified) return verified;
  return `${record.outcome}. ${notVerified}. ${record.errorMessage ?? record.decision.reasons.join(', ')}`;
}
