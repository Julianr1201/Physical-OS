import type { CatalogItem } from './catalog.js';
import { CommerceError } from './errors.js';

export interface PricedLine {
  sku: string;
  name: CatalogItem['name'];
  qty: number;
  unitCents: number;
  lineCents: number;
}

export function priceLines(catalog: CatalogItem[], lines: Array<{ sku: string; qty: number }>): { items: PricedLine[]; totalCents: number } {
  if (lines.length === 0) throw new CommerceError('empty_cart', 'Choose a product.', 422);
  const items = lines.map((line) => {
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 5) {
      throw new CommerceError('invalid_qty', 'Quantity must be from 1 to 5.', 422);
    }
    const product = catalog.find((item) => item.sku === line.sku);
    if (!product) throw new CommerceError('unknown_product', 'That product is not in the store.', 404);
    return {
      sku: product.sku,
      name: product.name,
      qty: line.qty,
      unitCents: product.priceCents,
      lineCents: product.priceCents * line.qty,
    };
  });
  return { items, totalCents: items.reduce((sum, item) => sum + item.lineCents, 0) };
}
