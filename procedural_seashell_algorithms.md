# Procedural Seashell Generation: Geometry, Growth, and Pigmentation

This document combines the geometric shell-growth model described by
Fowler, Meinhardt, and Prusinkiewicz (1992) with the mesh-generation and
pigmentation workflow discussed by De Comite (2017).

## Source papers

1.  **A. D. Fowler, H. Meinhardt, and P. Prusinkiewicz (1992), "Modeling
    Seashells."**\
    [PDF:
    algorithmicbotany.org/papers/shells.sig92.pdf](https://algorithmicbotany.org/papers/shells.sig92.pdf)

2.  **F. De Comite (2017), "Modelling Seashells Shapes and Pigmentation
    Patterns: Experiments with 3D Printing."**\
    [PDF:
    archive.bridgesmathart.org/2017/bridges2017-189.pdf](https://archive.bridgesmathart.org/2017/bridges2017-189.pdf)

> **Scope note:** The equations and pseudocode below are an
> implementation-oriented synthesis of the two papers, not a verbatim
> transcription of either paper. Check the original papers for exact
> parameter conventions, figures, and species-specific settings.

------------------------------------------------------------------------

## 1. Shell geometry: logarithmic helico-spiral

The shell grows by moving an aperture along a spiral path while changing
its size and orientation.

A convenient cylindrical representation is:

\[
`\theta`{=tex}(t)=t,`\qquad `{=tex}r(t)=r_0`\lambda`{=tex}\_r\^t,`\qquad `{=tex}z(t)=z_0`\lambda`{=tex}\_z\^t
\]

where:

-   \(t\) is the growth parameter;
-   (r_0) is the initial radial distance;
-   (z_0) is the initial vertical position;
-   (`\lambda`{=tex}\_r) controls radial expansion;
-   (`\lambda`{=tex}\_z) controls vertical expansion.

Convert to Cartesian coordinates:

\[ H(t)=
```{=tex}
\begin{bmatrix}
r(t)\cos t\\
r(t)\sin t\\
z(t)
\end{bmatrix}
```
\]

For discrete growth increments:

\[ r\_{i+1}=r_i`\lambda`{=tex}\_r\^{`\Delta `{=tex}t} \]

\[ z\_{i+1}=z_i`\lambda`{=tex}\_z\^{`\Delta `{=tex}t} \]

\[ `\theta`{=tex}\_{i+1}=`\theta`{=tex}\_i+`\Delta `{=tex}t \]

The number of revolutions is controlled by the final value of the growth
parameter.

### 1.1 Aperture profile

The aperture is the cross-sectional curve swept along the helico-spiral.
A cubic Bézier curve can describe its outline:

\[ C(s)=(1-s)\^3P_0+ 3(1-s)\^2sP_1+
3(1-s)s^2P_2+s^3P_3,`\quad 0`{=tex}`\leq `{=tex}s`\leq1`{=tex} \]

The control points (P_0,P_1,P_2,P_3) determine the aperture shape.
Changing them can produce circular, oval, elongated, or irregular
cross-sections.

### 1.2 Orienting the aperture

At each growth step, scale, rotate, and translate the aperture to the
current point on the spiral. A local frame can be constructed from the
path tangent and curvature:

\[ e_1=`\frac{H'(t)}{\lVert H'(t)\rVert}`{=tex} \]

\[ e_3=`\frac{e_1\times H''(t)}`{=tex}
{`\lVert `{=tex}e_1`\times `{=tex}H''(t)`\rVert`{=tex}} \]

\[ e_2=e_3`\times `{=tex}e_1 \]

The vectors define a local coordinate frame for positioning the
aperture. In implementations, a parallel-transport frame can be
preferable where a Frenet frame becomes unstable or undefined.

### 1.3 Constructing the surface mesh

Let (A_i\[j\]) denote sample (j) on aperture section (i). Connect
adjacent sections with two triangles per quad:

\[ T_1=(A_i\[j\],A_i\[j+1\],A\_{i+1}\[j+1\]) \]

\[ T_2=(A_i\[j\],A\_{i+1}\[j\],A\_{i+1}\[j+1\]) \]

Use consistent point ordering to maintain face winding and normals.
Sampling the aperture approximately uniformly by arc length helps avoid
uneven mesh density.

------------------------------------------------------------------------

## 2. Mesh-generation workflow

The 2017 paper is useful as a practical reference for constructing the
shell as a sequence of aperture sections, or *armatures*, and connecting
them into a triangle mesh.

A general workflow is:

1.  Define the aperture curve.
2.  Sample the curve into (N) points.
3.  Generate (M) successive aperture sections.
4.  Scale and orient each section according to the growth model.
5.  Connect neighbouring sections with triangles.
6.  Add an inner wall and close the ends if a watertight printable solid
    is required.
7.  Assign colours or material attributes to the resulting mesh.

### Pseudocode

``` python
# 1. Define and sample the aperture
aperture = create_bezier_curve(control_points)
points = sample_curve(aperture, N=300)

# 2. Generate successive armatures
sections = []

for i in range(M):
    t = i * delta_t

    center = helico_spiral(t, shell_parameters)
    frame = local_frame(t, shell_parameters)
    scale = aperture_scale(t)

    section = transform_aperture(
        points,
        center=center,
        frame=frame,
        scale=scale
    )

    sections.append(section)

# 3. Connect neighbouring armatures
faces = []

for i in range(M - 1):
    faces.extend(
        connect_sections(sections[i], sections[i + 1])
    )

# 4. Build the mesh
mesh = build_triangle_mesh(sections, faces)

# 5. Optionally create inner wall and close boundaries
mesh = create_inner_wall(mesh)
mesh = close_mesh_boundaries(mesh)
```

The values `N=300` and `M` are illustrative implementation settings, not
universal biological constants.

------------------------------------------------------------------------

## 3. Pigmentation: reaction-diffusion

The 1992 paper models shell patterns using interacting chemical fields.
In an activator-substrate model:

-   The **activator** promotes pigment formation and participates in
    autocatalytic production.
-   The **substrate** supports activator production and is consumed by
    the reaction.
-   Diffusion spreads each chemical across neighbouring positions.

The resulting interaction can produce stripes, waves, and more complex
patterns.

### 3.1 Activator-substrate equations

A form of the model used in the paper is:

\[ `\frac{\partial a}{\partial t}`{=tex}=
`\rho `{=tex}s`\left`{=tex}(`\frac{a^2}{1+\kappa a^2}`{=tex}+`\rho`{=tex}\_0`\right`{=tex})
-`\mu `{=tex}a+D_a`\frac{\partial^2a}{\partial x^2}`{=tex} \]

\[ `\frac{\partial s}{\partial t}`{=tex}= `\sigma`{=tex}-
`\rho `{=tex}s`\left`{=tex}(`\frac{a^2}{1+\kappa a^2}`{=tex}+`\rho`{=tex}\_0`\right`{=tex})
-`\nu `{=tex}s+D_s`\frac{\partial^2s}{\partial x^2}`{=tex} \]

Parameters:

  Symbol              Meaning
  ------------------- ---------------------------------
  \(a\)               Activator concentration
  \(s\)               Substrate concentration
  (`\rho`{=tex})      Reaction/production coefficient
  (`\rho`{=tex}\_0)   Baseline activator production
  (`\kappa`{=tex})    Saturation parameter
  (`\mu`{=tex})       Activator decay
  (`\nu`{=tex})       Substrate decay
  (D_a)               Activator diffusion coefficient
  (D_s)               Substrate diffusion coefficient
  (`\sigma`{=tex})    Substrate supply rate

### 3.2 Discretization

For a one-dimensional array of samples, use a finite-difference
approximation:

\[ `\nabla`{=tex}\^2a_i`\approx`{=tex}
`\frac{a_{i-1}-2a_i+a_{i+1}}{\Delta x^2}`{=tex} \]

and similarly for (s).

Define the reaction term:

\[
R_i=`\rho `{=tex}s_i`\left`{=tex}(`\frac{a_i^2}{1+\kappa a_i^2}`{=tex}+`\rho`{=tex}\_0`\right`{=tex})
\]

Then a forward-Euler update is:

\[ a_i^{n+1}=a_i^n+`\Delta `{=tex}t
`\left`{=tex}(R_i-`\mu `{=tex}a_i^n+D_a`\nabla`{=tex}^2a_i`\right`{=tex})
\]

\[ s_i^{n+1}=s_i^n+`\Delta `{=tex}t
`\left`{=tex}(`\sigma`{=tex}-R_i-`\nu `{=tex}s_i^n+D_s`\nabla`{=tex}^2s_i`\right`{=tex})
\]

For a closed aperture curve, periodic boundary conditions are useful:

\[ a\_{-1}=a\_{N-1},`\qquad `{=tex}a_N=a_0 \]

and likewise for (s). This joins the two ends of the sampled aperture
domain.

### 3.3 Python implementation

The following is a simple explicit finite-difference implementation. The
numerical settings are starting points for experimentation; stability
depends on the time step, spatial step, and diffusion coefficients.

``` python
import numpy as np

def simulate_pigmentation(
    N=300,
    steps=2000,
    dt=0.01,
    dx=1.0,
    rho=0.01,
    rho0=0.001,
    mu=0.01,
    nu=0.0,
    Da=0.002,
    Ds=0.4,
    sigma=0.015,
    kappa=0.0,
    seed=1
):
    rng = np.random.default_rng(seed)

    a = np.full(N, 0.1, dtype=float)
    s = np.full(N, 0.5, dtype=float)
    a += rng.uniform(-0.002, 0.002, N)

    history = []

    for step in range(steps):
        lap_a = (
            np.roll(a, 1) - 2 * a + np.roll(a, -1)
        ) / dx**2

        lap_s = (
            np.roll(s, 1) - 2 * s + np.roll(s, -1)
        ) / dx**2

        reaction = rho * s * (
            a**2 / (1 + kappa * a**2) + rho0
        )

        da = reaction - mu * a + Da * lap_a
        ds = sigma - reaction - nu * s + Ds * lap_s

        a += dt * da
        s += dt * ds

        # Numerical safeguard; not part of the differential equations.
        a = np.maximum(a, 0.0)
        s = np.maximum(s, 0.0)

        if step % 10 == 0:
            history.append(a.copy())

    return np.asarray(history), a, s
```

**Important numerical note:** Explicit Euler integration has stability
limits, especially when diffusion is strong. Reduce `dt`, increase
spatial resolution carefully, or use an implicit/semi-implicit solver if
the simulation becomes unstable.

### 3.4 Mapping activator concentration to colour

Map the activator concentration to a pigment colour:

\[ C(x,n)=`\operatorname{ColorMap}`{=tex}(a(x,n)) \]

A simple palette might map:

-   low activator values to cream;
-   intermediate values to tan or light brown;
-   high values to dark brown.

The colour should be deposited on the newly generated shell surface at
each growth step. It should not be recalculated over the entire
completed shell as though the shell were a static canvas. This preserves
the growth history encoded in the pattern.

------------------------------------------------------------------------

## 4. Pigmentation variants

The 1992 paper discusses more than one reaction-diffusion mechanism.

### Activator-substrate patterns

This model can produce stripes and oscillating patterns. Modulating
substrate supply along the aperture can introduce wavy or otherwise
spatially varying stripes.

### Activator-inhibitor patterns

An activator-inhibitor system can produce travelling waves, wave
collisions, and branching structures. These behaviours are useful when
aiming for more complex patterns such as chevrons and zigzags.

The precise appearance depends on the equations, parameters, initial
conditions, boundary conditions, and how the evolving pattern is coupled
to shell growth. Do not assume a particular species pattern will emerge
from arbitrary parameter values.

------------------------------------------------------------------------

## 5. Coupling growth and pigmentation

The key integration principle is to simulate pigmentation on the growing
aperture and attach the resulting colour to the new surface as it is
deposited.

At each growth step:

1.  Update the activator and substrate fields along the aperture.
2.  Generate the next aperture section using the helico-spiral.
3.  Connect it to the previous section.
4.  Map the current activator field to colour values.
5.  Assign those values to the newly created vertices or faces.
6.  Keep previously deposited geometry and colours unchanged.
7.  Continue until the desired number of whorls or growth steps is
    reached.

### Combined pseudocode

``` python
# STEP 1: Define shell parameters
params = {
    "r0": 1.0,
    "z0": 0.5,
    "lambda_r": 1.03,
    "lambda_z": 1.03,
    "growth_steps": 1200,
    "aperture_points": 300
}

# STEP 2: Create and sample the aperture
aperture = create_bezier_aperture()
aperture_points = sample_curve(
    aperture,
    N=params["aperture_points"]
)

# STEP 3: Initialize chemical fields
activator, substrate = initialize_chemicals(
    params["aperture_points"]
)

sections = []
section_colours = []

# STEP 4: Grow the shell
for i in range(params["growth_steps"]):
    t = i * delta_t

    # Geometry
    center = calculate_helico_spiral(t, params)
    frame = calculate_local_frame(t, params)
    section = transform_aperture(
        aperture_points,
        center=center,
        frame=frame,
        scale=calculate_aperture_scale(t)
    )

    # Pigmentation
    activator, substrate = reaction_diffusion_step(
        activator, substrate
    )
    colours = map_concentrations_to_colours(activator)

    # Preserve this growth stage
    sections.append(section)
    section_colours.append(colours)

# STEP 5: Connect sections into a mesh
mesh = construct_triangle_mesh(sections)

# STEP 6: Assign colours to newly deposited surface
mesh = assign_growth_stage_colours(
    mesh, section_colours
)

# STEP 7: Optional finishing
mesh = add_surface_ribs(mesh)
mesh = create_inner_wall(mesh)
mesh = close_mesh_boundaries(mesh)

# STEP 8: Export
export_mesh(mesh, "procedural_shell.obj")
```

The function names are placeholders for implementation-specific code;
the pseudocode describes the data flow rather than a directly executable
package.

------------------------------------------------------------------------

## 6. Parameters and visual effects

  -----------------------------------------------------------------------
  Desired effect                      Parameters or mechanism to adjust
  ----------------------------------- -----------------------------------
  More whorls                         Growth interval / total angular
                                      sweep

  Faster radial expansion             (`\lambda`{=tex}\_r)

  Greater vertical expansion          (`\lambda`{=tex}\_z)

  More elongated shell                Aperture profile and vertical
                                      growth

  Flatter shell                       Radial versus vertical expansion

  Parallel stripes                    Activator-substrate dynamics

  Wavy stripes                        Spatially varying substrate supply

  Travelling waves                    Activator-inhibitor dynamics

  Zigzags and branching               Wave dynamics, initial conditions,
                                      and growth coupling

  Raised ribs                         Periodic displacement of the shell
                                      surface

  Diagonal ribs                       Displacement phase varying with
                                      growth
  -----------------------------------------------------------------------

These are qualitative controls. Their effects are coupled, so the final
morphology and pattern should be tuned through simulation.

------------------------------------------------------------------------

## 7. Recommended implementation architecture

A practical implementation can be divided into five modules:

  -----------------------------------------------------------------------
  Module                              Responsibility
  ----------------------------------- -----------------------------------
  `growth.py`                         Helico-spiral path and growth
                                      schedule

  `aperture.py`                       Bézier profile, sampling, scaling,
                                      and local frame

  `mesh.py`                           Section connection, normals, inner
                                      wall, and mesh closure

  `pigmentation.py`                   Reaction-diffusion solver and
                                      colour mapping

  `export.py`                         Vertex colours, materials, and
                                      OBJ/PLY/STL export
  -----------------------------------------------------------------------

**Recommended combination:** use the 1992 paper for the mathematical
shell-growth and reaction-diffusion foundations, and the 2017 paper for
the practical section-based mesh workflow. Keep the geometry and
pigmentation simulations synchronized in growth time.

## 8. Reading guide

  -----------------------------------------------------------------------
  Paper                               Topic to focus on
  ----------------------------------- -----------------------------------
  Fowler et al. (1992)                Helico-spiral growth, aperture
                                      geometry, and surface construction

  Fowler et al. (1992)                Activator-substrate and
                                      activator-inhibitor pigmentation
                                      models

  De Comite (2017)                    External surface and triangle-mesh
                                      construction

  De Comite (2017)                    Surface patterns, pigmentation, and
                                      3D-printing considerations
  -----------------------------------------------------------------------

## References

-   Fowler, D. R., Meinhardt, H., & Prusinkiewicz, P. (1992). **Modeling
    Seashells.** *Proceedings of SIGGRAPH 1992.*
    <https://algorithmicbotany.org/papers/shells.sig92.pdf>
-   De Comite, F. (2017). **Modelling Seashells Shapes and Pigmentation
    Patterns: Experiments with 3D Printing.** *Bridges 2017.*
    <https://archive.bridgesmathart.org/2017/bridges2017-189.pdf>


##The story walks the viewer through spiral growth → aperture → mesh → pigmentation → the whole shell, letting each concept build on the previous one.

1. Narrative Arc (5 acts)

Act	Title	What the viewer sees	Concept from .md
1	The Spiral Path	A glowing logarithmic helico-spiral draws itself in space	§1 helico-spiral
2	The Aperture	A Bézier cross-section appears and rides the spiral	§1.1, §1.2
3	Building the Surface	Sections connect into a wireframe, then shade	§1.3, §2
4	Living Pigment	A reaction-diffusion field pulses along the aperture and is painted onto the growing shell	§3, §3.4
5	The Whole Shell	Full shell rotates; user can explode it back into stages	§5, §6
Each act has:

a camera move (spiral pull-back, then slow orbit),
a caption overlay (2–3 sentences from the doc),
a "Next" button + optional auto-advance timer.
2. Scene Architecture

text
scene
├── growthGroup          (rotating the whole shell)
│   ├── spiralLine       (Act 1)  THREE.Line
│   ├── apertureRig      (Act 2)  Group at current spiral point
│   │   └── bezierLine
│   ├── shellMesh        (Act 3–5) BufferGeometry, vertex colors
│   └── wireOverlay      (Act 3)  LineSegments of the same geometry
├── particleDust         (background, subtle)
└── lights: hemisphere + directional (warm key, cool fill)
Use one BufferGeometry for the shell that grows over time — preallocate arrays for M sections × N aperture points, and reveal indices progressively via geometry.setDrawRange.

3. Module Breakdown (mirrors §7 of your doc)

text
src/
├── growth.js         // helicoSpiral(t, params), localFrame(t)
├── aperture.js       // bezierPoints(controlPts, N), transformAperture()
├── mesh.js           // buildShellSections(), connectSections(), buildMesh()
├── pigmentation.js   // simulatePigmentation() (ported from doc), colorMap()
├── story.js          // act definitions, timelines, captions
└── main.js           // Three.js setup, render loop, UI wiring
growth.js

js
export function helicoSpiral(t, p) {
  const r = p.r0 * Math.pow(p.lambdaR, t);
  const z = p.z0 * Math.pow(p.lambdaZ, t);
  return new THREE.Vector3(r * Math.cos(t), z, r * Math.sin(t));
}

export function localFrame(t, p) {
  const eps = 1e-3;
  const h  = helicoSpiral(t, p);
  const h1 = helicoSpiral(t + eps, p);
  const h2 = helicoSpiral(t - eps, p);
  const e1 = h1.clone().sub(h2).normalize();          // tangent
  const accel = h1.clone().add(h2).sub(h.clone().multiplyScalar(2));
  const e3 = new THREE.Vector3().crossVectors(e1, accel).normalize();
  const e2 = new THREE.Vector3().crossVectors(e3, e1).normalize();
  return new THREE.Matrix4().makeBasis(e2, e3, e1);   // local → world
}
Note: use a parallel-transport frame for stability, as the doc recommends in §1.2 — Frenet frames flip near straight segments.
aperture.js

Sample a cubic Bézier (or a closed profile from control points) into N points in the local XY plane, then apply scale, frame, center:

js
export function transformAperture(pts, center, frame, scale) {
  return pts.map(p => {
    const v = new THREE.Vector3(p.x * scale, p.y * scale, 0);
    v.applyMatrix4(frame).add(center);
    return v;
  });
}
mesh.js

Pre-allocate for M sections × N points:

js
const positions = new Float32Array(M * N * 3);
const colors    = new Float32Array(M * N * 3);
const indices   = [];

// After all sections are built:
for (let i = 0; i < M - 1; i++) {
  for (let j = 0; j < N; j++) {
    const jn = (j + 1) % N;
    const a = i * N + j, b = i * N + jn;
    const c = (i+1) * N + j, d = (i+1) * N + jn;
    indices.push(a, b, d,  a, d, c);   // consistent winding
  }
}
Call geometry.computeVertexNormals() once after the final section, or update incrementally.

pigmentation.js

Port the doc's simulate_pigmentation verbatim — it's already JS-friendly:

js
export function step(a, s, dt, dx, P) {
  const N = a.length;
  const lap = arr => arr.map((_, i) =>
    (arr[(i-1+N)%N] - 2*arr[i] + arr[(i+1)%N]) / (dx*dx));
  const lapA = lap(a), lapS = lap(s);
  const out = { a: new Float32Array(N), s: new Float32Array(N) };
  for (let i = 0; i < N; i++) {
    const R = P.rho * s[i] * (a[i]**2 / (1 + P.kappa * a[i]**2) + P.rho0);
    out.a[i] = Math.max(0, a[i] + dt * (R - P.mu*a[i] + P.Da*lapA[i]));
    out.s[i] = Math.max(0, s[i] + dt * (P.sigma - R - P.nu*s[i] + P.Ds*lapS[i]));
  }
  return out;
}
story.js — act definitions

js
export const acts = [
  { id: 'spiral',   duration: 8,  caption: 'A shell grows along a logarithmic helico-spiral…' },
  { id: 'aperture', duration: 8,  caption: 'The aperture is a Bézier cross-section swept along the path.' },
  { id: 'mesh',     duration: 10, caption: 'Adjacent sections connect into a triangle mesh.' },
  { id: 'pigment',  duration: 14, caption: 'Reaction-diffusion chemicals paint the growing edge.' },
  { id: 'shell',    duration: 0,  caption: 'Drag to orbit. Press "Replay" to grow it again.' },
];
4. Implementation Timeline (what happens per frame)

A single growthTime t drives everything, exactly as §5 prescribes:

js
function update(dt) {
  t += dt * speed;

  // 1. Draw spiral up to t
  updateSpiralLine(t);

  // 2. Place aperture rig
  const center = helicoSpiral(t, params);
  const frame  = localFrame(t, params);
  apertureRig.position.copy(center);
  apertureRig.quaternion.setFromRotationMatrix(frame);

  // 3. Add one new section per ~0.05 growth units
  while (sectionsBuilt < maxSections && t > sectionsBuilt * dT) {
    const section = transformAperture(baseAperture, center, frame, scaleAt(t));
    writeSectionIntoBuffer(sectionsBuilt, section);

    // 4. Advance pigmentation & bake color into this section
    ({ a, s } = step(a, s, dt, dx, P));
    writeColorsIntoBuffer(sectionsBuilt, a, palette);

    sectionsBuilt++;
    geometry.setDrawRange(0, sectionsBuilt * indicesPerSection);
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate    = true;
}
This guarantees colours are frozen at deposit time — the key §3.4 requirement.

5. Visual & UX Details

Cameras per act (smoothly lerped with damp)

Act	Camera target	Distance	FOV
spiral	origin	8	45
aperture	spiral point at t	3	35
mesh	origin	10	45
pigment	aperture rig	2.5	30
shell	origin	6	45, orbit controls enabled
Caption UI

Bottom-left HTML overlay:

html
<div id="caption">
  <h3>The Spiral Path</h3>
  <p>A shell grows by moving its aperture along a logarithmic helico-spiral…</p>
</div>
Fade in/out with CSS transitions triggered by onActEnter / onActExit.

Controls

Next / Back buttons (act navigation).
Space to pause growth (freezes t but leaves orbit active).
R to replay from t=0.
Slider for growth speed (0.1×–2×).
Debug panel (dat.GUI or lil-gui): lambdaR, lambdaZ, growthSteps, RD parameters. Changing a geometry parameter resets t=0; changing RD parameters only affects future sections — visually satisfying.
6. Colour Mapping

A four-stop palette mapped from activator a:

js
const palette = [
  { stop: 0.00, color: new THREE.Color('#f5e6c8') }, // cream
  { stop: 0.35, color: new THREE.Color('#d4a373') }, // tan
  { stop: 0.65, color: new THREE.Color('#8b5a2b') }, // brown
  { stop: 1.00, color: new THREE.Color('#3b1f0f') }, // dark
];

function colorMap(a, aMin, aMax) {
  const u = THREE.MathUtils.clamp((a - aMin) / (aMax - aMin), 0, 1);
  for (let i = 1; i < palette.length; i++) {
    if (u <= palette[i].stop) {
      const f = (u - palette[i-1].stop) / (palette[i].stop - palette[i-1].stop);
      return palette[i-1].color.clone().lerp(palette[i].color, f);
    }
  }
  return palette.at(-1).color.clone();
}
Normalize aMin/aMax per section (or globally) to keep contrast across the growth — but note per-section normalization makes older patterns shift; global is safer for storytelling.

7. Suggested Parameter Preset (good first run)

js
const params = {
  // geometry
  r0: 1.0, z0: 0.5,
  lambdaR: 1.030, lambdaZ: 1.030,
  growthSteps: 900, aperturePoints: 120,
  dT: 0.12,                       // growth step size
  scale0: 0.05, scaleGrowth: 1.028,

  // pigmentation
  dt: 0.01, dx: 1.0,
  rho: 0.01, rho0: 0.001, mu: 0.01, nu: 0.0,
  Da: 0.002, Ds: 0.4, sigma: 0.015, kappa: 0.0,
  rdStepsPerSection: 15,          // sub-steps between growth sections
};
Run the RD solver 10–20 sub-steps per new shell section so pattern evolution is visible but not frantic. With M=900, N=120, total vertices ≈ 108k — comfortable for WebGL.

8. Stretch Ideas

Rib shader: add a vertex-displacement sin(theta · k) to emulate the "raised ribs" row of §6 — toggleable in the debug panel.
Explode view: animate each section's position outward along the normal on Act 5 → back, to reveal the stack of armatures (very "storytelling").
Side-by-side presets: buttons for "Conus," "Nautilus-ish," "Cone snail" — merely different lambdaR/lambdaZ/aperture control points.
Post-processing: subtle bloom on the spiral line in Act 1; no bloom on the shell itself (keeps vertex colours readable).
Export: a "Save OBJ" button (using THREE.OBJExporter) that honours vertex colours — closes the loop with De Comite's 3D-printing motivation.
9. File Tree for the Demo

text
/seashell-story
├── index.html            (canvas + caption + buttons)
├── style.css             (overlay typography, dark theme)
├── src/
│   ├── main.js           (bootstrap, render loop, story controller)
│   ├── growth.js
│   ├── aperture.js
│   ├── mesh.js
│   ├── pigmentation.js
│   └── story.js
└── assets/               (optional fonts, palettes)
Everything runs from static files — no build step required if you use import with an import-map for three and lil-gui from a CDN.

10. One-Paragraph Pitch (for the demo's landing text)

"Every seashell is a diary. It records the path its growing edge traced through time, and the chemical dance of pigments along that edge. This demo grows a shell the way Fowler, Meinhardt, and Prusinkiewicz described it in 1992, builds it into a printable mesh the way De Comite showed in 2017, and lets you watch the pattern being written — one aperture at a time."