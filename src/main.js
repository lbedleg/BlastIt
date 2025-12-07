/* global io */
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Scoring } from './systems/Scoring.js';
import { Goalkeeper } from './entities/Goalkeeper.js';
import { AudioSystem } from './systems/Audio.js';
import { PlayerAvatar } from './entities/Player.js';

let audio = null;

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

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.6, 4.5);
camera.lookAt(0, 1.2, -8);

let light = new THREE.DirectionalLight(0xffffff, 1.6);
light.position.set(5, 10, 3);
light.castShadow = true;
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

/* =======================
   AUDIO
======================= */
audio = new AudioSystem(camera);

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
const settingsPanel    = document.getElementById('settingsPanel');
const settingsBtn      = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const dayBtn           = document.getElementById('dayBtn');
const nightBtn         = document.getElementById('nightBtn');
const volumeSlider     = document.getElementById('volumeSlider');
const menuEl           = document.getElementById('menu');

let currentMode = 'day';
function applyMode(mode) {
  currentMode = mode;
  const isNight = mode === 'night';

  dayBtn?.setAttribute('aria-pressed', String(!isNight));
  nightBtn?.setAttribute('aria-pressed', String(isNight));

  if (light) {
    light.intensity = isNight ? 0.35 : 1.8;
    light.color.set(isNight ? 0x88aaff : 0xffffff);
  }

  const amb = scene.children.find((o) => o.isAmbientLight);
  if (amb) amb.intensity = isNight ? 0.12 : 0.3;

  scene.backgroundIntensity = isNight ? 0.18 : 0.7;
  scene.environmentIntensity = isNight ? 0.42 : 0.9;

  renderer.toneMappingExposure = isNight ? 0.68 : 1.05;
}

settingsBtn?.addEventListener('click', () => {
  menuEl?.classList.add('hidden');
  settingsPanel?.classList.remove('hidden');
});
closeSettingsBtn?.addEventListener('click', () => {
  settingsPanel?.classList.add('hidden');
  menuEl?.classList.remove('hidden');
});

dayBtn?.addEventListener('click', () => applyMode('day'));
nightBtn?.addEventListener('click', () => applyMode('night'));

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
   SOCKET / MULTIPLAYER
======================= */

const socket = io();
let myId = null;

let localPlayer = null;
const remotePlayers = new Map(); // id -> PlayerAvatar
let input = { left: false, right: false };

// ask name + color
const playerNameRaw = window.prompt('Enter your player name:', 'Player');
const playerName = playerNameRaw && playerNameRaw.trim() ? playerNameRaw.trim() : 'Player';

let colorRaw = window.prompt('Pick your color (blue/red):', 'blue');
colorRaw = (colorRaw || 'blue').trim().toLowerCase();
let playerColor = colorRaw === 'red' ? 'red' : 'blue';

// HUD refs for 1v1 scoreboard & ready
const meNameEl   = document.getElementById('meName');
const meColorEl  = document.getElementById('meColor');
const meWinsEl   = document.getElementById('meWins');
const mePointsEl = document.getElementById('mePoints');

const oppNameEl   = document.getElementById('oppName');
const oppColorEl  = document.getElementById('oppColor');
const oppWinsEl   = document.getElementById('oppWins');
const oppPointsEl = document.getElementById('oppPoints');

const readyBar     = document.getElementById('readyBar');
const readyBtn     = document.getElementById('readyBtn');
const readyStatus  = document.getElementById('readyStatus');
let isReady = false;

socket.on('connect', () => {
  myId = socket.id;
  socket.emit('join', { name: playerName, color: playerColor });
});

socket.on('sessionFull', () => {
  alert('Session is full (1v1 only).');
});

// full player list on join
socket.on('currentPlayers', (players) => {
  setupPlayersFromState(players);
});

// new player joined
socket.on('playerJoined', (p) => {
  if (p.id === myId) return;
  createRemotePlayer(p);
  updateScoreboardForPlayers(playersFromMap());
});

// remote player movement
socket.on('playerMoved', ({ id, x, z }) => {
  const remote = remotePlayers.get(id);
  if (remote) remote.setPosition(x, z);
});

// player left
socket.on('playerLeft', ({ id }) => {
  const remote = remotePlayers.get(id);
  if (remote && remote.mesh) scene.remove(remote.mesh);
  remotePlayers.delete(id);
  updateScoreboardForPlayers(playersFromMap());
});

