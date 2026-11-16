import * as THREE from "three";
import anime from "animejs";
import { chapters, PRESETS } from "./story.js";
import {
  EXPLORE_LIMITS,
  RAUP_DEFAULTS,
  W_SLIDER,
  totalTheta,
} from "./growth.js";
import {
  createApertureCap,
  createApertureRing,
  createShell,
  createSpiralLine,
  placeAperture,
} from "./shell.js";
import { generatePigmentMap } from "./pigmentation.js";
import { createMorphospace } from "./morphospace.js";
import { createEnvironment, createShellTextures } from "./textures.js";
import "./style.css";

const canvas = document.querySelector("#world");
const errorBanner = document.querySelector("#webgl-error");
let renderer;

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
} catch (error) {
  errorBanner.hidden = false;
  console.error("Unable to initialize the shell WebGL scene.", error);
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#000000");
scene.fog = new THREE.FogExp2("#000000", 0.03);
scene.environment = createEnvironment(renderer);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);

/**
 * The camera is a damped orbit rig expressed in spherical coordinates
 * (yaw, pitch, radius) around a look target. Each frame the camera's position
 * *and* orientation are derived from that single rig state.
 *
 * The previous rig damped a free 3D direction vector and then slerped the
 * camera quaternion toward a separately-computed look-at goal. Position and
 * orientation converged at different rates, so the aim permanently lagged the
 * position. Near the steep story angles, where roll is very sensitive to yaw,
 * that mismatch read as a constant wobble. Damping yaw/pitch/radius and calling
 * lookAt directly removes the second, competing interpolation, so there is
 * nothing left to fight. Working in angles also keeps the path around the
 * specimen smooth and makes the pitch clamp exact instead of approximate.
 */
const CAMERA_STATES = [
  { position: [3.1, 4.4, 7.6], target: [0.3, 0.1, 0], fov: 38 },
  { position: [1.4, 8.6, 2.1], target: [0.3, 0, 0], fov: 36 },
  { position: [1.6, 8.6, 2.0], target: [0.3, 0, 0], fov: 36 },
  { position: [4.0, 2.6, 7.2], target: [0.3, 0.1, 0], fov: 38 },
  { position: [3.0, 2.2, 8.0], target: [0.3, 0.1, 0], fov: 38 },
  { position: [3.0, 2.7, 8.2], target: [0.25, 0.05, 0], fov: 38 },
  { position: [3.5, 3.0, 8.6], target: [0.25, 0.05, 0], fov: 38 },
  { position: [3.2, 4.2, 7.4], target: [0.3, 0.1, 0], fov: 38 },
];

const CAMERA_DAMPING = 2.7;
const CAMERA_MIN_DISTANCE = 3.2;
const CAMERA_MAX_PITCH = THREE.MathUtils.degToRad(76);
const CAMERA_UP = new THREE.Vector3(0, 1, 0);
const cameraScratch = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();

const cameraRig = {
  target: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  radius: 0,
  fov: 38,
};
const cameraRigGoal = {
  target: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  radius: 0,
  fov: 38,
};

/** Wrap an angle into [-PI, PI] so yaw always takes the shorter way around. */
function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Read a story view into a rig state, clamped to the orbit limits. */
function readView(view, rig) {
  rig.target.fromArray(view.target);
  rig.fov = view.fov ?? 38;

  const offset = cameraScratch.fromArray(view.position).sub(rig.target);
  const distance = offset.length();
  rig.radius = Math.max(distance, CAMERA_MIN_DISTANCE);

  if (distance > 1e-6) {
    rig.yaw = Math.atan2(offset.x, offset.z);
    rig.pitch = THREE.MathUtils.clamp(
      Math.asin(THREE.MathUtils.clamp(offset.y / distance, -1, 1)),
      -CAMERA_MAX_PITCH,
      CAMERA_MAX_PITCH,
    );
  } else {
    rig.yaw = 0;
    rig.pitch = 0;
  }
}

/** Place the camera from the rig. Position and orientation share one source. */
function applyCameraRig() {
  const cosPitch = Math.cos(cameraRig.pitch);
  cameraOffset
    .set(
      Math.sin(cameraRig.yaw) * cosPitch,
      Math.sin(cameraRig.pitch),
      Math.cos(cameraRig.yaw) * cosPitch,
    )
    .multiplyScalar(cameraRig.radius);

  camera.position.copy(cameraRig.target).add(cameraOffset);
  camera.up.copy(CAMERA_UP);
  camera.lookAt(cameraRig.target);

  if (camera.fov !== cameraRig.fov) {
    camera.fov = cameraRig.fov;
    camera.updateProjectionMatrix();
  }
}

