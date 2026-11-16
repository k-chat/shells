import * as THREE from "three";
import { APERTURE_DEFAULTS, createApertureProfile } from "./aperture.js";
import {
  RAUP_DEFAULTS,
  createNormalizedTransform,
  growthRidgeAt,
  lipFlareAt,
  localFrame,
  referenceRadius,
  spiralAt,
  spiralRibAt,
  spiralRadius,
  taperAt,
  thetaAt,
  totalTheta,
  verticalOffset,
} from "./growth.js";

const TWO_PI = Math.PI * 2;

/**
 * Outward unit normal at every sample of a closed profile. Taken from the
 * neighbouring samples so it follows the aperture's real outline (tilt, suture
 * groove and all) instead of a circle approximation.
 */
function apertureProfileNormals(profile) {
  const count = profile.length;
  const normals = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const previous = profile[(index - 1 + count) % count];
    const next = profile[(index + 1) % count];
    const tangentX = next.x - previous.x;
    const tangentY = next.y - previous.y;
    const length = Math.hypot(tangentX, tangentY) || 1;
    // Counter-clockwise profile: (ty, -tx) points outward.
    normals[index] = new THREE.Vector2(tangentY / length, -tangentX / length);
  }

  return normals;
}

function apertureShape(params) {
  return {
    aspect: params.apertureAspect ?? APERTURE_DEFAULTS.aspect,
    tilt: params.apertureTilt ?? APERTURE_DEFAULTS.tilt,
  };
}

function resolve(params) {
  return { ...RAUP_DEFAULTS, ...params };
}

function normalizedPoint(point, transform, target) {
  target.set(
    (point.x - transform.center.x) * transform.scale,
    (point.y - transform.center.y) * transform.scale,
    (point.z - transform.center.z) * transform.scale,
  );
  return target;
}

/**
 * Sweep Raup's generating curve around the coiling axis.
 *
 * Each ring is one aperture section in the radial/vertical plane. Adjacent
 * rings are joined with two triangles per sample; the section ordering is
 * preserved so the vertex colours line up with the premultiplied pigment map.
 */
