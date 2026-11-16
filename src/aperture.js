import * as THREE from "three";

/**
 * The aperture is a closed, slightly asymmetric D/egg profile in the local
 * XY plane: x points radially outward, y points up. Cubic curves from the
 * field notes are approximated here with a smooth analytic loop so the
 * profile can be sampled uniformly and modulated without seams.
 */
export const APERTURE_DEFAULTS = Object.freeze({
  aspect: 0.6,
  asymmetry: 0.14,
  outerBias: 0.06,
  tilt: -0.12,
  grooveDepth: 0.04,
  grooveWidth: 0.42,
});

export function createApertureProfile(count, options = {}) {
  const settings = { ...APERTURE_DEFAULTS, ...options };
  const cosTilt = Math.cos(settings.tilt);
  const sinTilt = Math.sin(settings.tilt);
  const points = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const phi = (index / count) * Math.PI * 2;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);

    // Rounded outer lip, narrower inner (columellar) side.
    let x = cos + settings.outerBias * (0.5 + 0.5 * cos);
    let y = settings.aspect * sin * (1 + settings.asymmetry * cos);

    // Suture groove where one whorl meets the next.
    const distance = (phi - Math.PI / 2) / settings.grooveWidth;
    y -= settings.grooveDepth * Math.exp(-distance * distance) * Math.max(0, sin);

    // A little tilt keeps the aperture from looking mechanically upright.
    points[index] = new THREE.Vector2(
      x * cosTilt - y * sinTilt,
      x * sinTilt + y * cosTilt,
    );
  }

  return points;
}

export function transformAperture(points, center, frame, scale) {
  return points.map((point) => (
    new THREE.Vector3(point.x * scale, point.y * scale, 0)
      .applyMatrix4(frame)
      .add(center)
  ));
}
