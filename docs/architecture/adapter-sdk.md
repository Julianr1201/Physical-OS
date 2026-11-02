# Adapter SDK

An adapter implements a versioned manifest (`contractVersion: "1"`) and only the operations it lists.

Required methods: `discover`, `connect`, `disconnect`, `listDevices`, `getCapabilities`, `readState`, `executeCommand`, `subscribeToEvents`, `healthCheck`.

`executeCommand` receives a correlation id and a timeout. It returns whether the adapter accepted and delivered the command. Delivery is not verification. The core reads state afterwards and sets `verified` only when the observed capability matches the expected value.

Errors use `AdapterError` with a stable code: `timeout`, `disconnected`, `unsupported`, `rejected`, `invalid_payload`, `transport`, `unhealthy`.

Adapters must not spawn a shell, evaluate a payload as code, or subscribe to a wildcard topic. Command topics are taken from configuration, not from the payload.

The simulator can inject latency, a one-shot failure, and disconnection. A slow command that exceeds the timeout does not change state.

The MQTT adapter maps configured devices. Incoming payloads are parsed into declared capabilities. Unknown commands inside a payload are ignored. Invalid payloads are audited and do not change state. Publishes use QoS 1 and are not retained. The client reconnects every 2 seconds after a drop.

See `docs/developer/creating-adapters.md` to add another adapter.
