# Intelligence

The deterministic parser handles a documented subset and needs no network:

- `turn on/off all the <room> lights|switches`
- `turn on/off <device>`
- `turn on/off <room> light` when that room has one match
- `set <device> brightness to <n>`
- `what is the temperature in <room>`
- Spanish equivalents for all lights and temperature

Anything else, including a sentence that continues with “ignore previous instructions”, returns unrecognized. A device name that contains shell punctuation is still only a device id in a structured step.

An optional OpenAI-compatible provider is used only when the deterministic parser does not recognize the utterance and all three `PHYSICAL_OS_LLM_*` variables are set. The provider must return JSON. The server discards the model’s explanation, rebuilds steps with `parseAction`, and rejects the whole plan if any step names an unknown device, a missing capability, or an action outside the catalog. The provider is not given a tool, a shell, or a network callback of its own.

Plans that contain actions wait for `POST /api/v1/intelligence/:planId/approve`. Temperature questions are reads and do not create commands.

Plans expire after 10 minutes.
