import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = new URLSearchParams(location.search);
const VIEW_KEY = params.get('key') ?? '';
const DEMO = params.has('demo');
const IS_MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 720;

const $ = (sel) => document.querySelector(sel);
const stage = $('#stage');
const listEl = $('#list');
const logEl = $('#log');
const countsEl = $('#counts');
const emptyEl = $('#empty');
const connEl = $('#conn');
const panel = $('#panel');

// ---------------------------------------------------------------- 定数 ----
const COLS = 4;
const SPACE_X = 3.4;
const SPACE_Z = 3.6;
const MIN_ROWS = 2;
const MAX_SLOTS = 60;

const STATUS_LABEL = { working: '作業中', waiting: '承認待ち', idle: '待機中', sleeping: '無信号', left: '退社' };
const STATUS_COLOR = { working: '#3f9d4a', waiting: '#d9443b', idle: '#8a8578', sleeping: '#6b7fa8' };
const TOOL_LABEL = {
  thinking: '考え中', Edit: '編集中', MultiEdit: '編集中', Write: '編集中', NotebookEdit: '編集中',
  Read: '読み込み中', Grep: '検索中', Glob: '検索中', Bash: 'コマンド実行', WebSearch: '調査中',
  WebFetch: '調査中', Task: '指示出し', Agent: '指示出し', compact: '整理中',
};

const hash = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};
const projectColor = (project) => new THREE.Color().setHSL((hash(project) % 360) / 360, 0.55, 0.52);
const SKIN = [0xf1c9a5, 0xe0ac86, 0xc68b62, 0x8d5a3b];
const HAIR = [0x2b2118, 0x5a3a22, 0x1a1a1a, 0x8a6a3a, 0x6d6d6d];
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

// ---------------------------------------------------------------- シーン ----
const renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_MOBILE ? 1.5 : 2));
renderer.shadowMap.enabled = !IS_MOBILE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const dark = matchMedia('(prefers-color-scheme: dark)').matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color(dark ? 0x26231e : 0xf3ecdf);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.46;
controls.minDistance = 4;
controls.maxDistance = 40;
controls.screenSpacePanning = false;

scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c8a8, 1.0));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
sun.position.set(8, 14, 10);
sun.castShadow = !IS_MOBILE;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
scene.add(sun);

const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
function box(w, h, d, color, x = 0, y = 0, z = 0, { cast = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color.isMaterial ? color : mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

function disposeTree(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose?.();
    const m = obj.material;
    if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose(); });
  });
}

// ---------------------------------------------------------------- ラベル ----
function makeLabel(width, height, worldWidth) {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(worldWidth, (worldWidth * height) / width, 1);
  sprite.renderOrder = 10;
  return {
    sprite,
    draw(fn) {
      ctx.clearRect(0, 0, width, height);
      fn(ctx, width, height);
      texture.needsUpdate = true;
    },
  };
}
const FONT = '"Hiragino Sans","Noto Sans JP",system-ui,sans-serif';
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---------------------------------------------------------------- 部屋 ----
const room = new THREE.Group();
scene.add(room);
let rows = 0;
let layout = null;
const slotPos = (index) => ({ x: ((index % COLS) - (COLS - 1) / 2) * SPACE_X, z: Math.floor(index / COLS) * SPACE_Z });
const desks = [];

