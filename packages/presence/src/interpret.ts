import type { ExpressionName } from './state.js';
import type { EngineReply } from './turn.js';

export interface InterpretResult {
  type: string;
  message?: string;
  explanation?: string;
  plan?: { id?: string; explanation?: string };
}

export interface CommandOutcome {
  verified: boolean;
  outcome: string;
  errorMessage?: string | null;
}

export function replyFromInterpret(result: InterpretResult): EngineReply {
  if (result.type === 'plan') {
    const planId = result.plan?.id;
    if (!planId) return { kind: 'unavailable', text: 'The plan had no id.' };
    return {
      kind: 'confirm',
      planId,
      text: result.plan?.explanation ?? 'Confirm this action before it runs.',
    };
  }
  if (result.type === 'query') {
    return { kind: 'say', expression: 'attentive', text: result.explanation ?? 'There is no reading.' };
  }
  if (result.type === 'clarify') {
    return { kind: 'clarify', text: result.message ?? 'I need a clearer request.' };
  }
  if (result.type === 'unrecognized') {
    return { kind: 'say', expression: 'thoughtful', text: result.message ?? 'That is outside the command set.' };
  }
  return { kind: 'unavailable', text: 'The conversation service did not answer.' };
}

export function lineForExecution(
  commands: CommandOutcome[],
  explanation: string,
  suffixes: { sent: string; failed: string },
): { expression: ExpressionName; line: string } {
  if (commands.length === 0) return { expression: 'concerned', line: suffixes.failed };
  if (commands.every((command) => command.verified)) return { expression: 'pleased', line: explanation };
  if (commands.every((command) => command.verified || command.outcome === 'delivered')) {
    return { expression: 'attentive', line: `${explanation} ${suffixes.sent}` };
  }
  const reason = commands.find((command) => command.errorMessage)?.errorMessage;
  return { expression: 'concerned', line: reason ?? suffixes.failed };
}

export function isEcho(heard: string, spoken: string | null): boolean {
  if (!spoken) return false;
  const left = heard.trim().toLowerCase();
  const right = spoken.trim().toLowerCase();
  if (left.length < 4) return false;
  return right.includes(left) || left.includes(right);
}
