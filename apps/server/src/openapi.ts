export const openApi = {
  openapi: '3.0.3',
  info: {
    title: 'Physical OS API',
    version: '0.1.0',
    description:
      'Local control API. A response is not success unless outcome is verified. delivered means the adapter accepted the command and the device state was not confirmed.',
  },
  paths: {
    '/api/v1/health': { get: { summary: 'Process health. No device state.' } },
    '/api/v1/setup': { post: { summary: 'Create the first local administrator. Disabled after enrollment.' } },
    '/api/v1/session': { post: { summary: 'Log in with the administrator password.' } },
    '/api/v1/overview': { get: { summary: 'Environments, rooms, devices, automations and safety state.' } },
    '/api/v1/devices/{id}/commands': {
      post: { summary: 'Request a device command. Medium risk requires confirmation.' },
    },
    '/api/v1/intelligence/interpret': {
      post: { summary: 'Turn an utterance into a validated plan. Does not execute it.' },
    },
    '/api/v1/integrations/mqtt': { post: { summary: 'Connect a configured MQTT broker.' } },
  },
} as const;