function buildRoom(rowCount) {
  rows = rowCount;
  disposeTree(room);
  room.clear();
  desks.length = 0;
  const width = COLS * SPACE_X + 3;
  const zMin = -3.4;
  const zMax = (rowCount - 1) * SPACE_Z + 3.2;
  const depth = zMax - zMin;
  layout = {
    width, zMin, zMax,
    aisleX: -width / 2 + 1.1,
    doorZ: zMax - 1.0,
    doorX: -width / 2,
    cx: 0, cz: (zMin + zMax) / 2,
  };

  const floor = box(width, 0.2, depth, dark ? 0x6b5a42 : 0xd9c4a0, 0, -0.1, layout.cz, { cast: false });
  room.add(floor);
  const wallColor = dark ? 0x58503f : 0xefe6d4;
  room.add(box(width, 2.4, 0.2, wallColor, 0, 1.2, zMin - 0.1));
  const doorGap = 1.6;
  const leftLen1 = layout.doorZ - doorGap / 2 - zMin;
  const leftLen2 = zMax - (layout.doorZ + doorGap / 2);
  room.add(box(0.2, 2.4, leftLen1, wallColor, -width / 2 - 0.1, 1.2, zMin + leftLen1 / 2));
  if (leftLen2 > 0.05) room.add(box(0.2, 2.4, leftLen2, wallColor, -width / 2 - 0.1, 1.2, zMax - leftLen2 / 2));
  room.add(box(0.2, 0.5, doorGap, wallColor, -width / 2 - 0.1, 2.15, layout.doorZ));
  room.add(box(0.5, 0.04, 1.2, 0xb94a3d, -width / 2 + 0.5, 0.02, layout.doorZ, { cast: false }));

  // 観葉植物とコーヒーコーナー
  const plant = new THREE.Group();
  plant.add(box(0.5, 0.45, 0.5, 0xa5673f, 0, 0.22, 0));
  plant.add(box(0.7, 0.9, 0.7, 0x4f8f4a, 0, 0.95, 0));
  plant.position.set(width / 2 - 0.8, 0, zMin + 0.8);
  room.add(plant);
  const coffee = new THREE.Group();
  coffee.add(box(1.4, 0.9, 0.6, 0x7a6a58, 0, 0.45, 0));
  coffee.add(box(0.5, 0.5, 0.4, 0x2d2d2d, -0.3, 1.15, 0));
  coffee.position.set(width / 2 - 2.6, 0, zMin + 0.5);
  room.add(coffee);

  for (let i = 0; i < rowCount * COLS; i += 1) {
    const { x, z } = slotPos(i);
    const desk = buildDesk(x, z);
    desks.push(desk);
    room.add(desk.group);
  }
  sun.target.position.set(0, 0, layout.cz);
  scene.add(sun.target);
}

function buildDesk(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.add(box(1.7, 0.07, 0.85, 0xb98a5a, 0, 0.74, 0));
  for (const sx of [-0.78, 0.78]) group.add(box(0.06, 0.7, 0.7, 0x8a6a45, sx, 0.36, 0));
  // 椅子（人は z のマイナス側に座り、+z の手前＝カメラ側を向く）
  group.add(box(0.55, 0.08, 0.55, 0x3d4a5c, 0, 0.45, -0.95));
  group.add(box(0.55, 0.55, 0.08, 0x3d4a5c, 0, 0.75, -1.25));
  group.add(box(0.08, 0.4, 0.08, 0x2d2d2d, 0, 0.22, -0.95));
  // ノート PC（画面の裏側がカメラ側。裏のライトが状態色になる）
  group.add(box(0.55, 0.03, 0.38, 0x9a9a9a, 0, 0.8, 0.02, { cast: false }));
  const lid = new THREE.Group();
  lid.position.set(0, 0.82, -0.15);
  lid.rotation.x = -0.25;
  lid.add(box(0.55, 0.36, 0.03, 0x8c8c8c, 0, 0.18, 0));
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
  const light = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), lightMat);
  light.position.set(0, 0.18, 0.02);
  lid.add(light);
  group.add(lid);
  group.add(box(0.12, 0.12, 0.12, 0xe8e0d0, 0.62, 0.83, 0.15, { cast: false }));
  // 机の名札
  const plate = makeLabel(256, 64, 1.9);
  plate.sprite.position.set(0, 1.1, 0.55);
  group.add(plate.sprite);
  plate.draw((ctx, w, h) => { ctx.clearRect(0, 0, w, h); });
  return { group, lightMat, plate, x, z };
}

