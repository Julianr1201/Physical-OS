# HTTP API

The running server publishes a short OpenAPI document at `GET /api/v1/openapi.json`. That document lists the public routes. It is not a generated schema for every body.

Authenticated routes require the `pos_session` cookie.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/setup` | Create the first administrator. 409 after that |
| POST | `/api/v1/demo/session` | Create the first local session without returning a password. 409 after that |
| POST | `/api/v1/session` | Log in |
| DELETE | `/api/v1/session` | Log out |
| GET | `/api/v1/session` | `{ authenticated, enrolled }` |
| GET | `/api/v1/overview` | Environments, rooms, devices, automations, health |
| POST | `/api/v1/demo/simulated-home` | Create the labeled simulation |
| POST | `/api/v1/devices/:id/commands` | Request a device command |
| POST | `/api/v1/commands/:id/approve` | Approve a waiting command |
| POST | `/api/v1/commands/:id/reject` | Reject a waiting command |
| POST | `/api/v1/intelligence/interpret` | Parse an utterance into a plan |
| POST | `/api/v1/intelligence/:planId/approve` | Execute an approved plan |
| GET | `/api/v1/events` | Server-sent events with type and time only |

Command responses include `outcome` and `verified`. Read those fields before treating a call as success.
