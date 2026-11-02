import { zodToJsonSchema } from 'zod-to-json-schema';
import { automationDefinitionSchema } from './domain.js';

export function automationJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(automationDefinitionSchema, {
    name: 'AutomationDefinition',
    $refStrategy: 'none',
  }) as Record<string, unknown>;
}
