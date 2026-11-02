import { describe, expect, it } from 'vitest';
import { moveFocus, restoreFocus, type FocusItem } from './spatial';

const items: FocusItem[] = [
  { id: 'nav-home', row: 0, col: 0 },
  { id: 'nav-tv', row: 0, col: 1 },
  { id: 'assist', row: 1, col: 0 },
  { id: 'media', row: 2, col: 0 },
  { id: 'lights', row: 3, col: 0 },
  { id: 'climate', row: 3, col: 1 },
];

describe('spatial focus', () => {
  it('moves horizontally inside a row and stops at the edge', () => {
    expect(moveFocus(items, 'nav-home', 'ArrowRight')).toBe('nav-tv');
    expect(moveFocus(items, 'nav-tv', 'ArrowRight')).toBe('nav-tv');
    expect(moveFocus(items, 'nav-tv', 'ArrowLeft')).toBe('nav-home');
  });

  it('moves vertically to the nearest item in the next row', () => {
    expect(moveFocus(items, 'nav-tv', 'ArrowDown')).toBe('assist');
    expect(moveFocus(items, 'media', 'ArrowDown')).toBe('lights');
    expect(moveFocus(items, 'climate', 'ArrowUp')).toBe('media');
    expect(moveFocus(items, 'nav-home', 'ArrowUp')).toBe('nav-home');
  });

  it('restores a focus target that is still on screen', () => {
    expect(restoreFocus('media', items)).toBe('media');
    expect(restoreFocus('missing', items)).toBe('nav-home');
    expect(restoreFocus(null, [])).toBe('');
  });
});
