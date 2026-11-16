/**
 * The five specimens from the transcript, as points in Raup's morphospace.
 *
 * Only W, D and T are shape parameters. The number of whorls is derived from
 * a fixed adult/birth growth span, which is why a clam grows a fraction of a
 * turn while a nautilus grows almost four.
 */
export const PRESETS = Object.freeze({
  snail: Object.freeze({
    label: "SEA SNAIL",
    whorlExpansion: 3,
    axisDistance: 0,
    translation: 2.1,
  }),
  nautilus: Object.freeze({
    label: "NAUTILUS",
    whorlExpansion: 3,
    axisDistance: 0,
    translation: 0,
  }),
  clam: Object.freeze({
    label: "CLAM",
    whorlExpansion: 1_000_000,
    axisDistance: 0.03,
    translation: 0,
  }),
  ram: Object.freeze({
    label: "RAM'S HORN",
    whorlExpansion: 7,
    axisDistance: 0.38,
    translation: 0.6,
  }),
  tusk: Object.freeze({
    label: "ELEPHANT TUSK",
    whorlExpansion: 1_585,
    axisDistance: 0.86,
    translation: 0,
  }),
});

export const PRESET_ORDER = Object.freeze(["snail", "nautilus", "clam", "ram", "tusk"]);

const W_LOG_SPAN = 6;

/**
 * Euclidean distance in the normalised morphospace. Used by the live readout
 * to decide whether the current shell is one of the five named corners or an
 * unnamed theoretical form.
 */
export function nearestPreset(params) {
  const w = Math.log10(Math.max(1.0001, params.whorlExpansion));
  let best = null;

  for (const name of PRESET_ORDER) {
    const preset = PRESETS[name];
    const dx = (w - Math.log10(preset.whorlExpansion)) / W_LOG_SPAN;
    const dy = (params.axisDistance - preset.axisDistance) / 0.92;
    const dz = (params.translation - preset.translation) / 2.4;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!best || distance < best.distance) best = { name, label: preset.label, distance };
  }

  return best;
}

/**
 * Story chapters. `mode` drives what the scene shows:
 *   shell       the live swept surface
 *   morphospace Raup's cube and the five specimens
 *
 * `preset` is the destination of the shape morph for that chapter. The
 * explore chapter intentionally keeps whatever the visitor has dialled in.
 *
 * `focus` lists the parameters the copy is currently changing, so the
 * scene controls can highlight the relevant slider(s) for the act.
 */
export const chapters = [
  {
    id: "rule",
    title: "ONE RULE",
    mode: "shell",
    preset: "snail",
    growth: 0.88,
    orbit: 0.06,
    focus: ["whorlExpansion", "axisDistance", "translation"],
  },
  {
    id: "drop",
    title: "THE DROP",
    mode: "shell",
    preset: "nautilus",
    growth: 1,
    orbit: 0.045,
    focus: ["translation"],
  },
  {
    id: "widen",
    title: "THE WIDENING",
    mode: "shell",
    preset: "clam",
    growth: 1,
    orbit: 0.03,
    focus: ["whorlExpansion"],
  },
  {
    id: "distance",
    title: "THE DISTANCE",
    mode: "shell",
    preset: "ram",
    growth: 1,
    orbit: 0.04,
    focus: ["axisDistance"],
  },
  {
    id: "tusk",
    title: "OUTSIDE THE SHELL",
    mode: "shell",
    preset: "tusk",
    growth: 1,
    orbit: 0.035,
    focus: ["whorlExpansion", "axisDistance"],
  },
  {
    id: "cube",
    title: "THE CUBE",
    mode: "morphospace",
    preset: "tusk",
    growth: 1,
    orbit: 0,
    focus: [],
  },
  {
    id: "survivors",
    title: "LIFE'S FEW CORNERS",
    mode: "survivors",
    preset: "snail",
    growth: 1,
    orbit: 0.018,
    focus: [],
  },
  {
    id: "bench",
    title: "THE BENCH",
    mode: "shell",
    preset: "snail",
    growth: 1,
    orbit: 0.02,
    focus: ["whorlExpansion", "axisDistance", "translation"],
  },
];
