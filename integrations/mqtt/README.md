# MQTT broker

Status: configuration only. The adapter code lives in `packages/adapter-mqtt`.

`mosquitto.conf` disables anonymous clients. Create `password.txt` in this directory with `mosquitto_passwd` before using the Compose profile:

```bash
docker run --rm -it -v "$PWD:/work" eclipse-mosquitto:2 mosquitto_passwd -c /work/integrations/mqtt/password.txt physical
docker compose --profile mqtt up
```

The password file is gitignored. Do not publish port 1883 beyond `127.0.0.1`.