// ---------------------------------------------------------------- キャラクター ----
function buildPerson(shirt, skin, hair, scale = 1) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = box(0.5, 0.62, 0.3, shirt, 0, 0.31, 0);
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 0.8, 0);
  head.add(box(0.36, 0.36, 0.34, skin, 0, 0, 0));
  head.add(box(0.38, 0.14, 0.36, hair, 0, 0.2, -0.01));
  head.add(box(0.38, 0.3, 0.1, hair, 0, 0.04, -0.15));
  head.add(box(0.05, 0.07, 0.02, 0x222222, -0.09, 0.02, 0.175, { cast: false }));
  head.add(box(0.05, 0.07, 0.02, 0x222222, 0.09, 0.02, 0.175, { cast: false }));
  body.add(head);
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.32, 0.56, 0);
    const arm = box(0.14, 0.55, 0.14, shirt, 0, -0.26, 0);
    pivot.add(arm);
    pivot.add(box(0.13, 0.13, 0.13, skin, 0, -0.56, 0, { cast: false }));
    body.add(pivot);
    return pivot;
  });
  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.13, 0, 0);
    pivot.add(box(0.18, 0.6, 0.2, 0x3a3f4d, 0, -0.3, 0));
    root.add(pivot);
    return pivot;
  });
  root.scale.setScalar(scale);
  return { root, body, head, arms, legs };
}

const actors = new Map();
const slotOwner = new Array(MAX_SLOTS).fill(null);
const tmpV = new THREE.Vector3();

class Actor {
  constructor(session) {
    this.id = session.id;
    this.data = session;
    this.slot = -1;
    this.color = projectColor(session.project);
    const h = hash(session.id);
    this.person = buildPerson(this.color, SKIN[h % SKIN.length], HAIR[(h >>> 3) % HAIR.length]);
    this.group = new THREE.Group();
    this.group.add(this.person.root);
    this.bubble = makeLabel(256, 80, 1.9);
    this.bubble.sprite.position.set(0, 2.25, 0);
    this.group.add(this.bubble.sprite);
    this.minis = [];
    this.path = [];
    this.leaving = false;
    this.sit = 0;
    this.phase = Math.random() * 10;
    this.bubbleKey = '';
    scene.add(this.group);
  }

  seat() {
    const { x, z } = slotPos(this.slot);
    return new THREE.Vector3(x, 0, z - 0.95);
  }

  placeAtDoor() {
    this.group.position.set(layout.doorX + 0.3, 0, layout.doorZ);
  }

  // 玄関 → 通路 → 席 の順に歩く
  walkToSeat() {
    const seat = this.seat();
    this.path = [
      new THREE.Vector3(layout.aisleX, 0, layout.doorZ),
      new THREE.Vector3(layout.aisleX, 0, seat.z - 0.9),
      new THREE.Vector3(seat.x, 0, seat.z - 0.9),
      seat,
    ];
  }

  walkOut() {
    this.leaving = true;
    const here = this.group.position;
    this.path = [
      new THREE.Vector3(here.x, 0, here.z - 0.9),
      new THREE.Vector3(layout.aisleX, 0, here.z - 0.9),
      new THREE.Vector3(layout.aisleX, 0, layout.doorZ),
      new THREE.Vector3(layout.doorX - 0.8, 0, layout.doorZ),
    ];
  }

  syncMinis(count) {
    const want = Math.min(count, 4);
    while (this.minis.length < want) {
      const mini = buildPerson(this.color.clone().offsetHSL(0.05, 0, 0.1), SKIN[(this.minis.length + 1) % SKIN.length], HAIR[this.minis.length % HAIR.length], 0.55);
      mini.root.rotation.y = 0;
      this.group.add(mini.root);
      this.minis.push(mini);
    }
    while (this.minis.length > want) {
      const mini = this.minis.pop();
      this.group.remove(mini.root);
      disposeTree(mini.root);
    }
  }

