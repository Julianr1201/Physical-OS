# Creating an adapter

1. Add a package that depends on `@physical-os/adapter-sdk`, `@physical-os/device-sdk` and `@physical-os/shared`.
2. Export a class whose `manifest.contractVersion` is `"1"` and whose `operations` lists only what you implement.
3. Validate every inbound payload with the capability schema. Drop the event if parsing fails.
4. Honor `timeoutMs` and include the correlation id in logs and outbound messages.
5. Return `delivered: true` only after the transport accepts the command. Do not set a verified flag. The core does that from `readState`.
6. Register the instance in `apps/server` the same way the simulator and MQTT adapter are constructed. Add a health entry.
7. Test a rejected payload, a timeout, and a successful command with Vitest.
8. Keep the integration marked experimental in the console until those tests pass against the real transport.

Do not accept a command string that is passed to a shell. Do not scan a network in `discover` unless the operator configured an explicit address.
