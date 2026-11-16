import * as THREE from "three";
import { createShell } from "./shell.js";
import { PRESETS, PRESET_ORDER } from "./story.js";

const CUBE_SIZE = 3.5;
const W_LOG_MAX = 6;
const D_MAX = 0.92;
const T_MAX = 2.4;
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

function normalizeW(value) {
  return THREE.MathUtils.clamp(Math.log10(Math.max(1.0001, value)) / W_LOG_MAX, 0, 1);
}

function normalizeD(value) {
  return THREE.MathUtils.clamp(value / D_MAX, 0, 1);
}

function normalizeT(value) {
  return THREE.MathUtils.clamp(value / T_MAX, 0, 1);
}

function pointFromNormalized(x, y, z, size = CUBE_SIZE) {
  return new THREE.Vector3(
    (x - 0.5) * size,
    (y - 0.5) * size,
    (z - 0.5) * size,
  );
}

/**
 * Map a Raup parameter triple into the cube.
 *
 *   x = log10(W)   widening
 *   y = T          drop per turn
 *   z = D          distance from the axis
 */
export function morphospaceCoordinates(params, size = CUBE_SIZE) {
  return pointFromNormalized(
    normalizeW(params.whorlExpansion),
    normalizeT(params.translation),
    normalizeD(params.axisDistance),
    size,
  );
}

function makeTextSprite(text, { color = "#e5484d", size = 0.72 } = {}) {
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = 320 * scale;
  canvas.height = 96 * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.clearRect(0, 0, 320, 96);
  context.fillStyle = color;
  context.font = "400 44px 'Space Mono', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 160, 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size * 0.3, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function addAxisLabels(group) {
  const half = CUBE_SIZE / 2;
  const labels = [
    { text: "W / WIDENING", position: [half + 0.62, -half - 0.16, 0], color: "#e5484d" },
    { text: "T / DROP", position: [-half - 0.56, half + 0.16, 0], color: "#ffffff" },
    { text: "D / DISTANCE", position: [0, -half - 0.2, half + 0.64], color: "#e5484d" },
  ];

  for (const label of labels) {
    const sprite = makeTextSprite(label.text, { color: label.color, size: 0.98 });
    sprite.position.fromArray(label.position);
    group.add(sprite);
  }
}

function addCubeFrame(group) {
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  const edges = new THREE.EdgesGeometry(geometry);
  geometry.dispose();
  const material = new THREE.LineBasicMaterial({
    color: 0xe5484d,
    transparent: true,
    opacity: 0.72,
  });
  group.add(new THREE.LineSegments(edges, material));

  const half = CUBE_SIZE / 2;
  const tickMaterial = new THREE.LineBasicMaterial({
    color: 0xa1121b,
    transparent: true,
    opacity: 0.2,
  });
  const ticks = [];
  for (let index = 0; index <= W_LOG_MAX; index += 1) {
    const x = (index / W_LOG_MAX - 0.5) * CUBE_SIZE;
    ticks.push(
      new THREE.Vector3(x, -half, -half),
      new THREE.Vector3(x, -half - 0.08, -half),
    );
  }
  for (let index = 0; index <= 4; index += 1) {
    const y = (index / 4 - 0.5) * CUBE_SIZE;
    ticks.push(
      new THREE.Vector3(-half, y, -half),
      new THREE.Vector3(-half - 0.08, y, -half),
    );
  }
  const tickGeometry = new THREE.BufferGeometry().setFromPoints(ticks);
  group.add(new THREE.LineSegments(tickGeometry, tickMaterial));
}

