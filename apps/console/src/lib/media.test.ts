import { describe, expect, it } from 'vitest';
import { mediaDestinations, playableDestinations } from './media';

describe('media destinations', () => {
  it('exposes only the local demonstration as playable', () => {
    expect(playableDestinations().map((item) => item.id)).toEqual(['local-demo']);
    expect(mediaDestinations().filter((item) => !item.available).map((item) => item.id)).toEqual([
      'live-tv',
      'apps',
      'hdmi',
      'library',
    ]);
  });
});