function setCameraGoal(view) {
  readView(view, cameraRigGoal);
}

function initCamera(view) {
  readView(view, cameraRig);
  readView(view, cameraRigGoal);
  applyCameraRig();
}

function updateCamera(delta) {
  if (delta <= 0) return;

  // Frame-rate independent exponential damping. The delta cap keeps a stalled
  // tab from teleporting the camera when it wakes up.
  const amount = 1 - Math.exp(-Math.min(delta, 0.1) * CAMERA_DAMPING);

  cameraRig.target.lerp(cameraRigGoal.target, amount);
  cameraRig.radius += (cameraRigGoal.radius - cameraRig.radius) * amount;
  cameraRig.pitch += (cameraRigGoal.pitch - cameraRig.pitch) * amount;
  cameraRig.yaw = wrapAngle(
    cameraRig.yaw + wrapAngle(cameraRigGoal.yaw - cameraRig.yaw) * amount,
  );
  cameraRig.fov += (cameraRigGoal.fov - cameraRig.fov) * amount;

  applyCameraRig();
}

initCamera(CAMERA_STATES[0]);

const ambient = new THREE.HemisphereLight("#f4e3cc", "#0c0f10", 1.7);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight("#ffe1b5", 3.2);
keyLight.position.set(4, 7, 5);
scene.add(keyLight);
const coolLight = new THREE.DirectionalLight("#8fb3c4", 1.25);
coolLight.position.set(-5, 1, -4);
scene.add(coolLight);
const rimLight = new THREE.PointLight("#a1121b", 26, 14);
rimLight.position.set(0.8, 3, -2.5);
scene.add(rimLight);
// Neutral cool fill from below-left: keeps the shell from going flat without
// tinting it violet.
const bounceFill = new THREE.PointLight("#8fa6b8", 12, 12);
bounceFill.position.set(-2.4, -1.2, 1.8);
scene.add(bounceFill);

const shellGroup = new THREE.Group();
shellGroup.position.x = 0.9;
scene.add(shellGroup);

const SHAPE_KEYS = ["whorlExpansion", "axisDistance", "translation"];
const W_KEY = "whorlExpansion";

function presetParams(name) {
  const preset = PRESETS[name];
  return {
    ...RAUP_DEFAULTS,
    whorlExpansion: preset.whorlExpansion,
    axisDistance: preset.axisDistance,
    translation: preset.translation,
  };
}

const liveParams = presetParams("snail");
const goalParams = presetParams("snail");
let goalLabel = PRESETS.snail.label;
let goalPresetName = "snail";

let pigmentSeed = 1966;
let pigmentMap = generatePigmentMap({
  sections: liveParams.sections,
  aperturePoints: liveParams.aperturePoints,
  seed: pigmentSeed,
});
let shellData = createShell(liveParams, pigmentMap.colors);

const shellTextures = createShellTextures();
const shellMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.68,
  metalness: 0.06,
  normalMap: shellTextures.normalMap,
  normalScale: new THREE.Vector2(0.75, 0.75),
  roughnessMap: shellTextures.roughnessMap,
  envMapIntensity: 0.5,
  side: THREE.DoubleSide,
});
const shellMesh = new THREE.Mesh(shellData.geometry, shellMaterial);
shellGroup.add(shellMesh);

let spiralLine = createSpiralLine(liveParams, shellData.transform);
shellGroup.add(spiralLine);

const apertureRing = createApertureRing(liveParams);
shellGroup.add(apertureRing);

const apertureCap = createApertureCap(liveParams);
apertureCap.visible = false;
shellGroup.add(apertureCap);

const morpho = createMorphospace();
scene.add(morpho.group);
morpho.group.visible = false;

const dustPositions = new Float32Array(900 * 3);
for (let index = 0; index < dustPositions.length; index += 3) {
  dustPositions[index] = (Math.random() - 0.5) * 32;
  dustPositions[index + 1] = (Math.random() - 0.5) * 22;
  dustPositions[index + 2] = (Math.random() - 0.5) * 22;
}
const dustGeometry = new THREE.BufferGeometry();
dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(
  dustGeometry,
  new THREE.PointsMaterial({ color: "#e5484d", size: 0.022, transparent: true, opacity: 0.4 }),
);
scene.add(dust);