// scoreboard updates from server
socket.on('scoreUpdate', ({ players }) => {
  updateScoreboardForPlayers(players);
});

// match over (server decides winner)
socket.on('matchOver', ({ winnerId, loserId, reason, players }) => {
  const iWon = winnerId === myId;
  updateScoreboardForPlayers(players);
  showMatchOver(iWon, reason);
});

// ready counts 0/2, 1/2, 2/2
socket.on('readyStatus', ({ readyCount, totalPlayers }) => {
  if (readyStatus) {
    readyStatus.textContent = `Ready: ${readyCount}/${totalPlayers}`;
  }
});

// server tells both to start new match
socket.on('newMatchStart', ({ players }) => {
  isReady = false;
  if (readyBtn) readyBtn.textContent = 'Ready';
  if (readyBar) readyBar.classList.add('hidden');

  gameOver.classList.add('hidden');
  showHUD();
  resetWholeScene();
  scoring.reset();
  gameState = GameState.PLAYING;
  updateScoreboardForPlayers(players);
});

// session over (someone quit / disconnected)
socket.on('sessionOver', () => {
  gameState = GameState.MENU;
  showMenu();
  hideHUD();
  if (readyBar) readyBar.classList.add('hidden');
});

readyBtn?.addEventListener('click', () => {
  isReady = !isReady;
  readyBtn.textContent = isReady ? 'Unready' : 'Ready';
  socket.emit('playerReady', { ready: isReady });
});

function setupPlayersFromState(players) {
  Object.values(players).forEach((p) => {
    if (p.id === myId) {
      createLocalPlayer(p);
      playerColor = p.color; // authoritative color from server
    } else {
      createRemotePlayer(p);
    }
  });
  updateScoreboardForPlayers(players);
}

function playersFromMap() {
  const obj = {};
  if (localPlayer && myId) {
    obj[myId] = {
      id: myId,
      name: localPlayer.name,
      color: playerColor,
      points: scoring.score,
      wins: 0,
    };
  }
  remotePlayers.forEach((avatar, id) => {
    obj[id] = {
      id,
      name: avatar.name,
      color: avatar.teamColor,
      points: 0,
      wins: 0,
    };
  });
  return obj;
}

/* =======================
   PITCH & CONSTANTS
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

const groundY = 0;
const keeperHalfHeight = 0.95;

const GOAL_Z    = -7.5;
const ENDLINE_Z = GOAL_Z;
const KEEPER_Z  = GOAL_Z + 0.15;

const GOAL_HALF_WIDTH = 3.6;
const GOAL_HEIGHT     = 2.5;

// lateral margin inside posts for blockers
const BLOCKER_MARGIN = 0.3;
const BLOCKER_MIN_X = -GOAL_HALF_WIDTH + BLOCKER_MARGIN;
const BLOCKER_MAX_X =  GOAL_HALF_WIDTH - BLOCKER_MARGIN;

const BOX_DEPTH = 5.5;
const BOX_WIDTH = BOX_DEPTH * (40.32 / 16.5);
const SIX_DEPTH = BOX_DEPTH * ( 5.50 / 16.5);
const SIX_WIDTH = BOX_DEPTH * (18.32 / 16.5);

/* =======================
   VIEWPORT / MARKINGS
======================= */
function viewportWidthAtZ(zWorld){
  const dist = Math.abs(camera.position.z - zWorld);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const height = 2 * Math.tan(vFov/2) * dist;
  return height * (renderer.domElement.width / renderer.domElement.height);
}

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
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
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
  addStripe(-L/2, ENDLINE_Z, L/2, ENDLINE_Z);

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

  const PEN_SPOT_Z = ENDLINE_Z + BOX_DEPTH * (11 / 16.5);
  addDisk(0, PEN_SPOT_Z, 0.09);
}
drawMarkings();

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

gltfLoader.load(`${ASSET_BASE}models/goal.glb`, (gltf) => {
  goal = gltf.scene;
  goal.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }});
  goal.scale.setScalar(0.85);
  goal.position.set(0, 1.10, ENDLINE_Z);
  scene.add(goal);

  goal.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(goal);
  const frontZ = box.max.z;
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
const scoreEl    = document.getElementById('score');
const attemptsEl = document.getElementById('attempts');
const hud = {
  setScore: (v) => { scoreEl.textContent    = `Score: ${v}`; },
  setShot:  (n) => { attemptsEl.textContent = `Attempts: ${n}`; },
};
const scoring = new Scoring(hud);

