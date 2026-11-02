# Getting started

1. Install Node.js 22.13 or newer and pnpm 10. On Windows, if Corepack cannot write to Program Files, install pnpm in a user prefix: `npm install -g pnpm@10.18.3 --prefix %USERPROFILE%\.local` and add that directory to `PATH`.
2. `pnpm install`
3. `pnpm dev`
4. Open http://127.0.0.1:3000 and create the administrator.
5. Create the simulated home and turn a light on. The activity page should show a verified command.
6. Set **After sunset**, simulate motion on the living-room sensor, and confirm the ceiling light and floor lamp turn on. The wall switch stays off.
7. On Intelligence, submit `Turn off all the living room lights.` and approve the plan.

Data is stored in `./data`. That directory is gitignored.

## Recovery

Stop the server. Run `pnpm recover-admin`. Store the printed password, log in, and run recovery again when you want to replace it. The command does not keep the previous password.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
```

The MQTT test starts an in-process broker. Docker is optional and is not required for the test suite.