const chaptersOnPage = [...document.querySelectorAll(".chapter")];
const navLinks = [...document.querySelectorAll("#chapter-nav a")];
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/** Split a heading into word spans so the words can rise in sequence. */
function splitHeadingWords(heading) {
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  let wordIndex = 0;
  textNodes.forEach((textNode) => {
    const fragment = document.createDocumentFragment();
    textNode.textContent.split(/(\s+)/u).forEach((part) => {
      if (!part || /^\s+$/u.test(part)) {
        fragment.append(part);
        return;
      }

      const word = document.createElement("span");
      word.className = "heading-word";
      word.style.setProperty("--word-index", wordIndex++);
      word.textContent = part;
      fragment.append(word);
    });
    textNode.replaceWith(fragment);
  });
}

/**
 * Every content block is revealed by the same observer, so the copy arrives
 * element by element as it actually enters the viewport. Headings keep their
 * word-by-word treatment, but are triggered by the same scroll position.
 */
const revealTargets = [];

function prepareReveal(element, index, { heading = false } = {}) {
  element.classList.add(heading ? "heading-reveal" : "chapter-reveal");
  element.style.setProperty("--reveal-index", index);
  revealTargets.push(element);
}

chaptersOnPage.forEach((chapter) => {
  const copy = chapter.querySelector(".chapter-copy");
  if (!copy) return;

  let revealIndex = 0;
  [...copy.children].forEach((element) => {
    if (element.matches("h1, h2")) {
      splitHeadingWords(element);
      prepareReveal(element, revealIndex++, { heading: true });
      return;
    }

    prepareReveal(element, revealIndex++);

    // The bench panel holds its own controls: stagger them inside the panel
    // rather than letting the whole block arrive as one opaque rectangle.
    if (element.matches(".explore-panel")) {
      [...element.children].forEach((child, childIndex) => {
        prepareReveal(child, childIndex);
      });
    }
  });
});

const storyFooter = document.querySelector(".story-footer");
if (storyFooter) {
  const footerBlocks = storyFooter.querySelectorAll(
    ".footer-head, .footer-copy > *, .footer-side, .footer-baseline > *",
  );
  footerBlocks.forEach((element, index) => {
    prepareReveal(element, index);
  });
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.05, rootMargin: "0px 0px -8% 0px" },
);

revealTargets.forEach((target) => {
  // If the page is restored part-way down, content above the fold has already
  // been passed; show it without waiting for an intersection that cannot come.
  if (target.getBoundingClientRect().bottom <= 0) {
    target.classList.add("is-revealed");
    return;
  }
  revealObserver.observe(target);
});
const sceneIndex = document.querySelector("#scene-index");
const sceneTitle = document.querySelector("#scene-title");
const railProgress = document.querySelector("#rail-progress");
const pauseButton = document.querySelector("#pause-button");
const pauseLabel = document.querySelector("#pause-label");
const pauseIcon = document.querySelector("#pause-icon");
const speedInput = document.querySelector("#speed");
const speedValue = document.querySelector("#speed-value");
const readoutName = document.querySelector("#readout-name");
const readoutW = document.querySelector("#readout-w");
const readoutD = document.querySelector("#readout-d");
const readoutT = document.querySelector("#readout-t");

const exploreInputs = {
  whorlExpansion: document.querySelector("#param-w"),
  axisDistance: document.querySelector("#param-d"),
  translation: document.querySelector("#param-t"),
};
const exploreOutputs = {
  whorlExpansion: document.querySelector("#value-w"),
  axisDistance: document.querySelector("#value-d"),
  translation: document.querySelector("#value-t"),
};
const sceneInputs = {
  whorlExpansion: document.querySelector("#scene-param-w"),
  axisDistance: document.querySelector("#scene-param-d"),
  translation: document.querySelector("#scene-param-t"),
};
const sceneOutputs = {
  whorlExpansion: document.querySelector("#scene-value-w"),
  axisDistance: document.querySelector("#scene-value-d"),
  translation: document.querySelector("#scene-value-t"),
};
const sceneParamRows = [...document.querySelectorAll("[data-scene-param]")];
const sceneControlsName = document.querySelector("#scene-controls-name");
const sceneResetButton = document.querySelector("#scene-reset");
const xrayButton = document.querySelector("#xray-toggle");
const presetButtons = [...document.querySelectorAll("[data-preset]")];
const randomButton = document.querySelector("#random-shell");
const replayButton = document.querySelector("#replay-explore");

