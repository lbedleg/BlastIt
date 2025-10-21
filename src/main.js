import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Scoring } from './systems/Scoring.js';
import { Goalkeeper } from './entities/Goalkeeper.js';
import { AudioSystem } from './systems/Audio.js';
let audio = null; // <-- make audio assignable

/* =======================
   SCENE & RENDERER
======================= */
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;

const scene = new THREE.Scene();
scene.backgroundBlurriness = 0.0;
scene.backgroundIntensity = 0.65;
scene.environmentIntensity = 0.85;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 4.5);
camera.lookAt(0, 1.2, -8);

let light = new THREE.DirectionalLight(0xffffff, 1.6); // <-- was const, now let
light.position.set(5, 10, 3);
light.castShadow = true;
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

/* =======================
   AUDIO
======================= */
audio = new AudioSystem(camera); // <-- assign into the let audio

/* =======================
   ASSET BASE
======================= */
const BASE = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
const ASSET_BASE = `${BASE}public/assets/`;

/* =======================
   ENVIRONMENT
======================= */
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader().load(`${ASSET_BASE}hdris/stadium.hdr`, (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr;
  const envTex = pmrem.fromEquirectangular(hdr).texture;
  scene.environment = envTex;
  scene.backgroundIntensity = 0.65;
  scene.environmentIntensity = 0.85;
});

/* =======================
   SETTINGS (UI + BEHAVIOR)
======================= */
const settingsPanel   = document.getElementById('settingsPanel');
const settingsBtn     = document.getElementById('settingsBtn');
const closeSettingsBtn= document.getElementById('closeSettingsBtn');
const dayBtn          = document.getElementById('dayBtn');
const nightBtn        = document.getElementById('nightBtn');
const volumeSlider    = document.getElementById('volumeSlider');
const menuEl          = document.getElementById('menu');

let currentMode = 'day';
function applyMode(mode) {
  currentMode = mode;
  const isNight = (mode === 'night');

  // Update pressed state on buttons (🌞 / 🌙)
  dayBtn?.setAttribute('aria-pressed', String(!isNight));
  nightBtn?.setAttribute('aria-pressed', String(isNight));

  // --- DARK NIGHT / BRIGHT DAY PRESET ---
  if (light) {
    // Key light
    light.intensity = isNight ? 0.35 : 1.8;         // ↓ dark night, ↑ bright day
    light.color.set(isNight ? 0x88aaff : 0xffffff); // cooler night tint
  }

  // Ambient light (if present)
  const amb = scene.children.find(o => o.isAmbientLight);
  if (amb) amb.intensity = isNight ? 0.12 : 0.30;   // dim ambient at night

  // HDRI / IBL strength
  scene.backgroundIntensity   = isNight ? 0.18 : 0.70; // background brightness
  scene.environmentIntensity  = isNight ? 0.42 : 0.90; // reflections/ambient

  // Global “camera exposure”
  renderer.toneMappingExposure = isNight ? 0.68 : 1.05;
}

// Open/close settings overlay
settingsBtn?.addEventListener('click', () => {
  menuEl?.classList.add('hidden');
  settingsPanel?.classList.remove('hidden');
});
closeSettingsBtn?.addEventListener('click', () => {
  settingsPanel?.classList.add('hidden');
  menuEl?.classList.remove('hidden');
});

// Mode toggles
dayBtn?.addEventListener('click',  () => applyMode('day'));
nightBtn?.addEventListener('click', () => applyMode('night'));

// Volume slider → master volume (0–100 → 0.0–1.0)
volumeSlider?.addEventListener('input', (e) => {
  const v = Number(e.target.value) / 100;
  if (audio && typeof audio.setMasterVolume === 'function') {
    audio.setMasterVolume(v);
  }
});

/* =======================
   LOADERS
======================= */
const gltfLoader = new GLTFLoader();
const texLoader  = new THREE.TextureLoader();

