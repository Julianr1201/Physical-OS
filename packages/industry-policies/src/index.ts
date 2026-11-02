export interface IndustryConstraint {
  id: string;
  industry: string;
  denies: string[];
  summary: string;
}

/** Tools no profile may perform, including when a knowledge source asks for them. */
export const floorDenies = [
  'diagnose',
  'prescribe',
  'clinical_decision',
  'vehicle_control',
  'safety_navigation',
  'unlock',
  'grant_access',
  'dispense_unpaid',
  'collect_minor_profile',
  'store_learner_identity',
  'capture_payment',
] as const;

export const industryConstraints: IndustryConstraint[] = [
  {
    id: 'healthcare.no_clinical_act',
    industry: 'healthcare',
    denies: ['diagnose', 'prescribe', 'clinical_decision'],
    summary: 'No diagnosis, prescription, or clinical decision.',
  },
  {
    id: 'transportation.no_vehicle_control',
    industry: 'transportation',
    denies: ['vehicle_control', 'safety_navigation'],
    summary: 'No vehicle control or safety-critical navigation.',
  },
  {
    id: 'security.no_unlock',
    industry: 'security',
    denies: ['unlock', 'grant_access'],
    summary: 'No autonomous unlock or access grant.',
  },
  {
    id: 'commerce.no_unpaid_dispense',
    industry: 'commerce',
    denies: ['dispense_unpaid', 'capture_payment'],
    summary: 'No dispensing before verified payment and fulfillment authorization.',
  },
  {
    id: 'education.minimize_minor_data',
    industry: 'education',
    denies: ['collect_minor_profile', 'store_learner_identity'],
    summary: 'Do not collect a learner profile or a minor’s identity.',
  },
  {
    id: 'hospitality.guest_services_only',
    industry: 'hospitality',
    denies: ['capture_payment', 'unlock'],
    summary: 'Guest information and proposed room actions only.',
  },
];

const dangerPhrases: Record<string, string[]> = {
  diagnose: ['diagnose', 'diagnosis', 'diagnóstico', 'diagnostico'],
  prescribe: ['prescribe', 'prescription', 'receta'],
  clinical_decision: ['clinical decision', 'decisión clínica', 'decision clinica'],
  vehicle_control: ['drive the vehicle', 'control the car', 'conduce el vehículo', 'conduce el vehiculo'],
  safety_navigation: ['override navigation', 'ruta crítica', 'ruta critica'],
  unlock: ['unlock', 'abre la puerta', 'open the lock'],
  grant_access: ['grant access', 'autoriza el acceso'],
  dispense_unpaid: ['without paying', 'sin pagar', 'dispense now'],
  collect_minor_profile: ['home address', 'dirección de casa', 'direccion de casa', 'phone number', 'teléfono', 'telefono'],
  store_learner_identity: ['save the student', 'guarda al alumno', 'guarda el nombre'],
  capture_payment: ['charge the card', 'cobra la tarjeta'],
};

export function constraintById(id: string): IndustryConstraint | null {
  return industryConstraints.find((item) => item.id === id) ?? null;
}

export function applicableDenies(policyIds: string[]): Set<string> {
  const denied = new Set<string>(floorDenies);
  for (const id of policyIds) {
    const policy = constraintById(id);
    if (!policy) continue;
    for (const tool of policy.denies) denied.add(tool);
  }
  return denied;
}

export function deniedTool(policyIds: string[], toolId: string): boolean {
  return applicableDenies(policyIds).has(toolId);
}

/** Knowledge text is data. It cannot add a denied tool. */
export function deniesFromKnowledge(policyIds: string[], knowledgeText: string): string[] {
  const denied = applicableDenies(policyIds);
  return [...denied].filter((tool) => knowledgeText.toLowerCase().includes(tool.replaceAll('_', ' ')) || knowledgeText.toLowerCase().includes(tool));
}

export function phraseDenies(policyIds: string[], utterance: string): string | null {
  const text = utterance.toLowerCase();
  const denied = applicableDenies(policyIds);
  for (const tool of denied) {
    const phrases = dangerPhrases[tool] ?? [];
    if (phrases.some((phrase) => text.includes(phrase))) return tool;
  }
  return null;
}