export function createShell(params = RAUP_DEFAULTS, pigmentColors = null) {
  const p = resolve(params);
  const { sections, aperturePoints, targetSize } = p;
  const maxTheta = totalTheta(p);
  const profile = createApertureProfile(aperturePoints, apertureShape(p));
  const profileNormals = apertureProfileNormals(profile);
  const vertexCount = (sections + 1) * aperturePoints;

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(sections * aperturePoints * 6);

  const baseColor = new THREE.Color("#d7a96f");
  const hasPigment = pigmentColors && pigmentColors.length >= vertexCount * 3;

  for (let section = 0; section <= sections; section += 1) {
    const progress = section / sections;
    const theta = progress * maxTheta;
    const radius = spiralRadius(theta, p);
    const reference = referenceRadius(theta, p);
    const height = verticalOffset(theta, p);
    const taper = taperAt(progress, p);
    const flare = lipFlareAt(progress, p);
    const growthRidge = growthRidgeAt(progress, p);
    const sectionScale = p.apertureScale * radius * taper;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    for (let point = 0; point < aperturePoints; point += 1) {
      const phi = (point / aperturePoints) * TWO_PI;
      const lip = 1 + (flare - 1) * Math.max(0, Math.cos(phi));
      const scale = sectionScale * lip;
      const local = profile[point];
      const normal = profileNormals[point];

      // Raised relief: displace along the profile's outward normal so the
      // ridges protrude from the tube instead of merely resizing it.
      const ridge = spiralRibAt(phi, theta, p) + growthRidge;
      const offset = (section * aperturePoints + point) * 3;

      // Raup's generating curve: x is radial, y is vertical. Rotating the
      // radial coordinate around the coiling axis sweeps the tube.
      const radial = reference + (local.x + normal.x * ridge) * scale;

      positions[offset] = radial * cos;
      positions[offset + 1] = height + (local.y + normal.y * ridge) * scale;
      positions[offset + 2] = radial * sin;

      const uvOffset = (section * aperturePoints + point) * 2;
      uvs[uvOffset] = point / aperturePoints;
      uvs[uvOffset + 1] = progress;

      if (hasPigment) {
        colors[offset] = pigmentColors[offset];
        colors[offset + 1] = pigmentColors[offset + 1];
        colors[offset + 2] = pigmentColors[offset + 2];
      } else {
        const warmth = 0.82 + 0.18 * progress;
        colors[offset] = baseColor.r * warmth;
        colors[offset + 1] = baseColor.g * warmth;
        colors[offset + 2] = baseColor.b * warmth;
      }
    }
  }

  const transform = createNormalizedTransform(positions, targetSize);
  for (let offset = 0; offset < positions.length; offset += 3) {
    positions[offset] = (positions[offset] - transform.center.x) * transform.scale;
    positions[offset + 1] = (positions[offset + 1] - transform.center.y) * transform.scale;
    positions[offset + 2] = (positions[offset + 2] - transform.center.z) * transform.scale;
  }

  let index = 0;
  for (let section = 0; section < sections; section += 1) {
    const row = section * aperturePoints;
    const nextRow = row + aperturePoints;
    for (let point = 0; point < aperturePoints; point += 1) {
      const nextPoint = (point + 1) % aperturePoints;
      const a = row + point;
      const b = row + nextPoint;
      const c = nextRow + point;
      const d = nextRow + nextPoint;

      indices[index] = a;
      indices[index + 1] = b;
      indices[index + 2] = d;
      indices[index + 3] = a;
      indices[index + 4] = d;
      indices[index + 5] = c;
      index += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.setDrawRange(0, 0);

  return {
    geometry,
    sections,
    aperturePoints,
    maxTheta,
    turns: maxTheta / TWO_PI,
    transform,
    params: p,
  };
}

/** The glowing path of the growing tube centre. */
export function createSpiralLine(params = RAUP_DEFAULTS, transform) {
  const p = resolve(params);
  const count = 700;
  const maxTheta = totalTheta(p);
  const points = new Array(count + 1);
  const scratch = new THREE.Vector3();

  for (let index = 0; index <= count; index += 1) {
    const raw = spiralAt((index / count) * maxTheta, p);
    points[index] = normalizedPoint(raw, transform, scratch).clone();
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xf2bd80,
    transparent: true,
    opacity: 0.72,
  });
  const line = new THREE.Line(geometry, material);
  line.geometry.setDrawRange(0, 0);
  return line;
}

/** Unit aperture outline; position/scale are applied from the current growth. */
export function createApertureRing(params = RAUP_DEFAULTS) {
  const p = resolve(params);
  const profile = createApertureProfile(p.aperturePoints, apertureShape(p));
  const geometry = new THREE.BufferGeometry().setFromPoints(
    profile.map((point) => new THREE.Vector3(point.x, point.y, 0)),
  );

  const warm = new THREE.Color("#ffd5a5");
  const colors = new Float32Array(profile.length * 3);
  for (let index = 0; index < profile.length; index += 1) {
    colors[index * 3] = warm.r;
    colors[index * 3 + 1] = warm.g;
    colors[index * 3 + 2] = warm.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
  });
  const ring = new THREE.LineLoop(geometry, material);
  ring.visible = false;
  return ring;
}

/**
 * A dark disc inside the final aperture. Without it the open end reads as a
 * hollow tube; with it the shell gets the deep, shadowed mouth of a specimen.
 */
export function createApertureCap(params = RAUP_DEFAULTS) {
  const p = resolve(params);
  const profile = createApertureProfile(p.aperturePoints, apertureShape(p));
  const positions = new Float32Array((profile.length + 1) * 3);
  const indices = new Uint16Array(profile.length * 3);

  for (let index = 0; index < profile.length; index += 1) {
    const offset = (index + 1) * 3;
    positions[offset] = profile[index].x;
    positions[offset + 1] = profile[index].y;
    positions[offset + 2] = 0;

    const next = (index + 1) % profile.length;
    const triangle = index * 3;
    indices[triangle] = 0;
    indices[triangle + 1] = index + 1;
    indices[triangle + 2] = next + 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    color: "#180d09",
    roughness: 0.97,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

/**
 * Small helper used by the story readout: the angular position of a growth
 * progress value, preserving the same mapping as the mesh.
 */
export function thetaForProgress(progress, params = RAUP_DEFAULTS) {
  return thetaAt(progress, resolve(params));
}

/** Transforms the aperture ring onto the current growing edge. */
export function placeAperture(object, progress, params, transform, scaleFactor = 1) {
  const p = resolve(params);
  const clamped = THREE.MathUtils.clamp(progress, 0.004, 1);
  const theta = clamped * totalTheta(p);
  const rawCenter = spiralAt(theta, p);
  const frame = localFrame(theta);
  const radius = spiralRadius(theta, p);

  object.position.set(
    (rawCenter.x - transform.center.x) * transform.scale,
    (rawCenter.y - transform.center.y) * transform.scale,
    (rawCenter.z - transform.center.z) * transform.scale,
  );
  object.quaternion.setFromRotationMatrix(frame);
  object.scale.setScalar(
    transform.scale
      * p.apertureScale
      * radius
      * taperAt(clamped, p)
      * lipFlareAt(clamped, p)
      * scaleFactor,
  );
  return object;
}
