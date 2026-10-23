/*! js/explore.js - 漫游控制与碰撞 (全局脚本, 直接双击打开可用) */
(function (global) {
"use strict";
const THREE = global.THREE;
/* ==========================================================
   红色地图 · 漫游模式
   《人类一败涂地》风格小人 + WASD 行走 + 鼠标拖动视角 +
   十字光标 F 交互 + 右下角全屏；碰撞体由场景几何自动生成，
   行走不会穿模。
   ========================================================== */

const BODY_RADIUS = 0.34;    // 身体碰撞半径
const BODY_TOP    = 1.72;    // 身体（含头）上沿，超过此高度的构件可从下方通过
const EYE_HEIGHT  = 1.30;    // 相机环绕中心高度
const WALK_SPEED  = 2.8;     // m/s
const RUN_SPEED   = 4.9;
const ACCEL       = 17;
const BRAKE       = 13;
const GRAVITY     = 21;
const JUMP_V      = 4.5;
const MAX_STEP    = 0.68;    // 可迈上的最大台阶（需越过各建筑 0.6m 台基与挡墙）
const AIM_RANGE   = 17;      // F 交互的最远距离

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ==========================================================
   1. 碰撞世界：遍历场景几何自动生成 AABB 碰撞体 + 空间网格
   ========================================================== */
class CollisionWorld {
  constructor({ cell = 5, baseY = 0, bounds = 0 } = {}) {
    this.cell = cell;
    this.baseY = baseY;
    this.bounds = bounds;      // 可行走半径（0 = 不限制）
    this.boxes = [];
    this.grid = new Map();
  }

  /* 把一棵对象树里所有实体网格登记为碰撞体 */
  addObject(object, buildingKey = null) {
    const box = new THREE.Box3();
    object.updateWorldMatrix(true, true);
    object.traverse(node => {
      if (!node.isMesh || node.visible === false || node.userData.noCollide) return;
      const geo = node.geometry;
      if (!geo) return;
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (!geo.boundingBox) return;
      box.copy(geo.boundingBox).applyMatrix4(node.matrixWorld);
      if (box.max.y - box.min.y < 0.035) return;   // 贴地薄片（草地、铺装）
      if (box.min.y >= BODY_TOP) return;           // 整体高于头顶
      this.boxes.push({
        key: buildingKey,
        minX: box.min.x, maxX: box.max.x,
        minZ: box.min.z, maxZ: box.max.z,
        bottom: box.min.y, top: box.max.y,
        cx: (box.min.x + box.max.x) / 2,
        cz: (box.min.z + box.max.z) / 2
      });
    });
    return this;
  }

  /* 建立空间网格，供行走与视角碰撞快速查询 */
  finalize() {
    this.grid.clear();
    const cell = this.cell, pad = 1.2;
    for (const b of this.boxes) {
      const x0 = Math.floor((b.minX - pad) / cell), x1 = Math.floor((b.maxX + pad) / cell);
      const z0 = Math.floor((b.minZ - pad) / cell), z1 = Math.floor((b.maxZ + pad) / cell);
      for (let i = x0; i <= x1; i++) {
        for (let j = z0; j <= z1; j++) {
          const k = i + '|' + j;
          let arr = this.grid.get(k);
          if (!arr) { arr = []; this.grid.set(k, arr); }
          arr.push(b);
        }
      }
    }
    return this;
  }

  /* 遍历 (x,z) 附近 pad 范围内的碰撞体 */
  near(x, z, pad, cb) {
    const cell = this.cell;
    const x0 = Math.floor((x - pad) / cell), x1 = Math.floor((x + pad) / cell);
    const z0 = Math.floor((z - pad) / cell), z1 = Math.floor((z + pad) / cell);
    for (let i = x0; i <= x1; i++) {
      for (let j = z0; j <= z1; j++) {
        const arr = this.grid.get(i + '|' + j);
        if (!arr) continue;
        for (let k = 0; k < arr.length; k++) cb(arr[k]);
      }
    }
  }

  /* (x,z) 处可站立的地面高度：从 from 出发最多抬升 MAX_STEP */
  groundAt(x, z, from) {
    let g = this.baseY;
    const reach = from + MAX_STEP + 1e-3;
    const headY = from + BODY_TOP;
    this.near(x, z, 0.02, b => {
      if (x < b.minX - 0.02 || x > b.maxX + 0.02) return;
      if (z < b.minZ - 0.02 || z > b.maxZ + 0.02) return;
      if (b.bottom > headY) return;      // 头顶上方的构件不当地面
      if (b.top > reach) return;         // 太高，站不上去
      if (b.top > g) g = b.top;
    });
    return g;
  }

  /* 水平移动 + 碰撞求解（贴墙滑行、可上小台阶） */
  move(x, z, dx, dz, feetY) {
    let nx = x + dx, nz = z + dz;
    const feet = Math.max(feetY, this.groundAt(x, z, feetY));
    const stepTop = feet + MAX_STEP;     // 不高于此者可迈上去
    const headY = feet + BODY_TOP;
    for (let iter = 0; iter < 4; iter++) {
      let bestDepth = 0, bestPush = null;
      this.near(nx, nz, BODY_RADIUS + 0.12, b => {
        if (b.top <= stepTop) return;    // 可踩上去，不阻挡
        if (b.bottom >= headY) return;   // 头顶之上，可从下方通过
        const cx = clamp(nx, b.minX, b.maxX);
        const cz = clamp(nz, b.minZ, b.maxZ);
        const ddx = nx - cx, ddz = nz - cz;
        const d2 = ddx * ddx + ddz * ddz;
        let push, depth;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          if (d >= BODY_RADIUS) return;
          depth = BODY_RADIUS - d;
          push = [ddx / d * depth, ddz / d * depth];
        } else {                          // 圆心落在盒内：沿最浅方向推出
          const left = nx - b.minX, right = b.maxX - nx;
          const back = nz - b.minZ, front = b.maxZ - nz;
          const m = Math.min(left, right, back, front);
          if (m === left)        push = [-(left + BODY_RADIUS), 0];
          else if (m === right)  push = [right + BODY_RADIUS, 0];
          else if (m === back)   push = [0, -(back + BODY_RADIUS)];
          else                   push = [0, front + BODY_RADIUS];
          depth = BODY_RADIUS + m;
        }
        if (depth > bestDepth) { bestDepth = depth; bestPush = push; }
      });
      if (!bestPush) break;
      nx += bestPush[0];
      nz += bestPush[1];
    }
    if (this.bounds > 0) {
      const r = Math.hypot(nx, nz);
      if (r > this.bounds) { nx *= this.bounds / r; nz *= this.bounds / r; }
    }
    return { x: nx, z: nz };
  }

  /* 相机用：空间中是否被实体挡住 */
  solidAt(x, y, z, radius) {
    let hit = false;
    this.near(x, z, radius + 0.05, b => {
      if (hit) return;
      if (b.top - b.bottom < 0.5) return;          // 薄片/铺装忽略
      if (y < b.bottom - 0.05 || y > b.top + 0.05) return;
      const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
      const ddx = x - cx, ddz = z - cz;
      if (ddx * ddx + ddz * ddz < radius * radius) hit = true;
    });
    return hit;
  }

  /* 准星射线：返回最近命中的建筑碰撞体 */
  aim(origin, dir, range) {
    let hitKey = null, bestT = range;
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (!b.key) continue;                          // 只判定建筑本体
      const dx = b.cx - origin.x, dz = b.cz - origin.z;
      if (dx * dx + dz * dz > (range + 24) * (range + 24)) continue;
      const t = rayBox(origin, dir, b);
      if (t >= 0 && t < bestT) { bestT = t; hitKey = b.key; }
    }
    return { key: hitKey, distance: hitKey ? bestT : Infinity };
  }
}