let activeChapter = 0;
let growth = 0;
let paused = false;
let speed = Number(speedInput.value);
let isDragging = false;
let previousPointerX = 0;
let shapeDirty = false;
let rebuildTimer = 0;
let elapsed = 0;
let xrayEnabled = true;

function applyXrayState() {
  xrayButton.setAttribute("aria-pressed", String(xrayEnabled));
  document.body.classList.toggle("is-xray", xrayEnabled);
  shellMaterial.wireframe = xrayEnabled;
  shellMaterial.needsUpdate = true;
  morpho.setXRay(xrayEnabled);
  dust.visible = !xrayEnabled;
}

applyXrayState();

function tweenChapterRail(index, intro = false) {
  const progress = `${(index / (chapters.length - 1)) * 100}%`;
  anime.remove(navLinks);
  anime.remove(railProgress);

  if (prefersReducedMotion.matches) {
    navLinks.forEach((link) => link.style.removeProperty("transform"));
    railProgress.style.height = progress;
    return;
  }

  anime({
    targets: navLinks,
    scale: (link, linkIndex) => linkIndex === index ? [0.9, 1.08] : 1,
    translateX: (link, linkIndex) => linkIndex === index ? -2 : 0,
    delay: intro ? anime.stagger(48) : anime.stagger(14, { from: index }),
    duration: intro ? 560 : 440,
    easing: intro ? "easeOutCubic" : "easeOutBack",
  });

  anime({
    targets: railProgress,
    height: progress,
    duration: 640,
    easing: "easeOutQuart",
  });
}

function formatW(value) {
  if (value >= 1000) return Math.round(value).toLocaleString("en-US");
  if (value >= 100) return value.toFixed(0);
  return value.toFixed(1);
}

function formatValue(key, value) {
  return key === W_KEY ? `${formatW(value)}×` : value.toFixed(2);
}

function sliderValue(key, output) {
  return key === W_KEY ? Math.log10(output) : output;
}

const readoutCache = { name: "", w: "", d: "", t: "" };

function updateReadout() {
  const w = formatValue(W_KEY, liveParams.whorlExpansion);
  const d = formatValue("axisDistance", liveParams.axisDistance);
  const t = formatValue("translation", liveParams.translation);

  if (readoutCache.name !== goalLabel) {
    readoutName.textContent = goalLabel;
    readoutCache.name = goalLabel;
  }
  if (readoutCache.w !== w) {
    readoutW.textContent = w;
    readoutCache.w = w;
  }
  if (readoutCache.d !== d) {
    readoutD.textContent = d;
    readoutCache.d = d;
  }
  if (readoutCache.t !== t) {
    readoutT.textContent = t;
    readoutCache.t = t;
  }
}

function updateApertureColors(progress) {
  const attribute = apertureRing.geometry.getAttribute("color");
  if (!attribute) return;

  const colors = attribute.array;
  const pointCount = colors.length / 3;
  const section = THREE.MathUtils.clamp(
    Math.round(progress * pigmentMap.sections),
    0,
    pigmentMap.sections,
  );
  const row = section * pigmentMap.aperturePoints;
  const shared = Math.min(pointCount, pigmentMap.aperturePoints);

  for (let point = 0; point < pointCount; point += 1) {
    const source = (row + (point % shared)) * 3;
    const offset = point * 3;
    // Lift the baked colour toward a warm highlight so the ring reads as the
    // illuminated growing edge rather than a flat copy of the shell.
    colors[offset] = Math.min(1, pigmentMap.colors[source] * 0.72 + 0.34);
    colors[offset + 1] = Math.min(1, pigmentMap.colors[source + 1] * 0.72 + 0.26);
    colors[offset + 2] = Math.min(1, pigmentMap.colors[source + 2] * 0.72 + 0.16);
  }

  attribute.needsUpdate = true;
}

function updateAperture(progress) {
  placeAperture(apertureRing, progress, liveParams, shellData.transform, 1.02);
  updateApertureColors(progress);
}

const capNormal = new THREE.Vector3();

function updateCapTransform() {
  placeAperture(apertureCap, 1, liveParams, shellData.transform, 0.985);
  const theta = totalTheta(liveParams);
  capNormal.set(-Math.sin(theta), 0, Math.cos(theta));
  apertureCap.position.addScaledVector(capNormal, -apertureCap.scale.x * 0.05);
}

