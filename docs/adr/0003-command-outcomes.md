# ADR 0003 — Command outcomes

An HTTP success does not mean the device changed. The dispatcher records:

- `awaiting_approval` when policy requires a person
- `rejected` when policy denies the command
- `delivered` when the adapter accepted the command and the follow-up read does not match
- `verified` when the observed capability equals the expected value
- `timed_out` and `failed` for adapter errors

The API returns 200 only for `verified`. Approval, delivery, rejection, timeout and validation errors use 202, 403, 504, 409 and 422. Clients must read `outcome` and `verified`.
