export type Vec3 = [number, number, number];

export interface AvatarAxes {
  /** Unit axis in skinned space that points toward the top of the head. */
  up: Vec3;
  /** Unit axis in skinned space that points out of the face. */
  face: Vec3;
}

/**
 * Measured from `female-adult-01.glb` after skinning, not chosen as a half turn.
 * The skeleton's height follows +Z and the face points along +Y.
 * The resulting rotation is right-handed: it turns the body to face +Z without mirroring it.
 */
export const femaleAdult01Axes: AvatarAxes = {
  up: [0, 0, 1],
  face: [0, 1, 0],
};

/** World point the camera looks at. The face center is moved here. */
export const presenceFocus: Vec3 = [0, 0.38, 0];

export interface AvatarFrame {
  right: Vec3;
  up: Vec3;
  face: Vec3;
  position: Vec3;
}

export function frameAvatar(axes: AvatarAxes, faceCenter: Vec3, focus: Vec3 = presenceFocus): AvatarFrame {
  const up = unit(axes.up);
  const face = unit(reject(axes.face, up));
  if (length(face) < 1e-5) throw new Error('The avatar face axis is parallel to its up axis.');
  const right = cross(up, face);
  const rotated: Vec3 = [dot(right, faceCenter), dot(up, faceCenter), dot(face, faceCenter)];
  return {
    right,
    up,
    face,
    position: [focus[0] - rotated[0], focus[1] - rotated[1], focus[2] - rotated[2]],
  };
}

export function applyFrame(frame: AvatarFrame, point: Vec3): Vec3 {
  return [
    dot(frame.right, point) + frame.position[0],
    dot(frame.up, point) + frame.position[1],
    dot(frame.face, point) + frame.position[2],
  ];
}

/** The declared up axis has to be the longest extent of the skinned body. */
export function extentMatchesUp(min: Vec3, max: Vec3, up: Vec3): boolean {
  const extent = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  let longest = 0;
  if ((extent[1] ?? 0) > (extent[longest] ?? 0)) longest = 1;
  if ((extent[2] ?? 0) > (extent[longest] ?? 0)) longest = 2;
  const axis = Math.abs(up[0]) > 0.5 ? 0 : Math.abs(up[1]) > 0.5 ? 1 : 2;
  return longest === axis;
}

function reject(vector: Vec3, normal: Vec3): Vec3 {
  const amount = dot(vector, normal);
  return [vector[0] - normal[0] * amount, vector[1] - normal[1] * amount, vector[2] - normal[2] * amount];
}

function unit(vector: Vec3): Vec3 {
  const scale = length(vector);
  if (scale < 1e-8) return [0, 0, 0];
  return [vector[0] / scale, vector[1] / scale, vector[2] / scale];
}

function length(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
