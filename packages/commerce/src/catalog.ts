export interface CatalogItem {
  sku: string;
  name: { en: string; es: string };
  priceCents: number;
  currency: 'MXN';
  simulated: true;
}

export function simulatedCatalog(): CatalogItem[] {
  return [
    { sku: 'water', name: { en: 'Water', es: 'Agua' }, priceCents: 2000, currency: 'MXN', simulated: true },
    { sku: 'coffee', name: { en: 'Coffee', es: 'Café' }, priceCents: 3500, currency: 'MXN', simulated: true },
    { sku: 'snack', name: { en: 'Snack', es: 'Snack' }, priceCents: 2500, currency: 'MXN', simulated: true },
  ];
}