  drawBubble() {
    const { status, tool, detail } = this.data;
    const text = status === 'working' ? (TOOL_LABEL[tool] ?? tool ?? '作業中') : STATUS_LABEL[status] ?? '';
    const sub = status === 'working' && detail ? detail : status === 'waiting' ? '呼ばれています' : '';
    const key = `${status}|${text}|${sub}`;
    if (key === this.bubbleKey) return;
    this.bubbleKey = key;
    this.bubble.draw((ctx, w, h) => {
      ctx.fillStyle = STATUS_COLOR[status] ?? '#8a8578';
      roundRect(ctx, 6, 4, w - 12, h - 18, 16);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w / 2 - 8, h - 14);
      ctx.lineTo(w / 2 + 8, h - 14);
      ctx.lineTo(w / 2, h - 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const prefix = status === 'waiting' ? '！' : status === 'sleeping' ? 'Zzz ' : '';
      ctx.font = `700 ${sub ? 22 : 26}px ${FONT}`;
      ctx.fillText(`${prefix}${text}`, w / 2, sub ? 26 : (h - 14) / 2 + 2, w - 28);
      if (sub) {
        ctx.font = `500 16px ${FONT}`;
        ctx.fillText(sub, w / 2, 50, w - 28);
      }
    });
  }

  update(dt, t) {
    const { person } = this;
    const walking = this.path.length > 0;
    if (walking) {
      const target = this.path[0];
      tmpV.subVectors(target, this.group.position);
      tmpV.y = 0;
      const dist = tmpV.length();
      const step = 2.6 * dt;
      if (dist <= step) {
        this.group.position.copy(target);
        this.path.shift();
      } else {
        tmpV.multiplyScalar(1 / dist);
        this.group.position.addScaledVector(tmpV, step);
        person.root.rotation.y = damp(person.root.rotation.y, Math.atan2(tmpV.x, tmpV.z), 12, dt);
      }
      if (!this.path.length && this.leaving) {
        removeActor(this.id);
        return;
      }
    }
    const arrived = !walking && !this.leaving;
    this.sit = damp(this.sit, arrived ? 1 : 0, 8, dt);
    if (arrived) person.root.rotation.y = damp(person.root.rotation.y, 0, 8, dt);

    // 歩行 / 着席の姿勢
    const swing = walking ? Math.sin(t * 9 + this.phase) : 0;
    person.root.position.y = 0;
    person.body.position.y = 0.6 - 0.15 * this.sit + (walking ? Math.abs(swing) * 0.05 : 0);
    person.legs.forEach((leg, i) => {
      const side = i === 0 ? 1 : -1;
      leg.position.y = person.body.position.y;
      leg.rotation.x = -Math.PI / 2 * this.sit + swing * 0.7 * side * (1 - this.sit);
    });

    // 腕と頭（状態別）
    const status = this.data.status;
    let leftX = -0.1 + swing * 0.6;
    let rightX = -0.1 - swing * 0.6;
    let rightZ = 0;
    let headX = 0;
    let headY = 0;
    let bobY = 0;
    if (this.sit > 0.5) {
      if (status === 'working') {
        leftX = -1.35 + Math.sin(t * 17 + this.phase) * 0.13;
        rightX = -1.35 + Math.sin(t * 17 + this.phase + 2) * 0.13;
        headX = 0.08 + Math.sin(t * 2.4 + this.phase) * 0.03;
      } else if (status === 'waiting') {
        leftX = -1.0;
        rightX = -Math.PI + 0.25;
        rightZ = Math.sin(t * 7) * 0.3 - 0.1;
        bobY = Math.abs(Math.sin(t * 5)) * 0.04;
      } else if (status === 'sleeping') {
        leftX = -0.7;
        rightX = -0.7;
        headX = 0.55;
      } else {
        leftX = -1.05;
        rightX = -1.05;
        headY = Math.sin(t * 0.7 + this.phase) * 0.45;
        headX = Math.sin(t * 0.5 + this.phase) * 0.05;
      }
    }
    const [armL, armR] = person.arms;
    armL.rotation.x = damp(armL.rotation.x, leftX, 14, dt);
    armR.rotation.x = damp(armR.rotation.x, rightX, 14, dt);
    armR.rotation.z = damp(armR.rotation.z, rightZ, 14, dt);
    person.head.rotation.x = damp(person.head.rotation.x, headX, 6, dt);
    person.head.rotation.y = damp(person.head.rotation.y, headY, 6, dt);
    person.body.position.y += bobY;

    this.minis.forEach((mini, i) => {
      mini.root.position.set(1.15 + i * 0.5, 0, 0.35 - (i % 2) * 0.5);
      mini.root.rotation.y = -0.5;
      mini.body.position.y = 0.6 + Math.abs(Math.sin(t * 6 + i)) * 0.04;
      mini.arms.forEach((arm, k) => { arm.rotation.x = -1.2 + Math.sin(t * 14 + i + k) * 0.12; });
      mini.legs.forEach((leg) => { leg.position.y = mini.body.position.y; });
    });

    this.bubble.sprite.visible = !walking;
    this.bubble.sprite.position.y = 2.25 + (status === 'waiting' ? Math.abs(Math.sin(t * 5)) * 0.12 : 0);
  }

