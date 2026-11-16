import * as THREE from "three";

const TWO_PI = Math.PI * 2;

/** Cheap deterministic 2D hash in [0, 1); used for the fine surface grain. */
function hash2(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Height field shared by the normal and roughness maps.
 *
 * The shell's UVs run `u` around the aperture and `v` along growth, so the
 * spiral micro-ribs are vertical stripes and the growth lines are horizontal
 * ones. Every term uses an integer frequency across the canvas so the texture
 * tiles seamlessly in both directions.
 */
function buildHeightField(size) {
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const ribs = Math.pow(Math.abs(Math.sin(u * TWO_PI * 48)), 1.6);
      const lines = Math.pow(Math.abs(Math.sin(v * TWO_PI * 72)), 1.8);
      const grain = hash2(x, y) * 0.35 + hash2(x * 0.5, y * 0.5) * 0.25;
      height[y * size + x] = ribs * 0.5 + lines * 0.3 + grain * 0.2;
    }
  }

  return height;
}

/**
 * A tiling normal map that adds fine spiral ribs, growth lines and grain to
 * the swept surface without more geometry.
 */
export function createNormalMap(size = 512, strength = 2.2) {
  const height = buildHeightField(size);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const ym = (y - 1 + size) % size;
      const yp = (y + 1) % size;
      const dx = (height[y * size + xp] - height[y * size + xm]) * strength;
      const dy = (height[yp * size + x] - height[ym * size + x]) * strength;

      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;

      const offset = (y * size + x) * 4;
      data[offset] = (nx * 0.5 + 0.5) * 255;
      data[offset + 1] = (ny * 0.5 + 0.5) * 255;
      data[offset + 2] = (nz * 0.5 + 0.5) * 255;
      data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * A roughness map so ridge crests catch a little more light than the troughs,
 * which stops the shell from reading as a single flat, plastic surface.
 */
export function createRoughnessMap(size = 256) {
  const height = buildHeightField(size);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);
  const data = image.data;

  for (let index = 0; index < size * size; index += 1) {
    const value = THREE.MathUtils.clamp(0.74 + (0.5 - height[index]) * 0.42, 0, 1);
    const grey = value * 255;
    data[index * 4] = grey;
    data[index * 4 + 1] = grey;
    data[index * 4 + 2] = grey;
    data[index * 4 + 3] = 255;
  }

  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * A soft warm/cool studio environment, pre-filtered for PBR reflections. It
 * gives the shell a gentle nacre-like sheen; the scene background stays black.
 */
export function createEnvironment(renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#4a3623");
  gradient.addColorStop(0.45, "#15120d");
  gradient.addColorStop(1, "#050506");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(150, 70, 0, 150, 70, 190);
  glow.addColorStop(0, "rgba(255, 214, 158, 0.85)");
  glow.addColorStop(1, "rgba(255, 214, 158, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(texture).texture;
  texture.dispose();
  pmrem.dispose();
  return environment;
}

/** Convenience bundle for the shell material. */
export function createShellTextures() {
  return {
    normalMap: createNormalMap(),
    roughnessMap: createRoughnessMap(),
  };
}