function createShellField() {
  const divisions = 4;
  const sections = 30;
  const aperturePoints = 32;
  const targetSize = 0.5;
  const shellsPerAxis = divisions + 1;
  const shellCount = shellsPerAxis ** 3;
  const verticesPerShell = (sections + 1) * aperturePoints;
  const indicesPerShell = sections * aperturePoints * 6;
  const positions = new Float32Array(shellCount * verticesPerShell * 3);
  const normals = new Float32Array(positions.length);
  const colors = new Float32Array(positions.length);
  const indices = new Uint32Array(shellCount * indicesPerShell);
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const random = mulberry32(1966);
  let shellIndex = 0;

  for (let x = 0; x < shellsPerAxis; x += 1) {
    for (let y = 0; y < shellsPerAxis; y += 1) {
      for (let z = 0; z < shellsPerAxis; z += 1) {
        const params = {
          whorlExpansion: x === 0 ? 1.0001 : 10 ** ((x / divisions) * W_LOG_MAX),
          translation: (y / divisions) * T_MAX,
          axisDistance: (z / divisions) * D_MAX,
          sections,
          aperturePoints,
          targetSize,
        };
        const data = createShell(params);
        const source = data.geometry;
        const sourcePositions = source.getAttribute("position");
        const sourceNormals = source.getAttribute("normal");
        const offset = morphospaceCoordinates(params);
        const shellVertexOffset = shellIndex * verticesPerShell;

        euler.set(
          (random() - 0.5) * 0.55,
          random() * Math.PI * 2,
          (random() - 0.5) * 0.55,
        );
        rotation.setFromEuler(euler);

        for (let point = 0; point < verticesPerShell; point += 1) {
          vertex.fromBufferAttribute(sourcePositions, point).applyQuaternion(rotation).add(offset);
          normal.fromBufferAttribute(sourceNormals, point).applyQuaternion(rotation).normalize();
          const targetOffset = (shellVertexOffset + point) * 3;
          positions[targetOffset] = vertex.x;
          positions[targetOffset + 1] = vertex.y;
          positions[targetOffset + 2] = vertex.z;
          normals[targetOffset] = normal.x;
          normals[targetOffset + 1] = normal.y;
          normals[targetOffset + 2] = normal.z;
          colors[targetOffset] = 1;
          colors[targetOffset + 1] = 1;
          colors[targetOffset + 2] = 1;
        }

        const sourceIndices = source.index.array;
        const indexOffset = shellIndex * indicesPerShell;
        for (let index = 0; index < indicesPerShell; index += 1) {
          indices[indexOffset + index] = shellVertexOffset + sourceIndices[index];
        }

        source.dispose();
        shellIndex += 1;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    color: "#f3e8d2",
    vertexColors: true,
    roughness: 0.74,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
  });
  return new THREE.Mesh(geometry, material);
}

function createSparseField() {
  const divisions = 4;
  const shellsPerAxis = divisions + 1;
  const targetSize = 0.5;
  const samples = [];

  for (let x = 0; x < shellsPerAxis; x += 1) {
    for (let y = 0; y < shellsPerAxis; y += 1) {
      for (let z = 0; z < shellsPerAxis; z += 1) {
        const params = {
          whorlExpansion: x === 0 ? 1.0001 : 10 ** ((x / divisions) * W_LOG_MAX),
          translation: (y / divisions) * T_MAX,
          axisDistance: (z / divisions) * D_MAX,
        };
        samples.push({ params, position: morphospaceCoordinates(params) });
      }
    }
  }

  const preservedSamples = new Set();
  for (const name of PRESET_ORDER) {
    const preset = PRESETS[name];
    const target = morphospaceCoordinates(preset);
    let nearestIndex = -1;
    let nearestDistance = Infinity;
    samples.forEach((sample, index) => {
      if (preservedSamples.has(index)) return;
      const distance = sample.position.distanceToSquared(target);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    preservedSamples.add(nearestIndex);
  }

  const group = new THREE.Group();
  const sphereGeometry = new THREE.SphereGeometry(0.045, 12, 8);
  const sphereMaterial = new THREE.MeshStandardMaterial({
    color: "#d8d1c4",
    roughness: 0.74,
    metalness: 0,
    transparent: true,
  });
  const spheres = new THREE.InstancedMesh(
    sphereGeometry,
    sphereMaterial,
    samples.length - preservedSamples.size,
  );
  const transform = new THREE.Object3D();
  let sphereIndex = 0;

  samples.forEach((sample, index) => {
    if (preservedSamples.has(index)) return;
    transform.position.copy(sample.position);
    transform.updateMatrix();
    spheres.setMatrixAt(sphereIndex, transform.matrix);
    sphereIndex += 1;
  });
  spheres.instanceMatrix.needsUpdate = true;
  group.add(spheres);

  const presetMaterial = new THREE.MeshStandardMaterial({
    color: "#f3e8d2",
    vertexColors: true,
    roughness: 0.74,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
  });
  for (const name of PRESET_ORDER) {
    const params = {
      ...PRESETS[name],
      sections: 30,
      aperturePoints: 32,
      targetSize,
    };
    const data = createShell(params);
    data.geometry.setDrawRange(0, data.geometry.index.count);
    const shell = new THREE.Mesh(data.geometry, presetMaterial);
    shell.position.copy(morphospaceCoordinates(PRESETS[name]));
    group.add(shell);
  }

  return group;
}

/**
 * Build a 5 × 5 × 5 sample of actual shell meshes across Raup's parameter cube.
 */
export function createMorphospace() {
  const group = new THREE.Group();
  group.position.set(0.78, 0.1, 0);
  group.scale.setScalar(0.7);

  const cubeFrame = new THREE.Group();
  const labels = new THREE.Group();
  addCubeFrame(cubeFrame);
  addAxisLabels(labels);
  const shellField = createShellField();
  const sparseField = createSparseField();
  sparseField.visible = false;
  group.add(cubeFrame, labels, shellField, sparseField);

  const sparseMaterials = new Set();
  sparseField.traverse((object) => {
    if (!object.material) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      sparseMaterials.add(material);
    }
  });

  let sparseMix = 0;
  let sparseStart = 0;
  let sparseTarget = 0;
  let sparseElapsed = 0;
  const sparseDuration = 0.9;

  function applySparseMix() {
    shellField.material.opacity = 1 - sparseMix;
    for (const material of sparseMaterials) material.opacity = sparseMix;
    shellField.visible = sparseMix < 1;
    sparseField.visible = sparseMix > 0;
  }

  return {
    group,
    setSparse(enabled, immediate = false) {
      const target = enabled ? 1 : 0;
      if (!immediate && target === sparseTarget) return;

      sparseTarget = target;
      if (immediate) {
        sparseMix = target;
        applySparseMix();
        return;
      }

      sparseStart = sparseMix;
      sparseElapsed = 0;
      shellField.visible = true;
      sparseField.visible = true;
    },
    setXRay(enabled) {
      labels.visible = !enabled;
      for (const field of [shellField, sparseField]) {
        field.traverse((object) => {
          if (object.material) {
            object.material.wireframe = enabled;
            object.material.needsUpdate = true;
          }
        });
      }
    },
    update(delta) {
      if (sparseMix !== sparseTarget) {
        sparseElapsed = Math.min(sparseElapsed + delta, sparseDuration);
        const progress = sparseElapsed / sparseDuration;
        const eased = progress * progress * (3 - 2 * progress);
        sparseMix = THREE.MathUtils.lerp(sparseStart, sparseTarget, eased);
        applySparseMix();
      }
      group.rotation.y += delta * 0.045;
    },
  };
}

export { CUBE_SIZE, W_LOG_MAX, D_MAX, T_MAX, TWO_PI };
