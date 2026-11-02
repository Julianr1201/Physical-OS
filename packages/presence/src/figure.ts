export const figureKind = {
  head: 0,
  eye: 1,
  lid: 2,
  mouth: 3,
  torso: 4,
  arm: 5,
  hair: 6,
  hand: 7,
  ring: 8,
} as const;

export interface FigureSample {
  count: number;
  positions: Float32Array;
  kind: Float32Array;
  side: Float32Array;
}

export function sampleFigure(count: number, options?: { body?: boolean }): FigureSample {
  const total = Math.max(400, Math.floor(count));
  const body = options?.body !== false;
  const parts = partCounts(total, body);
  const positions = new Float32Array(total * 3);
  const kind = new Float32Array(total);
  const side = new Float32Array(total);
  let cursor = 0;
  const random = mulberry32(0x504f53);

  const write = (point: [number, number, number], part: number, facing: number) => {
    positions[cursor * 3] = point[0];
    positions[cursor * 3 + 1] = point[1];
    positions[cursor * 3 + 2] = point[2];
    kind[cursor] = part;
    side[cursor] = facing;
    cursor += 1;
  };

  for (let index = 0; index < parts.head; index += 1) write(headPoint(index, parts.head), figureKind.head, 0);
  for (let index = 0; index < parts.hair; index += 1) write(hairPoint(index, parts.hair, random), figureKind.hair, 0);
  for (let index = 0; index < parts.eye; index += 1) {
    const facing = index % 2 === 0 ? 1 : -1;
    write(eyePoint(facing, random), figureKind.eye, facing);
  }
  for (let index = 0; index < parts.lid; index += 1) {
    const facing = index % 2 === 0 ? 1 : -1;
    write(lidPoint(facing, random), figureKind.lid, facing);
  }
  for (let index = 0; index < parts.mouth; index += 1) {
    const upper = index % 2 === 0;
    write(mouthPoint(upper, random), figureKind.mouth, upper ? 1 : -1);
  }
  for (let index = 0; index < parts.torso; index += 1) write(torsoPoint(random), figureKind.torso, 0);
  for (let index = 0; index < parts.arm; index += 1) {
    const facing = index % 5 === 0 ? -1 : 1;
    write(armPoint(facing, random), figureKind.arm, facing);
  }
  for (let index = 0; index < parts.hand; index += 1) {
    const facing = index % 5 === 0 ? -1 : 1;
    write(handPoint(facing, random), figureKind.hand, facing);
  }
  for (let index = 0; index < parts.ring; index += 1) write(ringPoint(random), figureKind.ring, 0);

  return { count: cursor, positions, kind, side };
}

export function sliceFigure(sample: FigureSample, include: (kind: number) => boolean): FigureSample {
  let next = 0;
  for (let index = 0; index < sample.count; index += 1) {
    if (include(sample.kind[index] ?? 0)) next += 1;
  }
  const positions = new Float32Array(next * 3);
  const kind = new Float32Array(next);
  const side = new Float32Array(next);
  let cursor = 0;
  for (let index = 0; index < sample.count; index += 1) {
    const part = sample.kind[index] ?? 0;
    if (!include(part)) continue;
    positions[cursor * 3] = sample.positions[index * 3] ?? 0;
    positions[cursor * 3 + 1] = sample.positions[index * 3 + 1] ?? 0;
    positions[cursor * 3 + 2] = sample.positions[index * 3 + 2] ?? 0;
    kind[cursor] = part;
    side[cursor] = sample.side[index] ?? 0;
    cursor += 1;
  }
  return { count: cursor, positions, kind, side };
}

function partCounts(
  total: number,
  body: boolean,
): Record<'head' | 'eye' | 'lid' | 'mouth' | 'torso' | 'arm' | 'hair' | 'hand' | 'ring', number> {
  if (!body) {
    const hair = Math.round(total * 0.24);
    const eye = Math.round(total * 0.1);
    const lid = Math.round(total * 0.06);
    const mouth = Math.round(total * 0.08);
    return { head: total - hair - eye - lid - mouth, eye, lid, mouth, torso: 0, arm: 0, hair, hand: 0, ring: 0 };
  }
  const hair = Math.round(total * 0.18);
  const eye = Math.round(total * 0.018);
  const lid = Math.round(total * 0.012);
  const mouth = Math.round(total * 0.02);
  const torso = Math.round(total * 0.22);
  const arm = Math.round(total * 0.09);
  const hand = Math.round(total * 0.1);
  const ring = Math.round(total * 0.04);
  return {
    head: total - hair - eye - lid - mouth - torso - arm - hand - ring,
    eye,
    lid,
    mouth,
    torso,
    arm,
    hair,
    hand,
    ring,
  };
}

function headPoint(index: number, count: number): [number, number, number] {
  const faceCount = Math.max(1, Math.floor(count * 0.74));
  if (index < faceCount) return facePoint(index, faceCount);
  return craniumPoint(index - faceCount, count - faceCount);
}

