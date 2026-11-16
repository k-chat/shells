import * as THREE from "three";

/**
 * Tuned activator-substrate parameters.
 *
 * The field-notes defaults are a useful starting point, but they collapse to
 * a flat activator field at the resolution of a shell aperture. This set sits
 * in a Turing-unstable regime: the substrate diffuses much faster than the
 * activator, so a ring of travelling peaks forms around the aperture and is
 * frozen onto each new section as growth proceeds.
 */
export const PIGMENT_DEFAULTS = Object.freeze({
  dt: 0.01,
  dx: 1,
  rho: 0.1,
  rho0: 0.01,
  mu: 0.1,
  nu: 0.001,
  sigma: 0.1,
  Da: 0.01,
  Ds: 10,
  kappa: 0.25,
  a0: 0.99,
  s0: 1,
  noise: 0.02,
  warmUpSteps: 14000,
  stepsPerSection: 16,
  seed: 20261114,
});

const PALETTE = [
  { stop: 0, color: new THREE.Color("#f4e4c0") },
  { stop: 0.38, color: new THREE.Color("#d7a96f") },
  { stop: 0.68, color: new THREE.Color("#9a5b2f") },
  { stop: 1, color: new THREE.Color("#2b1710") },
];

const PALETTE_STOPS = PALETTE.map(({ stop, color }) => ({
  stop,
  r: color.r,
  g: color.g,
  b: color.b,
}));

const TWO_PI = Math.PI * 2;

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function writePalette(value, target, offset) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  let index = 1;
  while (index < PALETTE_STOPS.length - 1 && u > PALETTE_STOPS[index].stop) {
    index += 1;
  }

  const previous = PALETTE_STOPS[index - 1];
  const current = PALETTE_STOPS[index];
  const span = current.stop - previous.stop;
  const amount = span > 0 ? (u - previous.stop) / span : 0;

  target[offset] = previous.r + (current.r - previous.r) * amount;
  target[offset + 1] = previous.g + (current.g - previous.g) * amount;
  target[offset + 2] = previous.b + (current.b - previous.b) * amount;
}

function paletteColor(value) {
  const color = new THREE.Color();
  const target = [0, 0, 0];
  writePalette(value, target, 0);
  color.setRGB(target[0], target[1], target[2]);
  return color;
}

function quantileRange(values, low = 0.05, high = 0.95) {
  const sorted = Float32Array.from(values).sort();
  const last = sorted.length - 1;
  const lo = sorted[Math.floor(low * last)];
  const hi = sorted[Math.floor(high * last)];
  return { lo, hi: hi - lo > 1e-9 ? hi : lo + 1e-9 };
}

function sampleField(values, position) {
  const count = values.length;
  const wrapped = ((position % count) + count) % count;
  const left = Math.floor(wrapped);
  const right = (left + 1) % count;
  const amount = wrapped - left;
  return values[left] + (values[right] - values[left]) * amount;
}

export class PigmentSimulation {
  constructor(size, options = {}) {
    if (!Number.isInteger(size) || size < 3) {
      throw new RangeError("PigmentSimulation needs at least three samples");
    }

    this.size = size;
    this.parameters = { ...PIGMENT_DEFAULTS, ...options };
    const random = mulberry32(this.parameters.seed);
    const noise = this.parameters.noise;

    this.a = new Float32Array(size).fill(this.parameters.a0);
    this.s = new Float32Array(size).fill(this.parameters.s0);
    for (let index = 0; index < size; index += 1) {
      this.a[index] *= 1 + (random() - 0.5) * noise;
      this.s[index] *= 1 + (random() - 0.5) * noise;
    }

    this.nextA = new Float32Array(size);
    this.nextS = new Float32Array(size);
    this.warmUp(this.parameters.warmUpSteps);
  }

  step() {
    const {
      a, s, nextA, nextS, size,
      parameters: p,
    } = this;
    const dxSquared = p.dx * p.dx;

    for (let index = 0; index < size; index += 1) {
      const previous = index === 0 ? size - 1 : index - 1;
      const next = index === size - 1 ? 0 : index + 1;
      const lapA = (a[previous] - 2 * a[index] + a[next]) / dxSquared;
      const lapS = (s[previous] - 2 * s[index] + s[next]) / dxSquared;
      const square = a[index] * a[index];
      const reaction = p.rho * s[index] * (square / (1 + p.kappa * square) + p.rho0);

      nextA[index] = Math.max(0, a[index] + p.dt * (reaction - p.mu * a[index] + p.Da * lapA));
      nextS[index] = Math.max(0, s[index] + p.dt * (p.sigma - reaction - p.nu * s[index] + p.Ds * lapS));
    }

    // Swap buffers instead of allocating a new pair on every step.
    this.a = nextA;
    this.s = nextS;
    this.nextA = a;
    this.nextS = s;
  }

