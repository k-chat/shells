# One Rule, Three Numbers

A Node.js + Three.js scrollytelling demo of David Raup's 1966 shell-coiling model. One parametric rule grows a sea snail, a nautilus, a clam, a ram's horn, and an elephant's tusk — then opens the whole morphospace for exploration.

The story and parameter values come from [raup_s_shell_coiling_model_transcript_study_notes.md](./raup_s_shell_coiling_model_transcript_study_notes.md).

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, then scroll. The scene morphs continuously between specimens while the copy changes.

## The three numbers

Every shell is a tube accreted at its mouth. Raup described the resulting logarithmic spiral with three numbers:

| Number | Meaning | Effect in the story |
| --- | --- | --- |
| **W** | Whorl expansion per revolution | A nautilus multiplies its tube by 3 each turn. At 1,000,000 the tube cannot finish a revolution and becomes a clam valve. |
| **D** | Distance of the tube from the coiling axis | Near 0, whorls cover one another. At 0.38 the turns separate into a ram's horn; at 0.86 the shell opens into a tusk. |
| **T** | Drop along the axis per revolution | At 0 the shell stays flat (nautilus, clam, tusk). At 2.1 it stacks into a snail's tower. |

The sweep is:

```text
r(θ) = W^(θ / 2π)
R(θ) = r(θ) · (1 + D) / (1 − D)
y(θ) ∝ −T / (1 − D) · (r(θ) − 1)
```

A fixed presentation gain scales `T` so that the caption value 2.1 reads as a compact snail rather than a widely spaced corkscrew. The number of whorls is not a shape parameter: it comes from a fixed adult/birth growth span, `n = ln(span) / ln(W)`. That is why the same algorithm gives a 3.7-turn nautilus and a 0.3-turn clam.

The aperture is a closed D-shaped profile in Raup's radial/vertical plane, with a suture groove, a slight tilt, spiral ribs, growth-line ridges, an apex taper, and a final lip flare. The shell is one ring of aperture samples per growth step, joined into a triangle mesh and normalised to a fixed presentation size.

The pigment is a reaction–diffusion field baked into vertex colours once, then reused while the geometry changes. The glowing aperture ring samples the same field.

## The seven chapters

1. **One Rule** — a tube that grows only at its mouth.
2. **The Drop** — lower `T` to zero and the snail's tower lies down into a nautilus.
3. **The Widening** — raise `W` and the nautilus opens into a clam valve.
4. **The Distance** — move the tube away from the axis and the whorls separate into a ram's horn.
5. **Outside the Shell** — extreme `W` and `D` stretch the same tube into an elephant's tusk.
6. **The Cube** — Raup's morphospace: a 5 × 5 × 5 grid of generated shell meshes spanning the W, D, and T parameter ranges.
7. **The Bench** — live controls for `W`, `D`, and `T`, five presets, a random theoretical shell, and replay.

The cube chapter references Raup's functional explanation for the empty regions and Stephen Jay Gould's historical-contingency alternative.

## Explore the bench

- **W** uses a logarithmic slider from 1× to 1,000,000×.
- **D** and **T** use linear sliders over Raup's practical range.
- **Presets** snap the morph toward the five story specimens.
- **Random Shell** jumps to a theoretical form, often in a region no animal has occupied.
- **Replay** regrows the current form from its apex.

Drag the finished shell to rotate it. The lower-left panel follows the active scene: it shows that scene's W, D, and T (highlighting the parameter the copy is changing), lets you adjust them directly, restores the scene's specimen with **↺ Scene**, and pauses or resumes the reveal and its growth speed. On the Bench, the floating panel fades away so the inline exploration controls have room to breathe.

## Test and build

```sh
npm test
npm run build
npm run preview
```

The test suite checks the expansion law, derived whorl counts, umbilicus/clearance behaviour, the flat-versus-tower signature of `T`, all five presets, and the baked pigment map.

## Live demo

<https://k-chat.github.io/shells/>

The site is a static Vite build published from the `gh-pages` branch. To refresh it after a change:

```sh
npm test
npm run build
npx gh-pages -d dist   # or copy dist/ onto the gh-pages branch
```
