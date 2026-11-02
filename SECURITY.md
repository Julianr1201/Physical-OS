# Security

## Reporting

Report vulnerabilities privately to the repository maintainers. Do not open a public issue for an unfixed authentication bypass, command injection, or policy bypass.

## Supported use

Physical OS is an MVP for local simulation and a configured MQTT broker. It is not a safety-rated controller. The software stop latch does not replace a hardware emergency stop.

## Defaults

- The API binds to `127.0.0.1` unless `PHYSICAL_OS_ALLOW_LAN=1`
- There is no default password
- High-risk physical actuation is denied
- MQTT plaintext off localhost is rejected unless explicitly allowed
- Language-model access is off until `PHYSICAL_OS_LLM_BASE_URL`, `PHYSICAL_OS_LLM_API_KEY`, and `PHYSICAL_OS_LLM_MODEL` are all set

## Recovery

Stop the server and run `pnpm recover-admin` from the repository. The command replaces the administrator password, prints the new password once, and deletes sessions.