function rayBox(o, d, b) {
  let tmin = 0, tmax = Infinity, t1, t2, tmp;
  if (Math.abs(d.x) < 1e-8) { if (o.x < b.minX || o.x > b.maxX) return -1; }
  else {
    t1 = (b.minX - o.x) / d.x; t2 = (b.maxX - o.x) / d.x;
    if (t1 > t2) { tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
  }
  if (Math.abs(d.y) < 1e-8) { if (o.y < b.bottom || o.y > b.top) return -1; }
  else {
    t1 = (b.bottom - o.y) / d.y; t2 = (b.top - o.y) / d.y;
    if (t1 > t2) { tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
  }
  if (Math.abs(d.z) < 1e-8) { if (o.z < b.minZ || o.z > b.maxZ) return -1; }
  else {
    t1 = (b.minZ - o.z) / d.z; t2 = (b.maxZ - o.z) / d.z;
    if (t1 > t2) { tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
  }
  if (tmax < tmin || tmax < 0) return -1;
  return tmin;
}

/* ==========================================================
   2. 《人类一败涂地》风格小人：奶白四肢 + 灰绿军装 + 八角帽红五星
   ========================================================== */
function faceTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f2e6';
  g.fillRect(0, 0, 512, 256);
  // 脸部正前方位于 uv(0.25, 0.5)，即画布 (128, 128) 附近
  g.fillStyle = '#2b2b30';
  const eye = (x) => {
    g.beginPath();
    g.ellipse(x, 107, 13, 17, 0, 0, Math.PI * 2);
    g.fill();
  };
  eye(103); eye(153);
  g.lineWidth = 7;
  g.strokeStyle = '#2b2b30';
  g.beginPath();
  g.arc(128, 138, 20, 0.25 * Math.PI, 0.75 * Math.PI);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

function buildCharacter() {
  const root = new THREE.Group();          // 位置 + 朝向
  const rig = new THREE.Group();           // 弹性晃动（橡皮人质感）
  root.add(rig);

  const skin  = new THREE.MeshStandardMaterial({ color: 0xf4efe0, roughness: .62 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x6d7a5f, roughness: .85 });
  const red   = new THREE.MeshStandardMaterial({ color: 0xc0272d, roughness: .68 });
  const shoe  = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: .8 });

  const put = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // 躯干（灰绿军装）+ 红领巾 + 腰带
  put(new THREE.CapsuleGeometry(0.19, 0.30, 6, 16), cloth, rig, 0, 1.01, 0);
  const collar = put(new THREE.TorusGeometry(0.155, 0.035, 8, 18), red, rig, 0, 1.255, 0);
  collar.rotation.x = Math.PI / 2;
  const belt = put(new THREE.TorusGeometry(0.20, 0.022, 8, 20), shoe, rig, 0, 0.86, 0);
  belt.rotation.x = Math.PI / 2;

  // 头部（奶白 + 简笔脸）
  const head = new THREE.Group();
  head.position.y = 1.42;
  rig.add(head);
  const skullMat = new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: .6 });
  put(new THREE.SphereGeometry(0.215, 24, 18), skullMat, head, 0, 0, 0);
  put(new THREE.CylinderGeometry(0.228, 0.238, 0.135, 8), cloth, head, 0, 0.15, 0);
  const brim = put(new THREE.BoxGeometry(0.34, 0.035, 0.16), cloth, head, 0, 0.10, 0.20);
  brim.rotation.x = -0.08;
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rad = (i % 2 === 0) ? 0.062 : 0.026;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    if (i === 0) starShape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else starShape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  starShape.closePath();
  const starMesh = new THREE.Mesh(new THREE.ShapeGeometry(starShape),
    new THREE.MeshStandardMaterial({ color: 0xd42b2b, roughness: .55, side: THREE.DoubleSide }));
  starMesh.position.set(0, 0.15, 0.223);
  head.add(starMesh);

  // 四肢：肩/髋为一级关节，肘/膝为二级关节
  const limb = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.225, 1.185, 0);
    rig.add(shoulder);
    put(new THREE.CapsuleGeometry(0.072, 0.13, 5, 12), skin, shoulder, 0, -0.135, 0);
    const elbow = new THREE.Group();
    elbow.position.y = -0.265;
    shoulder.add(elbow);
    put(new THREE.CapsuleGeometry(0.064, 0.12, 5, 12), skin, elbow, 0, -0.12, 0);
    put(new THREE.SphereGeometry(0.088, 14, 12), skin, elbow, 0, -0.255, 0);
    return { shoulder, elbow };
  };
  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.105, 0.76, 0);
    rig.add(hip);
    put(new THREE.CapsuleGeometry(0.092, 0.17, 5, 12), skin, hip, 0, -0.18, 0);
    const knee = new THREE.Group();
    knee.position.y = -0.36;
    hip.add(knee);
    put(new THREE.CapsuleGeometry(0.082, 0.16, 5, 12), skin, knee, 0, -0.165, 0);
    put(new THREE.BoxGeometry(0.15, 0.09, 0.27), shoe, knee, 0, -0.355, 0.058);
    return { hip, knee };
  };
  const armL = limb(-1), armR = limb(1);
  const legL = leg(-1), legR = leg(1);

  return {
    root, rig, head, armL, armR, legL, legR,
    setVisible(v) { root.visible = v; }
  };
}

