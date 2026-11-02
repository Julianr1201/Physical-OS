# MVP audit

Reviewed against the running profile, commerce, presence, and SQLite paths. This note records the risks and the order of work. It does not claim that later stages are done.

## Priority 0 — Purchase integrity

`ProfileHost.answer` used to call `CommerceService.checkout` inside `POST /api/v1/profiles/turn` as soon as the keyword planner saw a buy phrase. That reserved stock and opened a payment session before the person confirmed. A price question could sit next to a buy verb and still be treated as a purchase.

The kiosk path is different. `POST /api/v1/commerce/checkout` is an explicit selection, and it may still create the order and the payment session together.

Profile purchases now stop at a proposal. `POST /api/v1/profiles/confirm` is the confirmation. It creates a `CREATED` order, then starts payment, and those two calls stay separate. A second confirm returns the same order. Cancel before confirm creates nothing. Cancel after payment has started uses `CommerceService.cancel` and releases the reservation. A later utterance drops an unconfirmed proposal and does not open an order. Payment that has already started is not dropped by a new sentence; it needs cancel.

Stages recorded on the session: `interpreted`, `proposed`, `confirmed`, `order_created`, `payment_started`, `payment_verified`, `fulfillment_authorized`, `delivery_verified`, `cancelled`, `interrupted`.

Verified payment and delivery still happen in the existing commerce service. `simulatePayment` verifies a signed notice and only then authorizes fulfillment. The profile host does not dispense.

## Priority 1 — Professional conversation

`packages/profile-runtime/src/plan.ts` is still a keyword planner. It has no general multi-turn memory, no typed tool calls, and no model. The deterministic device parser remains the only path that can become a device plan, and the profile still cannot call `executeCommand`.

The purchase pending record is the only session context added here. Replacing the planner with an orchestrator is the next stage. The keyword planner stays as the fallback.

## Priority 2 — Persistence

Commerce orders, payment sessions, inventory reservations, profile installs, and profile sessions live in process memory. A restart drops them. SQLite already stores accounts, devices, commands, and plans through `AppDatabase`. There is no migration runner. Idempotent payment callbacks exist only inside one process (`seenEvents`).

## Priority 3 — Organization and device

`profileDeviceId` is the constant `console`. Activation, the active profile, and the purchase pending record all use that one device. There is one implicit operator and no organization id on orders, so cross-organization access is not enforced because the second organization does not exist. Credentials are not split by site.

## Priority 4 — Hotel concierge

`hospitality.concierge` answers from `hotel.services`, proposes a device utterance, and hands off a bill dispute. It does not search alternatives, check availability, hold a reservation, or carry that choice across turns. The knowledge connector is an in-memory simulated note list, not a hotel contract.

## Priority 5 — Presence

The figure is still one instanced particle draw. Mouth movement uses speech-synthesis boundaries when the browser has them, and a labeled silent preview otherwise. There is no streamed reply, no measured conversation latency, and no automated frame-rate test. The page can report frames per second only after it runs in a browser.

## Execution order

1. Profile purchases confirm before an order exists. Done in this change.
2. Session orchestrator in front of `planTurn`, with the keyword planner as fallback.
3. SQLite tables for orders, reservations, profile installs, and deployments, reloaded after restart.
4. Organization, site, and device ids on every profile and commerce record. Reject a session that names another organization.
5. Simulated hotel port with a multi-turn concierge: ask, choose, check, propose, confirm, reserve, pay, verify.
6. Presence latency and interruption tests without a paid speech service.

No new profession is added until that concierge completes a multi-turn reservation.