/* =======================
   DIFFICULTY SCALING
======================= */
let difficultyLevel = 0;

// bump every 10 points
function maybeScaleDifficulty() {
  const newLevel = Math.floor(scoring.score / 10);
  if (newLevel > difficultyLevel) {
    difficultyLevel = newLevel;
    if (keeper?.bumpSpeedScale) keeper.bumpSpeedScale(1.2);
    else if (keeper?.setSpeedScale && keeper?.getSpeedScale) {
      keeper.setSpeedScale(keeper.getSpeedScale() * 1.2);
    }
  }
}

/* =======================
   UI & GAME STATE
======================= */
const hudWrap      = document.getElementById('hud');
const menu         = document.getElementById('menu');
const playBtn      = document.getElementById('playBtn');
const gameOver     = document.getElementById('gameOver');
const finalScore   = document.getElementById('finalScore');
const playAgainBtn = document.getElementById('playAgainBtn');
const quitBtn      = document.getElementById('quitBtn');
const gameOverTitle= document.getElementById('gameOverTitle');

const GameState = { MENU:'MENU', PLAYING:'PLAYING', GAME_OVER:'GAME_OVER' };
let gameState = GameState.MENU;

function showMenu(){ menu?.classList.remove('hidden'); }
function hideMenu(){ menu?.classList.add('hidden'); }
function showHUD(){ hudWrap?.classList.remove('hidden'); }
function hideHUD(){ hudWrap?.classList.add('hidden'); }
function hideGameOver(){ gameOver?.classList.add('hidden'); }

function showMatchOver(iWon, reason) {
  gameState = GameState.GAME_OVER;

  const reasonText =
    reason === 'points'
      ? (iWon ? 'You reached 50 points first.' : 'Opponent reached 50 points first.')
      : (iWon ? 'Opponent missed 3 shots in a row.' : 'You missed 3 shots in a row.');

  gameOver.classList.remove('hidden', 'win', 'lose');
  gameOver.classList.add(iWon ? 'win' : 'lose');

  if (gameOverTitle) gameOverTitle.textContent = iWon ? 'YOU WIN!' : 'YOU LOSE';
  if (finalScore)    finalScore.textContent    = reasonText;

  hideHUD();
  audio.play('whistle');

  if (readyBar) readyBar.classList.remove('hidden');
}

function initUIState(){
  gameState = GameState.MENU;
  showMenu();
  hideGameOver();
  hideHUD();
  if (readyBar) readyBar.classList.add('hidden');
  scoring.reset();
}

function resetWholeScene(){
  ball.position.set(0,ballRadius,0);
  ballVelocity.set(0,0,0);

  canShoot     = true;
  shotActive   = false;
  shotResolved = false;
  holdActive   = false;
  holdUntil    = 0;

  aimingYaw = 0;
  aimingPitch = -0.1;
  updateAim(getAimDirection());
  if (keeper?.mesh) keeper.mesh.position.set(0, 0.95, KEEPER_Z);

  showAimArrow(true);
}

function startNewGame(){
  hideMenu();
  hideGameOver();
  if (readyBar) readyBar.classList.add('hidden');
  resetWholeScene();
  scoring.reset();
  showHUD();

  canShoot = true;
  shotActive = false;
  shotResolved = false;
  holdActive = false;
  holdUntil = 0;

  difficultyLevel = 0;
  if (keeper?.setSpeedScale) keeper.setSpeedScale(1);

  gameState = GameState.PLAYING;
  showAimArrow(true);
  audio.play('whistle');
}

playBtn?.addEventListener('click', startNewGame);

playAgainBtn?.addEventListener('click', () => {
  if (gameState === GameState.GAME_OVER && readyBtn) {
    readyBtn.click(); // play again -> toggle ready
  }
});

quitBtn?.addEventListener('click', () => {
  hideGameOver();
  if (readyBar) readyBar.classList.add('hidden');
  showMenu();
  hideHUD();
  gameState = GameState.MENU;
  resetWholeScene();
  scoring.reset();
  socket.disconnect();
});

initUIState();

/* =======================
   INPUT / SHOOTING
======================= */
let aimingYaw = 0, aimingPitch = -0.1;
const aimSpeed = 0.03;