function rebuildGeometry() {
  const nextData = createShell(liveParams, pigmentMap.colors);
  shellMesh.geometry.dispose();
  shellMesh.geometry = nextData.geometry;
  shellData = nextData;

  shellGroup.remove(spiralLine);
  spiralLine.geometry.dispose();
  spiralLine.material.dispose();
  spiralLine = createSpiralLine(liveParams, shellData.transform);
  shellGroup.add(spiralLine);

  updateCapTransform();
  applyGrowthReveal(true);
}

let appliedGrowth = -1;

/**
 * Redraw the growth window. The render loop asks for this every frame, but the
 * aperture ring rebuild is real per-frame CPU work plus a GPU buffer upload;
 * skipping it while growth is settled removes the frame-time spikes that made
 * the camera stutter. Scene changes (chapter, x-ray, new geometry) pass
 * `force` because they alter visibility or geometry without moving growth.
 */
function applyGrowthReveal(force = false) {
  if (!force && growth === appliedGrowth) return;
  appliedGrowth = growth;

  const visibleRows = Math.floor(growth * shellData.sections);
  shellData.geometry.setDrawRange(
    0,
    Math.max(0, visibleRows * shellData.aperturePoints * 6),
  );
  spiralLine.geometry.setDrawRange(0, Math.floor(growth * 700));
  updateAperture(growth);

  const shellMode = chapters[activeChapter]?.mode === "shell";
  apertureRing.visible = shellMode && !xrayEnabled;
  spiralLine.visible = shellMode && !xrayEnabled;
  apertureCap.visible = shellMode && !xrayEnabled && growth > 0.995;
}

/**
 * The lower-left panel always describes the scene that is on screen. It is
 * driven from goalParams (the destination of the morph), so it stays in step
 * with chapter changes, presets, random shells, and the bench sliders.
 */
function syncSceneControls() {
  const chapter = chapters[activeChapter];
  const isMorphospace = chapter?.mode === "morphospace" || chapter?.mode === "survivors";
  const focus = chapter?.focus ?? [];

  for (const key of SHAPE_KEYS) {
    const input = sceneInputs[key];
    input.value = sliderValue(key, goalParams[key]);
    input.disabled = isMorphospace;
    sceneOutputs[key].textContent = formatValue(key, goalParams[key]);
  }

  sceneParamRows.forEach((row) => {
    const key = row.dataset.sceneParam;
    row.classList.toggle("is-focused", focus.includes(key));
    row.classList.toggle("is-disabled", isMorphospace);
  });

  sceneControlsName.textContent = chapter?.mode === "survivors"
    ? "LIFE'S FEW CORNERS"
    : isMorphospace ? "MORPHOSPACE" : goalLabel;
  sceneResetButton.disabled = isMorphospace || !chapter?.preset;
}

function syncExploreUI() {
  for (const key of SHAPE_KEYS) {
    const input = exploreInputs[key];
    const output = exploreOutputs[key];
    input.value = sliderValue(key, goalParams[key]);
    output.textContent = formatValue(key, goalParams[key]);
  }

  presetButtons.forEach((button) => {
    const preset = PRESETS[button.dataset.preset];
    const active = preset
      && Math.abs(preset.whorlExpansion - goalParams.whorlExpansion) < 1e-6
      && Math.abs(preset.axisDistance - goalParams.axisDistance) < 1e-9
      && Math.abs(preset.translation - goalParams.translation) < 1e-9;
    button.classList.toggle("active", Boolean(active));
  });

  syncSceneControls();
}

function setGoalPreset(name, { snap = false } = {}) {
  const preset = PRESETS[name];
  if (!preset) return;

  for (const key of SHAPE_KEYS) {
    goalParams[key] = preset[key];
    if (snap) liveParams[key] = preset[key];
  }
  goalLabel = preset.label;
  goalPresetName = name;
  if (snap) {
    shapeDirty = true;
    rebuildTimer = 1;
  }
  syncExploreUI();
}

function setGoalValues(values, label = "THEORETICAL FORM") {
  for (const key of SHAPE_KEYS) {
    if (Number.isFinite(values[key])) goalParams[key] = values[key];
  }
  goalLabel = label;
  goalPresetName = null;
  syncExploreUI();
}

