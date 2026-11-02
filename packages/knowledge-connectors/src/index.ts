export interface Localized {
  en: string;
  es: string;
}

export interface KnowledgeRecord {
  sourceId: string;
  title: Localized;
  body: Localized;
  provenance: string;
  updatedAt: string;
  fresh: boolean;
  uncertainty: 'stated' | 'partial' | 'unknown';
}

export interface KnowledgeConnector {
  id: string;
  retrieve(query: string, now: Date): KnowledgeRecord[];
}

interface Article {
  keywords: string[];
  title: Localized;
  body: Localized;
  provenance: string;
  updatedAt: string;
  maxAgeHours: number;
}

function connector(id: string, articles: Article[]): KnowledgeConnector {
  return {
    id,
    retrieve(query, now) {
      const text = query.toLowerCase();
      return articles
        .filter((article) => article.keywords.some((keyword) => text.includes(keyword)))
        .slice(0, 3)
        .map((article) => materialize(id, article, now));
    },
  };
}

function materialize(sourceId: string, article: Article, now: Date): KnowledgeRecord {
  const age = now.getTime() - Date.parse(article.updatedAt);
  const fresh = Number.isFinite(age) && age >= 0 && age <= article.maxAgeHours * 3_600_000;
  return {
    sourceId,
    title: article.title,
    body: article.body,
    provenance: article.provenance,
    updatedAt: article.updatedAt,
    fresh,
    uncertainty: fresh ? 'stated' : 'partial',
  };
}

export const hotelConnector = connector('hotel.services', [
  {
    keywords: ['breakfast', 'desayuno'],
    title: { en: 'Breakfast', es: 'Desayuno' },
    body: {
      en: 'Breakfast is served from 7:00 to 10:30 in the dining room.',
      es: 'El desayuno se sirve de 7:00 a 10:30 en el comedor.',
    },
    provenance: 'Simulated front-desk policy',
    updatedAt: '2026-11-01T12:00:00.000Z',
    maxAgeHours: 24 * 30,
  },
  {
    keywords: ['tour', 'paseo', 'recorrido'],
    title: { en: 'City walk', es: 'Paseo' },
    body: {
      en: 'The simulated city walk leaves at 18:00 and costs 450 MXN.',
      es: 'El paseo simulado sale a las 18:00 y cuesta 450 MXN.',
    },
    provenance: 'Simulated tour desk',
    updatedAt: '2026-11-01T12:00:00.000Z',
    maxAgeHours: 24 * 14,
  },
  {
    keywords: ['checkout', 'salida'],
    title: { en: 'Checkout', es: 'Salida' },
    body: { en: 'Checkout is 12:00. A 14:00 departure is a request, not a promise.', es: 'La salida es a las 12:00. Salir a las 14:00 es una solicitud, no una promesa.' },
    provenance: 'Simulated front-desk policy',
    updatedAt: '2026-11-01T12:00:00.000Z',
    maxAgeHours: 24 * 30,
  },
]);

export const commerceConnector = connector('commerce.catalog', [
  {
    keywords: ['water', 'agua'],
    title: { en: 'Water', es: 'Agua' },
    body: { en: 'Water is 20.00 MXN. This is a simulated price.', es: 'El agua cuesta 20.00 MXN. Es un precio simulado.' },
    provenance: 'Simulated catalog',
    updatedAt: '2026-11-01T12:00:00.000Z',
    maxAgeHours: 24 * 7,
  },
  {
    keywords: ['coffee', 'café', 'cafe'],
    title: { en: 'Coffee', es: 'Café' },
    body: { en: 'Coffee is 35.00 MXN. This is a simulated price.', es: 'El café cuesta 35.00 MXN. Es un precio simulado.' },
    provenance: 'Simulated catalog',
    updatedAt: '2026-11-01T12:00:00.000Z',
    maxAgeHours: 24 * 7,
  },
  {
    keywords: ['snack'],
    title: { en: 'Snack', es: 'Snack' },
    body: { en: 'The snack is 25.00 MXN. This is a simulated price.', es: 'El snack cuesta 25.00 MXN. Es un precio simulado.' },
    provenance: 'Simulated catalog',
    updatedAt: '2026-11-01T12:00:00.000Z',
    maxAgeHours: 24 * 7,
  },
  {
    keywords: ['pastry', 'pastel'],
    title: { en: 'Seasonal pastry', es: 'Pastel de temporada' },
    body: { en: 'An old note priced the pastry at 18.00 MXN.', es: 'Una nota vieja ponía el pastel en 18.00 MXN.' },
    provenance: 'Simulated catalog archive',
    updatedAt: '2025-01-01T12:00:00.000Z',
    maxAgeHours: 24,
  },
]);

export const educationConnector = connector('education.curriculum', [
  {
    keywords: ['fraction', 'fractions', 'fracción', 'fraccion', 'fracciones', 'lesson', 'lección', 'leccion'],
    title: { en: 'Fractions', es: 'Fracciones' },
    body: {
      en: 'A fraction is a part of a whole. 1/2 means one of two equal parts.',
      es: 'Una fracción es una parte de un entero. 1/2 es una de dos partes iguales.',
    },
    provenance: 'Approved lesson note',
    updatedAt: '2026-10-01T12:00:00.000Z',
    maxAgeHours: 24 * 365,
  },
  {
    keywords: ['practice', 'practica', 'práctica', 'exercise', 'ejercicio'],
    title: { en: 'Practice', es: 'Práctica' },
    body: { en: 'Which is larger, 1/2 or 1/3?', es: '¿Qué es mayor, 1/2 o 1/3?' },
    provenance: 'Approved practice note',
    updatedAt: '2026-10-01T12:00:00.000Z',
    maxAgeHours: 24 * 365,
  },
]);

export const healthcareConnector = connector('healthcare.admin', [
  {
    keywords: ['hours', 'horario', 'appointment', 'cita'],
    title: { en: 'Desk hours', es: 'Horario de mostrador' },
    body: {
      en: 'The simulated desk records appointment requests on weekdays from 9:00 to 17:00. This is not medical advice.',
      es: 'El mostrador simulado anota solicitudes de cita los días hábiles de 9:00 a 17:00. Esto no es consejo médico.',
    },
    provenance: 'Administrative note',
    updatedAt: '2026-11-01T12:00:00.000Z',
    maxAgeHours: 24 * 30,
  },
]);

const connectors = [hotelConnector, commerceConnector, educationConnector, healthcareConnector];

export function connectorFor(id: string): KnowledgeConnector | null {
  return connectors.find((item) => item.id === id) ?? null;
}

export function retrieveKnowledge(sourceIds: string[], query: string, now: Date): KnowledgeRecord[] {
  const records: KnowledgeRecord[] = [];
  for (const id of sourceIds) {
    const connector = connectorFor(id);
    if (!connector) continue;
    records.push(...connector.retrieve(query, now));
  }
  return records.slice(0, 3);
}