  dispose() {
    scene.remove(this.group);
    disposeTree(this.group);
  }
}

// ---------------------------------------------------------------- セッション管理 ----
const sessions = new Map();
let selectedId = null;
let selectionRing = null;

function ensureRows(needed) {
  const wanted = Math.max(MIN_ROWS, Math.ceil(needed / COLS));
  if (wanted !== rows) buildRoom(wanted);
  // 部屋を作り直したので、机の見た目を現在の状態に合わせ直す
  for (const [id, actor] of actors) paintDesk(actor, id);
}

function paintDesk(actor) {
  const desk = desks[actor.slot];
  if (!desk) return;
  desk.lightMat.color.set(STATUS_COLOR[actor.data.status] ?? '#555555');
  desk.plate.draw((ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,250,240,0.92)';
    roundRect(ctx, 2, 6, w - 4, h - 12, 12);
    ctx.fill();
    ctx.fillStyle = `#${actor.color.getHexString()}`;
    roundRect(ctx, 10, 18, 10, h - 36, 3);
    ctx.fill();
    ctx.fillStyle = '#3a3a3a';
    ctx.font = `700 22px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(actor.data.project, 28, h / 2 - 7, w - 40);
    ctx.fillStyle = '#7a7468';
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(`#${actor.data.short}`, 28, h / 2 + 13, w - 40);
  });
}

function upsertSession(session) {
  if (session.status === 'left') {
    sessions.delete(session.id);
    const actor = actors.get(session.id);
    if (actor && !actor.leaving) actor.walkOut();
    return;
  }
  sessions.set(session.id, session);
  let actor = actors.get(session.id);
  if (!actor) {
    let slot = slotOwner.indexOf(null);
    if (slot < 0) return;
    slotOwner[slot] = session.id;
    actor = new Actor(session);
    actor.slot = slot;
    actors.set(session.id, actor);
    ensureRows(Math.max(...slotOwner.map((o, i) => (o ? i + 1 : 0))));
    actor.placeAtDoor();
    actor.walkToSeat();
  }
  actor.data = session;
  actor.syncMinis(session.subagents);
  actor.drawBubble();
  paintDesk(actor);
}

function removeActor(id) {
  const actor = actors.get(id);
  if (!actor) return;
  slotOwner[actor.slot] = null;
  const desk = desks[actor.slot];
  desk?.lightMat.color.set(0x555555);
  desk?.plate.draw((ctx, w, h) => ctx.clearRect(0, 0, w, h));
  actor.dispose();
  actors.delete(id);
  sessions.delete(id);
  if (selectedId === id) select(null);
  renderUi();
}

function removeSession(id) {
  sessions.delete(id);
  const actor = actors.get(id);
  if (actor && !actor.leaving) actor.walkOut();
  renderUi();
}

