import { phraseDenies } from '@physical-os/industry-policies';
import { matchCue } from '@physical-os/human-handoff';
import type { KnowledgeRecord } from '@physical-os/knowledge-connectors';
import type { ProfileManifest } from '@physical-os/professional-profiles';

export interface ProfilePlan {
  profileId: string;
  version: string;
  role: { en: string; es: string };
  disclosure: { en: string; es: string };
  avatarId: string;
  voicePreset: string;
  text: { en: string; es: string };
  knowledge: KnowledgeRecord[];
  proposal:
    | null
    | { kind: 'device'; utterance: string; executed: false }
    | { kind: 'checkout'; sku: 'water' | 'coffee' | 'snack'; qty: 1; executed: false; proposalId?: string }
    | { kind: 'handoff'; target: string; reason: string; executed: false }
    | { kind: 'practice'; prompt: { en: string; es: string }; executed: false };
  denied: string | null;
  uncertainty: 'stated' | 'partial' | 'unknown';
}

export function planTurn(
  manifest: ProfileManifest,
  avatarId: string,
  voicePreset: string,
  utterance: string,
  knowledge: KnowledgeRecord[],
): ProfilePlan {
  const denied = phraseDenies(manifest.safetyPolicies, utterance);
  const cue = matchCue(manifest.handoffPolicy.cues, utterance);
  if (denied) {
    return plan(manifest, avatarId, voicePreset, {
      text: {
        en: `I cannot do that. ${denied} stays denied.`,
        es: `No puedo hacer eso. ${denied} sigue denegado.`,
      },
      knowledge: [],
      proposal: cue ? { kind: 'handoff', target: manifest.handoffPolicy.target, reason: cue, executed: false } : null,
      denied,
      uncertainty: 'stated',
    });
  }
  if (cue) {
    return plan(manifest, avatarId, voicePreset, {
      text: {
        en: `I am handing this to ${manifest.handoffPolicy.target}.`,
        es: `Paso esto a ${manifest.handoffPolicy.target}.`,
      },
      knowledge: [],
      proposal: { kind: 'handoff', target: manifest.handoffPolicy.target, reason: cue, executed: false },
      denied: null,
      uncertainty: 'stated',
    });
  }
  if (hasEffect(manifest, 'propose') && mentionsDevice(utterance)) {
    return plan(manifest, avatarId, voicePreset, {
      text: {
        en: 'I can propose that to Physical OS. It runs only after approval.',
        es: 'Puedo proponerlo a Physical OS. Corre solo después de la aprobación.',
      },
      knowledge: [],
      proposal: { kind: 'device', utterance, executed: false },
      denied: null,
      uncertainty: 'stated',
    });
  }
  const skus = skusIn(utterance);
  if (hasTool(manifest, 'checkout') && wantsToBuy(utterance)) {
    const sku = skus[0];
    if (skus.length !== 1 || !sku || asksPrice(utterance)) {
      return plan(manifest, avatarId, voicePreset, {
        text: {
          en: 'I need one product and a clear purchase request before I propose a checkout.',
          es: 'Necesito un solo producto y un pedido claro antes de proponer un cobro.',
        },
        knowledge,
        proposal: null,
        denied: null,
        uncertainty: 'partial',
      });
    }
    return plan(manifest, avatarId, voicePreset, {
      text: {
        en: `I can propose a simulated checkout for ${sku}. Confirm it before I create an order. Nothing is dispensed before payment is verified.`,
        es: `Puedo proponer un cobro simulado de ${sku}. Confírmalo antes de crear el pedido. No se entrega nada antes de verificar el pago.`,
      },
      knowledge,
      proposal: { kind: 'checkout', sku, qty: 1, executed: false },
      denied: null,
      uncertainty: 'stated',
    });
  }
  const practice = knowledge.find((record) => record.title.en === 'Practice');
  if (practice && /practice|práctica|practica|exercise|ejercicio/.test(utterance.toLowerCase())) {
    return plan(manifest, avatarId, voicePreset, {
      text: practice.body,
      knowledge: [practice],
      proposal: { kind: 'practice', prompt: practice.body, executed: false },
      denied: null,
      uncertainty: practice.uncertainty,
    });
  }
  const record = knowledge[0];
  if (record) {
    const stale = record.fresh ? { en: '', es: '' } : { en: ' This note may be out of date.', es: ' Esta nota puede estar vencida.' };
    return plan(manifest, avatarId, voicePreset, {
      text: {
        en: `${record.body.en} Source: ${record.provenance}.${stale.en}`,
        es: `${record.body.es} Fuente: ${record.provenance}.${stale.es}`,
      },
      knowledge: [record],
      proposal: null,
      denied: null,
      uncertainty: record.uncertainty,
    });
  }
  return plan(manifest, avatarId, voicePreset, {
    text: {
      en: 'I do not have that in the approved sources.',
      es: 'No tengo eso en las fuentes aprobadas.',
    },
    knowledge: [],
    proposal: null,
    denied: null,
    uncertainty: 'unknown',
  });
}

function plan(
  manifest: ProfileManifest,
  avatarId: string,
  voicePreset: string,
  body: Omit<ProfilePlan, 'profileId' | 'version' | 'role' | 'disclosure' | 'avatarId' | 'voicePreset'>,
): ProfilePlan {
  return {
    profileId: manifest.profileId,
    version: manifest.version,
    role: manifest.displayName,
    disclosure: manifest.disclosure,
    avatarId,
    voicePreset,
    ...body,
  };
}

function hasEffect(manifest: ProfileManifest, effect: ProfileManifest['tools'][number]['effect']): boolean {
  return manifest.tools.some((tool) => tool.effect === effect);
}

function hasTool(manifest: ProfileManifest, id: string): boolean {
  return manifest.tools.some((tool) => tool.id === id);
}

function mentionsDevice(utterance: string): boolean {
  return /light|lights|luz|luces|turn on|turn off|apaga|enciende/.test(utterance.toLowerCase());
}

function wantsToBuy(utterance: string): boolean {
  return /want|quiero|buy|comprar|order|pedir|dame/.test(utterance.toLowerCase());
}

function asksPrice(utterance: string): boolean {
  return /how much|cu[aá]nto|precio|price|cuesta/.test(utterance.toLowerCase());
}

function skusIn(utterance: string): Array<'water' | 'coffee' | 'snack'> {
  const text = utterance.toLowerCase();
  const found: Array<'water' | 'coffee' | 'snack'> = [];
  if (text.includes('coffee') || text.includes('café') || text.includes('cafe')) found.push('coffee');
  if (text.includes('water') || text.includes('agua')) found.push('water');
  if (text.includes('snack')) found.push('snack');
  return found;
}
