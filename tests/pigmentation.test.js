import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { PigmentSimulation, pigmentSection } from "../src/pigmentation.js";

test("pigment sections return usable Three.js colors for every aperture sample", () => {
  const colors = pigmentSection(new PigmentSimulation(72));

  assert.equal(colors.length, 72);
  for (const color of colors) {
    assert.ok(color instanceof THREE.Color);
    assert.ok(Number.isFinite(color.r) && color.r >= 0 && color.r <= 1);
    assert.ok(Number.isFinite(color.g) && color.g >= 0 && color.g <= 1);
    assert.ok(Number.isFinite(color.b) && color.b >= 0 && color.b <= 1);
  }
});
