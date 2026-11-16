import * as THREE from "three";

/**
 * Raup's coiling model (Raup 1966).
 *
 * A shell is a generating curve swept around a fixed coiling axis while it
 * expands and translates. Three numbers describe the whole architecture:
 *
 *   W  whorlExpansion  how much the tube widens per revolution
 *   D  axisDistance    how far the generating curve sits from the axis,
 *                      normalised by the tube radius (Raup's D, in (-1, 1))
 *   T  translation     how far the tube drops down the axis per revolution,
 *                      relative to the tube radius (Raup's T)
 *
 * The tube radius is r(theta) = W^(theta / 2pi). The generating-curve
 * reference point then sits at
 *
 *   R(theta) = r(theta) * (1 + D) / (1 - D)
 *   y(theta) = -g * 2T / (1 - D) * (r(theta) - 1)
 *
 * and the aperture is a closed profile of radius `apertureScale * r` in the
 * radial/vertical plane. With D = 0 the tube sits close to the axis and
 * successive whorls cover one another; with D -> 1 the tube moves away from
 * the axis and a hollow umbilicus opens.
 *
 * `g` is `translationGain`, a fixed presentation constant. Raup's T is
 * scale-free; the gain maps T = 2.1 onto a compact, whorl-on-whorl tower
 * instead of a widely spaced corkscrew.
 */
export const RAUP_DEFAULTS = Object.freeze({
  // The three numbers.
  whorlExpansion: 3,
  axisDistance: 0,
  translation: 2.1,

  // Ontogeny: how far the animal grows, expressed as an adult/birth ratio.
  // This is not a shape parameter. Solving n = ln(span) / ln(W) is what lets
  // the same three numbers describe a 4-whorl nautilus and a half-turn clam.
  growthSpan: 60,
  minTurns: 0.2,
  maxTurns: 6,

  // Visual constants: the generating curve and surface detail.
  //
  // translationGain maps Raup's abstract T onto a presentable drop. Raup's T
  // is independent of the tube's absolute size; the gain keeps T = 2.1 a
  // compact, whorl-on-whorl tower instead of a widely spaced corkscrew.
  translationGain: 0.42,
  apertureScale: 0.8,
  apertureAspect: 0.72,
  apertureTilt: -0.1,
  sections: 320,
  aperturePoints: 84,
  targetSize: 4.4,

  taper: 0.11,
  ribCount: 9,
  ribAmplitude: 0.052,
  ribTwist: 2.4,
  ribSharpness: 2.2,
  growthLineFrequency: 30,
  growthLineAmplitude: 0.014,
  growthLineSharpness: 2.4,
  lipFlare: 0.08,
  lipStart: 0.94,
});

/** Backwards-compatible name for the model defaults. */
export const SHELL_DEFAULTS = RAUP_DEFAULTS;

export const EXPLORE_LIMITS = Object.freeze({
  whorlExpansion: { min: 1.0001, max: 1_000_000, step: 1 },
  axisDistance: { min: 0, max: 0.92, step: 0.01 },
  translation: { min: 0, max: 2.4, step: 0.01 },
});

export const W_SLIDER = Object.freeze({ min: 0, max: 6, step: 0.001 });

const TWO_PI = Math.PI * 2;
const EPSILON = 1e-9;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** ln(W) / 2π: the exponential rate of tube growth per radian. */
export function spiralExponent(params = RAUP_DEFAULTS) {
  return Math.log(Math.max(1.000001, params.whorlExpansion)) / TWO_PI;
}

/** Tube radius at angle theta. r(0) = 1, r(2π) = W. */
export function spiralRadius(theta, params = RAUP_DEFAULTS) {
  return Math.exp(spiralExponent(params) * theta);
}

/** The tube radius itself; named separately so the mesh code reads clearly. */
export function tubeRadius(theta, params = RAUP_DEFAULTS) {
  return spiralRadius(theta, params) * (params.apertureScale ?? RAUP_DEFAULTS.apertureScale);
}

/**
 * R / r in Raup's model. D = 0 places the generating curve one tube radius
 * from the axis; larger D pushes it outward and opens the umbilicus.
 */
export function axisDistanceRatio(params = RAUP_DEFAULTS) {
  const d = clamp(params.axisDistance ?? 0, -0.95, 0.95);
  return (1 + d) / (1 - d);
}

/** Vertical travel per unit of tube growth. */
export function verticalRate(params = RAUP_DEFAULTS) {
  const d = clamp(params.axisDistance ?? 0, -0.95, 0.95);
  const gain = params.translationGain ?? RAUP_DEFAULTS.translationGain;
  return (2 * gain * Math.max(0, params.translation ?? 0)) / (1 - d);
}

/** Radius of the generating-curve reference point at theta. */
export function referenceRadius(theta, params = RAUP_DEFAULTS) {
  return spiralRadius(theta, params) * axisDistanceRatio(params);
}

/** Signed height of the reference point. The apex sits above the body whorl. */
export function verticalOffset(theta, params = RAUP_DEFAULTS) {
  return -verticalRate(params) * (spiralRadius(theta, params) - 1);
}

/**
 * Centreline of the growing tube:
 * (R cos θ, y, R sin θ) in a y-up Three.js frame.
 */
export function spiralAt(theta, params = RAUP_DEFAULTS) {
  const radius = referenceRadius(theta, params);
  return new THREE.Vector3(
    radius * Math.cos(theta),
    verticalOffset(theta, params),
    radius * Math.sin(theta),
  );
}