/* =======================
   PITCH
======================= */
const grassTex = texLoader.load(`${ASSET_BASE}textures/grass.jpg`);
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(32, 32);
grassTex.colorSpace = THREE.SRGBColorSpace;

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshStandardMaterial({ map: grassTex, metalness: 0, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* =======================
   CONSTANTS / DIMENSIONS
======================= */
const groundY = 0;
const keeperHalfHeight = 0.95;

const GOAL_Z    = -7.5; // goal line (endline)
const ENDLINE_Z = GOAL_Z;
const KEEPER_Z  = GOAL_Z + 0.15;

const GOAL_HALF_WIDTH = 3.6;
const GOAL_HEIGHT     = 2.5;

// BOX_DEPTH ≡ 16.5 m; other dims derive from it
const BOX_DEPTH = 5.5;
const BOX_WIDTH = BOX_DEPTH * (40.32 / 16.5);
const SIX_DEPTH = BOX_DEPTH * ( 5.50 / 16.5);
const SIX_WIDTH = BOX_DEPTH * (18.32 / 16.5);

/* =======================
   VIEWPORT HELPERS
======================= */
function viewportWidthAtZ(zWorld){
  const dist = Math.abs(camera.position.z - zWorld);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const height = 2 * Math.tan(vFov/2) * dist;
  return height * (renderer.domElement.width / renderer.domElement.height);
}

/* =======================
   FIELD MARKINGS
======================= */
const LINE_W = 0.08;
const LINE_Y = 0.012;

const markings = new THREE.Group();
scene.add(markings);

function addStripe(x1, z1, x2, z2, width = LINE_W) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz) || 0.0001;
  const geom = new THREE.PlaneGeometry(len, width);
  const mat  = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const m    = new THREE.Mesh(geom, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set((x1 + x2)/2, LINE_Y, (z1 + z2)/2);
  m.rotation.z = Math.atan2(dz, dx);
  m.renderOrder = 2;
  markings.add(m);
  return m;
}
function addDisk(x, z, r = 0.09) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, LINE_Y, z);
  m.renderOrder = 2;
  markings.add(m);
  return m;
}

function drawMarkings(){
  while (markings.children.length) {
    const obj = markings.children.pop();
    obj.geometry?.dispose();
    if (obj.material?.dispose) obj.material.dispose();
    obj.removeFromParent();
  }

  const L = viewportWidthAtZ(ENDLINE_Z) * 1.2;
  addStripe(-L/2, ENDLINE_Z, L/2, ENDLINE_Z); // goal line

  // 18-yard box
  {
    const xL = -BOX_WIDTH/2, xR = BOX_WIDTH/2;
    const zF = ENDLINE_Z + BOX_DEPTH;
    addStripe(xL, ENDLINE_Z, xL, zF);
    addStripe(xR, ENDLINE_Z, xR, zF);
    addStripe(xL, zF, xR, zF);
  }

  // 6-yard box
  {
    const xL = -SIX_WIDTH/2, xR = SIX_WIDTH/2;
    const zF = ENDLINE_Z + SIX_DEPTH;
    addStripe(xL, ENDLINE_Z, xL, zF);
    addStripe(xR, ENDLINE_Z, xR, zF);
    addStripe(xL, zF, xR, zF);
  }

  // Penalty spot
  const PEN_SPOT_Z = ENDLINE_Z + BOX_DEPTH * (11 / 16.5);
  addDisk(0, PEN_SPOT_Z, 0.09);
}
drawMarkings();