function getAimDirection(){
  const dir = new THREE.Vector3(0,0,-1);
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(aimingPitch, aimingYaw, 0, 'YXZ')
  );
  return dir.applyQuaternion(q).normalize();
}

// arrows ONLY for cursor/aim
function handleAimKey(code){
  if (gameState !== GameState.PLAYING) return;
  if (code === 'ArrowLeft')  aimingYaw += aimSpeed;
  if (code === 'ArrowRight') aimingYaw -= aimSpeed;
  if (code === 'ArrowUp')    aimingPitch += aimSpeed;
  if (code === 'ArrowDown')  aimingPitch -= aimSpeed;
  aimingPitch = THREE.MathUtils.clamp(aimingPitch, -0.6, 0.4);
  updateAim(getAimDirection());
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const code = e.code;
  const key  = e.key;

  if (code === 'Space') {
    if (gameState !== GameState.PLAYING || !canShoot) return;
    shoot();
    return;
  }

  if (code === 'KeyR') {
    if (gameState === GameState.PLAYING) startNewGame();
    return;
  }

  // arrows = aim
  if (code === 'ArrowLeft' || code === 'ArrowRight' ||
      code === 'ArrowUp'   || code === 'ArrowDown') {
    handleAimKey(code);
    return;
  }

  // A/D = move vision-blocker (support code + key for safety)
  if (code === 'KeyA' || key === 'a' || key === 'A') {
    input.left = true;
    return;
  }
  if (code === 'KeyD' || key === 'd' || key === 'D') {
    input.right = true;
    return;
  }
});