/* ==========================================================
   3. 漫游控制器：键盘行走 / 鼠标视角 / 准星交互 / 全屏
   ========================================================== */
class Explorer {
  constructor({ scene, camera, renderer, world, buildings = [], ui = {}, spawn = { x: 0, z: 0, yaw: 0 }, groundHint = 0 }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.world = world;
    this.buildings = buildings;
    this.ui = ui;
    this.spawn = spawn;
    this.groundHint = groundHint;

    this.active = false;
    this.locked = false;
    this.lockSupported = true;   // 指针锁定不可用时退化为按住拖动转视角
    this.dragging = false;
    this.keys = Object.create(null);

    this.player = buildCharacter();
    this.player.setVisible(false);
    scene.add(this.player.root);

    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.vel = { x: 0, y: 0 };          // 世界 XZ 速度（由实际位移反推，撞墙自然停下）
    this.prevVel = { x: 0, y: 0 };
    this.yaw = spawn.yaw || 0;          // 视角水平角
    this.pitch = -0.08;                 // 视角俯仰角
    this.camYaw = this.yaw;
    this.bodyYaw = this.yaw;            // 身体朝向
    this.feet = groundHint;
    this.vy = 0;
    this.grounded = true;
    this.phase = 0;
    this.blend = 0;
    this.squash = 0;
    this.time = 0;
    this.camDist = 4.2;
    this.camDistTarget = 4.2;
    this.camPos = new THREE.Vector3();
    this.camPivot = new THREE.Vector3(spawn.x, groundHint + EYE_HEIGHT, spawn.z);
    this.springs = { x: { x: 0, v: 0 }, z: { x: 0, v: 0 }, roll: { x: 0, v: 0 } };
    this.aimKey = null;
    this.infoKey = null;
    this.aimFrame = 0;
    this.mapFrame = 0;
    this._dir = new THREE.Vector3();

    this._bindEvents();
  }