function facePoint(index: number, count: number): [number, number, number] {
  const yUnit = 1 - ((index + 0.5) / count) * 2;
  const ring = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
  const theta = Math.PI * (3 - Math.sqrt(5)) * index;
  const v = yUnit * 0.92;
  const u = Math.cos(theta) * ring * (v < -0.55 ? 0.86 : 0.96);
  return [u * 0.17, 0.44 + v * 0.2, 0.1 + (1 - Math.min(1, u * u + v * v)) * 0.02];
}

function craniumPoint(index: number, count: number): [number, number, number] {
  const yUnit = 0.15 + ((index + 0.5) / Math.max(1, count)) * 0.85;
  const ring = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
  const theta = Math.PI * (3 - Math.sqrt(5)) * (index + 40);
  return [Math.cos(theta) * ring * 0.15, 0.52 + yUnit * 0.1, -0.04];
}

function hairPoint(index: number, count: number, random: () => number): [number, number, number] {
  const region = index / Math.max(1, count);
  if (region < 0.74) {
    const y = 0.4 + random() * 0.6;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = random() * Math.PI * 2;
    return [Math.cos(theta) * ring * 0.16, 0.58 + y * 0.08, -0.06];
  }
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(random()) * 0.065;
  return [Math.cos(angle) * radius * 0.7, 0.52, -0.1];
}

function eyePoint(facing: number, random: () => number): [number, number, number] {
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(random());
  return [facing * 0.048 + Math.cos(angle) * radius * 0.014, 0.48 + Math.sin(angle) * radius * 0.008, 0.13];
}

function lidPoint(facing: number, random: () => number): [number, number, number] {
  const along = random() * 2 - 1;
  return [facing * 0.048 + along * 0.018, 0.492, 0.126];
}

function mouthPoint(upper: boolean, random: () => number): [number, number, number] {
  const along = random() * 2 - 1;
  const smile = (1 - along * along) * 0.008;
  return [along * 0.03, 0.36 + (upper ? 0.004 : 0) + smile * 0.4, 0.125];
}

function torsoPoint(random: () => number): [number, number, number] {
  if (random() < 0.08) {
    const angle = (random() - 0.5) * Math.PI;
    return [Math.sin(angle) * 0.07, 0.28 + random() * 0.04, 0.08];
  }
  const t = random();
  const y = 0.3 - t * 0.42;
  const opened = Math.sin(Math.min(1, t * 2.4) * Math.PI * 0.5);
  const halfW = 0.09 + opened * 0.28;
  const x = (random() * 2 - 1) * halfW;
  const edge = halfW === 0 ? 0 : Math.abs(x) / halfW;
  return [x, y, 0.09 - edge * edge * 0.025];
}

function armPoint(facing: number, random: () => number): [number, number, number] {
  const t = random();
  if (facing > 0) {
    const point = bezier([-0.32, 0.16, 0.08], [-0.38, 0.08, 0.26], [-0.18, 0.05, 0.44], t);
    return [point[0] + (random() - 0.5) * 0.03, point[1] + (random() - 0.5) * 0.025, point[2] + (random() - 0.5) * 0.025];
  }
  return [0.34, 0.16 - t * 0.26, 0.07];
}

function handPoint(facing: number, random: () => number): [number, number, number] {
  if (facing < 0) return [0.34 + (random() - 0.5) * 0.025, -0.1, 0.07];
  const wrist: [number, number, number] = [-0.14, 0.04, 0.48];
  if (random() < 0.42) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 0.05;
    return [wrist[0] + Math.cos(angle) * radius, wrist[1] + Math.sin(angle) * radius * 0.62, wrist[2] + radius * 0.12];
  }
  const finger = Math.floor(random() * 5);
  const along = random();
  const thumb = finger === 4;
  const spread = (finger - 1.5) * 0.016;
  return [
    wrist[0] + (thumb ? -0.04 : spread),
    wrist[1] + along * (thumb ? 0.01 : 0.05) + (thumb ? -0.02 : 0.01),
    wrist[2] + along * (thumb ? 0.035 : 0.07),
  ];
}

function ringPoint(random: () => number): [number, number, number] {
  const angle = random() * Math.PI * 2;
  const radius = 0.4 + (random() - 0.5) * 0.008;
  return [Math.cos(angle) * radius, -0.14, Math.sin(angle) * radius * 0.28 + 0.14];
}

function bezier(a: number[], b: number[], c: number[], t: number): [number, number, number] {
  const u = 1 - t;
  return [
    u * u * (a[0] ?? 0) + 2 * u * t * (b[0] ?? 0) + t * t * (c[0] ?? 0),
    u * u * (a[1] ?? 0) + 2 * u * t * (b[1] ?? 0) + t * t * (c[1] ?? 0),
    u * u * (a[2] ?? 0) + 2 * u * t * (b[2] ?? 0) + t * t * (c[2] ?? 0),
  ];
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
