# Threat model

The MVP assumes one operator on one computer. The assets are the administrator session, the SQLite file (including any MQTT password), and the ability to publish MQTT commands or change simulated devices.

## Trust

| Source | Trust |
| --- | --- |
| Console on the same machine | The operator, after login |
| Microphone and camera | Off until the operator enables them. Frames and samples are not stored |
| Profile knowledge, manifests, and utterances | Untrusted. A knowledge sentence cannot grant a denied tool |
| Device names, metadata, MQTT payloads, model output, utterances | Untrusted |
| Other hosts on the LAN | Untrusted. The API does not listen there by default |

## Boundaries

- Session cookie is `HttpOnly` and `SameSite=Lax`. A browser `Origin` outside the console origin is rejected
- Login is limited to 5 attempts a minute per address. Commands are limited to 60 a minute
- Passwords are stored with scrypt. Sessions are stored as SHA-256 hashes
- Authorization happens in the policy engine, not only in the route
- Viewers cannot actuate. The shipped enrollment creates an administrator
- MQTT does not execute payload fields. Topics cannot contain `+` or `#`
- ADB, television debloating, and remote shells are out of scope. See the CleanYourTV evaluation

## Residual risk

A person who can read `data/physical-os.sqlite` can read the MQTT password. Protect that directory with the operating system account. A software stop does not open a contactor or kill motor power. Node’s `node:sqlite` module is still marked experimental by Node.js.