/* =======================
   FANS (crowd in the stands)
======================= */
function createFansWall({
  z = -11.5,        // stands position (behind the goal line at ~ -7.5)
  width = 22,       // span along X
  height = 4.2,     // total crowd height
  rows = 6,
  cols = 120,
  yBase = 1.2,      // bottom of the stand
  tilt = -0.08,     // a tiny tilt back
  amp = 0.06,       // waving amplitude
  speedMin = 0.8, speedMax = 1.4,
} = {}) {
  // Geometry for a single "fan" (a small upright card)
  const w = width / cols * 0.8;
  const h = height / rows * 0.85;
  const geom = new THREE.PlaneGeometry(w, h);

  // Material supports per-instance colors
  const mat = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
  });

  const total = rows * cols;
  const mesh = new THREE.InstancedMesh(geom, mat, total);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // give the wall a slight backward tilt so it feels like stands
  mesh.rotation.x = tilt;

  // palette: mostly neutral clothing with pops of team colors
  const palette = [
    0xdbeafe, 0xbfdbfe, 0x93c5fd, 0x60a5fa, 0x3b82f6, // blues
    0xfecaca, 0xfca5a5, 0xf87171,                     // reds
    0xfde68a, 0xf59e0b,                               // yellows
    0xc7d2fe, 0xa5b4fc,                                // purple hints
    0xe5e7eb, 0xcbd5e1, 0x94a3b8                      // neutrals
  ];

  // Precompute per-instance animation phases and speeds
  const phases = new Float32Array(total);
  const speeds = new Float32Array(total);
  const offsets = new Float32Array(total); // slight per-row base offset

  const dummy = new THREE.Object3D();
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++, i++) {
      const x = -width/2 + (c + 0.5) * (width / cols);
      const y = yBase + (r + 0.5) * (height / rows);

      dummy.position.set(x, y, z);
      // face roughly toward camera (camera is in +z looking to -z)
      dummy.rotation.y = 0; // plane faces +z by default; DoubleSide is on anyway
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Per-instance color
      const color = new THREE.Color(palette[(Math.random() * palette.length) | 0]);
      mesh.setColorAt(i, color);

      // Anim params
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = THREE.MathUtils.lerp(speedMin, speedMax, Math.random());
      offsets[i] = (r / rows) * 0.25; // makes upper rows sway a tad more
    }
  }
  mesh.instanceColor.needsUpdate = true;

  // updater
  const state = { t: 0, amp, phases, speeds, offsets, rows, cols, mesh, dummy, z, width, height, yBase };
  function updateFans(dt) {
    state.t += dt;
    const {
      mesh, dummy, phases, speeds, offsets, rows, cols,
      z, width, height, yBase
    } = state;

    let idx = 0;
    // Subtle wave: sway in X a hair, bob in Y a touch
    for (let r = 0; r < rows; r++) {
      const rowAmp = state.amp * (1 + offsets[idx]); // slightly stronger higher up
      for (let c = 0; c < cols; c++, idx++) {
        const baseX = -width/2 + (c + 0.5) * (width / cols);
        const baseY = yBase + (r + 0.5) * (height / rows);

        const phase = phases[idx];
        const spd   = speeds[idx];

        const swayX = Math.sin(state.t * spd + phase) * (rowAmp * 0.35);
        const bobY  = Math.cos(state.t * spd * 0.7 + phase) * (rowAmp * 0.6);

        dummy.position.set(baseX + swayX, baseY + bobY, z);
        dummy.rotation.x = mesh.rotation.x;
        dummy.rotation.y = 0;
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { group: mesh, update: updateFans, state };
}

/* =======================
   GAME OBJECTS
======================= */
const ballRadius = 0.22;
const ballTex = texLoader.load(`${ASSET_BASE}textures/ball.png`);
ballTex.colorSpace = THREE.SRGBColorSpace;
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 48, 48),
  new THREE.MeshStandardMaterial({ map: ballTex, metalness: 0.1, roughness: 0.55 })
);
ball.castShadow = true;
ball.position.set(0, ballRadius, 0);
scene.add(ball);

let goal;
let keeper = new Goalkeeper({ scene, gltfLoader });

let netOffsetZ = 0, netVelZ = 0;
function pulseNet(){ netVelZ -= 0.6; }

// goal: load and snap posts to ENDLINE_Z
gltfLoader.load(`${ASSET_BASE}models/goal.glb`, (gltf) => {
  goal = gltf.scene;
  goal.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }});
  goal.scale.setScalar(0.85);
  goal.position.set(0, 1.10, ENDLINE_Z);
  scene.add(goal);

  goal.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(goal);
  const frontZ = box.max.z;            // face toward the pitch/camera
  goal.position.z += (ENDLINE_Z - frontZ);
});

/* =======================
   AIM ARROW
======================= */
const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), ball.position, 2.5);
arrow.visible = false;
scene.add(arrow);
function showAimArrow(v){ arrow.visible = v; }
function updateAim(dir3){
  arrow.position.copy(ball.position);
  arrow.setDirection(dir3.clone().normalize());
  arrow.setLength(2.5);
}

/* =======================
   HUD + SCORING
======================= */
const scoreEl     = document.getElementById('score');
const attemptsEl  = document.getElementById('attempts');
const hud = {
  setScore: (v) => { scoreEl.textContent = `Score: ${v}`; },
  setShot:  (n) => { attemptsEl.textContent = `Attempts: ${n}`; },
};
const scoring = new Scoring(hud);