window.addEventListener('keyup', (e) => {
  const code = e.code;
  const key  = e.key;

  if (code === 'KeyA' || key === 'a' || key === 'A') input.left  = false;
  if (code === 'KeyD' || key === 'd' || key === 'D') input.right = false;
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
  audio.duck(0.15, 300);
}

function resolveShot(result){
  if (shotResolved) return;
  shotResolved = true;

  if (result === 'goal') {
    audio.play('goal');
    audio.duck(0.12, 1200);
  } else {
    audio.play('miss');
    audio.duck(0.08, 800);
  }

  scoring.onShot(result);
  maybeScaleDifficulty();

  socket.emit('shotResult', { result });

  scheduleHold();
}

function scheduleHold(){
  holdActive = true;
  holdUntil = performance.now() + 667;
}

function finalizeHold(){
  holdActive = false;
  shotActive = false;
  if (gameState !== GameState.GAME_OVER) {
    setTimeout(() => {
      if (gameState === GameState.PLAYING) {
        canShoot = true;
        showAimArrow(true);
        resetBallForNext();
      }
    }, 300);
  }
}

function resetBallForNext(){
  ball.position.set(0,ballRadius,0);
  ballVelocity.set(0,0,0);
}

/* =======================
   LOOP / COLLISIONS
======================= */
const dt = 1/60;
const tmpBox = new THREE.Box3();
const tmpVec = new THREE.Vector3();

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

  if (keeper) keeper.update(dt);

  // local player movement + sync (clamped to posts)
  if (localPlayer) {
    const moved = localPlayer.updateFromInput(input, dt);
    if (moved) {
      const { x, z } = localPlayer.getPosition();
      socket.emit('playerMove', { x, z });
    }
  }

  if (gameState === GameState.PLAYING) {
    if (!holdActive) {
      ball.position.addScaledVector(ballVelocity, dt);
      ballVelocity.multiplyScalar(0.99);
      if (ball.position.y < ballRadius) ball.position.y = ballRadius;

      // --- Keeper collision (sphere vs AABB) ---
      const kBox = keeper?.getAABB?.(tmpBox);
      if (shotActive && !shotResolved && kBox) {
        const closest = kBox.clampPoint(ball.position, tmpVec.set(0,0,0));
        const d2 = closest.distanceToSquared(ball.position);
        const r2 = ballRadius * ballRadius;

        if (d2 <= r2) {
          const normal = ball.position.clone().sub(closest).normalize();
          ball.position.add(
            normal.clone().multiplyScalar((ballRadius - Math.sqrt(d2)) + 0.002)
          );
          ballVelocity.copy(reflectVelocity(ballVelocity, normal, 0.6));
          resolveShot('save');
        }
      }

      // --- Player blocker collisions (OPPONENT ONLY) ---
      if (shotActive && !shotResolved) {
        const blockers = [];

        // Only consider remote players whose color differs from the local player's color.
        // If you're red, only blue blocks. If you're blue, only red blocks.
        remotePlayers.forEach((p) => {
          if (p.teamColor && p.teamColor !== playerColor) {
            blockers.push(p);
          }
        });

        // Simple sphere-vs-sphere style collision:
        // - ball is at ball.position with radius ballRadius
        // - blocker is approximated as a sphere of radius BLOCKER_RADIUS
        const BLOCKER_RADIUS = 0.4; // tweak if they feel too big/small

        for (const blocker of blockers) {
          // Use the blocker’s current X/Z position
          const { x, z } = blocker.getPosition
            ? blocker.getPosition()
            : { x: blocker.mesh?.position.x || 0, z: blocker.mesh?.position.z || 0 };

          // Approximate the blocker centre at same Y as ball for simplicity
          tmpVec.set(x, ball.position.y, z);

          const d2 = tmpVec.distanceToSquared(ball.position);
          const combinedR = ballRadius + BLOCKER_RADIUS;
          const combinedR2 = combinedR * combinedR;

          if (d2 <= combinedR2) {
            const dist = Math.sqrt(d2) || 0.0001;
            const normal = ball.position.clone().sub(tmpVec).divideScalar(dist);

            // Push ball out of the blocker
            const penetration = combinedR - dist;
            ball.position.add(
              normal.clone().multiplyScalar(penetration + 0.002)
            );

            // Reflect ball velocity (slightly less bouncy than keeper)
            ballVelocity.copy(reflectVelocity(ballVelocity, normal, 0.55));

            resolveShot('save');
            break; // one blocker is enough
          }
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

      if (shotActive && !shotResolved && ball.position.z < ENDLINE_Z - 6) {
        ballVelocity.set(0,0,0);
        resolveShot('miss');
      }
    } else if (now >= holdUntil) {
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

/* =======================
   PLAYER CREATION & SCOREBOARD
======================= */
function createLocalPlayer(p) {
  if (localPlayer) return;

  const spawnZ = KEEPER_Z; // same line as keeper
  const spawnX = p.color === 'red' ? 2.5 : -2.5;

  localPlayer = new PlayerAvatar({
    scene,
    isLocal: true,
    name: p.name,
    teamColor: p.color,
    spawnZ,
    bounds: { minX: BLOCKER_MIN_X, maxX: BLOCKER_MAX_X },
  });
  localPlayer.setPosition(spawnX, spawnZ);
}

function createRemotePlayer(p) {
  if (remotePlayers.has(p.id)) return;

  const spawnZ = KEEPER_Z;
  const spawnX = p.color === 'red' ? 2.5 : -2.5;

  const avatar = new PlayerAvatar({
    scene,
    isLocal: false,
    name: p.name,
    teamColor: p.color,
    spawnZ,
    bounds: { minX: BLOCKER_MIN_X, maxX: BLOCKER_MAX_X },
  });
  avatar.setPosition(spawnX, spawnZ);
  remotePlayers.set(p.id, avatar);
}

function updateScoreboardForPlayers(players) {
  if (!myId) return;
  const me  = players[myId];
  const opp = Object.values(players).find((p) => p.id !== myId);

  if (me) {
    if (meNameEl)   meNameEl.textContent   = me.name;
    if (meColorEl)  meColorEl.textContent  = `Color: ${me.color}`;
    if (meWinsEl)   meWinsEl.textContent   = `Wins: ${me.wins ?? 0}`;
    if (mePointsEl) mePointsEl.textContent = `Points: ${me.points ?? 0}`;
  }

  if (opp) {
    if (oppNameEl)   oppNameEl.textContent   = opp.name;
    if (oppColorEl)  oppColorEl.textContent  = `Color: ${opp.color}`;
    if (oppWinsEl)   oppWinsEl.textContent   = `Wins: ${opp.wins ?? 0}`;
    if (oppPointsEl) oppPointsEl.textContent = `Points: ${opp.points ?? 0}`;
  } else {
    if (oppNameEl)   oppNameEl.textContent   = 'Waiting...';
    if (oppColorEl)  oppColorEl.textContent  = '';
    if (oppWinsEl)   oppWinsEl.textContent   = '';
    if (oppPointsEl) oppPointsEl.textContent = '';
  }
}