/**
 * How many whorls the animal grows. W only controls the *rate* of expansion;
 * the number of turns is set by the adult/birth size ratio, so extreme W
 * values (a clam or a tusk) stop after a fraction of a revolution instead of
 * exploding.
 */
export function totalTurns(params = RAUP_DEFAULTS) {
  const w = Math.max(1.000001, params.whorlExpansion ?? RAUP_DEFAULTS.whorlExpansion);
  const span = Math.max(1.000001, params.growthSpan ?? RAUP_DEFAULTS.growthSpan);
  const minTurns = params.minTurns ?? RAUP_DEFAULTS.minTurns;
  const maxTurns = params.maxTurns ?? RAUP_DEFAULTS.maxTurns;
  return clamp(Math.log(span) / Math.log(w), minTurns, maxTurns);
}

/** Total coiling angle for a complete specimen. */
export function totalTheta(params = RAUP_DEFAULTS) {
  return totalTurns(params) * TWO_PI;
}

/** Convert a 0..1 growth progress value into the spiral's angular parameter. */
export function thetaAt(progress, params = RAUP_DEFAULTS) {
  return clamp(progress, 0, 1) * totalTheta(params);
}

/**
 * Distance from the axis to the inner edge of the tube. Zero means the whorl
 * reaches the axis; positive values are the open umbilicus.
 */
export function umbilicusRadius(theta, params = RAUP_DEFAULTS) {
  return Math.max(0, referenceRadius(theta, params) - tubeRadius(theta, params));
}

/**
 * Clearance between a whorl and the one before it. Positive means the turns
 * overlap; negative means they are separated by open space.
 */
export function whorlClearance(params = RAUP_DEFAULTS) {
  const ratio = axisDistanceRatio(params);
  const scale = params.apertureScale ?? RAUP_DEFAULTS.apertureScale;
  const previousOuter = ratio + scale;
  const nextInner = Math.max(1.000001, params.whorlExpansion) * Math.max(EPSILON, ratio - scale);
  return previousOuter - nextInner;
}

/** How much the aperture is allowed to open at a given growth stage. */
export function taperAt(progress, params = RAUP_DEFAULTS) {
  const t = THREE.MathUtils.smoothstep(progress, 0, params.taper ?? RAUP_DEFAULTS.taper);
  return 0.055 + 0.945 * t;
}

/** A final, outward lip flare at the very end of growth. */
export function lipFlareAt(progress, params = RAUP_DEFAULTS) {
  const start = params.lipStart ?? RAUP_DEFAULTS.lipStart;
  const flare = params.lipFlare ?? RAUP_DEFAULTS.lipFlare;
  return 1 + flare * THREE.MathUtils.smoothstep(progress, start, 1);
}

/**
 * Signed relief of the spiral ribs. These run along the growth direction —
 * one ridge per `ribCount` around the aperture — and the phase drifts with
 * `theta` so the ribs twist as the whorl advances. `ribSharpness` narrows the
 * crests and widens the troughs so the relief reads as raised costae rather
 * than a gentle wave. The value is a fraction of the local section radius and
 * is applied along the aperture's outward normal by the mesh builder.
 */
export function spiralRibAt(phi, theta, params = RAUP_DEFAULTS) {
  const phase = Math.sin(
    (params.ribCount ?? RAUP_DEFAULTS.ribCount) * phi
      + theta * (params.ribTwist ?? RAUP_DEFAULTS.ribTwist),
  );
  const sharpness = params.ribSharpness ?? RAUP_DEFAULTS.ribSharpness;
  const shaped = Math.sign(phase) * Math.pow(Math.abs(phase), sharpness);
  return (params.ribAmplitude ?? RAUP_DEFAULTS.ribAmplitude) * shaped;
}

/**
 * Signed relief of the fine axial growth lines (increments), keyed to growth
 * progress rather than angle so a specimen keeps the same number of lines
 * whatever its whorl expansion. Also a fraction of the section radius.
 */
export function growthRidgeAt(progress, params = RAUP_DEFAULTS) {
  const phase = Math.sin(
    progress * TWO_PI * (params.growthLineFrequency ?? RAUP_DEFAULTS.growthLineFrequency),
  );
  const sharpness = params.growthLineSharpness ?? RAUP_DEFAULTS.growthLineSharpness;
  const shaped = Math.sign(phase) * Math.pow(Math.abs(phase), sharpness);
  return (params.growthLineAmplitude ?? RAUP_DEFAULTS.growthLineAmplitude) * shaped;
}

/**
 * Raup's generating curve lives in the radial/vertical plane: x points away
 * from the coiling axis, y points up, and the plane's normal is tangential.
 * This is a stable frame at every angle, so the aperture never twists.
 */
export function localFrame(theta) {
  const radial = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
  return new THREE.Matrix4().makeBasis(radial, up, normal);
}

/**
 * Build the uniform scale/offset that fits the raw shell into a fixed
 * presentation size. Keeping this separate lets the spiral line, aperture
 * ring, and end cap share exactly the same transform as the mesh.
 */
export function createNormalizedTransform(positions, targetSize = RAUP_DEFAULTS.targetSize) {
  const box = new THREE.Box3().setFromArray(positions);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z);

  return {
    center,
    size,
    scale: largest > 1e-6 && Number.isFinite(largest) ? targetSize / largest : 1,
  };
}

export function transformPoint(point, transform) {
  return new THREE.Vector3(
    (point.x - transform.center.x) * transform.scale,
    (point.y - transform.center.y) * transform.scale,
    (point.z - transform.center.z) * transform.scale,
  );
}
