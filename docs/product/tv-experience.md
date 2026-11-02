# Television experience

The home screen is a local television page. It is not an Android TV build, an HDMI switch, or a streaming catalog.

## What the screen does

- First run asks where the screen is, then offers a simulated home or an empty screen. It does not scan the network and it does not ask for a cloud account.
- The first launch on a machine with no administrator calls `POST /api/v1/demo/session`. The server stores a random local key and does not return it. Recovery is `pnpm recover-admin`.
- The ribbon shows temperature, humidity, and lights only for the room assigned to this screen, and only from observed device state.
- Lights in that room can be switched. Brightness is sent when the slider is released. A thermostat setpoint stays locked.
- Music is a tone generated in the browser. Live TV, apps, HDMI, and commercial libraries are described as unavailable and are not buttons.
- The assistant uses the existing interpret and approve API. A plan does not run until it is confirmed. The screen says the room matched only when every command is verified.

## Navigation

Arrow keys move between the targets in `moveFocus`. Escape closes a panel and restores the previous target. Sliders keep Left and Right.

## Layout

The primary layout is 1920×1080, with type clamped so it does not grow without limit at 3840×2160. Below 760px the same screen becomes a stacked companion, not a shrunk television.

Settings, devices, automations, integrations, and diagnostics stay on their own routes.