function updateShapeMorph(delta) {
  const amount = 1 - Math.exp(-delta * 2.35);
  let changed = false;

  const currentLog = Math.log(liveParams.whorlExpansion);
  const targetLog = Math.log(goalParams.whorlExpansion);
  if (Math.abs(targetLog - currentLog) > 1e-4) {
    liveParams.whorlExpansion = Math.exp(currentLog + (targetLog - currentLog) * amount);
    changed = true;
  } else if (liveParams.whorlExpansion !== goalParams.whorlExpansion) {
    liveParams.whorlExpansion = goalParams.whorlExpansion;
    changed = true;
  }

  for (const key of ["axisDistance", "translation"]) {
    const difference = goalParams[key] - liveParams[key];
    if (Math.abs(difference) > 1e-4) {
      liveParams[key] += difference * amount;
      changed = true;
    } else if (liveParams[key] !== goalParams[key]) {
      liveParams[key] = goalParams[key];
      changed = true;
    }
  }

  if (changed) shapeDirty = true;
}

function maybeRebuild(delta) {
  if (!shapeDirty) return;
  rebuildTimer += delta;
  if (rebuildTimer < 1 / 18) return;
  rebuildTimer = 0;
  shapeDirty = false;
  rebuildGeometry();
}

function setActiveChapter(index) {
  const next = THREE.MathUtils.clamp(index, 0, chapters.length - 1);
  const changed = next !== activeChapter;
  activeChapter = next;
  const chapter = chapters[activeChapter];
  chaptersOnPage.forEach((element, index) => {
    element.classList.toggle("is-active", index === activeChapter);
  });
  document.body.classList.toggle("is-explore", chapter.id === "bench");
  if (changed) {
    if (chapter.preset) setGoalPreset(chapter.preset);
    else syncExploreUI();
  }

  const isMorphospace = chapter.mode === "morphospace" || chapter.mode === "survivors";
  shellGroup.visible = !isMorphospace;
  morpho.group.visible = isMorphospace;
  morpho.setSparse(chapter.mode === "survivors", prefersReducedMotion.matches);
  document.body.classList.toggle("is-morphospace", isMorphospace);

  sceneIndex.textContent = `${String(activeChapter + 1).padStart(2, "0")} / ${String(chapters.length).padStart(2, "0")}`;
  sceneTitle.textContent = chapter.title;
  navLinks.forEach((link, linkIndex) => {
    link.classList.toggle("active", linkIndex === activeChapter);
    if (linkIndex === activeChapter) link.setAttribute("aria-current", "step");
    else link.removeAttribute("aria-current");
  });
  if (changed) tweenChapterRail(activeChapter);

  const view = CAMERA_STATES[activeChapter];
  setCameraGoal(view);

  // Refresh even when the chapter is unchanged: focus, disabled state and
  // the scene name all depend on which act is on screen.
  syncSceneControls();
  applyGrowthReveal(true);
}

/**
 * Pick the chapter whose midpoint is nearest the viewport midpoint. Comparing
 * intersection *ratios of changed entries only* (the previous approach) could
 * flip between two neighbouring chapters at a boundary, which dragged the
 * camera goal back and forth and read as a jitter while scrolling.
 */
function chapterNearestCenter() {
  const center = window.innerHeight / 2;
  let bestIndex = activeChapter;
  let bestDistance = Infinity;

  chaptersOnPage.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;

    const distance = Math.abs(rect.top + rect.height / 2 - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

let chapterPickPending = false;
const observer = new IntersectionObserver(() => {
  // Intersections only signal "scroll position changed"; sample every chapter
  // once per frame so a burst of entries cannot switch chapters repeatedly.
  if (chapterPickPending) return;
  chapterPickPending = true;
  requestAnimationFrame(() => {
    chapterPickPending = false;
    setActiveChapter(chapterNearestCenter());
  });
}, { threshold: 0, rootMargin: "-20% 0px -20% 0px" });

chaptersOnPage.forEach((chapter) => observer.observe(chapter));
navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    document.querySelector(link.getAttribute("href")).scrollIntoView({
      behavior: prefersReducedMotion.matches ? "auto" : "smooth",
    });
  });
});

function updateGrowth(delta) {
  const target = paused ? growth : (chapters[activeChapter].growth ?? 1);
  const catchUp = 1 - Math.exp(-delta * (0.72 + speed * 1.8));
  growth = THREE.MathUtils.lerp(growth, target, catchUp);
  if (Math.abs(growth - target) < 0.0004) growth = target;
  applyGrowthReveal();
}