  warmUp(steps = this.parameters.warmUpSteps) {
    for (let step = 0; step < steps; step += 1) this.step();
    return this;
  }
}

/** Map one activator field to colours using a robust 5–95% range. */
export function colorizeField(values) {
  const { lo, hi } = quantileRange(values);
  return Array.from(values, (value) => (
    paletteColor(Math.pow(THREE.MathUtils.clamp((value - lo) / (hi - lo), 0, 1), 1.18))
  ));
}

/**
 * Advance the reaction-diffusion field and return a colour for every aperture
 * sample. Kept as the public single-section API used by the test suite.
 */
export function pigmentSection(simulation, steps = 16) {
  for (let step = 0; step < steps; step += 1) simulation.step();
  return colorizeField(simulation.a);
}

/**
 * Bake the whole growth history up front.
 *
 * Colours are deliberately independent of whorl expansion, axis distance, and
 * translation: moving a geometry slider can rebuild the mesh while the
 * specimen's pigment stays exactly as it was deposited.
 */
export function generatePigmentMap(options = {}) {
  const sections = Math.max(2, Math.floor(options.sections ?? 420));
  const aperturePoints = Math.max(8, Math.floor(options.aperturePoints ?? 96));
  const seed = (options.seed ?? PIGMENT_DEFAULTS.seed) >>> 0;
  const stepsPerSection = Math.max(1, Math.floor(options.stepsPerSection ?? PIGMENT_DEFAULTS.stepsPerSection));
  const warmUpSteps = Math.max(0, Math.floor(options.warmUpSteps ?? PIGMENT_DEFAULTS.warmUpSteps));

  const simulation = new PigmentSimulation(aperturePoints, {
    ...options,
    seed,
    warmUpSteps,
  });
  const random = mulberry32(seed ^ 0x9e3779b9);
  const phase = random() * TWO_PI;
  const linePhase = random() * TWO_PI;

  // One extra row: the swept mesh closes on the final growth ring, so the
  // baked field needs a matching colour for the last lip.
  const colors = new Float32Array((sections + 1) * aperturePoints * 3);
  const wobbleAmplitude = options.wobbleAmplitude ?? 1.1;
  const wobbleFrequency = options.wobbleFrequency ?? 0.11;
  const phaseDrift = options.phaseDrift ?? 0.028;
  const growthLineFrequency = options.growthLineFrequency ?? 1.15;
  const growthLineStrength = options.growthLineStrength ?? 0.06;
  const sutureStrength = options.sutureStrength ?? 0.12;
  const sutureIndex = aperturePoints * 0.25;
  const sutureWidth = Math.max(1, aperturePoints * 0.032);

  for (let section = 0; section < sections; section += 1) {
    for (let step = 0; step < stepsPerSection; step += 1) simulation.step();

    const { lo, hi } = quantileRange(simulation.a);
    const shift = wobbleAmplitude * Math.sin(section * wobbleFrequency + phase)
      + phaseDrift * section;
    const line = Math.pow(0.5 + 0.5 * Math.sin(section * growthLineFrequency + linePhase), 10);
    const shade = 1 - growthLineStrength * line;

    for (let point = 0; point < aperturePoints; point += 1) {
      const value = sampleField(simulation.a, point + shift);
      const normalized = Math.pow(
        THREE.MathUtils.clamp((value - lo) / (hi - lo), 0, 1),
        1.18,
      );
      const distance = Math.min(
        Math.abs(point - sutureIndex),
        aperturePoints - Math.abs(point - sutureIndex),
      );
      const suture = 1 - sutureStrength * Math.exp(-((distance / sutureWidth) ** 2));
      const offset = (section * aperturePoints + point) * 3;
      writePalette(normalized, colors, offset);
      colors[offset] *= shade * suture;
      colors[offset + 1] *= shade * suture;
      colors[offset + 2] *= shade * suture;
    }
  }

  // Mirror the last growth ring onto the closing lip row.
  colors.copyWithin(
    sections * aperturePoints * 3,
    (sections - 1) * aperturePoints * 3,
    sections * aperturePoints * 3,
  );

  return {
    colors,
    sections,
    aperturePoints,
    seed,
    parameters: simulation.parameters,
  };
}
