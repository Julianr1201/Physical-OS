# Event flow

The in-process bus drains events in order. A handler may enqueue another event. It must not wait for the bus to become idle, or the drain deadlocks.

```mermaid
sequenceDiagram
  participant Sensor
  participant Core
  participant Bus
  participant Automation
  participant Light
  Sensor->>Core: motion reading
  Core->>Bus: device.state.changed
  Bus->>Automation: match trigger
  Automation->>Core: command with causation
  Core->>Light: adapter execute
  Core->>Bus: device.state.changed depth + 1
```

Events include `device.discovered`, `device.connected`, `device.disconnected`, `device.state.changed`, `sensor.reading.received`, `environment.signal.changed`, `automation.triggered`, `automation.failed`, `command.requested`, `command.authorized`, `command.executed` and `command.failed`.

An automation skips an event it caused. Depth stops at 3. Cooldown and `maxRunsPerHour` skip further runs. A dry run records the decision and does not call the adapter.

Time triggers are checked every 15 seconds. That is the resolution of interval and daily rules.
