export interface MediaDestination {
  id: 'local-demo' | 'live-tv' | 'apps' | 'hdmi' | 'library';
  available: boolean;
}

/** Destinations this screen can actually open. Preview ids are not controls. */
export function mediaDestinations(): MediaDestination[] {
  return [
    { id: 'local-demo', available: true },
    { id: 'live-tv', available: false },
    { id: 'apps', available: false },
    { id: 'hdmi', available: false },
    { id: 'library', available: false },
  ];
}

export function playableDestinations(): MediaDestination[] {
  return mediaDestinations().filter((item) => item.available);
}
