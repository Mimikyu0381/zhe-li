/*! js/buildings.js - 一园五馆程序化建模 (全局脚本, 直接双击打开可用) */
(function (global) {
"use strict";
const THREE = global.THREE;
/* ==========================================================
   红色地图 · 3D 遗址程序化建模（Three.js）
   本文件由 resources.html 内联模块抽出，供「3D 遗址展示」与
   「红色地图 · 漫游模式」两种浏览方式共用。
   建模对象：挺进师纪念碑 / 北上抗日出征门 / 省一大冠尖会址 /
             林心平烈士陈列馆 / 闽浙边抗日救亡干部学校旧址
   ========================================================== */

// 每帧回调（旗帜飘动等）与可交互对象注册表：由场景模块每帧调用 / 清空
const registry = { updateHooks: [], pickables: [] };

    /* ---------- 程序化贴图 ---------- */
    function rand(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

    // 浅色花岗岩（带水平砌筑缝）
    function stoneTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#dcdcd5'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) {
        const v = 100 + Math.random() * 60 | 0;
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 5) + ',' + (0.05 + Math.random() * 0.07) + ')';
        const s = 1 + Math.random() * 2;
        g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
      }
      g.strokeStyle = 'rgba(150,150,142,.85)'; g.lineWidth = 2;
      [0, 128, 256].forEach(y => { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(256, y + .5); g.stroke(); });
      g.strokeStyle = 'rgba(160,160,152,.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(80.5, 0); g.lineTo(80.5, 128); g.stroke();
      g.beginPath(); g.moveTo(190.5, 128); g.lineTo(190.5, 256); g.stroke();
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    }

    // 灰瓦：横向瓦垄
    function tileTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#5c5f62'; g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 16) {
        g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, y, 128, 2);
        g.fillStyle = 'rgba(0,0,0,.22)';       g.fillRect(0, y + 12, 128, 4);
      }
      for (let x = 0; x < 128; x += 16) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, 0, 1.5, 128); }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(3, 2);
      t.anisotropy = 4;
      return t;
    }

    // 白墙：轻微斑驳
    function wallTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#f3eee2'; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = 'rgba(188,182,166,' + (0.04 + Math.random() * 0.06) + ')';
        g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1 + Math.random() * 2);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    }

    // 红底鎏金题字（碑名竖排 / 匾额横排）
    function plaqueTexture(text, vertical = true) {
      const W = vertical ? 224 : 1024;
      const H = vertical ? 1792 : 256;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      const bg = g.createLinearGradient(0, 0, vertical ? 0 : W, vertical ? H : 0);
      bg.addColorStop(0, '#5c1e13'); bg.addColorStop(.5, '#7d2b1b'); bg.addColorStop(1, '#571c12');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#caa14e';
      g.lineWidth = vertical ? 5 : 6;
      g.strokeRect(g.lineWidth, g.lineWidth, W - g.lineWidth * 2, H - g.lineWidth * 2);
      g.fillStyle = '#f4d98a';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const chars = Array.from(text);
      if (vertical) {
        g.font = 'bold 132px "Microsoft YaHei","PingFang SC",serif';
        const step = Math.min(150, (H - 180) / chars.length);
        const y0 = H / 2 - step * (chars.length - 1) / 2;
        chars.forEach((ch, i) => g.fillText(ch, W / 2, y0 + i * step));
      } else {
        g.font = 'bold 130px "Microsoft YaHei","PingFang SC",serif';
        const step = Math.min(150, (W - 120) / chars.length);
        const x0 = W / 2 - step * (chars.length - 1) / 2;
        chars.forEach((ch, i) => g.fillText(ch, x0 + i * step, H / 2 + 4));
      }
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = 4;
      return t;
    }

    /* ---------- 材质与几何工具 ---------- */
    const mat = {
      stone:  () => new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: .8 }),
      wall:   () => new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: .95 }),
      tile:   () => new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: .85 }),
      white:  () => new THREE.MeshStandardMaterial({ color: 0xf1efe6, roughness: .75 }),
      granite:() => new THREE.MeshStandardMaterial({ color: 0xc7cbc4, roughness: .95 }),
      dark:   () => new THREE.MeshStandardMaterial({ color: 0x323236, roughness: .5 }),
      wood:   () => new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: .9 }),
      glass:  () => new THREE.MeshStandardMaterial({ color: 0x35566e, roughness: .12, metalness: .55 }),
      red:    () => new THREE.MeshStandardMaterial({ color: 0xc0272d, roughness: .7 }),
      steel:  () => new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: .5, metalness: .25 }),
      cloth:  () => new THREE.MeshStandardMaterial({ color: 0xcf2027, roughness: .85, side: THREE.DoubleSide }),
      grass:  () => new THREE.MeshStandardMaterial({ color: 0x6f9a58, roughness: 1 })
    };

    function mesh(geo, material, cast = true) {
      const m = new THREE.Mesh(geo, material);
      m.castShadow = cast;
      m.receiveShadow = true;
      return m;
    }

    function box(w, h, d, material, x = 0, y = 0, z = 0) {
      const m = mesh(new THREE.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z);
      return m;
    }

    // 碑前石碑：底座 + 斜面碑身 + 支撑，正面贴红底鎏金字
    function makeStele(text) {
      const grp = new THREE.Group();
      const face = new THREE.MeshStandardMaterial({ map: plaqueTexture(text), roughness: .45 });
      const side = mat.dark();
      const parts = [
        box(2.7, 0.24, 1.9, side, 0, 0.12, 0),
        box(1.95, 1.25, 0.18, [side, side, side, side, face, side], 0, 0.84, -0.05),
        box(1.7, 0.55, 0.6, side, 0, 0.4, -0.58)
      ];
      parts[1].rotation.x = -0.36;
      parts.forEach(p => grp.add(p));
      registry.pickables.push(grp);
      return grp;
    }

    // 旗杆 + 飘动红旗
    function flag(g, x, y, z, rotY = 0, s = 1) {
      const grp = new THREE.Group();
      const pole = mesh(new THREE.CylinderGeometry(0.075 * s, 0.1 * s, 7.6 * s, 8), mat.steel());
      pole.position.y = 3.8 * s;
      const w = 3 * s, h = 2 * s;
      const geo = new THREE.PlaneGeometry(w, h, 20, 6);
      const base = geo.attributes.position.array.slice();
      const cloth = mesh(geo, mat.cloth(), false);
      cloth.position.set(w / 2 + 0.08 * s, h / 2 + 5.2 * s, 0);
      grp.add(pole, cloth);
      grp.position.set(x, y, z);
      grp.rotation.y = rotY;
      g.add(grp);
      registry.updateHooks.push(t => {
        const pos = geo.attributes.position, arr = pos.array;
        for (let i = 0; i < arr.length; i += 3) {
          const k = Math.min(1, Math.max(0, (base[i] + w / 2) / w));
          arr[i + 2] = Math.sin(base[i] * 2.2 - t * 3.4 + base[i + 1] * 1.6) * 0.34 * s * k;
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      });
      return grp;
    }

    /* ---------- 通用环境：草地 / 广场 / 绿化 ---------- */
    function ground(g, plazaR, plazaColor) {
      const grass = new THREE.Mesh(new THREE.CircleGeometry(110, 64), mat.grass());
      grass.rotation.x = -Math.PI / 2; grass.position.y = -0.04; grass.receiveShadow = true;
      const plaza = new THREE.Mesh(new THREE.CircleGeometry(plazaR, 72),
        new THREE.MeshStandardMaterial({ color: plazaColor, roughness: .95 }));
      plaza.rotation.x = -Math.PI / 2; plaza.receiveShadow = true;
      g.add(grass, plaza);
    }

    const foliageCols = [0x3e6b34, 0x4a7a3c, 0x355e2e];
    function tree(g, x, z, s, shade) {
      const grp = new THREE.Group();
      const trunk = mesh(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.8 * s, 6), mat.wood());
      trunk.position.y = 0.9 * s;
      grp.add(trunk);
      for (let k = 0; k < 3; k++) {
        const r = (1.4 + rand(k * 7 + x) * 0.7) * s;
        const f = mesh(new THREE.IcosahedronGeometry(r, 0),
          new THREE.MeshStandardMaterial({ color: foliageCols[(k + shade) % 3], roughness: 1, flatShading: true }));
        f.position.set((rand(k + x * 3) - .5) * 1.6 * s,
                       (1.9 + k * .75 + rand(k * 3 + z) * .4) * s,
                       (rand(k * 5 + z) - .5) * 1.6 * s);
        f.userData.noCollide = true;
        grp.add(f);
      }
      grp.position.set(x, 0, z);
      g.add(grp);
    }

    function bush(g, x, z, s) {
      const f = mesh(new THREE.IcosahedronGeometry(0.75 * s, 0),
        new THREE.MeshStandardMaterial({ color: 0x4a7a3c, roughness: 1, flatShading: true }), false);
      f.position.set(x, 0.5 * s, z);
      f.userData.noCollide = true;
      g.add(f);
    }

    function treeArc(g, from, to, count, r0, r1) {
      for (let i = 0; i < count; i++) {
        const a = (from + (to - from) * (i / (count - 1))) * Math.PI / 180;
        const r = r0 + rand(i) * (r1 - r0);
        tree(g, Math.sin(a) * r, Math.cos(a) * r, 1 + rand(i * 3) * 0.9, i);
      }
    }

    function bushRow(g, z, spread, s = 1) {
      [-1, -0.55, 0.55, 1].forEach((k, i) => bush(g, k * spread, z, (0.85 + rand(i * 5) * 0.5) * s));
    }

    // 双坡屋顶：w 面宽 / d 进深 / h 脊高，返回屋脊
    function gableRoof(g, w, d, h, y, material, overhang = 0.8) {
      const span = d / 2 + overhang;
      const ang = Math.atan2(h, span);
      const len = Math.hypot(span, h);
      [1, -1].forEach(s => {
        const p = mesh(new THREE.BoxGeometry(w + overhang * 2, 0.34, len), material);
        p.position.set(0, y + h / 2, s * span / 2);
        p.rotation.x = s * ang;
        g.add(p);
      });
      const ridge = box(w + overhang * 2 + 0.2, 0.42, 0.8, material, 0, y + h + 0.18, 0);
      g.add(ridge);
    }

    /* ---------- 挺进师纪念碑专用：碑体几何与贴图 ---------- */
    // 斜顶立柱轮廓（挤拉伸切）：底部宽 wB、顶部宽 wT、高 h、斜顶落差 drop
    function pillarGeo(wB, wT, h, drop, depth, mirror) {
      const s = new THREE.Shape();
      if (!mirror) {
        s.moveTo(-wB, 0); s.lineTo(wB, 0); s.lineTo(wT, h - drop); s.lineTo(-wT, h);
      } else {
        s.moveTo(-wB, 0); s.lineTo(wB, 0); s.lineTo(wT, h); s.lineTo(-wT, h - drop);
      }
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
      geo.translate(0, 0, -depth / 2);
      return geo;
    }

    // 上小下大的斜顶碑体：宽度、厚度同时收分（底 wB/dB，顶 wT/dT），更立体
    function bladeGeo(wB, dB, wT, dT, h, drop, mirror) {
      const yL = mirror ? h - drop : h, yR = mirror ? h : h - drop;
      const B0 = [-wB, 0, -dB], B1 = [wB, 0, -dB], B2 = [wB, 0, dB], B3 = [-wB, 0, dB];
      const T0 = [-wT, yL, -dT], T1 = [wT, yR, -dT], T2 = [wT, yR, dT], T3 = [-wT, yL, dT];
      const pos = [], uv = [];
      function quad(a, b, c, d, mode) {
        [a, b, c, a, c, d].forEach(v => {
          pos.push(v[0], v[1], v[2]);
          if (mode === 'front') uv.push(v[0], v[1]);
          else if (mode === 'side') uv.push(v[2], v[1]);
          else uv.push(v[0], v[2]);
        });
      }
      quad(B3, B2, T2, T3, 'front');  // 前 +z
      quad(B0, T0, T1, B1, 'front');  // 后 -z
      quad(B1, T1, T2, B2, 'side');   // 右 +x
      quad(B3, T3, T0, B0, 'side');   // 左 -x
      quad(T0, T3, T2, T1, 'top');    // 顶（斜面）
      quad(B0, B2, B1, B3, 'top');    // 底
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.computeVertexNormals();
      return geo;
    }

    // 主碑碑名石：红底 + 竖排鎏金大字（繁体书法，逐字抖动模拟手写笔意）
    function monumentPlaqueTexture() {
      const c = document.createElement('canvas'); c.width = 224; c.height = 1792;
      const g = c.getContext('2d');
      const bg = g.createLinearGradient(0, 0, 0, 1792);
      bg.addColorStop(0, '#5c1e13'); bg.addColorStop(.5, '#7d2b1b'); bg.addColorStop(1, '#571c12');
      g.fillStyle = bg; g.fillRect(0, 0, 224, 1792);
      g.strokeStyle = '#caa14e'; g.lineWidth = 5; g.strokeRect(10, 10, 204, 1772);
      g.strokeStyle = 'rgba(202,161,78,.6)'; g.lineWidth = 2; g.strokeRect(20, 20, 184, 1752);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 4; g.shadowOffsetY = 3;
      const rs = i => { const x = Math.sin(i * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); };
      const calli = '"STXingkai","Xingkai SC","STKaiti","DFKai-SB","KaiTi","Kaiti SC",serif';
      '中國工農紅軍挺進師紀念碑'.split('').forEach((ch, i) => {
        const y = 70 + 118 * i + 52;
        g.save();
        g.translate(112 + (rs(i * 3 + 1) - .5) * 7, y);
        g.rotate((rs(i * 3 + 2) - .5) * 0.07);
        g.font = 'bold ' + (99 + rs(i * 3 + 3) * 12) + 'px ' + calli;
        g.strokeStyle = '#6b4d0d'; g.lineWidth = 3; g.strokeText(ch, 0, 0);
        g.fillStyle = '#f2cd6a'; g.fillText(ch, 0, 0);
        g.restore();
      });
      g.font = 'bold 40px ' + calli; g.fillStyle = '#f2cd6a';
      '劉華清'.split('').forEach((ch, i) => g.fillText(ch, 168, 1500 + 46 * i));
      g.font = '30px ' + calli;
      '一九九八年十月'.split('').forEach((ch, i) => g.fillText(ch, 120, 1500 + 34 * i));
      const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
      return t;
    }

    // 纪念碑碑前石碑：黑色花岗岩 + 鎏金碑文
    function monumentSteleTexture() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 320;
      const g = c.getContext('2d');
      g.fillStyle = '#26262b'; g.fillRect(0, 0, 512, 320);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = 'rgba(200,200,210,' + Math.random() * .05 + ')';
        g.fillRect(Math.random() * 512, Math.random() * 320, 1.5, 1.5);
      }
      g.strokeStyle = '#caa14e'; g.lineWidth = 2; g.strokeRect(8, 8, 496, 304);
      g.fillStyle = '#e6c46a'; g.textAlign = 'center';
      g.font = 'bold 28px "KaiTi","STKaiti",serif';
      g.fillText('中国工农红军挺进师纪念碑', 256, 50);
      g.font = '16px "SimSun","Songti SC",serif'; g.textAlign = 'left'; g.fillStyle = '#d8c084';
      [
        '一九三五年，中国工农红军挺进师在粟裕、刘英率领下，',
        '挺进浙南，与浙南、闽东革命力量紧密结合，并肩战斗，',
        '开辟浙南游击根据地，功勋卓著，英名长存。',
        '特立此碑，永志纪念。'
      ].forEach((l, i) => g.fillText(l, 40, 100 + i * 34));
      g.textAlign = 'right';
      g.fillText('中共平阳县委 · 平阳县人民政府 敬立', 472, 250);
      g.fillText('一九九八年十月', 472, 284);
      const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
      return t;
    }

    /* ---------- 抗日救亡干部学校专用：贴图 ---------- */
    // 规整的垂直木纹（用于柱子、门窗、栏杆）
    function schoolWoodTexture() {
      const c = document.createElement('canvas'); c.width = 128; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#8b7d6b'; g.fillRect(0, 0, 128, 256);
      for (let x = 0; x < 128; x += 16) {
        g.strokeStyle = 'rgba(60,50,40,0.15)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke();
        for (let i = 0; i < 4; i++) {
          g.strokeStyle = 'rgba(50,40,30,' + (0.05 + Math.random() * 0.05) + ')';
          g.beginPath();
          const sx = x + Math.random() * 12;
          g.moveTo(sx, 0);
          g.bezierCurveTo(sx + 1, 80, sx - 1, 180, sx, 256);
          g.stroke();
        }
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(30,20,10,' + Math.random() * 0.04 + ')';
        g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    }

    // 规整的瓦片纹理（用于屋顶坡面）
    function schoolRoofTexture() {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 16) {
        g.fillStyle = 'rgba(20,20,20,0.8)';
        g.fillRect(0, y, 256, 2);
        g.fillStyle = 'rgba(70,70,70,0.4)';
        g.fillRect(0, y + 2, 256, 2);
      }
      for (let x = 0; x < 256; x += 32) {
        g.fillStyle = 'rgba(20,20,20,0.4)';
        g.fillRect(x, 0, 2, 256);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    }

    // 牌匾（深木色底 + 绿色行书字）
    function schoolPlaqueTexture() {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#3d2b1f'; g.fillRect(0, 0, 1024, 256);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 72px "STXingkai", "Xingkai SC", "STKaiti", "KaiTi", serif';
      g.fillStyle = '#2b5c3b';
      g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 4; g.shadowOffsetY = 3;
      g.fillText('闽浙边抗日救亡干部学校旧址', 512, 128);
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = 8;
      return t;
    }

    // 碑前石碑纹理
    function schoolSteleTexture() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 320;
      const g = c.getContext('2d');
      g.fillStyle = '#2a2a2f'; g.fillRect(0, 0, 512, 320);
      for (let i = 0; i < 200; i++) {
        g.fillStyle = 'rgba(200,200,210,' + Math.random() * .03 + ')';
        g.fillRect(Math.random() * 512, Math.random() * 320, 1.5, 1.5);
      }
      g.strokeStyle = '#caa14e'; g.lineWidth = 2; g.strokeRect(8, 8, 496, 304);
      g.fillStyle = '#e6c46a'; g.textAlign = 'center';
      g.font = 'bold 28px "KaiTi","STKaiti",serif';
      g.fillText('闽浙边抗日救亡干部学校旧址', 256, 50);
      g.font = '16px "SimSun","Songti SC",serif'; g.textAlign = 'left'; g.fillStyle = '#d8c084';
      [
        '一九三七年抗战全面爆发后，中共闽浙边临时省委在此',
        '创办抗日救亡干部学校，粟裕任校长，培养了大批抗日骨干。',
        '其旧址为清代木构建筑，现为浙江省文物保护单位。',
        '特立此碑，永志纪念。'
      ].forEach((l, i) => g.fillText(l, 40, 100 + i * 34));
      g.textAlign = 'right';
      g.fillText('平阳县人民政府 立', 472, 250);
      g.fillText('二零一八年十月', 472, 284);
      const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
      return t;
    }

    // 桂花丛
    function osmanthus(g, x, z, s) {
      const grp = new THREE.Group();
      const f = mesh(new THREE.IcosahedronGeometry(.8 * s, 0),
        new THREE.MeshStandardMaterial({ color: 0x5a7a4c, roughness: 1, flatShading: true }));
      f.position.y = .6 * s;
      f.userData.noCollide = true;
      grp.add(f);
      for (let i = 0; i < 8; i++) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 4, 4),
          new THREE.MeshStandardMaterial({ color: 0xe8d44d, roughness: 0.8 }));
        flower.position.set((rand(i) - 0.5) * 1.2 * s, 0.8 * s + rand(i * 2) * 0.4 * s, (rand(i * 3) - 0.5) * 1.2 * s);
        grp.add(flower);
      }
      grp.position.set(x, 0, z);
      g.add(grp);
    }

    /* ---------- 建模对象一：中国工农红军挺进师纪念碑 ---------- */
    function buildMonument(g) {
      ground(g, 17, 0xc7cbc4);
      // 后方与两侧树带 + 前方两侧点缀
      for (let i = 0; i < 16; i++) {
        const a = (100 + i * 10.5) * Math.PI / 180, r = 14 + rand(i) * 8;
        tree(g, Math.sin(a) * r, Math.cos(a) * r, 1 + rand(i * 3) * 0.9, i);
      }
      [[40, 22], [320, 22], [75, 20], [285, 20]].forEach(([deg, r], i) => {
        const a = deg * Math.PI / 180;
        tree(g, Math.sin(a) * r, Math.cos(a) * r, 1.1 + rand(i * 11) * 0.7, i + 1);
      });
      [[-6, 12.5], [6, 12.5], [-10.5, 9.5], [10.5, 9.5], [-12.5, 4], [12.5, 4]]
        .forEach(([x, z], i) => bush(g, x, z, 0.8 + rand(i * 5) * 0.5));

      const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: .85, metalness: .02 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x7e3b2c, roughness: .7 });
      const BED = 0.8, PLINTH = 0.45, baseY = BED + PLINTH;

      // 圆形基座
      const bed = mesh(new THREE.CylinderGeometry(6.6, 6.75, BED, 72),
        new THREE.MeshStandardMaterial({ color: 0xcfcfc8, roughness: .9 }));
      bed.position.y = BED / 2;
      g.add(bed);

      // 花坛顶面暗红色宽沿（航拍中的红环）+ 地面矮台阶
      const rimTop = mesh(new THREE.RingGeometry(5.7, 6.78, 72), rimMat, false);
      rimTop.rotation.x = -Math.PI / 2;
      rimTop.position.y = BED + 0.005;
      const rimStep = mesh(new THREE.CylinderGeometry(7.05, 7.05, 0.16, 72), rimMat);
      rimStep.position.y = 0.08;
      g.add(rimTop, rimStep);

      // 基座内草坪 + 环形绿篱
      const lawn = mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.06, 64),
        new THREE.MeshStandardMaterial({ color: 0x4d7a3f, roughness: 1 }), false);
      lawn.position.y = BED + 0.03;
      const hedgeShape = new THREE.Shape(); hedgeShape.absarc(0, 0, 5.6, 0, Math.PI * 2);
      const hedgeHole = new THREE.Path(); hedgeHole.absarc(0, 0, 4.5, 0, Math.PI * 2, true);
      hedgeShape.holes.push(hedgeHole);
      const hedgeGeo = new THREE.ExtrudeGeometry(hedgeShape, { depth: .5, bevelEnabled: false });
      hedgeGeo.rotateX(-Math.PI / 2);
      const hedge = mesh(hedgeGeo, new THREE.MeshStandardMaterial({ color: 0x3f6b35, roughness: 1 }));
      hedge.position.y = BED;
      g.add(lawn, hedge);

      // 中央方形碑座
      g.add(box(4.4, PLINTH, 2.9, stoneMat, 0, BED + PLINTH / 2, 0));

      // 双肢主碑：高 18 米，上小下大收分，略向外张开
      const H = 18;
      const pilL = mesh(bladeGeo(0.95, 0.85, 0.42, 0.5, H, 2.4, false), stoneMat);
      pilL.position.set(-1.06, baseY, 0); pilL.rotation.z = 0.021;
      const pilR = mesh(bladeGeo(0.95, 0.85, 0.42, 0.5, H, 2.4, true), stoneMat);
      pilR.position.set(1.06, baseY, 0); pilR.rotation.z = -0.021;
      g.add(pilL, pilR);

      // 双肢下部实心连为一体（顶端填满碑名石上方缝隙）
      g.add(box(1.5, 13.9, 1.0, stoneMat, 0, baseY + 13.9 / 2, 0));

      // 正面碑名石（鎏金题字）
      const plaqueSide = new THREE.MeshStandardMaterial({ color: 0x5c2015, roughness: .55 });
      const plaqueFront = new THREE.MeshStandardMaterial({ map: monumentPlaqueTexture(), roughness: .5 });
      g.add(box(1.18, 8.8, 0.3,
        [plaqueSide, plaqueSide, plaqueSide, plaqueSide, plaqueFront, plaqueSide],
        0, baseY + 8.85, 0.65));

      // 周围 6 根春笋状立柱：±30°/±90°/±150° 三对，离碑越近越矮、越远越高
      [[30, 3.3, 1.2], [-30, 3.3, 1.2],
       [90, 4.0, 2.2], [-90, 4.0, 2.2],
       [150, 4.2, 3.2], [-150, 4.2, 3.2]].forEach(([deg, r, h], i) => {
        const th = deg * Math.PI / 180;
        const m = mesh(pillarGeo(0.45, 0.38, h, 0.5, 0.9, i % 2 === 0), stoneMat);
        m.position.set(Math.sin(th) * r, BED, Math.cos(th) * r);
        m.rotation.y = th;
        g.add(m);
      });

      // 碑前石碑（可点击）
      const stele = new THREE.Group();
      const dSide = new THREE.MeshStandardMaterial({ color: 0x2c2c31, roughness: .45, metalness: .15 });
      const dFront = new THREE.MeshStandardMaterial({ map: monumentSteleTexture(), roughness: .45 });
      const plat = mesh(new THREE.BoxGeometry(2.5, .22, 1.7),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: .6 }));
      plat.position.y = .11;
      const slab = mesh(new THREE.BoxGeometry(1.75, 1.1, 0.16),
        [dSide, dSide, dSide, dSide, dFront, dSide]);
      slab.rotation.x = -0.38; slab.position.set(0, 0.72, -0.05);
      const sup = mesh(new THREE.BoxGeometry(1.5, 0.5, 0.5), dSide);
      sup.position.set(0, 0.35, -0.45);
      stele.add(plat, slab, sup);
      stele.position.set(2.7, 0, 8.1);
      stele.rotation.y = -0.15;
      registry.pickables.push(stele);
      g.add(stele);

      // 两侧英烈名录墙
      [-9.6, 9.6].forEach((x, i) => {
        const wall = new THREE.Group();
        const w = mesh(new THREE.BoxGeometry(6.4, 1.5, 0.35),
          new THREE.MeshStandardMaterial({ color: 0x323236, roughness: .5 }));
        w.position.y = .75;
        const cap = mesh(new THREE.BoxGeometry(6.6, .14, .5), stoneMat);
        cap.position.y = 1.57;
        wall.add(w, cap);
        wall.position.set(x, 0, -0.8);
        wall.rotation.y = i === 0 ? 0.35 : -0.35;
        g.add(wall);
      });
    }

    /* ---------- 建模对象二：北上抗日出征门 ---------- */
    function buildGate(g) {
      ground(g, 24, 0xc4c8c1);
      treeArc(g, 100, 260, 14, 22, 32);
      bushRow(g, 16, 6);

      const stone = mat.stone(), granite = mat.granite(), tile = mat.tile();

      // 台基与台阶
      g.add(box(20, 1.1, 12, granite, 0, 0.55, 0));
      [0, 1, 2].forEach(i => g.add(box(12, 0.3, 1.3, granite, 0, 0.95 - i * 0.3, 6.55 + i * 1.25)));

      // 四根青石立柱
      [-7.2, -4.0, 4.0, 7.2].forEach(x => {
        g.add(box(1.6, 9.2, 1.6, stone, x, 5.7, 0));
        g.add(box(2.0, 0.4, 2.0, granite, x, 10.5, 0));
      });

      // 额枋 + 匾额
      g.add(box(16.2, 1.9, 2.0, stone, 0, 11.65, 0));
      const banner = new THREE.MeshStandardMaterial({ map: plaqueTexture('北上抗日出征门', false), roughness: .5 });
      [1, -1].forEach(s => {
        const b = mesh(new THREE.PlaneGeometry(10.5, 1.5), banner, false);
        b.position.set(0, 11.65, s * 1.02);
        if (s < 0) b.rotation.y = Math.PI;
        g.add(b);
      });

      // 檐口 + 坡屋顶
      g.add(box(18, 0.6, 3.4, tile, 0, 12.9, 0));
      const roofH = 2.4, span = 2.6, ang = Math.atan2(roofH, span);
      [1, -1].forEach(s => {
        const p = mesh(new THREE.BoxGeometry(18.6, 0.34, Math.hypot(span, roofH) + 0.5), tile);
        p.position.set(0, 13.2 + roofH / 2, s * span / 2);
        p.rotation.x = s * ang;
        g.add(p);
      });
      g.add(box(18.7, 0.42, 0.8, granite, 0, 13.2 + roofH + 0.2, 0));

      // 两侧红旗
      flag(g, -10.6, 1.1, 3.6, 0.5, 1.1);
      flag(g, 10.6, 1.1, 3.6, -0.5, 1.1);

      // 碑前石碑（可点击）
      const stele = makeStele('红军北上抗日出征地');
      stele.position.set(-9.6, 0, 9.6);
      stele.rotation.y = 0.34;
      g.add(stele);
    }

    /* ---------- 中共浙江省一大冠尖会址专用：贴图 ---------- */
    // 老木料：竖向木纹 + 疖疤
    function siteWoodTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#6b5d4f'; g.fillRect(0, 0, 256, 256);
      for (let x = 0; x < 256; x += 18) {
        g.strokeStyle = 'rgba(40,30,20,0.45)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke();
        g.strokeStyle = 'rgba(90,75,60,0.25)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x + 4, 0); g.lineTo(x + 4, 256); g.stroke();
      }
      for (let i = 0; i < 100; i++) {
        g.fillStyle = 'rgba(30,20,10,' + (Math.random() * 0.14) + ')';
        g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 10, 2 + Math.random() * 5);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    }

    // 灰瓦：横向瓦垄 + 瓦当
    function siteRoofTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 14) {
        g.fillStyle = 'rgba(20,20,20,0.85)'; g.fillRect(0, y, 256, 2);
        g.fillStyle = 'rgba(100,100,100,0.35)'; g.fillRect(0, y + 2, 256, 4);
        for (let x = 0; x < 256; x += 26) {
          g.fillStyle = 'rgba(30,30,30,0.45)';
          g.fillRect(x + (y % 26 === 0 ? 0 : 13), y + 6, 2, 7);
        }
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    }

    // 鹅卵石铺地
    function siteCobbleTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      g.fillStyle = '#8a8a7a'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2500; i++) {
        const v = 100 + Math.random() * 60 | 0;
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 10) + ',' + (0.2 + Math.random() * 0.4) + ')';
        const x = Math.random() * 512, y = Math.random() * 512;
        const r = 4 + Math.random() * 9;
        g.beginPath(); g.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2); g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 4);
      t.anisotropy = 8;
      return t;
    }

    // 毛石挡墙
    function siteStoneWallTexture() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#7a7a6a'; g.fillRect(0, 0, 512, 256);
      for (let y = 0; y < 256; y += 32) {
        for (let x = 0; x < 512; x += 48) {
          const v = 110 + Math.random() * 40 | 0;
          const ox = x + (y % 64 === 0 ? 0 : 24);
          g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v - 10) + ')';
          g.fillRect(ox, y, 46, 30);
          g.strokeStyle = 'rgba(50,50,40,0.5)'; g.lineWidth = 1;
          g.strokeRect(ox, y, 46, 30);
        }
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(3, 1.5);
      t.anisotropy = 4;
      return t;
    }

    // 党旗：红底金镰锤（3:2）
    function siteFlagTexture() {
      const c = document.createElement('canvas');
      c.width = 300; c.height = 200;
      const g = c.getContext('2d');
      g.fillStyle = '#e60012'; g.fillRect(0, 0, 300, 200);
      g.fillStyle = '#ffde00'; g.strokeStyle = '#ffde00';
      g.lineCap = 'round'; g.lineJoin = 'round';
      const cx = 75, cy = 65;
      // 锤子
      g.save();
      g.translate(cx + 5, cy - 5);
      g.rotate(-Math.PI / 4);
      g.fillRect(-6, -40, 12, 80);
      g.beginPath(); g.roundRect(-28, -50, 56, 20, 4); g.fill();
      g.restore();
      // 镰刀
      g.save();
      g.translate(cx, cy);
      g.rotate(Math.PI);
      g.beginPath(); g.arc(0, 0, 35, Math.PI * 0.6, Math.PI * 1.8); g.lineWidth = 14; g.stroke();
      const hx = 35 * Math.cos(Math.PI * 1.8), hy = 35 * Math.sin(Math.PI * 1.8);
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - 18, hy + 18); g.lineWidth = 14; g.stroke();
      g.restore();
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = 8;
      return t;
    }

    // 文保碑：浙江省重点文物保护单位
    function siteSteleTexture() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 320;
      const g = c.getContext('2d');
      g.fillStyle = '#3a3a40'; g.fillRect(0, 0, 512, 320);
      for (let i = 0; i < 300; i++) {
        g.fillStyle = 'rgba(180,180,190,' + (Math.random() * .05) + ')';
        g.fillRect(Math.random() * 512, Math.random() * 320, 1.5, 1.5);
      }
      g.strokeStyle = '#aaaaaa'; g.lineWidth = 3; g.strokeRect(8, 8, 496, 304);
      g.fillStyle = '#d8d8d8'; g.textAlign = 'center';
      g.font = 'bold 22px "SimSun", "Songti SC", serif';
      g.fillText('浙江省重点文物保护单位', 256, 55);
      g.fillStyle = '#e60000';
      g.font = 'bold 34px "KaiTi", "STKaiti", "KaiTi SC", serif';
      g.fillText('中国共产党浙江省第', 256, 120);
      g.fillText('一次代表大会会址', 256, 175);
      g.fillStyle = '#d8d8d8';
      g.font = '16px "SimSun", "Songti SC", serif';
      g.fillText('浙江省人民政府一九六三年三月十一日公布', 256, 235);
      g.fillText('平阳县人民政府立', 256, 270);
      const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
      return t;
    }

    // 杉木 / 竹丛（浙南山场绿化）
    function sitePine(g, x, z, s, shade) {
      const grp = new THREE.Group();
      const trunk = mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2 * s, 6), mat.wood());
      trunk.position.y = 1 * s;
      grp.add(trunk);
      const coneMats = [0, 1, 2].map(k =>
        new THREE.MeshStandardMaterial({ color: foliageCols[k], roughness: 1, flatShading: true }));
      for (let k = 0; k < 4; k++) {
        const f = mesh(new THREE.ConeGeometry((1.2 - k * 0.2) * s, 1.2 * s, 8), coneMats[(k + shade) % 3]);
        f.position.y = (1.5 + k * 0.9) * s;
        f.userData.noCollide = true;
        grp.add(f);
      }
      grp.position.set(x, 0, z);
      g.add(grp);
    }

    function siteBamboo(g, x, z, count, s) {
      const stalkMat = new THREE.MeshStandardMaterial({ color: 0x5a7a3a, roughness: 1 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3c, roughness: 1, flatShading: true });
      for (let i = 0; i < count; i++) {
        const bx = x + (rand(i * 3 + x) - 0.5) * 3;
        const bz = z + (rand(i * 5 + z) - 0.5) * 3;
        const h = (4 + rand(i * 7) * 3) * s;
        const stalk = mesh(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, h, 5), stalkMat);
        stalk.position.set(bx, h / 2, bz);
        g.add(stalk);
        for (let k = 0; k < 3; k++) {
          const leaf = mesh(new THREE.ConeGeometry(0.3 * s, 0.8 * s, 4), leafMat, false);
          leaf.position.set(bx + (rand(k) - 0.5) * 0.5, h - k * 0.8, bz + (rand(k + 1) - 0.5) * 0.5);
          leaf.rotation.z = (rand(k + 2) - 0.5) * 0.5;
          leaf.userData.noCollide = true;
          g.add(leaf);
        }
      }
    }
    /* ---------- 建模对象三：中共浙江省一大冠尖会址 ---------- */
    // 原为村民郑永暖家新楼（1932 年建）：面阔六间、两层木构，重檐悬山顶、穿斗式梁架
    function buildSite(g) {
      const BW = 21.68, BD = 8.9, FLOOR_H = 3.2, BAYS = 6;
      const BAY_W = BW / BAYS;
      const PILLAR_R = 0.17;

      // 地面 / 广场
      const grass = mesh(new THREE.CircleGeometry(110, 64), mat.grass(), false);
      grass.rotation.x = -Math.PI / 2; grass.position.y = -0.03;
      const cobbleMat = new THREE.MeshStandardMaterial({ map: siteCobbleTexture(), roughness: .95 });
      const cobbleSquare = mesh(new THREE.CircleGeometry(16, 48), cobbleMat, false);
      cobbleSquare.rotation.x = -Math.PI / 2;
      cobbleSquare.position.set(0, 0.02, BD / 2 + 6);
      g.add(grass, cobbleSquare);

      // 绿化：竹丛、杉木、灌木、行道树
      siteBamboo(g, -12, -12, 12, 1.0);
      siteBamboo(g, 0, -14, 10, 0.9);
      siteBamboo(g, 12, -12, 8, 1.1);
      siteBamboo(g, -20, -8, 8, 0.9);
      siteBamboo(g, 20, -8, 8, 1.0);
      sitePine(g, -28, -5, 1.3, 0);
      sitePine(g, -30, 8, 1.1, 1);
      sitePine(g, 28, -5, 1.2, 2);
      sitePine(g, 30, 8, 1.0, 0);
      sitePine(g, -25, 15, 1.1, 1);
      sitePine(g, 25, 15, 1.3, 2);
      [[-14, 8], [14, 8], [-16, 4], [16, 4], [-18, 0], [18, 0], [-20, -4], [20, -4], [-10, -6], [10, -6]]
        .forEach(([x, z], i) => bush(g, x, z, 0.8 + rand(i * 5) * 0.5));
      for (let i = 0; i < 18; i++) {
        const a = (100 + i * 9) * Math.PI / 180, r = 26 + rand(i) * 12;
        tree(g, Math.sin(a) * r, Math.cos(a) * r, 1 + rand(i * 3) * 0.9, i);
      }

      // 材质
      const woodMat = new THREE.MeshStandardMaterial({ map: siteWoodTexture(), roughness: .92, metalness: .01 });
      const roofMat = new THREE.MeshStandardMaterial({ map: siteRoofTexture(), roughness: .82 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: .9 });
      const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3a2b1b, roughness: .88 });
      const shellMat = new THREE.MeshStandardMaterial({ color: 0xeeddcc, roughness: .3, metalness: .5 });
      const stoneWallMat = new THREE.MeshStandardMaterial({ map: siteStoneWallTexture(), roughness: .9 });
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x8c7d6b, roughness: .95 });
      const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: .5 });
      const mattressMat = new THREE.MeshStandardMaterial({ color: 0x9a8a7a, roughness: .8 });
      const pillowMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: .7 });
      const letterMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: .9 });
      const bustMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: .5, metalness: .1 });
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5 });
      const hillMat = new THREE.MeshStandardMaterial({ color: 0x6b8a4a, roughness: 1 });
      const trenchMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 });
      const signMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: .8 });

      const building = new THREE.Group();
      g.add(building);

      // 1. 地基与台阶
      building.add(box(BW + 2.5, 0.6, BD + 2.5, stoneMat, 0, 0.3, 0));
      for (let i = 0; i < 3; i++)
        building.add(box(BW + 3, 0.18, 1.2, stoneMat, 0, 0.09 + i * 0.18, BD / 2 + 1.5 - i * 0.3));

      // 2. 廊柱：前后檐各 7 根，两端山面各 3 根（明间不设前檐柱）
      const pillarGeo = new THREE.CylinderGeometry(PILLAR_R, PILLAR_R * 1.15, 7.7, 8);
      const pillarAt = (x, z) => {
        const p = mesh(pillarGeo, woodMat);
        p.position.set(x, 3.85, z);
        building.add(p);
      };
      for (let i = 0; i <= BAYS; i++) {
        const x = -BW / 2 + i * BAY_W;
        if (i !== 3) pillarAt(x, BD / 2 + 0.4);
        pillarAt(x, -BD / 2 - 0.4);
      }
      [-1, 1].forEach(s => [-BD / 2, 0, BD / 2].forEach(z => pillarAt(s * (BW / 2 + 0.4), z)));

      // 3. 底层后墙与侧墙
      const backWall = mesh(new THREE.BoxGeometry(BW - 0.8, FLOOR_H, 0.35), woodMat);
      backWall.position.set(0, FLOOR_H / 2 + 0.6, -BD / 2 + 0.15);
      building.add(backWall);
      [-1, 1].forEach(side => {
        const sw = mesh(new THREE.BoxGeometry(0.35, FLOOR_H, BD - 0.6), woodMat);
        sw.position.set(side * (BW / 2 - 0.17), FLOOR_H / 2 + 0.6, 0);
        building.add(sw);
      });

      // 4. 底层前墙：左端设板门，次间为木格窗，明间通道敞开
      const sideWallWidth = BAY_W * 2;
      const leftLowerWall = box(sideWallWidth, 1.3, 0.35, woodMat, -BAY_W - sideWallWidth / 2, 0.6 + 0.65, BD / 2 - 0.15);
      const leftUpperWall = box(sideWallWidth, 0.7, 0.35, woodMat, -BAY_W - sideWallWidth / 2, 0.6 + 2.6 + 0.35, BD / 2 - 0.15);
      const rightLowerWall = leftLowerWall.clone(); rightLowerWall.position.x = BAY_W + sideWallWidth / 2;
      const rightUpperWall = leftUpperWall.clone(); rightUpperWall.position.x = BAY_W + sideWallWidth / 2;
      building.add(leftLowerWall, leftUpperWall, rightLowerWall, rightUpperWall);

      // 木格窗：深色窗框 + 等分棂条
      const latticeWindow = (x, cy, w, h, n) => {
        building.add(box(w, h, 0.12, darkWoodMat, x, cy, BD / 2 - 0.02));
        const step = h / n;
        for (let j = 0; j < n; j++)
          building.add(box(w, 0.04, 0.14, woodMat, x, cy - h / 2 + step + j * step, BD / 2 - 0.02));
        for (let j = 0; j < n; j++)
          building.add(box(0.04, h, 0.14, woodMat, x + (j - (n - 1) / 2) * (w / n), cy, BD / 2 - 0.02));
      };

      for (let i = 0; i < BAYS; i++) {
        if (i === 2 || i === 3) continue;
        const x = -BW / 2 + BAY_W / 2 + i * BAY_W;
        if (i === 0) {
          building.add(box(BAY_W * 0.85, 2.6, 0.18, darkWoodMat, x, 0.6 + 1.3, BD / 2 - 0.02));
          const door = box(BAY_W * 0.4, 2.4, 0.1, woodMat, x - BAY_W * 0.2, 0.6 + 1.2, BD / 2 + 0.1);
          door.rotation.y = -0.5;
          building.add(door);
        } else {
          latticeWindow(x, 0.6 + 1.3 + 0.65, BAY_W * 0.6, 1.3, 4);
        }
      }

      // 5. 内部隔墙：左餐厅、右卧室，中间为直通内部的大通道
      const dividerLeft = mesh(new THREE.BoxGeometry(0.3, FLOOR_H, BD - 1.5), wallMat);
      dividerLeft.position.set(-4, FLOOR_H / 2 + 0.6, -0.2);
      const dividerRightBack = mesh(new THREE.BoxGeometry(0.3, FLOOR_H, 5.0), wallMat);
      dividerRightBack.position.set(4, FLOOR_H / 2 + 0.6, -1.5);
      const dividerRightFront = mesh(new THREE.BoxGeometry(0.3, FLOOR_H, 1.5), wallMat);
      dividerRightFront.position.set(4, FLOOR_H / 2 + 0.6, 3.2);
      building.add(dividerLeft, dividerRightBack, dividerRightFront);
      building.add(box(0.35, 2.6, 0.1, woodMat, 4.0, 0.6 + 1.3, 1.0));
      building.add(box(0.35, 2.6, 0.1, woodMat, 4.0, 0.6 + 1.3, 2.45));
      building.add(box(0.35, 0.1, 1.45, woodMat, 4.0, 0.6 + 2.6, 1.725));

      // 6. 重檐腰檐
      const eaveW = BW + 1.8, eaveD = BD + 1.8;
      const eaveShape = new THREE.Shape();
      eaveShape.moveTo(-eaveD / 2, 0);
      eaveShape.lineTo(eaveD / 2, 0);
      eaveShape.lineTo(0, 0.9);
      eaveShape.closePath();
      const eaveGeo = new THREE.ExtrudeGeometry(eaveShape, { depth: eaveW, bevelEnabled: false });
      eaveGeo.rotateY(-Math.PI / 2);
      eaveGeo.translate(eaveW / 2, 0, 0);
      const eaveMesh = mesh(eaveGeo, [woodMat, roofMat]);
      eaveMesh.position.y = FLOOR_H + 0.6;
      building.add(eaveMesh);
      building.add(box(BW + 1, 0.18, 0.2, woodMat, 0, FLOOR_H + 0.5, BD / 2 + 0.9));

      // 7. 二层楼板
      building.add(box(BW + 0.5, 0.2, BD + 0.5, woodMat, 0, FLOOR_H + 0.7, 0));

      // 8. 二层前廊栏杆：直棂 + 交叉斜撑
      const RAIL_H = 0.85;
      const railY = FLOOR_H + 0.7;
      building.add(box(BW + 0.5, 0.08, 0.08, woodMat, 0, railY + RAIL_H, BD / 2 + 0.4));
      building.add(box(BW + 0.5, 0.08, 0.08, woodMat, 0, FLOOR_H + 0.85, BD / 2 + 0.4));
      const railBays = BAYS * 2;
      for (let i = 0; i <= railBays; i++) {
        const x = -BW / 2 - 0.25 + (i * (BW + 0.5)) / railBays;
        building.add(box(0.07, RAIL_H, 0.07, woodMat, x, railY + RAIL_H / 2, BD / 2 + 0.4));
        if (i === railBays) continue;
        const x2 = -BW / 2 - 0.25 + ((i + 1) * (BW + 0.5)) / railBays;
        [Math.PI / 4, -Math.PI / 4].forEach(rot => {
          const cross = box(0.05, RAIL_H * 0.88, 0.05, woodMat, (x + x2) / 2, railY + RAIL_H / 2, BD / 2 + 0.4);
          cross.rotation.z = rot;
          building.add(cross);
        });
      }

      // 9. 二层后墙与侧墙
      const upperBackWall = mesh(new THREE.BoxGeometry(BW - 0.8, FLOOR_H, 0.35), woodMat);
      upperBackWall.position.set(0, FLOOR_H * 1.5 + 0.6, -BD / 2 + 0.15);
      building.add(upperBackWall);
      [-1, 1].forEach(side => {
        const sw = mesh(new THREE.BoxGeometry(0.35, FLOOR_H, BD - 0.6), woodMat);
        sw.position.set(side * (BW / 2 - 0.17), FLOOR_H * 1.5 + 0.6, 0);
        building.add(sw);
      });

      // 10. 二层前墙与连续排窗
      building.add(box(BW - 0.8, 0.9, 0.35, woodMat, 0, FLOOR_H + 0.6 + 0.45, BD / 2 - 0.15));
      building.add(box(BW - 0.8, 0.5, 0.35, woodMat, 0, FLOOR_H + 0.6 + 2.55, BD / 2 - 0.15));
      for (let i = 0; i < BAYS; i++) {
        if (i === 2 || i === 3) continue;
        latticeWindow(-BW / 2 + BAY_W / 2 + i * BAY_W, FLOOR_H + 0.6 + 0.9 + 0.7, BAY_W * 0.7, 1.4, 5);
      }

      // 11. 主屋顶（悬山顶 + 正脊）
      const roofHeight = 2.3, roofOverhang = 1.3;
      const roofW = BW + roofOverhang * 2, roofD = BD + roofOverhang * 2;
      const roofY = FLOOR_H * 2 + 1.3;
      const roofShape = new THREE.Shape();
      roofShape.moveTo(-roofD / 2, 0);
      roofShape.lineTo(roofD / 2, 0);
      roofShape.lineTo(0, roofHeight);
      roofShape.closePath();
      const siteRoofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: roofW, bevelEnabled: false });
      siteRoofGeo.rotateY(-Math.PI / 2);
      siteRoofGeo.translate(roofW / 2, 0, 0);
      const roofMesh = mesh(siteRoofGeo, [woodMat, roofMat]);
      roofMesh.position.y = roofY;
      building.add(roofMesh);
      building.add(box(roofW + 0.3, 0.22, 0.35, roofMat, 0, roofY + roofHeight, 0));
      /* ============ 12. 室内陈设 ============ */

      const put = (parent, geo, material, x, y, z) => {
        const m = mesh(geo, material);
        m.position.set(x, y, z);
        parent.add(m);
        return m;
      };

      // 左间餐厅：方桌 + 碗
      const leftRoomX = -BW / 2 + BAY_W * 1.5;
      const squareTable = (x, z) => {
        const grp = new THREE.Group();
        put(grp, new THREE.BoxGeometry(1.0, 0.08, 1.0), darkWoodMat, 0, 0.9, 0);
        [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]
          .forEach(([dx, dz]) => put(grp, new THREE.BoxGeometry(0.08, 0.8, 0.08), darkWoodMat, dx, 0.5, dz));
        for (let k = 0; k < 4; k++)
          put(grp, new THREE.CylinderGeometry(0.1, 0.08, 0.06, 8), porcelainMat,
            (k % 2 - 0.5) * 0.5, 0.97, (Math.floor(k / 2) - 0.5) * 0.5);
        grp.position.set(x, 0.6, z);
        building.add(grp);
      };
      squareTable(leftRoomX, -1.5);
      squareTable(leftRoomX, 1.5);

      // 中间通道：会场布景（长桌、茶杯、党旗、半身像、长凳）
      const deskZ = -BD / 2 + 1.8;
      put(building, new THREE.BoxGeometry(2.2, 0.08, 0.9), darkWoodMat, 0, 1.45, deskZ);
      [[-1.0, -0.35], [1.0, -0.35], [-1.0, 0.35], [1.0, 0.35]]
        .forEach(([dx, dz]) => put(building, new THREE.BoxGeometry(0.07, 0.8, 0.07), darkWoodMat, dx, 1.05, deskZ + dz));
      [-0.3, 0.3].forEach(dx =>
        put(building, new THREE.CylinderGeometry(0.06, 0.05, 0.08, 8), whiteMat, dx, 1.55, deskZ));

      const innerFlag = mesh(new THREE.PlaneGeometry(1.8, 1.2),
        new THREE.MeshStandardMaterial({ map: siteFlagTexture(), side: THREE.DoubleSide }), false);
      innerFlag.position.set(1.5, 3.1, -BD / 2 + 0.5);
      building.add(innerFlag);
      put(building, new THREE.BoxGeometry(0.08, 1.3, 0.05), whiteMat, 0.6, 3.1, -BD / 2 + 0.5);

      put(building, new THREE.BoxGeometry(0.6, 0.8, 0.6), darkWoodMat, -1.2, 1.9, -BD / 2 + 1.2);
      put(building, new THREE.CylinderGeometry(0.2, 0.25, 0.5, 16), bustMat, -1.2, 2.5, -BD / 2 + 1.2);

      const bench = (x, z, rotY) => {
        const grp = new THREE.Group();
        put(grp, new THREE.BoxGeometry(1.8, 0.06, 0.3), darkWoodMat, 0, 0.4, 0);
        [-0.8, 0.8].forEach(dx => put(grp, new THREE.BoxGeometry(0.06, 0.4, 0.25), darkWoodMat, dx, 0.2, 0));
        grp.position.set(x, 0.6, z);
        grp.rotation.y = rotY;
        building.add(grp);
      };
      [-1.5, 0, 1.5].forEach(x => bench(x, -BD / 2 + 3.5, 0));
      [-0.75, 0.75].forEach(x => bench(x, -BD / 2 + 4.5, 0));

      // 右间卧室：架子床、书桌、墙上书信
      const rightRoomX = BW / 2 - BAY_W * 1.5;
      const rightRoomZ = -BD / 4;
      const bed = new THREE.Group();
      put(bed, new THREE.BoxGeometry(1.8, 0.3, 0.9), darkWoodMat, 0, 0.15, 0);
      put(bed, new THREE.BoxGeometry(1.7, 0.15, 0.85), mattressMat, 0, 0.38, 0);
      put(bed, new THREE.BoxGeometry(0.5, 0.12, 0.4), pillowMat, -0.5, 0.5, 0);
      [[-0.85, -0.4], [0.85, -0.4], [-0.85, 0.4], [0.85, 0.4]]
        .forEach(([dx, dz]) => put(bed, new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), darkWoodMat, dx, 0.75, dz));
      put(bed, new THREE.BoxGeometry(1.9, 0.08, 1.0), darkWoodMat, 0, 1.35, 0);
      for (let k = 0; k < 6; k++)
        put(bed, new THREE.CircleGeometry(0.05, 8), shellMat, -0.7 + k * 0.28, 0.32, 0.46);
      bed.position.set(rightRoomX, 0.6, rightRoomZ);
      building.add(bed);

      put(building, new THREE.BoxGeometry(1.0, 0.08, 0.6), darkWoodMat, rightRoomX + 1.2, 0.9, rightRoomZ + 0.5);
      [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25], [0.4, 0.25]]
        .forEach(([dx, dz]) => put(building, new THREE.BoxGeometry(0.06, 0.8, 0.06), darkWoodMat,
          rightRoomX + 1.2 + dx, 0.5, rightRoomZ + 0.5 + dz));

      put(building, new THREE.PlaneGeometry(0.3, 0.4), letterMat, rightRoomX + 0.2, 2.2, -BD / 2 + 0.25);
      put(building, new THREE.PlaneGeometry(0.3, 0.4), letterMat, rightRoomX - 0.3, 2.2, -BD / 2 + 0.25);

      /* ============ 13. 外部环境 ============ */

      // 左侧毛石挡墙与上山石阶
      put(g, new THREE.BoxGeometry(1.0, 2.2, 18), stoneWallMat, -BW / 2 - 4, 1.1, 2);
      for (let i = 0; i < 10; i++)
        put(g, new THREE.BoxGeometry(1.5, 0.2, 0.6), stoneMat, -BW / 2 - 3, 0.1 + i * 0.2, -BD / 2 + 2 - i * 0.6);

      // 屋后壕沟与后山
      put(g, new THREE.BoxGeometry(3, 1.2, 6), trenchMat, -BW / 2, -0.3, -BD / 2 - 3.5);
      put(g, new THREE.BoxGeometry(12, 3, 8), hillMat, -BW / 2 - 4, 1.5, -BD / 2 - 6);

      // 门前石墩与盆栽
      [[-3, BD / 2 + 4], [3, BD / 2 + 4]]
        .forEach(([x, z]) => put(g, new THREE.BoxGeometry(0.6, 0.8, 0.5), stoneMat, x, 0.4, z));
      const potLeafMat = new THREE.MeshStandardMaterial({ color: 0x3e6b34, roughness: 1, flatShading: true });
      [[-7, BD / 2 + 5], [7, BD / 2 + 5]].forEach(([x, z]) => {
        put(g, new THREE.CylinderGeometry(0.4, 0.5, 0.5, 8), stoneMat, x, 0.25, z);
        put(g, new THREE.CylinderGeometry(0.06, 0.08, 1, 6), mat.wood(), x, 1, z);
        put(g, new THREE.IcosahedronGeometry(0.5, 0), potLeafMat, x, 1.6, z);
      });

      /* ============ 14. 文保碑（可点击） ============ */

      const dSide = new THREE.MeshStandardMaterial({ color: 0x2c2c31, roughness: .45, metalness: .15 });
      const dFront = new THREE.MeshStandardMaterial({ map: siteSteleTexture(), roughness: .45 });
      const stele = new THREE.Group();
      put(stele, new THREE.BoxGeometry(2.6, 0.22, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: .6 }), 0, 0.11, 0);
      const slab = put(stele, new THREE.BoxGeometry(1.8, 1.1, 0.16),
        [dSide, dSide, dSide, dSide, dFront, dSide], 0, 0.75, -0.08);
      slab.rotation.x = -0.25;
      put(stele, new THREE.BoxGeometry(1.4, 0.5, 0.5), dSide, 0, 0.38, -0.45);
      stele.position.set(9, 0, 10);
      stele.rotation.y = -0.25;
      registry.pickables.push(stele);
      g.add(stele);

      // 广场标识牌
      const signBoard = box(1.2, 0.8, 0.08, signMat, 9, 1.0, 11.5);
      signBoard.rotation.y = -0.25;
      g.add(signBoard);

      // 15. 室内补光
      const lightLeft = new THREE.PointLight(0xffeedd, 0.8, 12); lightLeft.position.set(-7, 3, 0); g.add(lightLeft);
      const lightCenter = new THREE.PointLight(0xffeedd, 1.0, 15); lightCenter.position.set(0, 3.5, 0); g.add(lightCenter);
      const lightRight = new THREE.PointLight(0xffeedd, 0.8, 12); lightRight.position.set(7, 3, 0); g.add(lightRight);
      const lightFlag = new THREE.PointLight(0xffffff, 1.0, 10); lightFlag.position.set(1.5, 3.5, -1.0); g.add(lightFlag);
    }
    /* ---------- 林心平烈士陈列馆专用：贴图 ---------- */
    // 白墙：浅灰白，带细微斑驳
    function hallWallTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#f0ede8'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = 'rgba(200,195,190,' + (Math.random() * 0.08) + ')';
        g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 3);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    }

    // 灰石：基座与台基
    function hallStoneTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#b0aca8'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2000; i++) {
        const v = 140 + Math.random() * 50 | 0;
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 5) + ',' + (0.1 + Math.random() * 0.2) + ')';
        g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(2, 2);
      t.anisotropy = 4;
      return t;
    }

    // 深色瓦：横向瓦垄
    function hallRoofTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#4a4a4a'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 14) {
        g.fillStyle = 'rgba(20,20,20,0.8)'; g.fillRect(0, y, 256, 2);
        g.fillStyle = 'rgba(80,80,80,0.3)'; g.fillRect(0, y + 2, 256, 4);
      }
      for (let x = 0; x < 256; x += 28) {
        g.fillStyle = 'rgba(30,30,30,0.4)'; g.fillRect(x, 0, 2, 256);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    }

    // 玻璃：蓝灰渐变
    function hallGlassTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 128, 128);
      grad.addColorStop(0, 'rgba(150,180,210,0.9)');
      grad.addColorStop(0.5, 'rgba(180,200,220,0.7)');
      grad.addColorStop(1, 'rgba(120,150,180,0.9)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1;
      g.strokeRect(10, 10, 108, 108);
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = 4;
      return t;
    }

    // 碑前石碑：黑花岗岩 + 鎏金碑文
    function hallSteleTexture() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 320;
      const g = c.getContext('2d');
      g.fillStyle = '#2a2a2f'; g.fillRect(0, 0, 512, 320);
      for (let i = 0; i < 200; i++) {
        g.fillStyle = 'rgba(200,200,210,' + (Math.random() * 0.03) + ')';
        g.fillRect(Math.random() * 512, Math.random() * 320, 1.5, 1.5);
      }
      g.strokeStyle = '#caa14e'; g.lineWidth = 2; g.strokeRect(8, 8, 496, 304);
      g.fillStyle = '#e6c46a'; g.textAlign = 'center';
      g.font = 'bold 26px "KaiTi","STKaiti",serif';
      g.fillText('林心平烈士陈列馆', 256, 50);
      g.font = '15px "SimSun","Songti SC",serif'; g.textAlign = 'left'; g.fillStyle = '#d8c084';
      [
        '林心平（1919—1942），原名林秋逸，平阳山门镇西山村人。',
        '1936年参加革命，同年加入中国共产党。曾任中央特科上海',
        '办事处政治交通员、八路军上海办事处机要秘书、新四军第一',
        '支队文工团副团长等职。1942年8月在江苏宜兴为国牺牲，',
        '被江浙人民誉为“浙南菁英”和“长滆女杰”。'
      ].forEach((l, i) => g.fillText(l, 40, 95 + i * 28));
      g.textAlign = 'right';
      g.fillText('平阳县人民政府 立', 472, 250);
      g.fillText('二零二四年十二月', 472, 284);
      const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
      return t;
    }

    /* ---------- 建模对象四：林心平烈士陈列馆（心平园） ---------- */
    // 白墙灰瓦展馆，单层为主、左侧局部两层，前设开放门廊与玻璃幕墙；
    // 馆前立林心平铜像与碑前石碑，四周香樟、桂花环绕，一侧通红军古道
    function buildHall(g) {
      ground(g, 20, 0xb8b4ac);

      // 周边绿化
      for (let i = 0; i < 14; i++) {
        const a = (100 + i * 10) * Math.PI / 180, r = 18 + rand(i) * 8;
        tree(g, Math.sin(a) * r, Math.cos(a) * r - 5, 1 + rand(i * 3) * 0.9, i);
      }
      [[35, 22], [325, 22], [70, 20], [290, 20]].forEach(([deg, r], i) => {
        const a = deg * Math.PI / 180;
        tree(g, Math.sin(a) * r, Math.cos(a) * r + 5, 1.1 + rand(i * 11) * 0.7, i + 1);
      });
      [[-14, 10], [14, 10], [-16, 6], [16, 6], [-18, 2], [18, 2], [-8, 18], [8, 18]]
        .forEach(([x, z], i) => bush(g, x, z, 0.8 + rand(i * 5) * 0.5));
      osmanthus(g, -10, 12, 1.1);
      osmanthus(g, 10, 12, 1.1);
      osmanthus(g, -16, 8, 0.9);
      osmanthus(g, 16, 8, 0.9);

      // 材质
      const whiteWallMat = new THREE.MeshStandardMaterial({ map: hallWallTexture(), roughness: .9 });
      const grayStoneMat = new THREE.MeshStandardMaterial({ map: hallStoneTexture(), roughness: .85 });
      const roofMat = new THREE.MeshStandardMaterial({ map: hallRoofTexture(), roughness: .8 });
      const glassMat = new THREE.MeshStandardMaterial({
        map: hallGlassTexture(), roughness: .15, metalness: .3, transparent: true, opacity: .6, side: THREE.DoubleSide
      });
      const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: .7 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: .6 });

      const building = new THREE.Group();
      g.add(building);

      const BW = 28;   // 建筑总宽
      const BD = 14;   // 建筑总深

      // 1. 基座平台与一层主体（白色外墙）
      building.add(box(BW + 3, 0.6, BD + 3, grayStoneMat, 0, 0.3, 0));
      building.add(box(BW, 4.2, BD, whiteWallMat, 0, 0.6 + 2.1, 0));

      // 2. 入口门廊：立柱 + 顶板，开放无实墙
      const porchW = 8, porchD = 3.0, porchH = 5.0;
      building.add(box(porchW + 0.8, 0.4, porchD + 0.8, grayStoneMat, 0, 0.6 + porchH + 0.2, BD / 2 + porchD / 2));
      [-porchW / 2 + 0.4, porchW / 2 - 0.4].forEach(x => {
        const col = mesh(new THREE.CylinderGeometry(0.3, 0.35, porchH, 12), whiteWallMat);
        col.position.set(x, 0.6 + porchH / 2, BD / 2 + porchD - 0.2);
        building.add(col);
      });

      // 3. 入口大门：玻璃门扇 + 门框 + 门内暖光
      const doorGlass = mesh(new THREE.PlaneGeometry(4.0, 3.4), glassMat, false);
      doorGlass.position.set(0, 0.6 + 1.7, BD / 2 + 0.05);
      const doorLight = new THREE.PointLight(0xffddbb, 0.5, 8);
      doorLight.position.set(0, 2, BD / 2 - 1);
      building.add(doorGlass, box(4.3, 3.7, 0.15, darkTrimMat, 0, 0.6 + 1.85, BD / 2 + 0.08), doorLight);

      // 4. 馆名横匾：红底鎏金，悬于门廊檐口
      const plaqueSide = new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: .5 });
      const plaqueFace = new THREE.MeshStandardMaterial({ map: plaqueTexture('林心平烈士陈列馆', false), roughness: .55 });
      building.add(box(6.2, 1.0, 0.18,
        [plaqueSide, plaqueSide, plaqueSide, plaqueSide, plaqueFace, plaqueSide],
        0, 5.35, BD / 2 + porchD + 0.45));

      // 5. 一层窗：正面 4 扇，两侧各 3 扇
      [-11.5, -6.5, 6.5, 11.5].forEach(wx => {
        building.add(box(2.2, 2.4, 0.2, darkTrimMat, wx, 0.6 + 2.6, BD / 2 + 0.05));
        const winGlass = mesh(new THREE.PlaneGeometry(1.9, 2.1), glassMat, false);
        winGlass.position.set(wx, 0.6 + 2.6, BD / 2 + 0.16);
        building.add(winGlass);
      });
      [-1, 1].forEach(side => {
        for (let i = 0; i < 3; i++) {
          const wz = -BD / 2 + 3 + i * 4;
          building.add(box(0.2, 2.4, 2.2, darkTrimMat, side * (BW / 2 + 0.05), 0.6 + 2.6, wz));
          const winGlass = mesh(new THREE.PlaneGeometry(1.9, 2.1), glassMat, false);
          winGlass.rotation.y = side * Math.PI / 2;
          winGlass.position.set(side * (BW / 2 + 0.16), 0.6 + 2.6, wz);
          building.add(winGlass);
        }
      });

      // 6. 坡屋顶：三角形截面沿面宽挤出，山墙面刷白、坡面铺灰瓦
      const roofHeight = 2.2, roofOverhang = 1.0;
      const roofShape = new THREE.Shape();
      roofShape.moveTo(-(BD + roofOverhang * 2) / 2, 0);
      roofShape.lineTo((BD + roofOverhang * 2) / 2, 0);
      roofShape.lineTo(0, roofHeight);
      roofShape.closePath();
      const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: BW + roofOverhang * 2, bevelEnabled: false });
      roofGeo.rotateY(-Math.PI / 2);
      roofGeo.translate((BW + roofOverhang * 2) / 2, 0, 0);
      const roof = mesh(roofGeo, [whiteWallMat, roofMat]);
      roof.position.y = 0.6 + 4.2;
      building.add(roof);
      building.add(box(BW + roofOverhang * 2 + 0.3, 0.2, 0.35, roofMat, 0, 0.6 + 4.2 + roofHeight, 0));

      // 7. 左侧局部两层
      const upperBlockW = 8, upperBlockH = 3.0;
      const upperBlockX = -BW / 2 + upperBlockW / 2 + 1;
      building.add(box(upperBlockW, upperBlockH, BD, whiteWallMat, upperBlockX, 0.6 + 4.2 + upperBlockH / 2, 0));
      const upperRoofShape = new THREE.Shape();
      upperRoofShape.moveTo(-(BD + 1.5) / 2, 0);
      upperRoofShape.lineTo((BD + 1.5) / 2, 0);
      upperRoofShape.lineTo(0, 1.5);
      upperRoofShape.closePath();
      const upperRoofGeo = new THREE.ExtrudeGeometry(upperRoofShape, { depth: upperBlockW + 1.5, bevelEnabled: false });
      upperRoofGeo.rotateY(-Math.PI / 2);
      upperRoofGeo.translate((upperBlockW + 1.5) / 2, 0, 0);
      const upperRoof = mesh(upperRoofGeo, [whiteWallMat, roofMat]);
      upperRoof.position.set(upperBlockX, 0.6 + 4.2 + upperBlockH, 0);
      building.add(upperRoof);
      building.add(box(2.0, 1.8, 0.2, darkTrimMat, upperBlockX, 0.6 + 4.2 + upperBlockH / 2, BD / 2 + 0.05));
      const upperWinGlass = mesh(new THREE.PlaneGeometry(1.7, 1.5), glassMat, false);
      upperWinGlass.position.set(upperBlockX, 0.6 + 4.2 + upperBlockH / 2, BD / 2 + 0.16);
      building.add(upperWinGlass);

      // 8. 内部展厅：隔墙、展板与射灯（浙南菁英 / 抗大英才 / 长滆女杰）
      const dividerMat = new THREE.MeshStandardMaterial({ color: 0xe8e5e0, roughness: .9 });
      [-BW / 3, BW / 3].forEach(x => building.add(box(0.3, 3.5, BD - 2, dividerMat, x, 0.6 + 1.75, 0)));
      const boardMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ed, roughness: .8 });
      const board = (x, z, w, h, color) => {
        building.add(box(w, h, 0.1, boardMat, x, 2.4, z));
        building.add(box(w * 0.7, h * 0.5, 0.06,
          new THREE.MeshStandardMaterial({ color: color, roughness: .7 }), x, 2.4 + h * 0.15, z + 0.07));
      };
      board(-8, -5, 3.5, 2.0, 0x5a7a4c); board(-8, -1, 3.5, 2.0, 0x4a6a8a);
      board(-8, 3, 3.5, 2.0, 0x8a6a4a);  board(-4, -5, 2.5, 2.0, 0x6a5a4a);
      board(0, -5, 3.0, 2.2, 0x8a4a4a);  board(0, -1, 3.0, 2.2, 0x4a5a8a);
      board(0, 3, 3.0, 2.2, 0x5a6a4a);
      board(8, -5, 3.5, 2.0, 0x8a5a4a);  board(8, -1, 3.5, 2.0, 0x4a7a6a);
      board(8, 3, 3.5, 2.0, 0x6a4a5a);   board(4, -5, 2.5, 2.0, 0x5a4a6a);
      const indoorLight = new THREE.PointLight(0xffeedd, 0.6, 20);
      indoorLight.position.set(0, 5, 0);
      building.add(indoorLight);
      [-10, -4, 2, 8].forEach(x => {
        const spot = new THREE.PointLight(0xfff5e0, 0.3, 6);
        spot.position.set(x, 3.8, 0);
        building.add(spot);
      });

      // 9. 馆前石碑（可点击）
      const dSide = new THREE.MeshStandardMaterial({ color: 0x2c2c31, roughness: .45, metalness: .15 });
      const dFront = new THREE.MeshStandardMaterial({ map: hallSteleTexture(), roughness: .45 });
      const stele = new THREE.Group();
      const plat = mesh(new THREE.BoxGeometry(2.6, .22, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: .6 }));
      plat.position.y = .11;
      const slab = mesh(new THREE.BoxGeometry(1.8, 1.1, 0.16),
        [dSide, dSide, dSide, dSide, dFront, dSide]);
      slab.rotation.x = -0.25; slab.position.set(0, 0.75, -0.08);
      const sup = mesh(new THREE.BoxGeometry(1.4, 0.5, 0.5), dSide);
      sup.position.set(0, 0.38, -0.45);
      stele.add(plat, slab, sup);
      stele.position.set(-12, 0, 16);
      stele.rotation.y = 0.3;
      registry.pickables.push(stele);
      g.add(stele);

      // 10. 林心平铜像：三级基座 + 金色半身像
      const statue = new THREE.Group();
      [[1.919, 1.942, 0.25, 0.125], [1.5, 1.5, 0.25, 0.375], [1.1, 1.1, 0.3, 0.65]]
        .forEach(([w, d, h, y]) => statue.add(box(w, h, d, grayStoneMat, 0, y, 0)));
      statue.add(box(0.8, 0.5, 0.8,
        new THREE.MeshStandardMaterial({ color: 0x6a7a6a, roughness: .8 }), 0, 1.05, 0));
      const bustMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: .35, metalness: .7 });
      const chest = mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.35, 10), bustMat);
      chest.position.y = 1.15;
      const neck = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.15, 8), bustMat);
      neck.position.y = 1.35;
      const head = mesh(new THREE.SphereGeometry(0.18, 12, 10), bustMat);
      head.position.y = 1.55;
      const nameplate = mesh(new THREE.PlaneGeometry(0.5, 0.15),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: .5 }), false);
      nameplate.position.set(0, 0.85, 0.56);
      statue.add(chest, neck, head, nameplate);
      statue.position.set(12, 0, 14);
      g.add(statue);

      // 11. 红军古道
      const path = mesh(new THREE.PlaneGeometry(2.5, 25),
        new THREE.MeshStandardMaterial({ color: 0x9a8a7a, roughness: .95 }), false);
      path.rotation.x = -Math.PI / 2;
      path.rotation.z = 0.4;
      path.position.set(-22, 0.02, -5);
      g.add(path);

      // 12. 馆前旗杆
      flag(g, -10, 0, 20, 0.35, 0.8);
      flag(g, 10, 0, 20, -0.35, 0.8);
    }

    /* ---------- 建模对象五：闽浙边抗日救亡干部学校旧址 ---------- */
    // 清代木构两层建筑，面阔七间，前廊设木栏，硬山顶灰瓦
    function buildSchool(g) {
      // 地面 / 广场
      const grass = mesh(new THREE.CircleGeometry(90, 64), mat.grass(), false);
      grass.rotation.x = -Math.PI / 2; grass.position.y = -0.03;
      const plaza = mesh(new THREE.PlaneGeometry(50, 50),
        new THREE.MeshStandardMaterial({ color: 0xc7cbc4, roughness: .95 }), false);
      plaza.rotation.x = -Math.PI / 2;
      g.add(grass, plaza);

      // 树木绿化
      for (let i = 0; i < 20; i++) {
        const a = (100 + i * 9) * Math.PI / 180, r = 20 + rand(i) * 10;
        tree(g, Math.sin(a) * r, Math.cos(a) * r, 1 + rand(i * 3) * 0.9, i);
      }
      [[35, 25], [325, 25], [70, 22], [290, 22]].forEach(([deg, r], i) => {
        const a = deg * Math.PI / 180;
        tree(g, Math.sin(a) * r, Math.cos(a) * r, 1.1 + rand(i * 11) * 0.7, i + 1);
      });

      // 桂花丛
      osmanthus(g, -4, 9, 1.2);
      osmanthus(g, 4, 9, 1.0);
      osmanthus(g, -8, 7, 0.9);
      osmanthus(g, 8, 7, 1.1);

      // 灌木
      [[-12, 12], [12, 12], [-16, 8], [16, 8], [-18, 3], [18, 3]]
        .forEach(([x, z], i) => bush(g, x, z, 0.8 + rand(i * 5) * 0.5));

      const woodMat = new THREE.MeshStandardMaterial({ map: schoolWoodTexture(), roughness: .9, metalness: .01 });
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x8c7d6b, roughness: .95 });
      const roofMat = new THREE.MeshStandardMaterial({ map: schoolRoofTexture(), roughness: .8 });
      const schoolStone = new THREE.MeshStandardMaterial({ color: 0x9a9a90, roughness: .9 });

      const building = new THREE.Group();
      g.add(building);
      const put = (geo, material, x, y, z) => {
        const m = mesh(geo, material);
        m.position.set(x, y, z);
        building.add(m);
        return m;
      };

      const BUILDING_WIDTH = 23.25;
      const BUILDING_DEPTH = 6.5;
      const PILLAR_RADIUS = 0.18;
      const FLOOR_HEIGHT = 3.2;
      const BAYS = 7;
      const BAY_WIDTH = BUILDING_WIDTH / BAYS;

      // 1. 地基与台阶
      put(new THREE.BoxGeometry(BUILDING_WIDTH + 2, 0.6, BUILDING_DEPTH + 2), schoolStone, 0, 0.3, 0);
      put(new THREE.BoxGeometry(BUILDING_WIDTH + 3, 0.2, BUILDING_DEPTH + 3), schoolStone, 0, 0.1, 0);

      // 2. 柱子（前后各 8 根 + 两端山面各 2 根）
      const pGeo = new THREE.CylinderGeometry(PILLAR_RADIUS, PILLAR_RADIUS * 1.2, FLOOR_HEIGHT * 2 + 0.6, 8);
      const pillarY = (FLOOR_HEIGHT * 2 + 0.6) / 2;
      for (let i = 0; i <= BAYS; i++) {
        const x = -BUILDING_WIDTH / 2 + i * BAY_WIDTH;
        put(pGeo, woodMat, x, pillarY, BUILDING_DEPTH / 2 + 0.5);
        put(pGeo, woodMat, x, pillarY, -BUILDING_DEPTH / 2 - 0.5);
      }
      [-BUILDING_DEPTH / 2, BUILDING_DEPTH / 2].forEach(z => {
        [-BUILDING_WIDTH / 2 - 0.5, BUILDING_WIDTH / 2 + 0.5]
          .forEach(x => put(pGeo, woodMat, x, pillarY, z));
      });

      // 3. 底层墙体与门窗
      const wallGeo = new THREE.BoxGeometry(BUILDING_WIDTH - 1, FLOOR_HEIGHT, 0.3);
      put(wallGeo, wallMat, 0, FLOOR_HEIGHT / 2 + 0.6, BUILDING_DEPTH / 2 - 0.15);
      put(wallGeo, wallMat, 0, FLOOR_HEIGHT / 2 + 0.6, -BUILDING_DEPTH / 2 + 0.15);

      // 一层左右两侧山墙（封住侧面）
      const sideWallGeo = new THREE.BoxGeometry(0.5, FLOOR_HEIGHT, BUILDING_DEPTH);
      [-1, 1].forEach(side =>
        put(sideWallGeo, wallMat, side * (BUILDING_WIDTH / 2 - 0.25), FLOOR_HEIGHT / 2 + 0.6, 0));

      const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2b, roughness: .8 });
      for (let i = 0; i < BAYS; i++) {
        const x = -BUILDING_WIDTH / 2 + BAY_WIDTH / 2 + i * BAY_WIDTH;
        if (i === Math.floor(BAYS / 2)) {
          put(new THREE.BoxGeometry(BAY_WIDTH * 0.7, FLOOR_HEIGHT * 0.8, 0.1), doorMat,
            x, FLOOR_HEIGHT * 0.4 + 0.6, BUILDING_DEPTH / 2 + 0.1);
        } else {
          put(new THREE.BoxGeometry(BAY_WIDTH * 0.6, FLOOR_HEIGHT * 0.6, 0.1), woodMat,
            x, FLOOR_HEIGHT * 0.5 + 0.6, BUILDING_DEPTH / 2 + 0.1);
          for (let j = 0; j < 3; j++) {
            put(new THREE.BoxGeometry(BAY_WIDTH * 0.6, 0.05, 0.15), woodMat,
              x, FLOOR_HEIGHT * 0.2 + 0.6 + j * FLOOR_HEIGHT * 0.2, BUILDING_DEPTH / 2 + 0.1);
          }
        }
      }

      // 4. 二层楼板
      put(new THREE.BoxGeometry(BUILDING_WIDTH + 1, 0.3, BUILDING_DEPTH + 1.5), woodMat,
        0, FLOOR_HEIGHT + 0.6, 0);

      // 5. 二层回廊与栏杆
      const RAIL_HEIGHT = 1.0;
      const corridorDepth = 1.2;
      put(new THREE.BoxGeometry(BUILDING_WIDTH + 1, 0.15, corridorDepth), woodMat,
        0, FLOOR_HEIGHT + 0.75, BUILDING_DEPTH / 2 + corridorDepth / 2);
      put(new THREE.BoxGeometry(BUILDING_WIDTH + 1, 0.08, 0.08), woodMat,
        0, FLOOR_HEIGHT + 0.6 + RAIL_HEIGHT, BUILDING_DEPTH / 2 + corridorDepth);
      put(new THREE.BoxGeometry(BUILDING_WIDTH + 1, 0.08, 0.08), woodMat,
        0, FLOOR_HEIGHT + 0.65, BUILDING_DEPTH / 2 + corridorDepth);
      for (let i = 0; i <= BAYS * 2; i++) {
        const x = -BUILDING_WIDTH / 2 - 0.5 + (i * (BUILDING_WIDTH + 1)) / (BAYS * 2);
        put(new THREE.BoxGeometry(0.08, RAIL_HEIGHT, 0.08), woodMat,
          x, FLOOR_HEIGHT + 0.6 + RAIL_HEIGHT / 2, BUILDING_DEPTH / 2 + corridorDepth);
        if (i < BAYS * 2) {
          const x2 = -BUILDING_WIDTH / 2 - 0.5 + ((i + 1) * (BUILDING_WIDTH + 1)) / (BAYS * 2);
          const midX = (x + x2) / 2;
          const cross1 = put(new THREE.BoxGeometry(0.06, RAIL_HEIGHT * 0.9, 0.06), woodMat,
            midX, FLOOR_HEIGHT + 0.6 + RAIL_HEIGHT / 2, BUILDING_DEPTH / 2 + corridorDepth);
          cross1.rotation.z = Math.PI / 4;
          const cross2 = cross1.clone();
          cross2.rotation.z = -Math.PI / 4;
          building.add(cross2);
        }
      }
      [-1, 1].forEach(side => {
        put(new THREE.BoxGeometry(0.08, 0.08, BUILDING_DEPTH + corridorDepth * 2), woodMat,
          side * (BUILDING_WIDTH / 2 + 0.5), FLOOR_HEIGHT + 0.6 + RAIL_HEIGHT, 0);
      });

      // 6. 二层墙体与窗
      const upperWallGeo = new THREE.BoxGeometry(BUILDING_WIDTH - 1, FLOOR_HEIGHT, 0.3);
      put(upperWallGeo, wallMat, 0, FLOOR_HEIGHT * 1.5 + 0.6, BUILDING_DEPTH / 2 - 0.15);
      put(upperWallGeo, wallMat, 0, FLOOR_HEIGHT * 1.5 + 0.6, -BUILDING_DEPTH / 2 + 0.15);
      [-1, 1].forEach(side =>
        put(sideWallGeo, wallMat, side * (BUILDING_WIDTH / 2 - 0.25), FLOOR_HEIGHT * 1.5 + 0.6, 0));
      for (let i = 0; i < BAYS; i++) {
        const x = -BUILDING_WIDTH / 2 + BAY_WIDTH / 2 + i * BAY_WIDTH;
        put(new THREE.BoxGeometry(BAY_WIDTH * 0.6, FLOOR_HEIGHT * 0.7, 0.15), woodMat,
          x, FLOOR_HEIGHT * 1.5 + 0.6, BUILDING_DEPTH / 2 - 0.05);
        for (let j = 0; j < 4; j++) {
          put(new THREE.BoxGeometry(BAY_WIDTH * 0.6, 0.05, 0.2), woodMat, x,
            FLOOR_HEIGHT * 1.5 + 0.6 - FLOOR_HEIGHT * 0.35 + j * FLOOR_HEIGHT * 0.23,
            BUILDING_DEPTH / 2 - 0.05);
        }
      }

      // 7. 硬山顶屋顶（三角形截面挤出，山墙面与坡面分材质）
      const roofHeight = 2.5;
      const roofOverhang = 1.0;
      const roofWidth = BUILDING_WIDTH + roofOverhang * 2;
      const roofDepth = BUILDING_DEPTH + roofOverhang * 2;
      const roofY = 7.15;
      const roofShape = new THREE.Shape();
      roofShape.moveTo(-roofDepth / 2, 0);
      roofShape.lineTo(roofDepth / 2, 0);
      roofShape.lineTo(0, roofHeight);
      roofShape.closePath();
      const schoolRoofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: roofWidth, bevelEnabled: false });
      schoolRoofGeo.rotateY(-Math.PI / 2);
      schoolRoofGeo.translate(roofWidth / 2, 0, 0);
      const roofMesh = mesh(schoolRoofGeo, [wallMat, roofMat]);
      roofMesh.position.y = roofY;
      building.add(roofMesh);
      put(new THREE.BoxGeometry(roofWidth + 0.2, 0.2, 0.4), roofMat, 0, roofY + roofHeight, 0);
      put(new THREE.BoxGeometry(BUILDING_WIDTH + 1, 0.15, 0.15), woodMat,
        0, roofY - 0.05, BUILDING_DEPTH / 2 + 0.8);

      // 8. 牌匾
      const plaqueSide = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: .7 });
      const plaqueFront = new THREE.MeshStandardMaterial({ map: schoolPlaqueTexture(), roughness: .6 });
      put(new THREE.BoxGeometry(6, 1.2, 0.2),
        [plaqueSide, plaqueSide, plaqueSide, plaqueSide, plaqueFront, plaqueSide],
        0, FLOOR_HEIGHT + 1.8, BUILDING_DEPTH / 2 + 0.2);

      // 碑前石碑（可点击）
      const stele = new THREE.Group();
      const dSide = new THREE.MeshStandardMaterial({ color: 0x2c2c31, roughness: .45, metalness: .15 });
      const dFront = new THREE.MeshStandardMaterial({ map: schoolSteleTexture(), roughness: .45 });
      const plat = mesh(new THREE.BoxGeometry(2.8, .25, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: .6 }));
      plat.position.y = .125;
      const slab = mesh(new THREE.BoxGeometry(2.0, 1.2, 0.18),
        [dSide, dSide, dSide, dSide, dFront, dSide]);
      slab.rotation.x = -0.25; slab.position.set(0, 0.8, -0.1);
      const sup = mesh(new THREE.BoxGeometry(1.6, 0.6, 0.6), dSide);
      sup.position.set(0, 0.4, -0.5);
      stele.add(plat, slab, sup);
      stele.position.set(-10, 0, 10);
      stele.rotation.y = 0.3;
      registry.pickables.push(stele);
      g.add(stele);

      // 粟裕同志骨灰安放纪念碑
      const suyu = new THREE.Group();
      const suyuStone = mesh(new THREE.BoxGeometry(0.6, 1.5, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: .5 }));
      suyuStone.position.y = 1.05;
      suyu.add(box(1.2, 0.3, 1.2, schoolStone, 0, 0.15, 0), suyuStone);
      suyu.position.set(-6, 0, 6);
      suyu.rotation.y = 0.2;
      g.add(suyu);
    }

    /* ==========================================================
       一园五馆：五座建模对象共处一个场景（红色遗址主题公园）
       以公园中心为圆心，半径 48m 环向均布，正面朝内
       ========================================================== */
    const PARK_RADIUS = 48;        // 建筑环半径
    const PARK_EXTENT = 132;       // 可行走范围（半径）
    const PARK_TERRAIN_Y = -0.06;  // 共享草地标高（低于各建筑自带铺装，避免闪烁）
    const SPAWN = { x: 0, z: 33, yaw: Math.PI };

    const BUILDINGS = [
      {
        key: 'gate', label: '北上抗日出征门', deg: 0,
        focus: { pos: [26, 14, 36], target: [0, 7, 0], min: 9, max: 130 },
        info: {
          title: '北上抗日出征门',
          meta: '山门镇凤岭山 · 挺进师纪念园核心景观',
          desc: '四柱三间门楼式建筑，青石立柱承额枋，额枋悬“北上抗日出征门”匾额，两侧红旗猎猎，是 1938 年粟裕率部出征北上的历史见证。',
          note: '1938 年 3 月，粟裕率红军挺进师及浙南游击纵队约 500 人，在山门集中整编后经出征门北上，奔赴皖南抗日前线。出征门由此成为浙南红军由土地革命战争转向抗日战争的历史坐标。'
        }
      },
      {
        key: 'school', label: '闽浙边抗日救亡干部学校旧址', deg: 72,
        focus: { pos: [30, 15, 34], target: [0, 3.5, 0], min: 9, max: 130 },
        info: {
          title: '闽浙边抗日救亡干部学校旧址',
          meta: '山门镇 · 浙江省文物保护单位',
          desc: '原为清代木构建筑，面阔七间、二层，前廊设木栏、硬山顶灰瓦。1937 年抗战全面爆发后，中共闽浙边临时省委在此创办抗日救亡干部学校，粟裕任校长，培养了大批抗日骨干，被誉为“浙南抗大”。',
          note: '1937 年抗战全面爆发后，中共闽浙边临时省委在山门创办抗日救亡干部学校，粟裕任校长，学员多为浙南、闽东一带的进步青年与红军骨干，为抗日战场输送了大批干部。旧址现为浙江省文物保护单位，院内另设粟裕同志骨灰安放纪念碑。'
        }
      },
      {
        key: 'site', label: '省一大冠尖会址', deg: 144,
        focus: { pos: [28, 12, 32], target: [0, 3.0, 0], min: 7, max: 170 },
        info: {
          title: '中共浙江省一大冠尖会址',
          meta: '凤卧镇凤林村冠尖山 · 全国红色旅游经典景区',
          desc: '原为村民郑永暖家新楼，建于 1932 年，俗称“冠尖新楼”。面阔 21.68 米、进深 8.9 米，六间两层木结构楼房，重檐悬山顶、穿斗式梁架。一楼左侧为餐厅、右侧为卧室，中间大通道设会场布景，可直视室内。',
          note: '1939 年 7 月 21 日至 30 日，中共浙江省第一次代表大会在冠尖召开，到会代表 26 人。会议选举产生新一届省委，刘英任书记，并选举出席党的七大代表。会址与马头岗会址共同构成省一大旧址群。'
        }
      },
      {
        key: 'monument', label: '挺进师纪念碑', deg: 216,
        focus: { pos: [19, 10.5, 28], target: [0, 7.5, 0], min: 7, max: 130 },
        info: {
          title: '中国工农红军挺进师纪念碑',
          meta: '山门镇凤岭山 · 全国红色旅游经典景区',
          desc: '主碑高 18 米，双肢合一、向上有力的长方体造型，象征挺进师与浙南、闽东革命力量紧密结合、并肩战斗；周围 6 根立柱高低错落，形似春笋破土。',
          note: '1935 年 2 月，中国工农红军挺进师以北上抗日先遣队先头部队和突围部队为基础组建，粟裕任师长、刘英任政委。1938 年 3 月，部队在平阳山门集结整编后开赴抗日前线。纪念园内设浮雕墙、出征门、纪念碑、陈列馆。'
        }
      },
      {
        key: 'hall', label: '林心平烈士陈列馆', deg: 288,
        focus: { pos: [26, 13, 32], target: [0, 3.4, 0], min: 9, max: 150 },
        info: {
          title: '林心平烈士陈列馆',
          meta: '山门镇西山村 · 县级爱国主义教育基地',
          desc: '现代展馆形制，浅色墙身配深色玻璃幕墙与红色竖向格栅。2024 年 12 月开馆，展陈分“浙南菁英”“抗大英才”“长滆女杰”三个展厅。',
          note: '林心平（1919—1942），平阳山门人，1936 年加入中国共产党，先后在浙南、苏南从事抗日救亡工作，1942 年在江苏金坛被捕就义，年仅 23 岁，被列入第一批 300 名著名抗日英烈名录。'
        }
      }
    ];

    const BUILDERS = {
      monument: buildMonument, gate: buildGate, site: buildSite,
      hall: buildHall, school: buildSchool
    };

    // 圆环布局：位置 + 朝向（正面局部 +Z 指向公园中心）
    function parkLayout(b) {
      const a = b.deg * Math.PI / 180;
      const x = Math.sin(a) * PARK_RADIUS;
      const z = Math.cos(a) * PARK_RADIUS;
      return { x, z, yaw: Math.atan2(-x, -z) };
    }

    // 各建筑自带的大幅地面（草地圆盘 / 大广场）在主题公园中会互相重叠闪烁，统一剔除
    function stripBuildingGround(group) {
      const drop = [];
      group.traverse(n => {
        const geo = n.geometry;
        if (!geo || !geo.parameters) return;
        const p = geo.parameters;
        if (geo.type === 'CircleGeometry' && p.radius >= 60) drop.push(n);
        else if (geo.type === 'PlaneGeometry' && p.width >= 40 && p.height >= 40) drop.push(n);
      });
      drop.forEach(n => { if (n.parent) n.parent.remove(n); n.geometry.dispose(); });
      return drop.length;
    }

    // 公园中心：红五星铺装
    function centerStar(g, R, r, y) {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const rad = (i % 2 === 0) ? R : r;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
        if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
      }
      shape.closePath();
      const m = mesh(new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({ color: 0xc0272d, roughness: .7 }), false);
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      g.add(m);
      return m;
    }

    /* 搭建主题公园：共享草地 + 中心广场 + 放射步道 + 外围林带 + 五座建筑 */
    function buildPark(root) {
      const groups = {};

      // 1. 共享草地（位于各建筑自带场地铺装之下）
      const park = mesh(new THREE.CircleGeometry(190, 96),
        new THREE.MeshStandardMaterial({ color: 0x6f9a58, roughness: 1 }), false);
      park.rotation.x = -Math.PI / 2;
      park.position.y = PARK_TERRAIN_Y;
      root.add(park);

      // 2. 中心广场与红五星
      const plaza = mesh(new THREE.CircleGeometry(30, 84),
        new THREE.MeshStandardMaterial({ color: 0xc9c3b6, roughness: .95 }), false);
      plaza.rotation.x = -Math.PI / 2;
      plaza.position.y = -0.02;
      root.add(plaza);
      const ring = mesh(new THREE.RingGeometry(12.6, 13.4, 72),
        new THREE.MeshStandardMaterial({ color: 0xb4ab9a, roughness: .95 }), false);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.01;
      root.add(ring);
      centerStar(root, 9, 3.6, 0.005);

      // 3. 放射步道：中心广场 → 各建筑前庭
      const pathMat = new THREE.MeshStandardMaterial({ color: 0xbdb6a8, roughness: .95 });
      BUILDINGS.forEach(b => {
        const dir = b.deg * Math.PI / 180;         // 自中心向外
        const len = PARK_RADIUS - 26;
        const path = mesh(new THREE.PlaneGeometry(7, len), pathMat, false);
        path.rotation.x = -Math.PI / 2;
        path.rotation.z = Math.PI - dir;
        path.position.set(Math.sin(dir) * (26 + len / 2), -0.02, Math.cos(dir) * (26 + len / 2));
        root.add(path);
      });

      // 4. 外围林带
      for (let i = 0; i < 54; i++) {
        const a = i * (Math.PI * 2 / 54) + rand(i) * 0.08;
        const r = 96 + rand(i * 3) * 26;
        tree(root, Math.sin(a) * r, Math.cos(a) * r, 1.1 + rand(i * 5) * 0.9, i);
      }
      for (let i = 0; i < 22; i++) {
        const a = i * (Math.PI * 2 / 22) + 0.14;
        bush(root, Math.sin(a) * 88, Math.cos(a) * 88, 1 + rand(i * 7) * 0.6);
      }

      // 5. 五座建筑
      BUILDINGS.forEach(b => {
        const g = new THREE.Group();
        const t = parkLayout(b);
        g.position.set(t.x, 0, t.z);
        g.rotation.y = t.yaw;
        BUILDERS[b.key](g);
        stripBuildingGround(g);
        g.userData.buildingKey = b.key;
        root.add(g);
        groups[b.key] = g;
      });

      return groups;
    }

global.ParkBuildings = { registry, buildMonument, buildGate, buildSite, buildHall, buildSchool, PARK_RADIUS, PARK_EXTENT, PARK_TERRAIN_Y, SPAWN, BUILDINGS, parkLayout, buildPark };
})(typeof globalThis !== "undefined" ? globalThis : window);