/* =======================
   DIFFICULTY SCALING
======================= */
let difficultyLevel = 0; // increments at 15, 30, 45, ...
function maybeScaleDifficulty() {
  const newLevel = Math.floor(scoring.score / 15);
  if (newLevel > difficultyLevel) {
    difficultyLevel = newLevel;
    // bump keeper speed by +20% per tier
    if (keeper?.bumpSpeedScale) keeper.bumpSpeedScale(1.20);
    else if (keeper?.setSpeedScale && keeper?.getSpeedScale) {
      keeper.setSpeedScale(keeper.getSpeedScale() * 1.20);
    }
  }
}

/* =======================
   UI & GAME STATE
======================= */
const hudWrap     = document.getElementById('hud');
const menu        = document.getElementById('menu');
const playBtn     = document.getElementById('playBtn');
const gameOver    = document.getElementById('gameOver');
const finalScore  = document.getElementById('finalScore');
const playAgainBtn= document.getElementById('playAgainBtn');
const quitBtn     = document.getElementById('quitBtn');

const GameState = { MENU:'MENU', PLAYING:'PLAYING', GAME_OVER:'GAME_OVER' };
let gameState = GameState.MENU;

function showMenu(){ menu?.classList.remove('hidden'); }
function hideMenu(){ menu?.classList.add('hidden'); }
function showHUD(){ hudWrap?.classList.remove('hidden'); }
function hideHUD(){ hudWrap?.classList.add('hidden'); }
function hideGameOver(){ gameOver?.classList.add('hidden'); }
function showGameOver(){
  gameState = GameState.GAME_OVER;
  finalScore.textContent = `Final Score: ${scoring.score}`;
  gameOver.classList.remove('hidden');
  hideHUD();
  audio.play('whistle'); // cue on finish
}
function initUIState(){ gameState = GameState.MENU; showMenu(); hideGameOver(); hideHUD(); scoring.reset(); }
function resetWholeScene(){
  ball.position.set(0,ballRadius,0);
  ballVelocity.set(0,0,0);

  // --- reset shot state so you can shoot again ---
  canShoot     = true;
  shotActive   = false;
  shotResolved = false;
  holdActive   = false;
  holdUntil    = 0;

  aimingYaw = 0; aimingPitch = -0.1;
  updateAim(getAimDirection());
  if (keeper?.mesh) keeper.mesh.position.set(0, 0.95, KEEPER_Z);

  showAimArrow(true);
}
function startNewGame(){
  hideMenu(); hideGameOver(); resetWholeScene(); scoring.reset(); showHUD();

  // defensive reset (covers any call path)
  canShoot = true; shotActive = false; shotResolved = false; holdActive = false; holdUntil = 0;

  // reset difficulty & keeper speed
  difficultyLevel = 0;
  if (keeper?.setSpeedScale) keeper.setSpeedScale(1);

  gameState = GameState.PLAYING;
  showAimArrow(true);
  audio.play('whistle'); // start-game whistle
}
playBtn?.addEventListener('click', startNewGame);
playAgainBtn?.addEventListener('click', startNewGame);
quitBtn?.addEventListener('click', ()=>{ hideGameOver(); showMenu(); hideHUD(); gameState = GameState.MENU; resetWholeScene(); scoring.reset(); });
initUIState();

/* =======================
   INPUT / SHOOTING
======================= */
let aimingYaw = 0, aimingPitch = -0.1;
const aimSpeed = 0.03;
function getAimDirection(){
  const dir = new THREE.Vector3(0,0,-1);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(aimingPitch, aimingYaw, 0, 'YXZ'));
  return dir.applyQuaternion(q).normalize();
}
function handleAimKey(k){
  if (gameState !== GameState.PLAYING) return;
  if (k==='ArrowLeft'||k.toLowerCase()==='a') aimingYaw += aimSpeed;
  if (k==='ArrowRight'||k.toLowerCase()==='d') aimingYaw -= aimSpeed;
  if (k==='ArrowUp'||k.toLowerCase()==='w') aimingPitch += aimSpeed;
  if (k==='ArrowDown'||k.toLowerCase()==='s') aimingPitch -= aimSpeed;
  aimingPitch = THREE.MathUtils.clamp(aimingPitch, -0.6, 0.4);
  updateAim(getAimDirection());
}
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === ' ' || e.code === 'Space') {
    if (gameState !== GameState.PLAYING || !canShoot) return;
    shoot();
  } else if (key === 'r') {
    if (gameState === GameState.PLAYING) startNewGame();
  } else {
    handleAimKey(e.key);
  }
});

