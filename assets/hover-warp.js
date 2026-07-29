import * as THREE from "./vendor/three.module.js";

const POINT_COUNT = 20;
const SAMPLES = 50;
const HOVER_EASE = 0.12;
const LINE_COLOR = 0xe6fd28;
const EDGE_MARGIN = 72;

function chooseRandomEdgePoint(w, h) {
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { x: Math.random() * w, y: -EDGE_MARGIN };
  if (edge === 1) return { x: w + EDGE_MARGIN, y: Math.random() * h };
  if (edge === 2) return { x: Math.random() * w, y: h + EDGE_MARGIN };
  return { x: -EDGE_MARGIN, y: Math.random() * h };
}

function catmullRom(p0, p1, p2, p3, t, out) {
  const t2 = t * t;
  const t3 = t2 * t;
  out.x =
    0.5 *
    (2 * p1.x +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  out.y =
    0.5 *
    (2 * p1.y +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
}

export function initLineWarp() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:65;";
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, window.innerWidth, 0, window.innerHeight, -1000, 1000);
  camera.position.z = 10;

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.right = window.innerWidth;
    camera.bottom = window.innerHeight;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // 制御点（生値の配列: {x,y}）
  const points = Array.from({ length: POINT_COUNT }, () => ({ x: 0, y: 0 }));
  const targetX0 = { v: 0 };
  const targetY0 = { v: 0 };
  let revealProgress = 0;
  let revealTarget = 0;
  let active = false;
  let rafId = null;

  // ジオメトリを一度だけ確保し、フレームごとに書き換える
  const vertexCount = SAMPLES * 2;
  const positions = new Float32Array(vertexCount * 3);
  const indices = new Uint16Array((SAMPLES - 1) * 6);
  for (let i = 0; i < SAMPLES - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = i * 2 + 2;
    const d = i * 2 + 3;
    const o = i * 6;
    indices[o] = a;
    indices[o + 1] = b;
    indices[o + 2] = c;
    indices[o + 3] = b;
    indices[o + 4] = d;
    indices[o + 5] = c;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  const material = new THREE.MeshBasicMaterial({
    color: LINE_COLOR,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  scene.add(mesh);

  const sampleScratch = { x: 0, y: 0 };
  const samplesX = new Float32Array(SAMPLES);
  const samplesY = new Float32Array(SAMPLES);
  // ロープが1点に収束すると接線ベクトルの正規化が不安定になり、
  // 太さの向きが毎フレーム乱れて「震える」ように見えるため、
  // 有効な向きが取れた時だけ更新し、それ以外は直前の向きを使い回す。
  const unitNx = new Float32Array(SAMPLES);
  const unitNy = new Float32Array(SAMPLES).fill(-1);

  function sampleCenterline() {
    for (let i = 0; i < SAMPLES; i++) {
      const t = (i / (SAMPLES - 1)) * (POINT_COUNT - 1);
      const seg = Math.min(Math.floor(t), POINT_COUNT - 2);
      const localT = t - seg;
      const p0 = points[Math.max(seg - 1, 0)];
      const p1 = points[seg];
      const p2 = points[Math.min(seg + 1, POINT_COUNT - 1)];
      const p3 = points[Math.min(seg + 2, POINT_COUNT - 1)];
      catmullRom(p0, p1, p2, p3, localT, sampleScratch);
      samplesX[i] = sampleScratch.x;
      samplesY[i] = sampleScratch.y;
    }
  }

  function buildRibbon(thickness) {
    for (let i = 0; i < SAMPLES; i++) {
      const prevI = Math.max(i - 1, 0);
      const nextI = Math.min(i + 1, SAMPLES - 1);
      const dx = samplesX[nextI] - samplesX[prevI];
      const dy = samplesY[nextI] - samplesY[prevI];
      const len = Math.hypot(dx, dy);
      let ux, uy;
      if (len > 0.5) {
        ux = -dy / len;
        uy = dx / len;
        unitNx[i] = ux;
        unitNy[i] = uy;
      } else {
        ux = unitNx[i];
        uy = unitNy[i];
      }
      const nx = ux * thickness;
      const ny = uy * thickness;
      const o = i * 6;
      positions[o] = samplesX[i] + nx;
      positions[o + 1] = samplesY[i] + ny;
      positions[o + 2] = 0;
      positions[o + 3] = samplesX[i] - nx;
      positions[o + 4] = samplesY[i] - ny;
      positions[o + 5] = 0;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  function tick() {
    points[0].x += (targetX0.v - points[0].x) * HOVER_EASE;
    points[0].y += (targetY0.v - points[0].y) * HOVER_EASE;
    for (let i = 1; i < POINT_COUNT; i++) {
      const segEase = 0.35 + (0.1 - 0.35) * (i / (POINT_COUNT - 1));
      points[i].x += (points[i - 1].x - points[i].x) * segEase;
      points[i].y += (points[i - 1].y - points[i].y) * segEase;
    }
    revealProgress += (revealTarget - revealProgress) * HOVER_EASE;

    const easedReveal = 1 - Math.pow(1 - revealProgress, 3);
    sampleCenterline();
    buildRibbon(4 + easedReveal * 17);
    material.opacity = easedReveal;
    mesh.visible = easedReveal > 0.01;

    renderer.render(scene, camera);

    const settled =
      Math.abs(targetX0.v - points[0].x) < 0.4 &&
      Math.abs(targetY0.v - points[0].y) < 0.4 &&
      Math.abs(revealTarget - revealProgress) < 0.01;

    if (settled && revealTarget === 0) {
      mesh.visible = false;
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function startTick() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  function onEnter(event) {
    const nextX = event.clientX;
    const nextY = event.clientY;
    const edge = chooseRandomEdgePoint(window.innerWidth, window.innerHeight);
    for (let i = 0; i < POINT_COUNT; i++) {
      points[i].x = edge.x;
      points[i].y = edge.y;
    }
    targetX0.v = nextX;
    targetY0.v = nextY;
    revealProgress = 0;
    revealTarget = 1;
    active = true;
    startTick();
  }

  function onMove(event) {
    targetX0.v = event.clientX;
    targetY0.v = event.clientY;
    if (!active) {
      active = true;
      revealTarget = 1;
    }
    startTick();
  }

  function onLeave() {
    active = false;
    revealTarget = 0;
    startTick();
  }

  return { onEnter, onMove, onLeave };
}
