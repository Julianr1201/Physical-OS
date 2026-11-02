# MVP scope

## In this repository

- One local administrator, session cookie, rate-limited login, recovery command
- SQLite persistence through Drizzle and Node's built-in SQLite
- Simulated home: living room, kitchen, bedroom, lights, switch, motion, climate, thermostat
- Direct controls for on/off and brightness
- Motion injection labeled as simulation
- `after_sunset` boolean signal
- One seeded automation for living-room lights after sunset
- Visual rule form for a motion-to-light rule
- Deterministic commands, including “Turn off all the living room lights.”
- Plan approval, verification against observed state, and an audit timeline
- MQTT adapter with authentication, localhost plaintext policy, and an in-process broker test
- Console screens: overview, spaces, devices, automations, intelligence, activity, integrations, settings, developer
- English and Spanish interface copy
- Software stop latch

## Not in this repository

- Playwright browser tests
- Real device certification
- Home Assistant, Matter, ROS 2, or Android TV control
- Debloating a television
- Astronomical sunset. The phone reads outside weather from its network location through Open-Meteo, without an API key and without storing the coordinate. That reading is not the simulated room climate.
- High-risk actuation, including thermostat setpoints, locks, motors, irrigation, drones and vehicles
- Multi-user households beyond the single administrator role check
- PostgreSQL. The repository interface is the migration boundary

A thermostat setpoint is visible and classified high risk. Commands against it are rejected.
