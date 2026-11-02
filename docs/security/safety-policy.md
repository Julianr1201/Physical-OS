# Safety policy

| Class | Examples in this MVP | Result |
| --- | --- | --- |
| Low | Read temperature or status | Allowed for an authenticated operator |
| Medium | on/off, brightness, media | Allowed from a direct console control, an approved plan, or an enabled automation |
| High | Temperature setpoint, and any future lock, gate, heater, pump, motor, drone or robot motion | Denied |

Unknown actions are denied. A disconnected device is denied. While the software stop is latched, actuation is denied and reads still work. Reset requires the administrator to send the exact confirmation `RESET`.

Automations may run medium-risk actions because an administrator enabled the rule. They cannot run high-risk actions. The isolated-simulator override exists only when `PHYSICAL_OS_SIM_HIGH_RISK=isolated` and the device is marked simulated and isolated. Leave it unset.

The software stop is a latch in this process. It is not a hardware emergency stop and must not be documented as one.

No path in this repository drives a real drone, vehicle, lock, or machine.
