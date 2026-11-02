# Physical OS

Physical OS is a local-first, open-source control plane for physical environments. It gives rooms and devices a shared model, a deterministic automation engine, and an optional intelligence layer that can only propose plans.

The current product is an MVP for a simulated home, plus a real MQTT adapter. It is not a Linux kernel, a chatbot, or a Home Assistant clone. Future domains (gardens, buildings, robots, drones) are documented and not implemented.

## What works

- Local administrator enrollment, session cookies, and credential recovery
- Simulated lights, switches, motion, climate and a thermostat whose setpoint cannot be actuated
- Rooms, device controls, live state, and an audit timeline
- The automation “when motion is detected in the living room after sunset, turn on the lights”
- Sunset is a boolean signal named `after_sunset`. There is no location or astronomy dependency
- Natural-language plans for a documented command subset, in English and Spanish
- Approval before a plan runs. The model cannot call devices directly
- MQTT against a local authenticated broker, with tested topic mapping
- Software stop latch. It is not a hardware safety system

High-risk actuation is denied. Android TV, Home Assistant, Matter and ROS 2 are marked planned.

## Inicio rápido

Requiere Node.js 22.13 o posterior y pnpm 10.

```powershell
pnpm install
pnpm dev
```

Abre http://127.0.0.1:3000. La primera vez la pantalla entra sin cuenta en la nube: elige la zona y, si quieres, la casa simulada. Los ajustes quedan aparte. La API escucha solo en `127.0.0.1:4747`.

Para recuperar el acceso, detén el servidor y ejecuta `pnpm recover-admin`. La contraseña temporal se imprime una vez y las sesiones anteriores quedan revocadas.

## Run

```bash
pnpm install
pnpm dev
```

| Process | Address |
| --- | --- |
| Console | http://127.0.0.1:3000 |
| API | http://127.0.0.1:4747 |

The console proxies `/api` to the API. Copy `.env.example` if you need to change the port, data directory, or optional language-model provider.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @physical-os/console build
```

`pnpm test` runs unit tests and one API integration test. It does not require hardware. Playwright is not part of this MVP.

## MQTT

Plaintext MQTT is accepted only for localhost unless `allowInsecurePlaintext` is set. Username and password are required unless `allowAnonymous` is explicitly true. TLS certificate checks stay on (`rejectUnauthorized: true`). The password is stored in the local SQLite file and is never returned by the API.

An optional broker is in `docker-compose.yml` under the `mqtt` profile. Create `integrations/mqtt/password.txt` with `mosquitto_passwd` before starting it. Anonymous access is disabled.

## Layout

`apps/server` is the Fastify API. `apps/console` is the Next.js console. Domain packages live in `packages/`: shared models, event bus, adapter contract, simulator, MQTT, automation, policy, intelligence and the core orchestrator. `integrations/` contains planned boundaries only.

## License

Apache-2.0. See [LICENSE](LICENSE).