// ---------------------------------------------------------------- UI ----
const events = [];
function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}秒前`;
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  return `${Math.floor(s / 3600)}時間前`;
}

function describe(session) {
  if (session.status === 'working') {
    const label = TOOL_LABEL[session.tool] ?? session.tool ?? '作業中';
    return session.detail ? `${label}: ${session.detail}` : label;
  }
  if (session.status === 'waiting') return session.message ?? '呼ばれています';
  return STATUS_LABEL[session.status];
}

let lastWaiting = 0;
function renderUi() {
  const list = [...sessions.values()].sort((a, b) => {
    const rank = { waiting: 0, working: 1, idle: 2, sleeping: 3 };
    return rank[a.status] - rank[b.status] || b.lastSeen - a.lastSeen;
  });
  listEl.replaceChildren(
    ...list.map((s) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `card${s.id === selectedId ? ' sel' : ''}`;
      const color = actors.get(s.id)?.color ?? projectColor(s.project);
      card.innerHTML = '<span class="sw"></span><span class="name"></span><span class="st"></span><span class="sub"></span>';
      card.querySelector('.sw').style.background = `#${color.getHexString()}`;
      const name = card.querySelector('.name');
      name.textContent = s.project;
      const small = document.createElement('small');
      small.textContent = `#${s.short}`;
      name.append(small);
      const st = card.querySelector('.st');
      st.textContent = STATUS_LABEL[s.status];
      st.classList.add(s.status);
      card.querySelector('.sub').textContent = `${describe(s)}${s.subagents ? ` ・部下${s.subagents}人` : ''} ・${ago(s.lastSeen)}`;
      card.addEventListener('click', () => select(s.id === selectedId ? null : s.id));
      return card;
    }),
  );

  const count = (status) => list.filter((s) => s.status === status).length;
  const waiting = count('waiting');
  countsEl.innerHTML = '';
  for (const [status, n] of [['working', count('working')], ['waiting', waiting], ['idle', count('idle') + count('sleeping')]]) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `${{ working: '作業', waiting: '承認待ち', idle: '待機' }[status]} <b>${n}</b>`;
    countsEl.append(chip);
  }
  emptyEl.classList.toggle('show', list.length === 0);
  document.title = `${waiting ? `(${waiting}) ` : ''}AI Office`;
  if (waiting > lastWaiting) {
    try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(120); } catch { /* 非対応端末 */ }
  }
  lastWaiting = waiting;
}

function renderLog() {
  logEl.replaceChildren(
    ...events.slice(-30).reverse().map((e) => {
      const li = document.createElement('li');
      const what = e.tool ? (TOOL_LABEL[e.tool] ?? e.tool) : e.type;
      li.textContent = `${new Date(e.ts).toLocaleTimeString('ja-JP')} ${e.project} ${what}${e.detail ? ` ${e.detail}` : ''}`;
      return li;
    }),
  );
}

let focusTarget = null;
function select(id) {
  selectedId = id;
  if (selectionRing) { scene.remove(selectionRing); disposeTree(selectionRing); selectionRing = null; }
  const actor = id ? actors.get(id) : null;
  if (actor) {
    selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.7, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffde59, side: THREE.DoubleSide }),
    );
    selectionRing.position.copy(actor.seat()).setY(0.03);
    scene.add(selectionRing);
    focusTarget = actor.seat().clone().setY(0.8);
  }
  renderUi();
}
controls.addEventListener('start', () => { focusTarget = null; });

// タップで社員選択
const raycaster = new THREE.Raycaster();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  let best = null;
  for (const actor of actors.values()) {
    const hit = raycaster.intersectObject(actor.person.root, true)[0];
    if (hit && (!best || hit.distance < best.distance)) best = { id: actor.id, distance: hit.distance };
  }
  select(best && best.id !== selectedId ? best.id : null);
});

// 一覧の開閉（スマホ）
$('#handle').addEventListener('click', () => {
  if (matchMedia('(min-width: 900px)').matches) return;
  const collapsed = panel.classList.toggle('collapsed');
  $('#handle').setAttribute('aria-expanded', String(!collapsed));
  requestAnimationFrame(resize);
});
if (IS_MOBILE && innerHeight < 700) panel.classList.add('collapsed');

