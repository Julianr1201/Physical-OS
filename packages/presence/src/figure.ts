export const figureKind = {
  head: 0,
  eye: 1,
  lid: 2,
  mouth: 3,
  torso: 4,
  arm: 5,
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
    const facing = index % 2 === 0 ? 1 : -1;
    write(armPoint(facing, random), figureKind.arm, facing);
  }

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

function partCounts(total: number, body: boolean): Record<'head' | 'eye' | 'lid' | 'mouth' | 'torso' | 'arm', number> {
  if (!body) {
    const eye = Math.round(total * 0.12);
    const lid = Math.round(total * 0.07);
    const mouth = Math.round(total * 0.1);
    return { head: total - eye - lid - mouth, eye, lid, mouth, torso: 0, arm: 0 };
  }
  const eye = Math.round(total * 0.08);
  const lid = Math.round(total * 0.05);
  const mouth = Math.round(total * 0.07);
  const torso = Math.round(total * 0.16);
  const arm = Math.round(total * 0.08);
  return { head: total - eye - lid - mouth - torso - arm, eye, lid, mouth, torso, arm };
}

function headPoint(index: number, count: number): [number, number, number] {
  const y = 1 - (index / Math.max(1, count - 1)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = Math.PI * (3 - Math.sqrt(5)) * index;
  const x = Math.cos(theta) * radius * 0.72;
  const yy = y * 0.96 - 0.02;
  let z = Math.sin(theta) * radius * 0.8;
  const chin = Math.min(0, yy + 0.12);
  const x2 = x * (1 + chin * 0.5);
  if (z > 0) {
    const nose = Math.exp(-(x2 * x2) / 0.018 - ((yy - 0.02) ** 2) / 0.028);
    const socketL = Math.exp(-((x2 - 0.2) ** 2) / 0.01 - ((yy - 0.14) ** 2) / 0.012);
    const socketR = Math.exp(-((x2 + 0.2) ** 2) / 0.01 - ((yy - 0.14) ** 2) / 0.012);
    const mouth = Math.exp(-(x2 * x2) / 0.035 - ((yy + 0.34) ** 2) / 0.01);
    z += nose * 0.18 - (socketL + socketR) * 0.09 - mouth * 0.045;
  }
  return [x2, yy, z];
}

function eyePoint(facing: number, random: () => number): [number, number, number] {
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(random()) * 0.042;
  return [facing * 0.2 + Math.cos(angle) * radius, 0.12 + Math.sin(angle) * radius * 0.62, 0.8];
}

function lidPoint(facing: number, random: () => number): [number, number, number] {
  const along = random() * 2 - 1;
  return [facing * 0.2 + along * 0.055, 0.175 + Math.abs(along) * 0.01, 0.76];
}

function mouthPoint(upper: boolean, random: () => number): [number, number, number] {
  const along = random() * 2 - 1;
  const arch = (1 - along * along) * 0.012;
  return [along * 0.15, -0.34 + (upper ? 0.028 : -0.02) + arch, 0.74];
}

function torsoPoint(random: () => number): [number, number, number] {
  const y = -0.78 - random() * 0.72;
  const width = 0.42 + (-0.78 - y) * -0.08;
  const angle = (random() - 0.5) * Math.PI * 1.15;
  return [Math.sin(angle) * width, y, Math.cos(angle) * 0.2 - 0.02];
}

function armPoint(facing: number, random: () => number): [number, number, number] {
  const along = random();
  return [facing * (0.46 + along * 0.05), -0.86 - along * 0.58, 0.02];
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