/* =======================
   SHOT FLOW & SCORING
======================= */
const ballVelocity = new THREE.Vector3(0,0,0);
let canShoot = true;
let shotActive = false;
let shotResolved = false;
let holdUntil = 0;
let holdActive = false;

function shoot(){
  if (holdActive || shotActive) return;
  showAimArrow(false);
  const dir = getAimDirection();
  const power = 18;
  ballVelocity.copy(dir).multiplyScalar(power);
  canShoot = false;
  shotActive = true;
  shotResolved = false;
  audio.duck(0.15, 300); // subtle dip on shot
}

function resolveShot(result){
  if (shotResolved) return;
  shotResolved = true;

  if (result === 'goal') { audio.play('goal'); audio.duck(0.12, 1200); }
  else { audio.play('miss'); audio.duck(0.08, 800); } // 'save' and 'miss' share SFX

  const { isGameOver } = scoring.onShot(result);

  // bump difficulty when crossing 15, 30, 45, ...
  maybeScaleDifficulty();

  scheduleHold();
  if (isGameOver) showGameOver();
}

function scheduleHold(){ holdActive = true; holdUntil = performance.now() + 667; }
function finalizeHold(){
  holdActive = false;
  shotActive = false;
  if (gameState !== GameState.GAME_OVER) {
    setTimeout(()=>{ if (gameState===GameState.PLAYING){ canShoot = true; showAimArrow(true); resetBallForNext(); } }, 300);
  }
}
function resetBallForNext(){ ball.position.set(0,ballRadius,0); ballVelocity.set(0,0,0); }

/* =======================
   LOOP / COLLISIONS
======================= */
const dt = 1/60;
const tmpBox = new THREE.Box3();

function reflectVelocity(v, normal, restitution = 0.6){
  const vn = normal.clone().multiplyScalar(v.dot(normal));
  const vt = v.clone().sub(vn);
  return vt.sub(vn.multiplyScalar(restitution));
}

function step(){
  const now = performance.now();

  if (goal) {
    netVelZ += (-netOffsetZ) * 0.12;
    netVelZ *= 0.92;
    netOffsetZ += netVelZ * (dt * 10);
    goal.position.z = ENDLINE_Z + netOffsetZ;
  }

  // Keeper idle sway
  if (keeper) keeper.update(dt);

  if (gameState === GameState.PLAYING) {
    if (!holdActive) {
      // integrate ball
      ball.position.addScaledVector(ballVelocity, dt);
      ballVelocity.multiplyScalar(0.99);
      if (ball.position.y < ballRadius) ball.position.y = ballRadius;

      // Keeper collision (sphere vs AABB) — bounce & mark save once
      const kBox = keeper?.getAABB?.(tmpBox);
      if (shotActive && !shotResolved && kBox) {
        const closest = kBox.clampPoint(ball.position, new THREE.Vector3());
        const d2 = closest.distanceToSquared(ball.position);
        const r2 = ballRadius * ballRadius;

        if (d2 <= r2) {
          const normal = ball.position.clone().sub(closest).normalize();
          ball.position.add(normal.clone().multiplyScalar((ballRadius - Math.sqrt(d2)) + 0.002));
          ballVelocity.copy(reflectVelocity(ballVelocity, normal, 0.6));
          resolveShot('save');
        }
      }

      // Goal / miss resolution
      const goalPlaneZ = ENDLINE_Z - 0.2;
      if (shotActive && !shotResolved && ball.position.z < goalPlaneZ) {
        const withinMouth =
          Math.abs(ball.position.x) <= GOAL_HALF_WIDTH &&
          ball.position.y >= 0 && ball.position.y <= GOAL_HEIGHT;

        if (withinMouth) {
          pulseNet();
          ballVelocity.set(0,0,0);
          ball.position.z = ENDLINE_Z - 0.6;
          resolveShot('goal');
        } else {
          ballVelocity.set(0,0,0);
          ball.position.z = Math.min(ball.position.z, ENDLINE_Z - 0.8);
          resolveShot('miss');
        }
      }

      // fail-safe
      if (shotActive && !shotResolved && ball.position.z < ENDLINE_Z - 6) {
        ballVelocity.set(0,0,0);
        resolveShot('miss');
      }
    } else if (performance.now() >= holdUntil) {
      finalizeHold();
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  drawMarkings();
});