// ---------------------------------------------------------------- データ受信 ----
function handleSnapshot(snapshot) {
  const keep = new Set(snapshot.sessions.map((s) => s.id));
  for (const id of [...sessions.keys()]) if (!keep.has(id)) removeSession(id);
  snapshot.sessions.forEach(upsertSession);
  events.length = 0;
  events.push(...snapshot.events);
  renderUi();
  renderLog();
}
function handleUpdate({ session, event }) {
  upsertSession(session);
  if (event) {
    events.push(event);
    if (events.length > 200) events.shift();
    renderLog();
  }
  renderUi();
}

function connect() {
  const es = new EventSource(`/stream${VIEW_KEY ? `?key=${encodeURIComponent(VIEW_KEY)}` : ''}`);
  es.addEventListener('open', () => { connEl.className = 'on'; connEl.title = '接続中'; });
  es.addEventListener('error', () => { connEl.className = 'off'; connEl.title = '再接続中…'; });
  es.addEventListener('snapshot', (e) => handleSnapshot(JSON.parse(e.data)));
  es.addEventListener('update', (e) => handleUpdate(JSON.parse(e.data)));
  es.addEventListener('remove', (e) => removeSession(JSON.parse(e.data).id));
}

async function startDemo() {
  const { createStore } = await import('/shared/state.mjs');
  connEl.className = 'on';
  connEl.title = 'デモ';
  const store = createStore();
  const projects = ['nicchyo', 'api-server', 'docs', 'mobile-app', 'data-batch'];
  const tools = [['Edit', 'page.tsx'], ['Read', 'route.ts'], ['Bash', 'npm'], ['Grep', null], ['Write', 'README.md'], ['WebSearch', null]];
  const ids = projects.map((p, i) => ({ id: `${(0xa3f0 + i * 0x137).toString(16)}-${p}`, project: p }));
  const send = (who, type, extra = {}) => {
    const evt = { session_id: who.id, source_app: who.project, hook_event_type: type, ...extra };
    const { session, event, removed } = store.apply(evt);
    handleUpdate({ session, event });
    if (removed) setTimeout(() => removeSession(session.id), 4000);
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  ids.forEach((who, i) => setTimeout(() => send(who, 'SessionStart'), 600 + i * 1400));
  setInterval(() => {
    const who = pick(ids);
    if (!store.snapshot().sessions.some((s) => s.id === who.id)) return;
    const roll = Math.random();
    if (roll < 0.5) { const [tool, detail] = pick(tools); send(who, 'PreToolUse', { tool_name: tool, ...(detail ? { detail } : {}) }); }
    else if (roll < 0.62) send(who, 'Notification', { message: 'ファイルの編集を許可しますか？' });
    else if (roll < 0.74) send(who, 'SubagentStart', { agent_id: `a${Math.random()}` });
    else if (roll < 0.82) send(who, 'SubagentStop');
    else if (roll < 0.95) send(who, 'Stop');
    else send(who, 'UserPromptSubmit');
  }, 1300);
}

// ---------------------------------------------------------------- 描画ループ ----
function resize() {
  const { clientWidth: w, clientHeight: h } = stage;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 縦長（スマホ）では画角を広げて部屋全体が入るようにする
  camera.fov = w / h < 0.8 ? 62 : 42;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

buildRoom(MIN_ROWS);
controls.target.set(0, 0.6, layout.cz);
camera.position.set(layout.width * 0.55, layout.width * 0.5, layout.zMax + layout.width * 0.36);
controls.update();
resize();

const clock = new THREE.Clock();
let acc = 0;
const frameInterval = IS_MOBILE ? 1 / 30 : 0;
function frame() {
  requestAnimationFrame(frame);
  if (document.hidden) { clock.getDelta(); return; }
  acc += clock.getDelta();
  if (acc < frameInterval) return;
  const dt = Math.min(acc, 0.1);
  acc = 0;
  const t = clock.elapsedTime;
  if (focusTarget) controls.target.lerp(focusTarget, 1 - Math.exp(-5 * dt));
  controls.update();
  for (const actor of actors.values()) actor.update(dt, t);
  renderer.render(scene, camera);
}
frame();

setInterval(renderUi, 5000);
if (DEMO) startDemo(); else connect();

// テスト・デバッグ用
window.__office = { actors, sessions };
