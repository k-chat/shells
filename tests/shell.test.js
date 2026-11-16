import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  RAUP_DEFAULTS,
  spiralRadius,
  thetaAt,
  totalTurns,
  umbilicusRadius,
  whorlClearance,
} from "../src/growth.js";
import { PRESETS, PRESET_ORDER } from "../src/story.js";
import { createShell } from "../src/shell.js";
import { generatePigmentMap } from "../src/pigmentation.js";

const SMALL = {
  ...RAUP_DEFAULTS,
  sections: 60,
  aperturePoints: 24,
};

function shellFor(name) {
  return createShell({ ...SMALL, ...PRESETS[name] }, null);
}

function boundingSize(data) {
  data.geometry.computeBoundingBox();
  return data.geometry.boundingBox.getSize(new THREE.Vector3());
}

test("the tube expands by W each revolution", () => {
  const params = { ...RAUP_DEFAULTS, whorlExpansion: 1.7 };

  assert.ok(Math.abs(spiralRadius(0, params) - 1) < 1e-9);
  assert.ok(Math.abs(spiralRadius(Math.PI * 2, params) - 1.7) < 1e-9);
  assert.ok(
    Math.abs(thetaAt(0.5, params) - totalTurns(params) * Math.PI) < 1e-9,
  );
});

test("the whorl count follows the adult growth span, not a fixed turn count", () => {
  const nautilus = totalTurns({ ...RAUP_DEFAULTS, ...PRESETS.nautilus });
  const clam = totalTurns({ ...RAUP_DEFAULTS, ...PRESETS.clam });
  const ram = totalTurns({ ...RAUP_DEFAULTS, ...PRESETS.ram });
  const tusk = totalTurns({ ...RAUP_DEFAULTS, ...PRESETS.tusk });

  assert.ok(nautilus > 3.5 && nautilus < 4, `nautilus turns: ${nautilus}`);
  assert.ok(clam < 0.4, `clam turns: ${clam}`);
  assert.ok(ram > 1.9 && ram < 2.3, `ram turns: ${ram}`);
  assert.ok(tusk > 0.45 && tusk < 0.7, `tusk turns: ${tusk}`);
});

test("D moves the tube away from the axis and opens the umbilicus", () => {
  const tight = { ...RAUP_DEFAULTS, axisDistance: 0 };
  const open = { ...RAUP_DEFAULTS, axisDistance: 0.86 };

  const tightGap = umbilicusRadius(0, tight);
  const openGap = umbilicusRadius(0, open);

  assert.ok(tightGap >= 0 && tightGap < 0.3, `tight gap: ${tightGap}`);
  assert.ok(openGap > 10, `open gap: ${openGap}`);

  // At D = 0 successive whorls overlap; a ram's horn and tusk separate.
  assert.ok(whorlClearance({ ...RAUP_DEFAULTS, ...PRESETS.nautilus }) > 0);
  assert.ok(whorlClearance({ ...RAUP_DEFAULTS, ...PRESETS.ram }) < 0);
  assert.ok(whorlClearance({ ...RAUP_DEFAULTS, ...PRESETS.tusk }) < 0);
});

test("T controls the drop: a flat nautilus stays in one plane", () => {
  const flat = shellFor("nautilus");
  const tower = shellFor("snail");
  const flatSize = boundingSize(flat);
  const towerSize = boundingSize(tower);

  assert.ok(flatSize.y < flatSize.x * 0.55, `flat y/x: ${flatSize.y / flatSize.x}`);
  assert.ok(towerSize.y > flatSize.y * 1.75, "the snail's drop produces a tower");
  assert.ok(
    towerSize.y < towerSize.x * 1.55,
    `the snail stays compact, not an open corkscrew: y/x ${towerSize.y / towerSize.x}`,
  );
});

test("all five Raup presets build finite meshes normalised to the presentation size", () => {
  const sizes = new Map();

  for (const name of PRESET_ORDER) {
    const data = shellFor(name);
    const positions = data.geometry.getAttribute("position");
    assert.equal(positions.count, (SMALL.sections + 1) * SMALL.aperturePoints);
    assert.equal(
      data.geometry.getIndex().count,
      SMALL.sections * SMALL.aperturePoints * 6,
    );

    for (let index = 0; index < positions.array.length; index += 1) {
      assert.ok(Number.isFinite(positions.array[index]), `${name} position ${index}`);
    }

    const size = boundingSize(data);
    assert.ok(
      Math.abs(Math.max(size.x, size.y, size.z) - RAUP_DEFAULTS.targetSize) < 0.06,
      `${name} is normalised`,
    );
    sizes.set(name, size);
  }

  // The five forms must actually differ in proportion, not just in parameter
  // values. Compare the flat/tall signatures pairwise.
  const signatures = [...sizes.entries()].map(([name, size]) => ({
    name,
    signature: [size.x, size.y, size.z].map((value) => value.toFixed(2)).join(":"),
  }));
  assert.equal(new Set(signatures.map((entry) => entry.signature)).size, 5);
});

test("pigment maps cover every swept vertex, including the closing lip", () => {
  const pigment = generatePigmentMap({
    sections: SMALL.sections,
    aperturePoints: SMALL.aperturePoints,
    warmUpSteps: 200,
    stepsPerSection: 2,
    seed: 11,
  });
  const vertexCount = (SMALL.sections + 1) * SMALL.aperturePoints;

  assert.equal(pigment.colors.length, vertexCount * 3);

  const data = createShell(SMALL, pigment.colors);
  const colors = data.geometry.getAttribute("color");
  assert.equal(colors.count, vertexCount);
  assert.deepEqual(
    Array.from(colors.array.slice(-SMALL.aperturePoints * 3)),
    Array.from(pigment.colors.slice(-SMALL.aperturePoints * 3)),
  );
  assert.ok(new Set(colors.array).size > 8, "vertex colours are not a flat fallback");
});

test("pigment maps are deterministic per seed and differ between seeds", () => {
  const options = {
    sections: 12,
    aperturePoints: 24,
    warmUpSteps: 300,
    stepsPerSection: 4,
  };
  const first = generatePigmentMap({ ...options, seed: 42 });
  const repeat = generatePigmentMap({ ...options, seed: 42 });
  const different = generatePigmentMap({ ...options, seed: 43 });

  assert.deepEqual(first.colors, repeat.colors);
  assert.notDeepEqual(first.colors, different.colors);

  for (const value of first.colors) {
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  }
});