  /* ---------------- 事件 ---------------- */
  _bindEvents() {
    this._onKeyDown = e => {
      if (!this.active) return;
      const k = this._keyName(e);
      if (!k) return;
      if (k === 'f') { if (!e.repeat) this._toggleInfo(); e.preventDefault(); return; }
      if (k === 'e') { if (!e.repeat) this.toggleFullscreen(); e.preventDefault(); return; }
      if (k === 'escape') { this._hideInfo(); return; }
      this.keys[k] = true;
      if (k === ' ' || k === 'shift') e.preventDefault();
    };
    this._onKeyUp = e => {
      const k = this._keyName(e);
      if (k) this.keys[k] = false;
    };
    this._onMouseMove = e => {
      if (!this.active || (!this.locked && !this.dragging)) return;
      const s = 0.0022;
      this.yaw -= e.movementX * s;
      this.pitch = clamp(this.pitch - e.movementY * s, -1.02, 0.92);
    };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.renderer.domElement;
      if (!this.locked) this.keys = Object.create(null);
      this._syncPause();
    };
    this._onCanvasDown = () => {
      if (!this.active || this.locked) return;
      if (this.lockSupported) this.requestLock();
      else {
        this.dragging = true;
        if (this.ui.pause) this.ui.pause.classList.remove('show');
      }
    };
    this._onCanvasUp = () => { this.dragging = false; };
    this._onFullscreen = () => this._syncFullscreen();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('fullscreenchange', this._onFullscreen);
    this.renderer.domElement.addEventListener('pointerdown', this._onCanvasDown);
    window.addEventListener('pointerup', this._onCanvasUp);
    if (this.ui.fs) this.ui.fs.addEventListener('click', () => this.toggleFullscreen());
    if (this.ui.pauseResume) this.ui.pauseResume.addEventListener('click', () => this.requestLock());
    if (this.ui.pauseExit) this.ui.pauseExit.addEventListener('click', () => this.onExit && this.onExit());
    if (this.ui.infoClose) this.ui.infoClose.addEventListener('click', () => this._hideInfo());
  }

  _keyName(e) {
    const c = e.code || '';
    const k = e.key || '';
    if (c === 'KeyW' || k === 'w' || k === 'W') return 'w';
    if (c === 'KeyA' || k === 'a' || k === 'A') return 'a';
    if (c === 'KeyS' || k === 's' || k === 'S') return 's';
    if (c === 'KeyD' || k === 'd' || k === 'D') return 'd';
    if (c === 'KeyF' || k === 'f' || k === 'F') return 'f';
    if (c === 'KeyE' || k === 'e' || k === 'E') return 'e';
    if (c === 'ShiftLeft' || c === 'ShiftRight' || k === 'Shift') return 'shift';
    if (c === 'Space' || k === ' ') return ' ';
    if (k === 'Escape') return 'escape';
    return null;
  }

  /* ---------------- 进出漫游 ---------------- */
  enter() {
    this.active = true;
    this.player.setVisible(true);
    this.pos.set(this.spawn.x, 0, this.spawn.z);
    this.vel.x = this.vel.y = 0;
    this.prevVel.x = this.prevVel.y = 0;
    this.feet = this.world.groundAt(this.spawn.x, this.spawn.z, this.groundHint + 3);
    this.yaw = this.bodyYaw = this.camYaw = this.spawn.yaw || 0;
    this.pitch = -0.06;
    this.phase = 0;
    this.blend = 0;
    this.squash = 0;
    this.camDist = this.camDistTarget = 4.2;
    this.camPivot.set(this.pos.x, this.feet + EYE_HEIGHT, this.pos.z);
    this._placeCamera(1);
    this.camera.position.copy(this.camPos);
    this._hideInfo();
    if (this.ui.hud) this.ui.hud.classList.add('show');
    this._syncFullscreen();
    this.requestLock();
  }

  exit() {
    this.active = false;
    this.player.setVisible(false);
    this.keys = Object.create(null);
    this._hideInfo();
    if (this.ui.hud) this.ui.hud.classList.remove('show');
    if (this.ui.pause) this.ui.pause.classList.remove('show');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  requestLock(soft) {
    const el = this.renderer.domElement;
    if (!el.requestPointerLock) { if (!soft) { this.lockSupported = false; this._syncPause(); } return; }
    const p = el.requestPointerLock();
    if (p && p.catch) p.catch(() => { if (!soft) { this.lockSupported = false; this._syncPause(); } });
    setTimeout(() => {
      if (!soft && this.active && !this.locked) { this.lockSupported = false; this._syncPause(); }
    }, 1200);
  }

  toggleFullscreen() {
    const el = this.ui.fsTarget || this.renderer.domElement.parentElement || this.renderer.domElement;
    const wasLocked = this.locked;
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else if (el.requestFullscreen) {
      const p = el.requestFullscreen({ navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => {});
    }
    // 全屏切换后浏览器可能解除指针锁定，稍后静默恢复，避免弹出暂停卡片
    if (wasLocked) setTimeout(() => { if (this.active && !this.locked) this.requestLock(true); }, 320);
  }

  _syncFullscreen() {
    const on = !!document.fullscreenElement;
    if (this.ui.fs) {
      this.ui.fs.classList.toggle('on', on);
      this.ui.fs.innerHTML = on
        ? '<span class="w3d-fs-ico">⤡</span>退出全屏（E）'
        : '<span class="w3d-fs-ico">⛶</span>全屏浏览（E）';
    }
    if (this.ui.fsTarget) this.ui.fsTarget.classList.toggle('is-fullscreen', on);
    this._placeCamera(1);
  }

  _syncPause() {
    if (!this.ui.pause) return;
    const show = this.active && !this.locked && this.lockSupported;
    this.ui.pause.classList.toggle('show', show);
  }

  /* ---------------- 每帧 ---------------- */
  update(dt) {
    if (!this.active) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this._move(dt);
    this._pose(dt);
    this._placeCamera(dt);
    this._aim(dt);
    this._drawMinimap(dt);
  }

  _move(dt) {
    const k = this.keys;
    let fwd = (k['w'] ? 1 : 0) - (k['s'] ? 1 : 0);
    let side = (k['d'] ? 1 : 0) - (k['a'] ? 1 : 0);
    // 移动端摇杆：-1..1 的模拟量，未设置时保持原有键盘行为
    if (this.touchMove) {
      fwd = -this.touchMove.y;
      side = this.touchMove.x;
    }
    const inputMag = Math.min(1, Math.hypot(fwd, side));
    const speed = k['shift'] ? RUN_SPEED : WALK_SPEED;

    // 以视角方向为基准分解移动方向
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    let mx = fx * fwd + rx * side;
    let mz = fz * fwd + rz * side;
    const len = Math.hypot(mx, mz);
    if (len > 1e-4) { mx /= len; mz /= len; } else { mx = mz = 0; }

    // 加速 / 减速
    const tvx = mx * speed * inputMag, tvz = mz * speed * inputMag;
    const rate = (len > 1e-4 ? ACCEL : BRAKE) * dt;
    const dvx = tvx - this.vel.x, dvz = tvz - this.vel.y;
    const dl = Math.hypot(dvx, dvz);
    if (dl > 1e-6) {
      const s = Math.min(1, rate / dl);
      this.vel.x += dvx * s;
      this.vel.y += dvz * s;
    }

    // 水平移动（碰撞求解：贴墙滑行、可上台阶）
    const res = this.world.move(this.pos.x, this.pos.z, this.vel.x * dt, this.vel.y * dt, this.feet);
    const dxw = res.x - this.pos.x, dzw = res.z - this.pos.z;
    const traveled = Math.hypot(dxw, dzw);
    this.pos.x = res.x;
    this.pos.z = res.z;
    // 用实际位移反推速度：撞墙即停，不产生抖动
    if (dt > 1e-4) { this.vel.x = dxw / dt; this.vel.y = dzw / dt; }
    this.moved = traveled;

    // 垂直：贴地 / 重力 / 跳跃
    const ground = this.world.groundAt(this.pos.x, this.pos.z, this.feet);
    if (this.grounded && k[' '] && this.feet <= ground + 0.02) {
      this.vy = JUMP_V;
      this.grounded = false;
    }
    if (this.grounded) {
      this.vy = 0;
      const diff = ground - this.feet;
      if (Math.abs(diff) < 0.004) this.feet = ground;
      else this.feet += diff * Math.min(1, dt * (diff > 0 ? 11 : 20));
    } else {
      this.vy -= GRAVITY * dt;
      this.feet += this.vy * dt;
      if (this.feet <= ground) {
        if (this.vy < -3.2) this.squash = Math.min(0.2, -this.vy * 0.028);
        this.feet = ground;
        this.vy = 0;
        this.grounded = true;
      } else if (this.feet - ground < 0.05) {
        this.feet = ground;
        this.vy = 0;
        this.grounded = true;
      }
    }
  }

  /* 步态与橡皮人晃动：相位由实际位移驱动，保证脚不打滑 */
  _pose(dt) {
    const p = this.player;
    const speed = Math.hypot(this.vel.x, this.vel.y);
    const moving = speed > 0.12 && this.moved > 1e-4;

    if (moving) {
      const target = Math.atan2(this.vel.x, this.vel.y);
      let d = target - this.bodyYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.bodyYaw += d * Math.min(1, dt * (7 + speed * 1.4));
    }
    p.root.position.set(this.pos.x, this.feet, this.pos.z);
    p.root.rotation.y = this.bodyYaw;

    const STRIDE = 1.5;
    if (this.grounded && speed > 0.05) this.phase += (speed * dt) / STRIDE * Math.PI * 2;
    const targetBlend = clamp(speed / WALK_SPEED, 0, 1.25) * (this.grounded ? 1 : 0.7);
    this.blend += (targetBlend - this.blend) * Math.min(1, dt * 6.5);

    const w = Math.min(1, this.blend);
    const ph = this.phase;
    const t = this.time;

    // 腿：phase=0 前脚跟着地，pi/2 支撑，pi 离地，3pi/2 摆动
    const legA = 0.56 * w;
    p.legL.hip.rotation.x = -legA * Math.cos(ph);
    p.legR.hip.rotation.x = -legA * Math.cos(ph + Math.PI);
    const kneeL = 0.10 + 0.85 * w * Math.pow(Math.max(0, Math.sin(ph + Math.PI * 0.85)), 1.15);
    const kneeR = 0.10 + 0.85 * w * Math.pow(Math.max(0, Math.sin(ph + Math.PI * 1.85)), 1.15);
    p.legL.knee.rotation.x = kneeL;
    p.legR.knee.rotation.x = kneeR;

    // 手臂：与同侧腿反相摆动，肘部自然弯曲并外张
    const armA = 0.44 * w;
    p.armL.shoulder.rotation.x = armA * Math.cos(ph);
    p.armR.shoulder.rotation.x = armA * Math.cos(ph + Math.PI);
    p.armL.shoulder.rotation.z = -0.13 - 0.05 * w;
    p.armR.shoulder.rotation.z = 0.13 + 0.05 * w;
    p.armL.elbow.rotation.x = -(0.16 + 0.34 * w * (0.5 + 0.5 * Math.cos(ph + 1.1)));
    p.armR.elbow.rotation.x = -(0.16 + 0.34 * w * (0.5 + 0.5 * Math.cos(ph + Math.PI + 1.1)));

    // 弹性晃动：加速/转身带来的滞后与侧倾（一败涂地的橡皮感）
    const ax = clamp((this.vel.x - this.prevVel.x) / Math.max(dt, 1e-3), -70, 70);
    const az = clamp((this.vel.y - this.prevVel.y) / Math.max(dt, 1e-3), -70, 70);
    this.prevVel.x = this.vel.x;
    this.prevVel.y = this.vel.y;
    const s = Math.sin(this.bodyYaw), c = Math.cos(this.bodyYaw);
    const localZ = ax * s + az * c;      // 前后加速度
    const localX = ax * c - az * s;      // 左右加速度
    const spx = this._spring('x', -clamp(localX * 0.006, -0.05, 0.05), dt);
    const spz = this._spring('z', -clamp(localZ * 0.008, -0.075, 0.075), dt);
    const spRoll = this._spring('roll', clamp(localX * 0.010, -0.16, 0.16), dt);

    const bob = 0.030 * w * (0.5 - 0.5 * Math.cos(2 * ph));
    const breathe = 0.008 * Math.sin(t * 1.7) * (1 - w);
    const idleSway = 0.006 * Math.sin(t * 0.9) * (1 - w);
    p.rig.position.set(spx + idleSway, bob + breathe, spz);
    p.rig.rotation.x = 0.05 * w - spz * 2.0;
    p.rig.rotation.z = spx * 1.4 + spRoll;
    p.rig.rotation.y = 0.06 * w * Math.sin(ph);
    p.head.rotation.x = -p.rig.rotation.x * 0.55 + 0.015 * Math.sin(t * 1.3);
    p.head.rotation.z = -p.rig.rotation.z * 0.5;
    p.head.rotation.y = -p.rig.rotation.y * 0.8;

    // 落地压缩 / 腾空拉伸
    this.squash *= Math.max(0, 1 - dt * 7);
    const stretch = this.grounded ? 0 : clamp(this.vy * 0.012, -0.06, 0.06);
    p.rig.scale.set(1 + this.squash * 0.7 - stretch * 0.5, 1 - this.squash + stretch, 1 + this.squash * 0.7 - stretch * 0.5);
  }

  _spring(key, target, dt) {
    const sp = this.springs[key];
    const k = 150, c = 17;
    sp.v += (-k * (sp.x - target) - c * sp.v) * dt;
    sp.x += sp.v * dt;
    return sp.x;
  }

  /* 第三人称相机：绕身体旋转、遇墙收近，绝不穿模 */
  _placeCamera(dt) {
    const dirX = Math.sin(this.yaw) * Math.cos(this.pitch);
    const dirY = Math.sin(this.pitch);
    const dirZ = Math.cos(this.yaw) * Math.cos(this.pitch);
    const targetPivotY = this.feet + EYE_HEIGHT + 0.12;
    const lerp = Math.min(1, dt * 22);
    this.camPivot.x += (this.pos.x - this.camPivot.x) * lerp;
    this.camPivot.z += (this.pos.z - this.camPivot.z) * lerp;
    this.camPivot.y += (targetPivotY - this.camPivot.y) * Math.min(1, dt * 14);

    // 沿视线反向步进，遇到实体就把相机拉近
    let allow = this.camDistTarget;
    const step = 0.2;
    for (let s = 0.45; s <= this.camDistTarget; s += step) {
      const cx = this.camPivot.x - dirX * s;
      const cy = this.camPivot.y - dirY * s;
      const cz = this.camPivot.z - dirZ * s;
      if (cy < this.feet + 0.3) { allow = Math.max(0.7, s - 0.15); break; }
      if (this.world.solidAt(cx, cy, cz, 0.26)) { allow = Math.max(0.7, s - 0.15); break; }
    }
    this.camDist += allow < this.camDist
      ? (allow - this.camDist) * Math.min(1, dt * 20)
      : (allow - this.camDist) * Math.min(1, dt * 4);

    this.camPos.set(
      this.camPivot.x - dirX * this.camDist,
      this.camPivot.y - dirY * this.camDist,
      this.camPivot.z - dirZ * this.camDist
    );
    this.camera.position.copy(this.camPos);
    this.camera.rotation.set(this.pitch, this.yaw + Math.PI, 0, 'YXZ');
  }

  /* 准星射线：指向建筑时提示可按 F 交互 */
  _aim(dt) {
    this.aimFrame++;
    if (this.aimFrame % 2) return;
    const dir = this.camera.getWorldDirection(this._dir);
    const hit = this.world.aim(this.camera.position, dir, AIM_RANGE);
    const key = hit.key;
    if (key === this.aimKey) return;
    this.aimKey = key;
    const ui = this.ui;
    if (ui.crosshair) ui.crosshair.classList.toggle('active', !!key);
    if (ui.hint) {
      const b = key ? this._building(key) : null;
      ui.hint.textContent = b
        ? (this.infoKey === key ? '按 F 收起介绍' : '按 F 查看「' + b.label + '」')
        : '';
      ui.hint.classList.toggle('show', !!b);
    }
  }

  _building(key) {
    for (const b of this.buildings) if (b.key === key) return b;
    return null;
  }

  _toggleInfo() {
    const key = this.aimKey;
    if (!key) { this._hideInfo(); return; }
    if (this.infoKey === key) this._hideInfo();
    else this._showInfo(key);
  }

  _showInfo(key) {
    const b = this._building(key);
    if (!b || !this.ui.info) return;
    this.infoKey = key;
    const u = this.ui;
    if (u.infoName) u.infoName.textContent = b.info.title;
    if (u.infoMeta) u.infoMeta.textContent = b.info.meta;
    if (u.infoDesc) u.infoDesc.textContent = b.info.desc;
    if (u.infoNote) u.infoNote.textContent = b.info.note;
    u.info.classList.add('show');
    if (u.hint) u.hint.textContent = '按 F 收起介绍';
  }

  _hideInfo() {
    this.infoKey = null;
    if (this.ui.info) this.ui.info.classList.remove('show');
    if (this.ui.hint && this.aimKey) {
      const b = this._building(this.aimKey);
      if (b) this.ui.hint.textContent = '按 F 查看「' + b.label + '」';
    }
  }

  /* 小地图：五个遗址 + 视野扇形 */
  _drawMinimap() {
    const cv = this.ui.map;
    if (!cv) return;
    this.mapFrame++;
    if (this.mapFrame % 4) return;
    const g = cv.getContext('2d');
    const size = cv.width;
    const half = size / 2;
    const span = (this.ui.mapRadius || 68);
    const sc = (half - 6) / span;
    g.clearRect(0, 0, size, size);
    g.save();
    g.beginPath();
    g.arc(half, half, half - 1, 0, Math.PI * 2);
    g.fillStyle = 'rgba(250, 246, 238, .88)';
    g.fill();
    g.clip();
    // 公园范围
    g.beginPath();
    g.arc(half, half, (this.ui.parkRadius || 48) * sc, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(192, 39, 45, .35)';
    g.lineWidth = 1.5;
    g.setLineDash([4, 3]);
    g.stroke();
    g.setLineDash([]);
    // 遗址点
    for (const b of this.buildings) {
      const x = half + (b.x || 0) * sc;
      const y = half - (b.z || 0) * sc;
      g.beginPath();
      g.arc(x, y, 3.6, 0, Math.PI * 2);
      g.fillStyle = b.key === this.aimKey ? '#e8b64c' : '#c0272d';
      g.fill();
      if (b.key === this.infoKey) {
        g.beginPath();
        g.arc(x, y, 6.5, 0, Math.PI * 2);
        g.strokeStyle = '#c0272d';
        g.lineWidth = 1.6;
        g.stroke();
      }
    }
    // 玩家与视野
    const px = half + this.pos.x * sc;
    const py = half - this.pos.z * sc;
    const ang = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    g.beginPath();
    g.moveTo(px, py);
    g.arc(px, py, 17, -Math.PI / 2 + ang - 0.5, -Math.PI / 2 + ang + 0.5);
    g.closePath();
    g.fillStyle = 'rgba(232, 182, 76, .45)';
    g.fill();
    g.beginPath();
    g.arc(px, py, 3.4, 0, Math.PI * 2);
    g.fillStyle = '#2b6ea8';
    g.fill();
    g.restore();
    g.beginPath();
    g.arc(half, half, half - 1, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(192, 39, 45, .55)';
    g.lineWidth = 2;
    g.stroke();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    document.removeEventListener('fullscreenchange', this._onFullscreen);
    this.renderer.domElement.removeEventListener('pointerdown', this._onCanvasDown);
    window.removeEventListener('pointerup', this._onCanvasUp);
  }
}

global.ParkExplore = { CollisionWorld, Explorer };
})(typeof globalThis !== "undefined" ? globalThis : window);