function updatePauseButton() {
  pauseButton.setAttribute("aria-pressed", String(paused));
  pauseLabel.textContent = paused ? "RESUME" : "PAUSE";
  pauseIcon.textContent = paused ? "▶" : "Ⅱ";
}

xrayButton.addEventListener("click", () => {
  xrayEnabled = !xrayEnabled;
  applyXrayState();
  applyGrowthReveal(true);
});

pauseButton.addEventListener("click", () => {
  paused = !paused;
  updatePauseButton();
});

speedInput.addEventListener("input", () => {
  speed = Number(speedInput.value);
  speedValue.textContent = `${speed.toFixed(1)}×`;
});

function applyCustomParameter(key, value) {
  goalParams[key] = value;
  liveParams[key] = value;
  shapeDirty = true;
  rebuildTimer = 1;
  goalLabel = "CUSTOM FORM";
  goalPresetName = null;
  syncExploreUI();
}

for (const inputs of [exploreInputs, sceneInputs]) {
  for (const [key, input] of Object.entries(inputs)) {
    input.addEventListener("input", () => {
      const raw = Number(input.value);
      applyCustomParameter(key, key === W_KEY ? 10 ** raw : raw);
    });
  }
}

sceneResetButton.addEventListener("click", () => {
  const chapter = chapters[activeChapter];
  if (chapter?.preset) setGoalPreset(chapter.preset);
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setGoalPreset(button.dataset.preset);
  });
});

randomButton.addEventListener("click", () => {
  const whorlExpansion = 10 ** (0.18 + Math.random() * 5.7);
  const axisDistance = Math.random() * 0.9;
  const translation = Math.random() * 2.4;
  setGoalValues({ whorlExpansion, axisDistance, translation }, "THEORETICAL FORM");
  growth = 0;
  paused = false;
  updatePauseButton();
});

replayButton.addEventListener("click", () => {
  growth = 0;
  paused = false;
  updatePauseButton();
});

function restartStory() {
  paused = false;
  growth = 0;
  setGoalPreset("snail");
  updatePauseButton();
  chaptersOnPage[0].scrollIntoView({ behavior: "smooth" });
}

document.querySelector("#restart-link").addEventListener("click", restartStory);
document.querySelector(".wordmark").addEventListener("click", (event) => {
  event.preventDefault();
  restartStory();
});

canvas.addEventListener("pointerdown", (event) => {
  if (!shellGroup.visible) return;
  isDragging = true;
  previousPointerX = event.clientX;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!isDragging || !shellGroup.visible) return;
  const movement = event.clientX - previousPointerX;
  previousPointerX = event.clientX;
  shellGroup.rotation.y += movement * 0.006;
});
canvas.addEventListener("pointerup", () => { isDragging = false; });
canvas.addEventListener("pointercancel", () => { isDragging = false; });

let previousTime = 0;
function animate(time) {
  requestAnimationFrame(animate);
  const delta = Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;
  elapsed += delta;

  updateShapeMorph(delta);
  maybeRebuild(delta);
  updateGrowth(delta);

  updateCamera(delta);
  dust.rotation.y += delta * 0.012;

  if (!paused) {
    if (morpho.group.visible) {
      morpho.update(delta);
    } else if (!isDragging) {
      shellGroup.rotation.y += delta * (chapters[activeChapter].orbit ?? 0);
    }
  }

  updateReadout();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
});

// Configure the logarithmic W slider and the two linear Raup sliders. The
// bench and scene-control panels share the same ranges.
for (const inputs of [exploreInputs, sceneInputs]) {
  inputs.whorlExpansion.min = W_SLIDER.min;
  inputs.whorlExpansion.max = W_SLIDER.max;
  inputs.whorlExpansion.step = W_SLIDER.step;
  inputs.axisDistance.min = EXPLORE_LIMITS.axisDistance.min;
  inputs.axisDistance.max = EXPLORE_LIMITS.axisDistance.max;
  inputs.axisDistance.step = EXPLORE_LIMITS.axisDistance.step;
  inputs.translation.min = EXPLORE_LIMITS.translation.min;
  inputs.translation.max = EXPLORE_LIMITS.translation.max;
  inputs.translation.step = EXPLORE_LIMITS.translation.step;
}

syncExploreUI();
updateCapTransform();
setActiveChapter(0);
tweenChapterRail(0, true);
updatePauseButton();
