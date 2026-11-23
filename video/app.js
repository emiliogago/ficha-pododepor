/* ============================================================
   Vídeo PD · Análisis cinemático en vídeo · Pododepor
   Todo ocurre en el dispositivo: los vídeos no se suben a ningún sitio.
   ============================================================ */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RAD = 180 / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fmt = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
const fmtT = t => fmt(t, 3) + ' s';
const hoy = () => new Date().toLocaleDateString('es-ES');

/* ---------------- Geometría ---------------- */
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const len = v => Math.hypot(v.x, v.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const norm180 = a => ((a + 180) % 360 + 360) % 360 - 180;
function angBetween(u, v) {
  const d = (u.x * v.x + u.y * v.y) / ((len(u) * len(v)) || 1);
  return Math.acos(clamp(d, -1, 1)) * RAD;
}
const ang3 = (a, b, c) => angBetween(sub(a, b), sub(c, b));
// Desviación hacia +x de v respecto a u (ambos vectores apuntando hacia abajo).
const xDev = (u, v) => -Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y) * RAD;
// Inclinación respecto a la vertical, + hacia delante (dir = +1 si avanza hacia la derecha).
const fromVert = (v, dir) => Math.atan2(v.x * dir, -v.y) * RAD;   // vector hacia arriba
const fromDown = (v, dir) => Math.atan2(v.x * dir, v.y) * RAD;    // vector hacia abajo
function distPtSeg(p, a, b) {
  const ab = sub(b, a), ap = sub(p, a);
  const t = clamp((ap.x * ab.x + ap.y * ab.y) / ((ab.x * ab.x + ab.y * ab.y) || 1), 0, 1);
  return Math.hypot(p.x - (a.x + ab.x * t), p.y - (a.y + ab.y * t));
}
const has = (...ps) => ps.every(p => p && isFinite(p.x));

/* ---------------- Catálogos ---------------- */
const COLORES = ['#FFD54F', '#4FC3F7', '#FF5252', '#69F0AE', '#FFFFFF', '#E040FB'];
const FASES = {
  marcha: ['—', 'Contacto inicial', 'Respuesta a la carga', 'Apoyo medio', 'Apoyo terminal', 'Preoscilación', 'Oscilación inicial', 'Oscilación media', 'Oscilación terminal'],
  carrera: ['—', 'Contacto inicial', 'Apoyo medio (máx. carga)', 'Despegue', 'Oscilación inicial', 'Máx. flexión de rodilla', 'Oscilación terminal'],
};
const TOOLS = [
  { t: 'move', g: '✋', n: 'Mover / zoom' },
  { t: 'angle3', g: '∠', n: 'Ángulo 3 puntos', np: 3, hints: ['Extremo del primer segmento', 'Vértice (articulación)', 'Extremo del segundo segmento'] },
  { t: 'vangle', g: '⊾', n: 'Ángulo con vertical', np: 2, hints: ['Extremo superior del segmento', 'Extremo inferior del segmento'] },
  { t: 'hangle', g: '⦣', n: 'Ángulo con horizontal', np: 2, hints: ['Primer extremo', 'Segundo extremo'] },
  { t: 'angle4', g: '✕', n: 'Ángulo entre 2 rectas', np: 4, hints: ['Recta 1 · punto alto', 'Recta 1 · punto bajo', 'Recta 2 · punto alto', 'Recta 2 · punto bajo'] },
  { t: 'line', g: '╱', n: 'Línea', np: 2, hints: ['Inicio', 'Final'] },
  { t: 'arrow', g: '➚', n: 'Flecha', np: 2, hints: ['Origen', 'Punta de la flecha'] },
  { t: 'plumb', g: '┃', n: 'Plomada', np: 1, hints: ['Punto por el que pasa la vertical'] },
  { t: 'dist', g: '↔', n: 'Distancia', np: 2, hints: ['Primer punto', 'Segundo punto'] },
  { t: 'hdist', g: '⇿', n: 'Distancia horizontal', np: 2, hints: ['Primer punto', 'Segundo punto'] },
  { t: 'text', g: 'T', n: 'Texto', np: 1, hints: ['Dónde colocar el texto'] },
  { t: 'calib', g: '📏', n: 'Calibrar (cm)', np: 2, hints: ['Extremo 1 del objeto de medida conocida', 'Extremo 2'] },
];
const TOOL = Object.fromEntries(TOOLS.map(t => [t.t, t]));

/* ---------------- Plantillas clínicas ----------------
   Cada una define los puntos que se piden, cómo se dibujan y qué se calcula.
   El mismo cálculo sirve para los puntos de la IA, así ambos son coherentes. */
const sentido = (v, pos, neg, neutro = '(neutro)') => Math.abs(v) < 0.5 ? neutro : v >= 0 ? pos : neg;
function sagCompute(P, side, ctx = {}) {
  const out = [];
  let dir = ctx.dir || 1;
  if (has(P.tal, P.mtt) && Math.abs(P.mtt.x - P.tal.x) > 2) dir = Math.sign(P.mtt.x - P.tal.x);
  else if (has(P.mal, P.mtt) && Math.abs(P.mtt.x - P.mal.x) > 2) dir = Math.sign(P.mtt.x - P.mal.x);
  let lean = null, thigh = null, shankUp = null, foot = null;
  if (has(P.hom, P.tro)) {
    lean = fromVert(sub(P.hom, P.tro), dir);
    out.push({ k: 'tronco', n: 'Inclinación del tronco', v: lean, u: '°', txt: `${fmt(Math.abs(lean))}° ${lean >= 0 ? 'hacia delante' : 'hacia atrás'}`, at: mid(P.hom, P.tro) });
  }
  if (has(P.tro, P.rod)) thigh = fromDown(sub(P.rod, P.tro), dir);
  if (has(P.rod, P.mal)) shankUp = fromVert(sub(P.rod, P.mal), dir);
  if (has(P.tal, P.mtt)) foot = Math.atan2(-(P.mtt.y - P.tal.y), (P.mtt.x - P.tal.x) * dir) * RAD;
  if (lean !== null && thigh !== null) {
    const v = norm180(thigh + lean);
    out.push({ k: 'cadera', n: 'Cadera', v, u: '°', txt: `${fmt(Math.abs(v))}° ${sentido(v, 'flexión', 'extensión')}`, at: P.tro });
  }
  if (thigh !== null && shankUp !== null) {
    const v = norm180(thigh + shankUp);   // muslo hacia delante + tibia hacia delante
    out.push({ k: 'rodilla', n: 'Rodilla', v, u: '°', txt: `${fmt(Math.abs(v))}° ${sentido(v, 'flexión', 'hiperextensión')}`, at: P.rod });
  }
  if (shankUp !== null && foot !== null) {
    const v = norm180(shankUp + foot);
    out.push({ k: 'tobillo', n: 'Tobillo', v, u: '°', txt: `${fmt(Math.abs(v))}° ${sentido(v, 'dorsiflexión', 'flexión plantar')}`, at: P.mal });
  }
  if (shankUp !== null) {
    out.push({ k: 'tibia', n: 'Inclinación de la tibia', v: shankUp, u: '°', txt: `${fmt(Math.abs(shankUp))}° ${shankUp >= 0 ? '(rodilla por delante del tobillo)' : '(tobillo por delante de la rodilla)'}`, at: mid(P.rod, P.mal), short: false });
  }
  if (foot !== null) {
    const tipo = Math.abs(foot) < 3 ? 'apoyo plano / mediopié' : foot > 0 ? 'talón primero' : 'antepié primero';
    out.push({ k: 'pie', n: 'Ángulo del pie con el suelo', v: foot, u: '°', txt: `${fmt(foot)}° (${tipo})`, at: P.mtt, short: false });
  }
  if (has(P.tro, P.tal)) {
    const dx = (P.tal.x - P.tro.x) * dir;
    const d = ctx.distFn ? ctx.distFn(dx) : { v: dx, u: 'px' };
    out.push({ k: 'overstride', n: 'Talón respecto a la cadera', v: d.v, u: d.u, txt: `${fmt(Math.abs(d.v), d.u === 'cm' ? 1 : 0)} ${d.u} ${dx >= 0 ? 'por delante (overstriding si es en el contacto)' : 'por detrás'}`, at: P.tal, short: false });
  }
  return out;
}
function pelvisOblic(Pi, Pd) {
  const v = sub(Pd, Pi);
  const a = Math.atan2(Math.abs(v.y), Math.abs(v.x)) * RAD;
  const signo = Pi.y > Pd.y ? 1 : -1;   // + = baja el lado izquierdo
  return { v: a * signo, txt: a < 0.5 ? `${fmt(a)}° (nivelada)` : `${fmt(a)}° · baja el lado ${signo > 0 ? 'izquierdo' : 'derecho'}` };
}
// Ángulo de rodilla en el plano frontal (FPPA). view: 'frontal' (anterior) o 'posterior'.
function fppa(cad, rod, tob, side, view) {
  const dev = 180 - ang3(cad, rod, tob);
  const t = (rod.y - cad.y) / ((tob.y - cad.y) || 1);
  const xl = cad.x + t * (tob.x - cad.x);
  // Medial hacia +x: pierna derecha en vista anterior, pierna izquierda en vista posterior.
  const medial = (view === 'frontal') === (side === 'D') ? 1 : -1;
  const valgo = (rod.x - xl) * medial > 0;
  const v = valgo ? dev : -dev;
  return { v, txt: `${fmt(dev)}° ${dev < 0.5 ? '(alineada)' : valgo ? 'valgo' : 'varo'}` };
}
function postCompute(P, side) {
  const out = [];
  const lat = side === 'D' ? 1 : -1;   // vista posterior: lateral de la pierna derecha hacia +x
  if (has(P.eips_i, P.eips_d)) {
    const o = pelvisOblic(P.eips_i, P.eips_d);
    out.push({ k: 'pelvis', n: 'Oblicuidad pélvica', v: o.v, u: '°', txt: o.txt, at: mid(P.eips_i, P.eips_d) });
  }
  const apoyo = side === 'D' ? P.eips_d : P.eips_i;
  if (has(apoyo, P.rod)) {
    let ref = { x: 0, y: 1 };
    if (has(P.eips_i, P.eips_d)) { const pv = sub(P.eips_d, P.eips_i); ref = { x: -pv.y, y: pv.x }; if (ref.y < 0) ref = { x: -ref.x, y: -ref.y }; }
    const v = xDev(ref, sub(P.rod, apoyo)) * -lat;   // + = rodilla hacia medial = aducción
    out.push({ k: 'aduccion', n: 'Cadera (frontal)', v, u: '°', txt: `${fmt(Math.abs(v))}° ${sentido(v, 'aducción', 'abducción')}`, at: apoyo });
  }
  if (has(P.pie_s, P.pie_i)) {
    const v = xDev({ x: 0, y: 1 }, sub(P.pie_i, P.pie_s)) * lat;
    out.push({ k: 'pierna', n: 'Pierna respecto a vertical', v, u: '°', txt: `${fmt(Math.abs(v))}° ${sentido(v, 'valgo', 'varo')}`, at: P.pie_s, short: false });
  }
  if (has(P.cal_s, P.cal_i)) {
    const v = xDev({ x: 0, y: 1 }, sub(P.cal_i, P.cal_s)) * lat;
    out.push({ k: 'calcvert', n: 'Calcáneo respecto a vertical', v, u: '°', txt: `${fmt(Math.abs(v))}° ${sentido(v, 'eversión', 'inversión')}`, at: P.cal_i, short: false });
  }
  if (has(P.pie_s, P.pie_i, P.cal_s, P.cal_i)) {
    const v = xDev(sub(P.pie_i, P.pie_s), sub(P.cal_i, P.cal_s)) * lat;
    out.push({ k: 'retropie', n: 'Retropié (pierna–calcáneo)', v, u: '°', txt: `${fmt(Math.abs(v))}° ${sentido(v, 'eversión (valgo)', 'inversión (varo)')}`, at: P.cal_s });
  }
  if (has(P.cad, P.rod, P.tob)) {
    const f = fppa(P.cad, P.rod, P.tob, side, 'posterior');
    out.push({ k: 'fppa', n: 'Rodilla frontal (FPPA)', v: f.v, u: '°', txt: f.txt, at: P.rod });
  }
  return out;
}
function frontCompute(P, side) {
  const out = [];
  const lat = side === 'D' ? -1 : 1;   // vista anterior: lateral de la pierna derecha hacia −x
  if (has(P.eias_i, P.eias_d)) {
    const o = pelvisOblic(P.eias_i, P.eias_d);
    out.push({ k: 'pelvis', n: 'Oblicuidad pélvica', v: o.v, u: '°', txt: o.txt, at: mid(P.eias_i, P.eias_d) });
  }
  if (has(P.cad, P.rod, P.tob)) {
    const f = fppa(P.cad, P.rod, P.tob, side, 'frontal');
    out.push({ k: 'fppa', n: 'Valgo dinámico (FPPA)', v: f.v, u: '°', txt: f.txt, at: P.rod });
  }
  if (has(P.tob, P.dedo)) {
    const v = xDev({ x: 0, y: 1 }, sub(P.dedo, P.tob)) * lat;
    out.push({ k: 'progresion', n: 'Progresión del pie (aprox. 2D)', v, u: '°', txt: `${fmt(Math.abs(v))}° ${sentido(v, 'abducción (punta hacia fuera)', 'aducción (punta hacia dentro)')}`, at: P.dedo, short: false });
  }
  return out;
}
// Índices de MediaPipe Pose: izquierdo impar, derecho par.
const LM = { hombro: 11, cadera: 23, rodilla: 25, tobillo: 27, talon: 29, dedo: 31 };
const lmPt = (lm, base, side) => { const i = base + (side === 'D' ? 1 : 0); return lm && lm[i * 3 + 2] > 0.25 ? { x: lm[i * 3], y: lm[i * 3 + 1] } : null; };
const lmAny = (lm, i) => lm && lm[i * 3 + 2] > 0.25 ? { x: lm[i * 3], y: lm[i * 3 + 1] } : null;

const TEMPLATES = {
  sagital: {
    n: 'Sagital (lateral)', g: '🏃',
    lm: [
      { k: 'hom', n: 'Hombro (acromion)' },
      { k: 'tro', n: 'Trocánter mayor' },
      { k: 'rod', n: 'Rodilla (epicóndilo femoral lateral)' },
      { k: 'mal', n: 'Maléolo lateral' },
      { k: 'tal', n: 'Talón (borde posterior del calcáneo)' },
      { k: 'mtt', n: 'Cabeza del 5º metatarsiano' },
    ],
    links: [['hom', 'tro'], ['tro', 'rod'], ['rod', 'mal'], ['tal', 'mtt'], ['mal', 'tal']],
    compute: sagCompute,
    fromPose: (lm, s) => ({ hom: lmPt(lm, LM.hombro, s), tro: lmPt(lm, LM.cadera, s), rod: lmPt(lm, LM.rodilla, s), mal: lmPt(lm, LM.tobillo, s), tal: lmPt(lm, LM.talon, s), mtt: lmPt(lm, LM.dedo, s) }),
  },
  posterior: {
    n: 'Posterior', g: '🦶',
    lm: [
      { k: 'eips_i', n: 'EIPS izquierda' },
      { k: 'eips_d', n: 'EIPS derecha' },
      { k: 'rod', n: 'Centro del hueco poplíteo (pierna de estudio)' },
      { k: 'pie_s', n: 'Bisección de la pierna · punto alto (tercio distal)' },
      { k: 'pie_i', n: 'Bisección de la pierna · punto bajo (sobre los maléolos)' },
      { k: 'cal_s', n: 'Bisección del calcáneo · punto alto (inserción aquílea)' },
      { k: 'cal_i', n: 'Bisección del calcáneo · punto bajo' },
    ],
    links: [['eips_i', 'eips_d'], ['@apoyo', 'rod'], ['pie_s', 'pie_i', 'ext'], ['cal_s', 'cal_i', 'ext']],
    compute: postCompute,
    fromPose: (lm, s) => ({ eips_i: lmAny(lm, 23), eips_d: lmAny(lm, 24), rod: lmPt(lm, LM.rodilla, s), pie_s: null, pie_i: null, cal_s: null, cal_i: null }),
  },
  frontal: {
    n: 'Frontal (anterior)', g: '🧍',
    lm: [
      { k: 'eias_d', n: 'EIAS derecha' },
      { k: 'eias_i', n: 'EIAS izquierda' },
      { k: 'cad', n: 'Centro de la cadera (pierna de estudio)' },
      { k: 'rod', n: 'Centro de la rodilla (rótula)' },
      { k: 'tob', n: 'Centro del tobillo (entre maléolos)' },
      { k: 'dedo', n: '2º dedo' },
    ],
    links: [['eias_d', 'eias_i'], ['cad', 'rod'], ['rod', 'tob'], ['tob', 'dedo'], ['cad', 'tob', 'dash']],
    compute: frontCompute,
    fromPose: (lm, s) => ({ eias_d: lmAny(lm, 24), eias_i: lmAny(lm, 23), cad: lmPt(lm, LM.cadera, s), rod: lmPt(lm, LM.rodilla, s), tob: lmPt(lm, LM.tobillo, s), dedo: lmPt(lm, LM.dedo, s) }),
  },
};
const tplPoints = (ann) => {
  const T = TEMPLATES[ann.tpl], P = {};
  T.lm.forEach((l, i) => { P[l.k] = ann.pts[i] || null; });
  P['@apoyo'] = ann.side === 'I' ? P.eips_i : P.eips_d;
  return P;
};

/* Métricas de la IA por vista (para la gráfica y la exportación). */
const POSE_METRICS = {
  sagital: [['rodilla', 'Flexión de rodilla'], ['cadera', 'Flexión de cadera'], ['tobillo', 'Dorsiflexión de tobillo'], ['tibia', 'Inclinación de la tibia'], ['tronco', 'Inclinación del tronco'], ['pie', 'Ángulo del pie']],
  posterior: [['fppa', 'Rodilla frontal (FPPA, + valgo)'], ['aduccion', 'Aducción de cadera'], ['pelvis', 'Oblicuidad pélvica (+ baja izq.)']],
  frontal: [['fppa', 'Valgo dinámico (FPPA, + valgo)'], ['pelvis', 'Oblicuidad pélvica (+ baja izq.)'], ['progresion', 'Progresión del pie']],
};
function poseMeasures(lm, view, side, dir, distFn) {
  if (!lm) return [];
  if (view === 'sagital') return sagCompute(TEMPLATES.sagital.fromPose(lm, side), side, { dir, distFn });
  const P = {
    eips_i: lmAny(lm, 23), eips_d: lmAny(lm, 24), eias_i: lmAny(lm, 23), eias_d: lmAny(lm, 24),
    cad: lmPt(lm, LM.cadera, side), rod: lmPt(lm, LM.rodilla, side), tob: lmPt(lm, LM.tobillo, side), dedo: lmPt(lm, LM.dedo, side),
  };
  return view === 'posterior' ? postCompute(P, side) : frontCompute(P, side);
}

/* ---------------- Estado global ---------------- */
const S = {
  tool: 'move', color: COLORES[0], lw: 3, side: 'D', act: 'carrera', fase: '—',
  grid: false, showPose: true, panes: [], active: 0, dual: false,
  link: null,          // desfase en segundos entre vídeo 2 y vídeo 1 cuando están vinculados
  loop: false, sel: null,    // {pi, id}
  session: null,       // {id, nhc, nombre, notas, created}
  dirty: false,
};
const activePane = () => S.panes[S.active];
const DPR = () => Math.min(window.devicePixelRatio || 1, 3);

function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
function marcarCambios() { S.dirty = true; actualizarCabecera(); }

/* ---------------- Diálogos propios (prompt/confirm fiables en iPad) ---------------- */
function preguntar(titulo, msg, def = '', { input = true, ok = 'Aceptar', tipo = 'text' } = {}) {
  return new Promise(res => {
    const m = $('#mPrompt'); $('#prTitle').textContent = titulo; $('#prMsg').textContent = msg || '';
    const inp = $('#prInput'); inp.parentElement.style.display = input ? '' : 'none';
    inp.type = tipo; inp.value = def; $('#prOk').textContent = ok;
    m.classList.add('show'); if (input) setTimeout(() => inp.focus(), 50);
    const fin = v => { m.classList.remove('show'); $('#prOk').onclick = $('#prCancel').onclick = inp.onkeydown = null; res(v); };
    $('#prOk').onclick = () => fin(input ? inp.value : true);
    $('#prCancel').onclick = () => fin(null);
    inp.onkeydown = e => { if (e.key === 'Enter') fin(inp.value); };
  });
}
const confirmar = (titulo, msg, ok = 'Sí') => preguntar(titulo, msg, '', { input: false, ok }).then(v => !!v);

/* ============================================================
   PANEL DE VÍDEO
   ============================================================ */
class Pane {
  constructor(i) {
    this.i = i;
    this.anns = []; this.undo = [];
    this.fps = 30; this.view = { s: 1, ox: 0, oy: 0 }; this.userZoom = false;
    this.mirror = false; this.pose = null; this.A = null; this.B = null;
    this.events = []; this.fpsReal = null;   // eventos de la zancada; fps reales si es cámara lenta
    this.ready = false; this.file = null; this.videoName = ''; this.pending = null;
    this.draft = null; this.action = null; this.pointers = new Map();
    this.build();
  }
  build() {
    const el = document.createElement('div');
    el.className = 'pane';
    el.innerHTML = `
      <div class="stage">
        <canvas class="main"></canvas>
        <video playsinline muted preload="auto"></video>
        <canvas class="loupe"></canvas>
        <div class="paneTag" style="display:none"></div>
        <div class="empty">
          <div class="big">${this.i === 0 ? 'Vídeo 1' : 'Vídeo 2'}</div>
          <div class="pend muted"></div>
          <div class="row"><button class="prim bOpen">📂 Abrir vídeo</button><button class="bCam">🎥 Grabar</button></div>
          <div class="muted">Mejor en cámara lenta (120–240 fps), grabado con la app Cámara</div>
        </div>
      </div>
      <div class="ptl">
        <button class="mini bCfg" title="Ajustes del vídeo">⚙︎</button>
        <div class="tlwrap"><div class="marks"></div><input type="range" min="0" max="0" step="1" value="0"></div>
        <span class="flabel">—</span>
      </div>`;
    this.el = el;
    this.stage = $('.stage', el); this.canvas = $('canvas.main', el); this.ctx = this.canvas.getContext('2d');
    this.video = $('video', el); this.loupe = $('.loupe', el); this.lctx = this.loupe.getContext('2d');
    this.empty = $('.empty', el); this.tag = $('.paneTag', el);
    this.range = $('input[type=range]', el); this.flabel = $('.flabel', el); this.marks = $('.marks', el);
    this.video.muted = true; this.video.playsInline = true;

    $('.bOpen', el).onclick = () => { S.loadTarget = this.i; $('#fileVideo').click(); };
    $('.bCam', el).onclick = () => { S.loadTarget = this.i; $('#fileCam').click(); };
    $('.bCfg', el).onclick = () => abrirAjustesPane(this);
    this.range.addEventListener('input', () => {
      if (!this.ready) return;
      this.pausar();
      const n = +this.range.value;
      this.video.currentTime = this.timeOf(n);
      if (S.link !== null && S.dual) seguirVinculado(this);
      this.updateTL(n);
    });
    this.range.addEventListener('pointerdown', () => setActive(this.i));
    this.video.addEventListener('seeked', () => { this.render(); this.updateTL(); actualizarLista(); if (grafVisible()) dibujarGrafica(); });
    this.video.addEventListener('loadeddata', () => this.render());
    this.video.addEventListener('pause', () => actualizarTransporte());
    this.video.addEventListener('play', () => actualizarTransporte());
    this.video.addEventListener('ended', () => actualizarTransporte());

    const st = this.stage;
    st.addEventListener('pointerdown', e => this.onDown(e));
    st.addEventListener('pointermove', e => this.onMove(e));
    st.addEventListener('pointerup', e => this.onUp(e));
    st.addEventListener('pointercancel', e => this.onUp(e, true));
    st.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(this.local(e), Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    new ResizeObserver(() => this.resize()).observe(st);
  }

  /* ---------- carga del vídeo ---------- */
  async loadFile(file) {
    const v = this.video;
    if (this.url) URL.revokeObjectURL(this.url);
    this.ready = false;
    this.url = URL.createObjectURL(file);
    this.file = file; this.videoName = file.name || 'vídeo';
    v.src = this.url; v.load();
    await new Promise((res, rej) => {
      const limpiar = () => { clearTimeout(to); v.removeEventListener('loadeddata', ok); v.removeEventListener('error', ko); };
      const ok = () => { limpiar(); res(); };
      const ko = () => { limpiar(); const e = new Error('formato'); e.codigo = v.error ? v.error.code : 0; rej(e); };
      const to = setTimeout(() => { limpiar(); const e = new Error('tiempo'); e.codigo = 'tiempo'; rej(e); }, 20000);
      v.addEventListener('loadeddata', ok); v.addEventListener('error', ko);
    });
    // Sin decodificador de vídeo (típico: HEVC del iPhone en Windows) el navegador abre solo el audio: ancho 0.
    if (!v.videoWidth || !v.videoHeight) { const e = new Error('sin imagen'); e.codigo = 'sinimagen'; throw e; }
    this.empty.style.display = 'none';
    this.fps = await this.detectFps();
    this.ready = true; this.userZoom = false;
    this.range.max = this.nFrames() - 1;
    await this.seekTo(this.timeOf(0));
    this.fit(); this.updateTag(); this.updateTL(); this.render();
  }
  async detectFps() {
    const v = this.video;
    if (!v.requestVideoFrameCallback) return 30;
    const tiempos = [];
    const r = await new Promise(res => {
      let fin = false;
      const acabar = () => { if (fin) return; fin = true; v.pause(); res(); };
      const cb = (now, md) => { tiempos.push(md.mediaTime); if (tiempos.length >= 18) acabar(); else v.requestVideoFrameCallback(cb); };
      v.requestVideoFrameCallback(cb);
      v.playbackRate = 0.25;
      v.play().catch(acabar);
      setTimeout(acabar, 3500);
    });
    v.playbackRate = +$('#tSpeed').value;
    const d = [];
    for (let i = 1; i < tiempos.length; i++) { const x = tiempos[i] - tiempos[i - 1]; if (x > 1e-4) d.push(x); }
    if (d.length < 3) return 30;
    d.sort((a, b) => a - b);
    const est = 1 / d[Math.floor(d.length * 0.25)];
    const comunes = [24, 25, 30, 50, 60, 100, 120, 240];
    return comunes.reduce((b, c) => Math.abs(Math.log(c / est)) < Math.abs(Math.log(b / est)) ? c : b, 30);
  }
  unload() {
    this.pausar();
    if (this.url) URL.revokeObjectURL(this.url);
    this.video.removeAttribute('src'); this.video.load();
    this.ready = false; this.file = null; this.videoName = ''; this.url = null;
    this.empty.style.display = ''; this.tag.style.display = 'none';
    this.updateTL(); this.render();
  }
  updateTag() {
    this.tag.style.display = this.ready ? '' : 'none';
    this.tag.textContent = `${this.videoName} · ${this.fps} fps${this.fpsReal ? ` (grabado a ${this.fpsReal})` : ''}${this.mirror ? ' · espejo' : ''}`;
    $('.pend', this.el).textContent = this.pending ? `Sesión abierta: carga «${this.pending.name}» para ver sus mediciones` : '';
  }

  /* ---------- tiempo / fotogramas ---------- */
  get vw() { return this.video.videoWidth || 1; }
  get vh() { return this.video.videoHeight || 1; }
  get fpsT() { return this.fpsReal || this.fps; }   // fps para convertir fotogramas en tiempo real
  nFrames() { return Math.max(1, Math.floor((this.video.duration || 0) * this.fps + 1e-6)); }
  frameOf(t) { return Math.floor(t * this.fps + 1e-6); }
  frame() { return this.frameOf(this.video.currentTime); }
  timeOf(n) { n = clamp(n, 0, this.nFrames() - 1); return Math.min((n + 0.5) / this.fps, Math.max(0, (this.video.duration || 0) - 0.001)); }
  seekTo(t, preciso = false) {
    const v = this.video;
    return new Promise(res => {
      if (Math.abs(v.currentTime - t) < 1e-5) { res(); return; }
      let vistoSeek = false, vistoFrame = !preciso || !v.requestVideoFrameCallback, hecho = false;
      const fin = () => { if (hecho) return; hecho = true; v.removeEventListener('seeked', onS); clearTimeout(to); res(); };
      const check = () => { if (vistoSeek && vistoFrame) fin(); };
      const onS = () => { vistoSeek = true; if (!vistoFrame) setTimeout(() => { vistoFrame = true; check(); }, 150); check(); };
      if (!vistoFrame) v.requestVideoFrameCallback(() => { vistoFrame = true; check(); });
      const to = setTimeout(fin, 2500);
      v.addEventListener('seeked', onS);
      v.currentTime = t;
    });
  }
  async seekFrame(n, preciso) { await this.seekTo(this.timeOf(n), preciso); }
  step(dn) {
    if (!this.ready) return;
    this.pausar();
    const n = clamp(this.frame() + dn, 0, this.nFrames() - 1);
    this.video.currentTime = this.timeOf(n);
    this.updateTL(n);
  }
  pausar() { if (!this.video.paused) this.video.pause(); }
  play() {
    if (!this.ready) return;
    const v = this.video;
    if (v.ended || v.currentTime >= v.duration - 0.01) v.currentTime = this.timeOf(this.A ?? 0);
    v.playbackRate = +$('#tSpeed').value;
    v.play().then(() => this.loop()).catch(() => {});
  }
  loop() {
    const v = this.video;
    const paso = () => {
      if (S.loop && this.B !== null && this.frame() >= this.B) v.currentTime = this.timeOf(this.A ?? 0);
      this.render(); this.updateTL();
      if (!v.paused && !v.ended) v.requestVideoFrameCallback ? v.requestVideoFrameCallback(paso) : requestAnimationFrame(paso);
      else { this.render(); actualizarLista(); if (grafVisible()) dibujarGrafica(); }
    };
    paso();
  }
  updateTL(n = this.frame()) {
    if (!this.ready) { this.flabel.textContent = '—'; this.marks.innerHTML = ''; return; }
    this.range.value = n;
    this.flabel.textContent = `F ${n} · ${fmtT(this.video.currentTime)}`;
    const key = this.anns.map(a => a.fixed ? '' : this.frameOf(a.t)).join(',') + `|${this.A}|${this.B}|${this.nFrames()}|` + this.events.map(e => e.type + e.side + this.frameOf(e.t)).join(',');
    if (key === this._mk) return;
    this._mk = key;
    const N = Math.max(1, this.nFrames() - 1), pct = f => (f / N * 100) + '%';
    let h = '';
    new Set(this.anns.filter(a => !a.fixed).map(a => this.frameOf(a.t))).forEach(f => { h += `<i style="left:${pct(f)}"></i>`; });
    for (const e of this.events) h += `<i style="left:${pct(this.frameOf(e.t))};top:${e.type === 'IC' ? 18 : 24}px;height:${e.type === 'IC' ? 12 : 7}px;width:2px;background:${e.side === 'D' ? '#FF8A65' : '#4FC3F7'}"></i>`;
    if (this.A !== null) h += `<i class="ab" style="left:${pct(this.A)}"></i>`;
    if (this.B !== null) h += `<i class="ab" style="left:${pct(this.B)}"></i>`;
    if (this.A !== null && this.B !== null) h += `<div class="rng" style="left:${pct(Math.min(this.A, this.B))};width:${Math.abs(this.B - this.A) / N * 100}%"></div>`;
    this.marks.innerHTML = h;
  }

  /* ---------- vista (zoom/desplazamiento) ---------- */
  resize() {
    const r = this.stage.getBoundingClientRect(), d = DPR();
    this.cw = r.width; this.ch = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * d)); this.canvas.height = Math.max(1, Math.round(r.height * d));
    if (!this.userZoom) this.fit(); else this.render();
  }
  fit() {
    if (!this.ready || !this.cw) { this.render(); return; }
    const s = Math.min(this.cw / this.vw, this.ch / this.vh);
    this.view = { s, ox: (this.cw - this.vw * s) / 2, oy: (this.ch - this.vh * s) / 2 };
    this.fitS = s; this.userZoom = false; this.render();
  }
  zoomAt(p, f) {
    if (!this.ready) return;
    const v = this.view, s = clamp(v.s * f, (this.fitS || v.s) * 0.5, (this.fitS || v.s) * 25);
    const u = (p.x - v.ox) / v.s, w = (p.y - v.oy) / v.s;
    this.view = { s, ox: p.x - u * s, oy: p.y - w * s }; this.userZoom = true; this.render();
  }
  local(e) { const r = this.stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  toScreen(p, view = this.view) { return { x: view.ox + (this.mirror ? this.vw - p.x : p.x) * view.s, y: view.oy + p.y * view.s }; }
  toVideo(q) { const v = this.view; const u = (q.x - v.ox) / v.s; return { x: this.mirror ? this.vw - u : u, y: (q.y - v.oy) / v.s }; }
  visibleRect() {
    const a = this.toVideo({ x: 0, y: 0 }), b = this.toVideo({ x: this.cw, y: this.ch });
    const x0 = clamp(Math.min(a.x, b.x), 0, this.vw), x1 = clamp(Math.max(a.x, b.x), 0, this.vw);
    const y0 = clamp(Math.min(a.y, b.y), 0, this.vh), y1 = clamp(Math.max(a.y, b.y), 0, this.vh);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* ---------- anotaciones ---------- */
  visibles(n = this.frame()) { return this.anns.filter(a => a.fixed || this.frameOf(a.t) === n); }
  get pxPerCm() { const c = [...this.anns].reverse().find(a => a.type === 'calib' && a.cm > 0); return c ? len(sub(c.pts[1], c.pts[0])) / c.cm : null; }
  dist(px) { const k = this.pxPerCm; return k ? { v: px / k, u: 'cm' } : { v: px, u: 'px' }; }
  pushUndo() { this.undo.push(JSON.stringify(this.anns)); if (this.undo.length > 60) this.undo.shift(); }
  doUndo() {
    if (this.draft) { this.cancelDraft(); return; }
    if (!this.undo.length) { toast('Nada que deshacer'); return; }
    this.anns = JSON.parse(this.undo.pop()); S.sel = null; marcarCambios(); refrescar();
  }
  getAnn(id) { return this.anns.find(a => a.id === id); }
  selAnn() { return S.sel && S.sel.pi === this.i ? this.getAnn(S.sel.id) : null; }

  /* ---------- puntero / gestos ---------- */
  onDown(e) {
    // Los botones del panel (Abrir vídeo, Grabar) deben recibir su clic: no capturar el puntero.
    if (e.target.closest('button, .empty')) { setActive(this.i); return; }
    e.preventDefault();
    setActive(this.i);
    try { this.stage.setPointerCapture(e.pointerId); } catch (_) {}
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      // Dos dedos: zoom. Si el primer dedo acababa de poner un punto, se retira.
      if (this.action && this.action.type === 'place' && this.action.added && this.draft) {
        if (this.draft.type === 'tpl') this.draft.pts[this.draft.cur] = undefined; else this.draft.pts.pop();
        if (this.draft.type !== 'tpl' && !this.draft.pts.length) this.draft = null;
      }
      const [a, b] = [...this.pointers.values()];
      this.action = { type: 'pinch', d0: len(sub(a, b)) || 1, m0: mid(a, b), v0: { ...this.view } };
      this.hideLoupe(); this.render(); actualizarGuia();
      return;
    }
    if (this.pointers.size > 2 || !this.ready) { if (!this.ready) this.action = null; return; }
    const vp = this.toVideo(p);

    // 1) Borrador en curso: ¿toca uno de sus puntos?
    if (this.draft) {
      const k = this.hitPts(this.draft.pts, p);
      if (k >= 0) { this.action = { type: 'dragDraft', k }; this.showLoupe(p); return; }
    }
    // 2) Puntos de la anotación seleccionada (con cualquier herramienta).
    const sel = this.selAnn();
    if (sel && !this.draft && this.visibles().includes(sel)) {
      const k = this.hitPts(sel.pts, p);
      if (k >= 0) { this.pushUndo(); this.action = { type: 'dragPt', ann: sel, k }; this.showLoupe(p); return; }
    }
    // 3) Mover: seleccionar / arrastrar / desplazar la imagen.
    if (S.tool === 'move') {
      const vis = this.visibles().slice().reverse();
      for (const a of vis) {
        const k = this.hitPts(a.pts, p);
        if (k >= 0) { this.select(a); this.pushUndo(); this.action = { type: 'dragPt', ann: a, k }; this.showLoupe(p); return; }
      }
      for (const a of vis) {
        if (this.hitBody(a, p)) { this.select(a); this.pushUndo(); this.action = { type: 'dragAnn', ann: a, last: vp, moved: false }; return; }
      }
      if (S.sel) { S.sel = null; refrescar(); }
      this.action = { type: 'pan', p0: p, v0: { ...this.view } };
      return;
    }
    // 4) Herramientas de dibujo: colocar un punto nuevo.
    if (S.tool.startsWith('tpl:')) {
      if (!this.draft) this.startTpl(S.tool.slice(4));
      this.draft.pts[this.draft.cur] = vp;
    } else {
      if (!this.draft) this.draft = { type: S.tool, pts: [] };
      this.draft.pts.push(vp);
    }
    this.action = { type: 'place', added: true };
    this.showLoupe(p); this.render(); actualizarGuia();
  }
  onMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    const A = this.action; if (!A) return;
    if (A.type === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const m = mid(a, b), f = len(sub(a, b)) / A.d0;
      const s = clamp(A.v0.s * f, (this.fitS || A.v0.s) * 0.5, (this.fitS || A.v0.s) * 25);
      const u = (A.m0.x - A.v0.ox) / A.v0.s, w = (A.m0.y - A.v0.oy) / A.v0.s;
      this.view = { s, ox: m.x - u * s, oy: m.y - w * s }; this.userZoom = true; this.render();
      return;
    }
    if (A.type === 'pan') {
      this.view = { ...A.v0, ox: A.v0.ox + p.x - A.p0.x, oy: A.v0.oy + p.y - A.p0.y }; this.userZoom = true; this.render();
      return;
    }
    const vp = this.toVideo(p);
    if (A.type === 'place') {
      if (this.draft.type === 'tpl') this.draft.pts[this.draft.cur] = vp; else this.draft.pts[this.draft.pts.length - 1] = vp;
    } else if (A.type === 'dragDraft') this.draft.pts[A.k] = vp;
    else if (A.type === 'dragPt') { A.ann.pts[A.k] = vp; A.moved = true; }
    else if (A.type === 'dragAnn') {
      const d = sub(vp, A.last); A.last = vp; A.moved = true;
      A.ann.pts = A.ann.pts.map(q => q ? { x: q.x + d.x, y: q.y + d.y } : q);
    }
    this.render(); this.showLoupe(p);
    if (A.type === 'dragPt' || A.type === 'dragAnn') actualizarLista();
  }
  async onUp(e, cancel) {
    this.pointers.delete(e.pointerId);
    const A = this.action;
    if (A && A.type === 'pinch') { if (this.pointers.size === 0) this.action = null; return; }
    this.action = null; this.hideLoupe();
    if (!A) return;
    if (A.type === 'dragPt' || A.type === 'dragAnn') {
      if (!A.moved && A.type === 'dragAnn') this.undo.pop();
      else marcarCambios();
      refrescar(); return;
    }
    if (A.type === 'place' || A.type === 'dragDraft') {
      if (cancel && A.type === 'place') { this.doUndo(); return; }
      if (A.type === 'place' && this.draft) {
        if (this.draft.type === 'tpl') this.advanceTpl();
        if (this.draftDone()) await this.commit();
      }
      this.render(); actualizarGuia();
    }
  }
  hitPts(pts, p, r = 24) {
    let best = -1, bd = r;
    pts.forEach((q, i) => { if (!q) return; const d = len(sub(this.toScreen(q), p)); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  hitBody(a, p) {
    const segs = segmentosDe(a, this);
    for (const [u, v] of segs) if (distPtSeg(p, this.toScreen(u), this.toScreen(v)) < 14) return true;
    if (a.type === 'text' && len(sub(this.toScreen(a.pts[0]), p)) < 40) return true;
    return false;
  }
  select(a) { S.sel = { pi: this.i, id: a.id }; refrescar(); }

  /* ---------- borradores ---------- */
  startTpl(k) {
    const T = TEMPLATES[k];
    this.draft = { type: 'tpl', tpl: k, pts: new Array(T.lm.length).fill(undefined), cur: 0 };
  }
  advanceTpl() {
    const d = this.draft, n = d.pts.length;
    let i = d.cur;
    while (i < n && d.pts[i] !== undefined) i++;
    d.cur = i;
  }
  draftDone() {
    const d = this.draft; if (!d) return false;
    if (d.type === 'tpl') return d.cur >= d.pts.length;
    return d.pts.length >= TOOL[d.type].np;
  }
  cancelDraft() { this.draft = null; this.render(); actualizarGuia(); }
  async commit() {
    const d = this.draft; this.draft = null;
    const a = {
      id: uid(), type: d.type, pts: d.pts.map(q => q === undefined ? null : q),
      color: S.color, lw: S.lw, side: S.side, fase: S.fase, act: S.act,
      t: this.timeOf(this.frame()), fixed: d.type === 'calib', label: '',
    };
    if (d.type === 'tpl') a.tpl = d.tpl;
    if (d.type === 'text') {
      const txt = await preguntar('Texto', 'Escribe el texto que se mostrará sobre el vídeo');
      if (!txt) { this.render(); return; }
      a.text = txt;
    }
    if (d.type === 'calib') {
      const v = await preguntar('Calibrar', '¿Cuántos centímetros mide en la realidad lo que has marcado? Debe estar en el mismo plano que el paciente.', '', { tipo: 'text' });
      const cm = parseFloat(String(v || '').replace(',', '.'));
      if (!(cm > 0)) { toast('Calibración cancelada'); this.render(); return; }
      a.cm = cm; a.color = '#69F0AE';
    }
    this.pushUndo();
    this.anns.push(a);
    S.sel = { pi: this.i, id: a.id };
    marcarCambios(); refrescar();
  }

  /* ---------- lupa ---------- */
  showLoupe(p) {
    const L = this.loupe, d = DPR(), size = 132;
    if (L.width !== size * d) { L.width = L.height = size * d; }
    let lx = p.x - size / 2, ly = p.y - size - 46;
    if (ly < 4) ly = p.y + 46;
    lx = clamp(lx, 4, this.cw - size - 4);
    L.style.left = lx + 'px'; L.style.top = ly + 'px'; L.style.display = 'block';
    const z = 3, sw = size * d / z;
    const c = this.lctx;
    c.fillStyle = '#000'; c.fillRect(0, 0, L.width, L.height);
    c.drawImage(this.canvas, p.x * d - sw / 2, p.y * d - sw / 2, sw, sw, 0, 0, L.width, L.height);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5 * d;
    const m = L.width / 2;
    c.beginPath(); c.moveTo(m, m - 18 * d); c.lineTo(m, m - 5 * d); c.moveTo(m, m + 5 * d); c.lineTo(m, m + 18 * d);
    c.moveTo(m - 18 * d, m); c.lineTo(m - 5 * d, m); c.moveTo(m + 5 * d, m); c.lineTo(m + 18 * d, m); c.stroke();
  }
  hideLoupe() { this.loupe.style.display = 'none'; }

  /* ---------- dibujo ---------- */
  render() {
    const c = this.canvas, ctx = this.ctx, d = DPR();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a1626'; ctx.fillRect(0, 0, c.width, c.height);
    if (!this.ready) return;
    const view = { s: this.view.s * d, ox: this.view.ox * d, oy: this.view.oy * d };
    dibujarEscena(ctx, this, view, d, { frame: this.frame(), draft: this.draft, sel: this.selAnn(), legend: true });
  }

  /* ---------- serialización ---------- */
  serialize() {
    const r2 = v => Math.round(v * 10) / 10;
    let pose = null;
    if (this.pose) {
      const frames = {};
      for (const [n, lm] of Object.entries(this.pose.frames)) frames[n] = lm.map((v, i) => i % 3 === 2 ? Math.round(v * 100) / 100 : r2(v));
      pose = { ...this.pose, frames };
    }
    return {
      videoName: this.videoName || this.pending?.name || '', videoDur: this.video.duration || this.pending?.dur || 0,
      fps: this.fps, fpsReal: this.fpsReal, anns: this.anns, events: this.events, A: this.A, B: this.B, mirror: this.mirror, pose,
    };
  }
  restore(d) {
    this.anns = d.anns || []; this.undo = []; this.A = d.A ?? null; this.B = d.B ?? null;
    this.mirror = !!d.mirror; this.pose = d.pose || null; this.events = d.events || []; this.fpsReal = d.fpsReal || null;
    if (d.fps) this.fps = d.fps;
    const mismo = this.ready && this.videoName === d.videoName;
    this.pending = mismo ? null : { name: d.videoName, dur: d.videoDur, fps: d.fps };
    if (mismo) this.range.max = this.nFrames() - 1;
    this._mk = null; this.updateTag(); this.updateTL(); this.render();
  }
}

/* Segmentos de cada anotación (para tocarla y para dibujarla). */
function segmentosDe(a, pane) {
  const p = a.pts;
  switch (a.type) {
    case 'line': case 'arrow': case 'dist': case 'calib': case 'vangle': case 'hangle': return has(p[0], p[1]) ? [[p[0], p[1]]] : [];
    case 'hdist': return has(p[0], p[1]) ? [[p[0], { x: p[1].x, y: p[0].y }]] : [];
    case 'angle3': return has(p[0], p[1], p[2]) ? [[p[0], p[1]], [p[1], p[2]]] : [];
    case 'angle4': return has(p[0], p[1], p[2], p[3]) ? [[p[0], p[1]], [p[2], p[3]]] : [];
    case 'plumb': return has(p[0]) ? [[{ x: p[0].x, y: 0 }, { x: p[0].x, y: pane.vh }]] : [];
    case 'tpl': {
      const P = tplPoints(a);
      return TEMPLATES[a.tpl].links.filter(([u, v]) => has(P[u], P[v])).map(([u, v]) => [P[u], P[v]]);
    }
  }
  return [];
}

/* Mediciones de una anotación. */
function medir(a, pane) {
  const p = a.pts;
  const D = px => pane.dist(px);
  switch (a.type) {
    case 'angle3': if (has(p[0], p[1], p[2])) { const v = ang3(p[0], p[1], p[2]); return [{ n: 'Ángulo', v, u: '°', txt: `${fmt(v)}° (suplementario ${fmt(180 - v)}°)`, at: p[1] }]; } break;
    case 'vangle': if (has(p[0], p[1])) { const d = sub(p[1], p[0]); const v = Math.atan2(Math.abs(d.x), Math.abs(d.y)) * RAD; return [{ n: 'Respecto a la vertical', v, u: '°', txt: `${fmt(v)}°`, at: p[0] }]; } break;
    case 'hangle': if (has(p[0], p[1])) { const d = sub(p[1], p[0]); const v = Math.atan2(Math.abs(d.y), Math.abs(d.x)) * RAD; return [{ n: 'Respecto a la horizontal', v, u: '°', txt: `${fmt(v)}°`, at: p[0] }]; } break;
    case 'angle4': if (has(p[0], p[1], p[2], p[3])) { const v = angBetween(sub(p[1], p[0]), sub(p[3], p[2])); return [{ n: 'Entre rectas', v, u: '°', txt: `${fmt(v)}° (suplementario ${fmt(180 - v)}°)`, at: mid(mid(p[0], p[1]), mid(p[2], p[3])) }]; } break;
    case 'dist': if (has(p[0], p[1])) { const d = D(len(sub(p[1], p[0]))); return [{ n: 'Distancia', v: d.v, u: d.u, txt: `${fmt(d.v, d.u === 'cm' ? 1 : 0)} ${d.u}`, at: mid(p[0], p[1]) }]; } break;
    case 'hdist': if (has(p[0], p[1])) { const d = D(Math.abs(p[1].x - p[0].x)); return [{ n: 'Distancia horizontal', v: d.v, u: d.u, txt: `${fmt(d.v, d.u === 'cm' ? 1 : 0)} ${d.u}`, at: { x: (p[0].x + p[1].x) / 2, y: p[0].y } }]; } break;
    case 'calib': if (has(p[0], p[1])) return [{ n: 'Calibración', v: a.cm, u: 'cm', txt: `${fmt(a.cm)} cm = ${fmt(len(sub(p[1], p[0])), 0)} px`, at: mid(p[0], p[1]) }]; break;
    case 'tpl': {
      const T = TEMPLATES[a.tpl];
      return T.compute(tplPoints(a), a.side, { dir: a.dir || 1, distFn: px => D(px) });
    }
  }
  return [];
}
const nombreAnn = a => a.label || (a.type === 'tpl' ? 'Plantilla ' + TEMPLATES[a.tpl].n.toLowerCase() : a.type === 'text' ? `Texto «${a.text}»` : TOOL[a.type].n);

/* ============================================================
   ESCENA: vídeo + rejilla + esqueleto + anotaciones
   view = {s, ox, oy} en píxeles del lienzo. ui = factor de tamaño.
   ============================================================ */
function dibujarEscena(ctx, pane, view, ui, opt = {}) {
  const T = q => pane.toScreen(q, view);
  ctx.save();
  // vídeo
  ctx.save();
  if (pane.mirror) { ctx.translate(view.ox + pane.vw * view.s, view.oy); ctx.scale(-1, 1); ctx.drawImage(pane.video, 0, 0, pane.vw * view.s, pane.vh * view.s); }
  else ctx.drawImage(pane.video, view.ox, view.oy, pane.vw * view.s, pane.vh * view.s);
  ctx.restore();
  // rejilla
  if (S.grid) {
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1 * ui;
    ctx.beginPath();
    for (let i = 1; i < 8; i++) {
      const x = view.ox + pane.vw * view.s * i / 8, y = view.oy + pane.vh * view.s * i / 8;
      ctx.moveTo(x, view.oy); ctx.lineTo(x, view.oy + pane.vh * view.s);
      ctx.moveTo(view.ox, y); ctx.lineTo(view.ox + pane.vw * view.s, y);
    }
    ctx.stroke();
  }
  // esqueleto IA
  if ((opt.pose ?? S.showPose) && pane.pose) {
    const lm = poseEn(pane, opt.frame);
    if (lm) dibujarEsqueleto(ctx, lm, T, ui);
  }
  // anotaciones
  const vis = pane.visibles(opt.frame);
  const legend = [];
  for (const a of vis) {
    const ms = dibujarAnn(ctx, a, pane, T, ui, a === opt.sel);
    if (a.type === 'tpl' && ms.length) legend.push({ a, ms });
  }
  if (opt.draft) dibujarBorrador(ctx, opt.draft, pane, T, ui);
  if (opt.legend !== false && legend.length) dibujarLeyenda(ctx, legend, ui, opt.legendY ?? 34 * ui);
  ctx.restore();
}
function poseEn(pane, n) {
  const fr = pane.pose.frames;
  if (fr[n]) return fr[n];
  const st = pane.pose.step || 1;
  for (let k = 1; k < st; k++) { if (fr[n - k]) return fr[n - k]; if (fr[n + k]) return fr[n + k]; }
  return null;
}
const ESQ = [[11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]];
function dibujarEsqueleto(ctx, lm, T, ui) {
  const P = i => lm[i * 3 + 2] > 0.25 ? T({ x: lm[i * 3], y: lm[i * 3 + 1] }) : null;
  ctx.lineWidth = 2.5 * ui; ctx.lineCap = 'round';
  for (const [a, b] of ESQ) {
    const p = P(a), q = P(b); if (!p || !q) continue;
    ctx.strokeStyle = (a % 2 && b % 2) ? 'rgba(79,195,247,.9)' : (!(a % 2) && !(b % 2)) ? 'rgba(255,138,101,.9)' : 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  }
  for (const i of [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]) {
    const p = P(i); if (!p) continue;
    ctx.fillStyle = i % 2 ? '#4FC3F7' : '#FF8A65';
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.5 * ui, 0, 7); ctx.fill();
  }
}
function linea(ctx, a, b, dash) {
  ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
}
function punto(ctx, p, color, ui, grande) {
  ctx.beginPath(); ctx.arc(p.x, p.y, (grande ? 7 : 4.5) * ui, 0, 7);
  ctx.fillStyle = grande ? 'rgba(0,0,0,.35)' : color; ctx.fill();
  ctx.lineWidth = (grande ? 2.5 : 1.5) * ui; ctx.strokeStyle = grande ? color : 'rgba(0,0,0,.75)'; ctx.stroke();
  if (grande) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 * ui, 0, 7); ctx.fillStyle = color; ctx.fill(); }
}
function etiqueta(ctx, txt, x, y, ui, color = '#fff', anchor = 'left') {
  ctx.font = `600 ${13 * ui}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const w = ctx.measureText(txt).width, h = 19 * ui, pad = 5 * ui;
  let x0 = anchor === 'center' ? x - w / 2 - pad : x;
  ctx.fillStyle = 'rgba(8,18,32,.82)';
  const r = 5 * ui;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y - h / 2, w + pad * 2, h, r) : ctx.rect(x0, y - h / 2, w + pad * 2, h); ctx.fill();
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(txt, x0 + pad, y + 0.5 * ui);
}
function arco(ctx, c, a, b, r) {
  const a1 = Math.atan2(a.y - c.y, a.x - c.x), a2 = Math.atan2(b.y - c.y, b.x - c.x);
  let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  ctx.beginPath(); ctx.arc(c.x, c.y, r, a1, a1 + d, d < 0); ctx.stroke();
}
function flecha(ctx, a, b, ui, lw) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x), L = (11 + lw * 2) * ui;
  ctx.beginPath(); ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - L * Math.cos(ang - 0.42), b.y - L * Math.sin(ang - 0.42));
  ctx.lineTo(b.x - L * Math.cos(ang + 0.42), b.y - L * Math.sin(ang + 0.42));
  ctx.closePath(); ctx.fill();
}
function dibujarAnn(ctx, a, pane, T, ui, sel) {
  const c = a.color, lw = (a.lw || 3) * ui * 0.8;
  const pts = a.pts.map(q => q ? T(q) : null);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 3 * ui;   // contorno: se ve sobre fondos claros
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ms = medir(a, pane);
  const off = 12 * ui;
  const [p0, p1, p2, p3] = pts;
  switch (a.type) {
    case 'line': linea(ctx, p0, p1); break;
    case 'arrow': linea(ctx, p0, p1); flecha(ctx, p0, p1, ui, a.lw || 3); break;
    case 'angle3': {
      linea(ctx, p0, p1); linea(ctx, p2, p1);
      ctx.lineWidth = Math.max(1, lw * 0.7); arco(ctx, p1, p0, p2, 26 * ui);
      if (ms[0]) etiqueta(ctx, `${fmt(ms[0].v)}°`, p1.x + off, p1.y - off * 1.6, ui, c);
      break;
    }
    case 'vangle': case 'hangle': {
      linea(ctx, p0, p1);
      const L = len(sub(p1, p0));
      const ref = a.type === 'vangle' ? { x: p0.x, y: p0.y + Math.sign(p1.y - p0.y || 1) * L } : { x: p0.x + Math.sign(p1.x - p0.x || 1) * L, y: p0.y };
      ctx.lineWidth = Math.max(1, lw * 0.6); linea(ctx, p0, ref, [6 * ui, 5 * ui]);
      arco(ctx, p0, ref, p1, 28 * ui);
      if (ms[0]) etiqueta(ctx, `${fmt(ms[0].v)}°`, p0.x + off, p0.y - off * 1.6, ui, c);
      break;
    }
    case 'angle4': {
      linea(ctx, p0, p1); linea(ctx, p2, p3);
      if (ms[0]) { const m = T(ms[0].at); etiqueta(ctx, `${fmt(ms[0].v)}°`, m.x, m.y, ui, c, 'center'); }
      break;
    }
    case 'plumb': {
      const top = T({ x: a.pts[0].x, y: 0 }), bot = T({ x: a.pts[0].x, y: pane.vh });
      linea(ctx, top, bot, [10 * ui, 6 * ui]);
      break;
    }
    case 'dist': case 'calib': {
      linea(ctx, p0, p1);
      const v = sub(p1, p0), L = len(v) || 1, nx = -v.y / L * 7 * ui, ny = v.x / L * 7 * ui;
      linea(ctx, { x: p0.x - nx, y: p0.y - ny }, { x: p0.x + nx, y: p0.y + ny });
      linea(ctx, { x: p1.x - nx, y: p1.y - ny }, { x: p1.x + nx, y: p1.y + ny });
      if (ms[0]) { const m = mid(p0, p1); etiqueta(ctx, a.type === 'calib' ? `📏 ${fmt(a.cm)} cm` : ms[0].txt, m.x + off, m.y - off, ui, c); }
      break;
    }
    case 'hdist': {
      const q = { x: p1.x, y: p0.y };
      ctx.lineWidth = Math.max(1, lw * 0.6); linea(ctx, p1, q, [5 * ui, 4 * ui]);
      ctx.lineWidth = lw; linea(ctx, p0, q);
      flecha(ctx, q, p0, ui, 1); flecha(ctx, p0, q, ui, 1);
      if (ms[0]) etiqueta(ctx, ms[0].txt, (p0.x + q.x) / 2, p0.y - 16 * ui, ui, c, 'center');
      break;
    }
    case 'text': etiqueta(ctx, a.text || '', p0.x, p0.y, ui * 1.15, c); break;
    case 'tpl': {
      const P = tplPoints(a), Ts = {}; for (const k in P) Ts[k] = P[k] ? T(P[k]) : null;
      for (const [u, v, mod] of TEMPLATES[a.tpl].links) {
        if (!Ts[u] || !Ts[v]) continue;
        if (mod === 'ext') {   // bisección prolongada
          const d = sub(Ts[v], Ts[u]), L = len(d) || 1, e = 0.35;
          linea(ctx, { x: Ts[u].x - d.x * e, y: Ts[u].y - d.y * e }, { x: Ts[v].x + d.x * e, y: Ts[v].y + d.y * e });
        } else linea(ctx, Ts[u], Ts[v], mod === 'dash' ? [6 * ui, 5 * ui] : null);
      }
      if (a.tpl === 'sagital' && Ts.tro && Ts.tal) {   // plomada desde la cadera
        ctx.lineWidth = Math.max(1, lw * 0.5); linea(ctx, Ts.tro, { x: Ts.tro.x, y: Ts.tal.y + 10 * ui }, [4 * ui, 5 * ui]); ctx.lineWidth = lw;
      }
      for (const m of ms) if (m.at && m.short !== false && m.u === '°') { const q = T(m.at); etiqueta(ctx, `${fmt(Math.abs(m.v))}°`, q.x + off, q.y - off, ui, c); }
      break;
    }
  }
  ctx.restore();
  // puntos
  pts.forEach(p => p && punto(ctx, p, c, ui, sel));
  if (sel && a.label) { const q = pts.find(Boolean); if (q) etiqueta(ctx, a.label, q.x + off, q.y + off * 2, ui, '#fff'); }
  return ms;
}
function dibujarBorrador(ctx, d, pane, T, ui) {
  const c = S.color;
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2 * ui;
  const pts = d.pts.map(q => q ? T(q) : null);
  if (d.type === 'tpl') {
    const P = {}; TEMPLATES[d.tpl].lm.forEach((l, i) => { P[l.k] = pts[i]; });
    P['@apoyo'] = S.side === 'I' ? P.eips_i : P.eips_d;
    for (const [u, v] of TEMPLATES[d.tpl].links) if (P[u] && P[v]) linea(ctx, P[u], P[v], [5 * ui, 4 * ui]);
  } else {
    for (let i = 1; i < pts.length; i++) if (pts[i - 1] && pts[i] && !(d.type === 'angle4' && i === 2)) linea(ctx, pts[i - 1], pts[i], [5 * ui, 4 * ui]);
  }
  pts.forEach(p => p && punto(ctx, p, c, ui, true));
}
function dibujarLeyenda(ctx, items, ui, y0) {
  let y = y0;
  const x = 10 * ui;
  for (const { a, ms } of items) {
    const tit = `${TEMPLATES[a.tpl].n} · ${a.side === 'I' ? 'Izdo' : 'Dcho'}${a.fase && a.fase !== '—' ? ' · ' + a.fase : ''}`;
    etiqueta(ctx, tit, x, y, ui * 0.95, a.color); y += 21 * ui;
    for (const m of ms) { etiqueta(ctx, `${m.n}: ${m.txt}`, x, y, ui * 0.85, '#fff'); y += 18 * ui; }
    y += 6 * ui;
  }
}

/* ============================================================
   INTERFAZ
   ============================================================ */
function setActive(i) {
  if (S.active === i) return;
  const old = activePane(); if (old && old.draft) old.cancelDraft();
  S.active = i;
  S.panes.forEach(p => p.el.classList.toggle('active', p.i === i));
  refrescar();
}
function refrescar() {
  S.panes.forEach(p => p.render());
  actualizarLado(); actualizarLista(); actualizarTransporte(); actualizarGuia();
  if (grafVisible()) dibujarGrafica();
}
function construirLado() {
  const tb = $('#tools');
  tb.innerHTML = TOOLS.map(t => `<button data-t="${t.t}"><span class="g">${t.g}</span>${t.n}</button>`).join('');
  $('#tpls').innerHTML = Object.entries(TEMPLATES).map(([k, T]) => `<button data-t="tpl:${k}"><span class="g">${T.g}</span>${T.n}</button>`).join('');
  $$('#tools button, #tpls button').forEach(b => b.onclick = () => elegirHerramienta(b.dataset.t));
  $('#swatches').innerHTML = COLORES.map(c => `<button data-c="${c}" style="background:${c}"></button>`).join('');
  $$('#swatches button').forEach(b => b.onclick = () => {
    S.color = b.dataset.c;
    const a = activePane()?.selAnn(); if (a) { activePane().pushUndo(); a.color = S.color; marcarCambios(); }
    refrescar();
  });
  $('#grosor').oninput = e => {
    S.lw = +e.target.value;
    const a = activePane()?.selAnn(); if (a) { a.lw = S.lw; marcarCambios(); }
    S.panes.forEach(p => p.render());
  };
  $$('#segAct button').forEach(b => b.onclick = () => { S.act = b.dataset.v; rellenarFases(); actualizarLado(); });
  $$('#segLado button').forEach(b => b.onclick = () => {
    S.side = b.dataset.v;
    const a = activePane()?.selAnn(); if (a) { activePane().pushUndo(); a.side = S.side; marcarCambios(); }
    refrescar();
  });
  $('#selFase').onchange = e => {
    S.fase = e.target.value;
    const a = activePane()?.selAnn(); if (a) { a.fase = S.fase; a.act = S.act; marcarCambios(); }
    refrescar();
  };
  $('#chkGrid').onchange = e => { S.grid = e.target.checked; S.panes.forEach(p => p.render()); };
  $('#chkPose').onchange = e => { S.showPose = e.target.checked; S.panes.forEach(p => p.render()); };
  $('#selLabel').oninput = e => { const a = activePane()?.selAnn(); if (a) { a.label = e.target.value; marcarCambios(); actualizarLista(); activePane().render(); } };
  $('#selFijo').onchange = e => { const p = activePane(), a = p?.selAnn(); if (a) { p.pushUndo(); a.fixed = e.target.checked; if (!a.fixed) a.t = p.timeOf(p.frame()); marcarCambios(); refrescar(); } };
  $('#selDel').onclick = () => borrarSel();
  $('#selDup').onclick = () => {
    const p = activePane(), a = p?.selAnn(); if (!a) return;
    p.pushUndo();
    const b = JSON.parse(JSON.stringify(a)); b.id = uid(); b.t = p.timeOf(p.frame()); b.fixed = false; b.fase = S.fase;
    p.anns.push(b); S.sel = { pi: p.i, id: b.id }; marcarCambios(); refrescar(); toast('Copiada a este fotograma: ajusta los puntos');
  };
  $('#bUndo').onclick = () => activePane()?.doUndo();
  rellenarFases();
}
function rellenarFases() {
  const sel = $('#selFase'), fs = FASES[S.act];
  if (!fs.includes(S.fase)) S.fase = '—';
  sel.innerHTML = fs.map(f => `<option${f === S.fase ? ' selected' : ''}>${f}</option>`).join('');
}
function borrarSel() {
  const p = activePane(), a = p?.selAnn(); if (!a) return;
  p.pushUndo(); p.anns = p.anns.filter(x => x !== a); S.sel = null; marcarCambios(); refrescar();
}
function elegirHerramienta(t) {
  const p = activePane();
  if (p && p.draft) p.cancelDraft();
  S.tool = t;
  if (t !== 'move') {
    if (!p || !p.ready) toast('Primero abre un vídeo');
    else if (!t.startsWith('tpl:')) toast(`${TOOL[t].n}: ${TOOL[t].hints[0].toLowerCase()}`);
    if (window.matchMedia('(max-width:899px), (orientation:portrait) and (max-width:1100px)').matches) $('#side').classList.remove('open');
  }
  refrescar();
}
function actualizarLado() {
  $$('#tools button, #tpls button').forEach(b => b.classList.toggle('on', b.dataset.t === S.tool));
  const p = activePane(), a = p?.selAnn();
  if (a) { S.color = a.color; S.lw = a.lw || S.lw; S.side = a.side || S.side; if (a.act) S.act = a.act; if (a.fase) S.fase = a.fase; rellenarFases(); }
  $$('#swatches button').forEach(b => b.classList.toggle('on', b.dataset.c === S.color));
  $('#grosor').value = S.lw;
  $$('#segAct button').forEach(b => b.classList.toggle('on', b.dataset.v === S.act));
  $$('#segLado button').forEach(b => b.classList.toggle('on', b.dataset.v === S.side));
  $('#selFase').value = S.fase;
  $('#selSec').style.display = a ? '' : 'none';
  if (a) {
    if (document.activeElement !== $('#selLabel')) $('#selLabel').value = a.label || '';
    $('#selFijo').checked = !!a.fixed;
  }
  const k = p?.pxPerCm;
  $('#calibInfo').textContent = k ? `Calibrado: ${fmt(k, 2)} px/cm (válido en el plano del objeto)` : 'Sin calibrar (distancias en px). Usa 📏 Calibrar.';
}
function actualizarLista() {
  actualizarEventos();
  const p = activePane(), box = $('#mlist');
  if (!p) { box.innerHTML = ''; return; }
  const n = p.ready ? p.frame() : -1;
  const lista = [...p.anns].sort((a, b) => (a.fixed - b.fixed) || a.t - b.t);
  if (!lista.length) { box.innerHTML = '<div class="muted">Aún no hay mediciones. Elige una herramienta y toca sobre el vídeo.</div>'; return; }
  box.innerHTML = lista.map(a => {
    const ms = p.ready || !p.pending ? medir(a, p) : [];
    const f = p.frameOf(a.t);
    const meta = a.fixed ? 'Todo el vídeo' : `F ${f} · ${fmtT(a.t)}${a.fase && a.fase !== '—' ? ' · ' + a.fase : ''}${a.type === 'tpl' ? ' · ' + (a.side === 'I' ? 'Izdo' : 'Dcho') : ''}`;
    const vis = a.fixed || f === n;
    const sel = S.sel && S.sel.id === a.id;
    return `<div class="it${sel ? ' sel' : ''}" data-id="${a.id}" style="${vis ? '' : 'opacity:.6'}">
      <b>${esc(nombreAnn(a))}</b> <span class="meta">${esc(meta)}</span>
      ${ms.map(m => `<div><span class="meta">${esc(m.n)}:</span> <span class="v">${esc(m.txt)}</span>${puntoRango(rangoDeMedida(m, a))}</div>`).join('')}
    </div>`;
  }).join('');
  $$('.it', box).forEach(el => el.onclick = async () => {
    const a = p.getAnn(el.dataset.id); if (!a) return;
    S.sel = { pi: p.i, id: a.id };
    if (!a.fixed && p.ready) { p.pausar(); await p.seekTo(a.t); p.updateTL(); }
    refrescar();
  });
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function actualizarGuia() {
  const p = activePane(), g = $('#guide');
  const d = p?.draft;
  const tplSel = S.tool.startsWith('tpl:') && p?.ready;
  if (!d && !tplSel) { g.classList.remove('show'); return; }
  g.classList.add('show');
  let txt, sub = '';
  if (d && d.type === 'tpl' || (!d && tplSel)) {
    const k = d ? d.tpl : S.tool.slice(4), T = TEMPLATES[k], i = d ? Math.min(d.cur, T.lm.length - 1) : 0;
    txt = `Toca: ${T.lm[i].n}`;
    sub = `${T.n} · ${i + 1}/${T.lm.length} · Pierna ${S.side === 'I' ? 'izquierda' : 'derecha'}${S.fase !== '—' ? ' · ' + S.fase : ''}`;
    $('#gBack').style.display = $('#gSkip').style.display = '';
    $('#gCancel').style.display = d ? '' : 'none';
  } else {
    const t = TOOL[d.type]; txt = `Toca: ${t.hints[Math.min(d.pts.length, t.np - 1)]}`; sub = `${t.n} · ${d.pts.length + 1}/${t.np}`;
    $('#gBack').style.display = ''; $('#gSkip').style.display = 'none'; $('#gCancel').style.display = '';
  }
  $('#guideTxt').innerHTML = `${esc(txt)}<small>${esc(sub)}</small>`;
}
function guiaAtras() {
  const p = activePane(), d = p?.draft; if (!d) return;
  if (d.type === 'tpl') {
    let i = d.cur - 1; if (i < 0) { p.cancelDraft(); return; }
    d.pts[i] = undefined; d.cur = i;
  } else { d.pts.pop(); if (!d.pts.length) p.draft = null; }
  p.render(); actualizarGuia();
}
async function guiaOmitir() {
  const p = activePane(); if (!p || !p.ready) return;
  if (!p.draft) p.startTpl(S.tool.slice(4));
  const d = p.draft; if (d.type !== 'tpl') return;
  d.pts[d.cur] = null; p.advanceTpl();
  if (p.draftDone()) {
    if (d.pts.every(q => !q)) { p.cancelDraft(); return; }
    await p.commit();
  }
  p.render(); actualizarGuia();
}

/* ---------- transporte ---------- */
function paneDestino() { return S.dual && S.link !== null ? S.panes : [activePane()]; }
function actualizarTransporte() {
  const p = activePane();
  const jugando = p && p.ready && !p.video.paused && !p.video.ended;
  $('#tPlay').textContent = jugando ? '❚❚' : '▶︎';
  $('#tLoop').classList.toggle('on', S.loop);
  $('#tLink').style.display = S.dual ? '' : 'none';
  $('#tLink').classList.toggle('on', S.link !== null);
  $('#tA').classList.toggle('on', p?.A !== null && p?.A !== undefined);
  $('#tB').classList.toggle('on', p?.B !== null && p?.B !== undefined);
  $('#tIA').classList.toggle('on', !!p?.pose);
}
function seguirVinculado(origen) {
  if (S.link === null || !S.dual) return;
  const otro = S.panes[1 - origen.i]; if (!otro.ready) return;
  const t = origen.video.currentTime + (origen.i === 0 ? S.link : -S.link);
  otro.pausar();
  otro.video.currentTime = otro.timeOf(otro.frameOf(clamp(t, 0, otro.video.duration)));
  otro.updateTL(otro.frameOf(t));
}
function construirTransporte() {
  $('#tPlay').onclick = () => {
    const ps = paneDestino(), p = activePane(); if (!p?.ready) return;
    if (!p.video.paused) ps.forEach(x => x.pausar());
    else { if (S.link !== null) seguirVinculado(p); ps.forEach(x => x.play()); }
  };
  const paso = dn => () => { paneDestino().forEach(x => x.step(dn)); };
  $('#tP1').onclick = paso(-1); $('#tN1').onclick = paso(1); $('#tP5').onclick = paso(-5); $('#tN5').onclick = paso(5);
  $('#tSpeed').onchange = e => S.panes.forEach(p => { p.video.playbackRate = +e.target.value; });
  $('#tFit').onclick = () => activePane()?.fit();
  $('#tA').onclick = () => { const p = activePane(); if (!p?.ready) return; const n = p.frame(); p.A = p.A === n ? null : n; if (p.B !== null && p.A !== null && p.B < p.A) [p.A, p.B] = [p.B, p.A]; marcarCambios(); p.updateTL(); actualizarTransporte(); if (grafVisible()) dibujarGrafica(); };
  $('#tB').onclick = () => { const p = activePane(); if (!p?.ready) return; const n = p.frame(); p.B = p.B === n ? null : n; if (p.A !== null && p.B !== null && p.B < p.A) [p.A, p.B] = [p.B, p.A]; marcarCambios(); p.updateTL(); actualizarTransporte(); if (grafVisible()) dibujarGrafica(); };
  $('#tLoop').onclick = () => { S.loop = !S.loop; actualizarTransporte(); };
  $('#tLink').onclick = () => {
    if (S.link !== null) { S.link = null; toast('Vídeos desvinculados'); }
    else {
      const [a, b] = S.panes; if (!a.ready || !b.ready) { toast('Carga los dos vídeos'); return; }
      S.link = b.video.currentTime - a.video.currentTime;
      toast('Vinculados en este instante: avanzan juntos');
    }
    actualizarTransporte();
  };
  $('#sheetBtn').onclick = () => $('#side').classList.toggle('open');
  $('#sideClose').onclick = () => $('#side').classList.remove('open');
  $('#gBack').onclick = guiaAtras; $('#gSkip').onclick = guiaOmitir;
  $('#gCancel').onclick = () => activePane()?.cancelDraft();

  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select') || $('.modal.show')) return;
    if (e.key === ' ') { e.preventDefault(); $('#tPlay').click(); }
    else if (e.key === 'ArrowRight') paso(e.shiftKey ? 5 : 1)();
    else if (e.key === 'ArrowLeft') paso(e.shiftKey ? -5 : -1)();
    else if (e.key === 'Delete' || e.key === 'Backspace') borrarSel();
    else if (e.key === 'Escape') { activePane()?.cancelDraft(); elegirHerramienta('move'); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'z') activePane()?.doUndo();
  });
}
function modoDual(on) {
  S.dual = on;
  $('#bComparar').classList.toggle('on', on);
  $('#work').classList.toggle('dual', on);
  S.panes[1].el.style.display = on ? '' : 'none';
  if (!on) { S.link = null; setActive(0); }
  S.panes.forEach(p => p.el.classList.toggle('active', on && p.i === S.active));
  requestAnimationFrame(() => { S.panes.forEach(p => p.resize()); refrescar(); });
}

/* ---------- carga de archivos ---------- */
async function cargarVideoEn(pane, file) {
  if (!file) return;
  if (pane.anns.length && !pane.pending) {
    const ok = await confirmar('Cambiar vídeo', 'Este vídeo tiene mediciones. Si cargas otro se borrarán (guarda antes la sesión si las quieres).', 'Cargar y borrar');
    if (!ok) return;
    pane.anns = []; pane.undo = []; pane.pose = null; pane.events = []; pane.A = pane.B = null; S.sel = null;
  }
  try {
    toast('Abriendo vídeo…', 6000);
    await pane.loadFile(file);
    if (pane.pending) {
      const p = pane.pending;
      if (p.fps) pane.fps = p.fps;
      pane.range.max = pane.nFrames() - 1;
      if (p.name && p.name !== pane.videoName) toast(`Ojo: la sesión era de «${p.name}» y has abierto «${pane.videoName}»`, 5000);
      else if (p.dur && Math.abs(p.dur - pane.video.duration) > 0.3) toast('Ojo: la duración no coincide con el vídeo de la sesión', 5000);
      else toast(`Vídeo listo · ${pane.fps} fps`);
      pane.pending = null;
    } else { toast(`Vídeo listo · ${pane.fps} fps detectados (cámbialo en ⚙︎ si no es correcto)`, 4000); marcarCambios(); }
    pane._mk = null; pane.updateTag(); pane.updateTL(); refrescar();
  } catch (e) {
    console.warn(e);
    pane.unload();
    toast('', 1);
    const nombre = file.name || 'el vídeo', ext = (nombre.split('.').pop() || '').toLowerCase();
    const hevc = !document.createElement('video').canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"');
    let msg;
    if (e.codigo === 'sinimagen' || e.codigo === 4 || e.codigo === 3 || e.codigo === 'formato') {
      msg = `Este navegador no puede descodificar «${nombre}».` +
        (hevc ? ' Casi seguro está grabado en HEVC (el formato por defecto del iPhone/iPad), que este equipo no sabe leer.' : '') +
        '\n\nSoluciones:\n' +
        '• En el iPhone/iPad: Ajustes → Cámara → Formatos → «Más compatible». Los vídeos nuevos se abrirán en cualquier sitio.\n' +
        '• Para los que ya tienes: compártelos desde la app Fotos con «Opciones → Más compatible», o pásalos por AirDrop/correo, que suele convertirlos a H.264.\n' +
        '• En Windows con Edge: instala «Extensiones de vídeo HEVC» desde Microsoft Store y reinicia Edge.\n' +
        '• Los vídeos MP4 de móviles Android normalmente se abren sin problema.';
    } else if (e.codigo === 'tiempo') {
      msg = `«${nombre}» tarda demasiado en abrirse. Si está en OneDrive/iCloud, descárgalo antes al equipo («Mantener siempre en este dispositivo») y vuelve a intentarlo.`;
    } else {
      msg = `No se pudo abrir «${nombre}» (${e.message || e}). Prueba con otro vídeo o expórtalo como MP4 (H.264).`;
    }
    preguntar('No se puede abrir el vídeo', msg, '', { input: false, ok: 'Entendido' });
  }
}
function abrirAjustesPane(pane) {
  setActive(pane.i);
  const m = $('#mPane');
  $('#pnFps').value = String(pane.fps);
  $('#pnMirror').checked = pane.mirror;
  $('#pnFpsReal').value = pane.fpsReal ? String(pane.fpsReal) : '';
  $('#pnFpsReal').onchange = () => { pane.fpsReal = +$('#pnFpsReal').value || null; pane.updateTag(); marcarCambios(); };
  $('#pnInfo').textContent = pane.ready ? `${pane.videoName} · ${pane.vw}×${pane.vh} px · ${fmt(pane.video.duration, 2)} s · ${pane.nFrames()} fotogramas` : 'Sin vídeo';
  m.classList.add('show');
  $('#pnFps').onchange = () => { const t = pane.video.currentTime; pane.fps = +$('#pnFps').value; pane.range.max = pane.nFrames() - 1; pane.video.currentTime = pane.timeOf(pane.frameOf(t)); pane._mk = null; pane.updateTag(); pane.updateTL(); marcarCambios(); };
  $('#pnMirror').onchange = () => { pane.mirror = $('#pnMirror').checked; pane.updateTag(); pane.fit(); };
  $('#pnClose').onclick = () => m.classList.remove('show');
  $('#pnQuitar').onclick = async () => {
    m.classList.remove('show');
    if (await confirmar('Quitar vídeo', 'Se quita el vídeo y sus mediciones de esta pantalla (no se borra nada guardado).', 'Quitar')) {
      pane.anns = []; pane.undo = []; pane.pose = null; pane.events = []; pane.A = pane.B = null; pane.pending = null; S.sel = null;
      pane.unload(); refrescar();
    }
  };
}

/* ============================================================
   GRÁFICA DE CINEMÁTICA (IA)
   ============================================================ */
const grafVisible = () => $('#graph').classList.contains('show');
function mostrarGrafica(on) {
  $('#graph').classList.toggle('show', on);
  requestAnimationFrame(() => { S.panes.forEach(p => p.resize()); if (on) dibujarGrafica(); });
}
function seriesPose(pane, metric) {
  const out = { D: [], I: [] };
  if (!pane.pose) return out;
  const frames = Object.keys(pane.pose.frames).map(Number).sort((a, b) => a - b);
  for (const side of ['D', 'I']) for (const n of frames) {
    const m = poseMeasures(pane.pose.frames[n], pane.pose.view, side, pane.pose.dir, px => pane.dist(px)).find(x => x.k === metric);
    if (m) out[side].push([n, m.v]);
  }
  if ($('#gSmooth').checked) for (const s of ['D', 'I']) {
    const a = out[s];
    out[s] = a.map(([n, v], i) => {
      let sum = 0, c = 0;
      for (let j = i - 1; j <= i + 1; j++) if (a[j] && Math.abs(a[j][0] - n) <= 2 * (pane.pose.step || 1)) { sum += a[j][1]; c++; }
      return [n, sum / c];
    });
  }
  return out;
}
function prepararGrafica() {
  const p = activePane(); if (!p?.pose) return;
  const sel = $('#gMetric'), mets = POSE_METRICS[p.pose.view];
  const prev = sel.value;
  sel.innerHTML = mets.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
  if (mets.some(m => m[0] === prev)) sel.value = prev;
}
function dibujarGrafica() {
  const p = activePane(), cv = $('#gCanvas'), d = DPR();
  const r = cv.getBoundingClientRect();
  cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0F2744'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!p?.pose) { $('#gInfo').textContent = 'Sin datos de IA en este vídeo'; return; }
  if (!$('#gMetric').options.length) prepararGrafica();
  const ser = seriesPose(p, $('#gMetric').value);
  const all = [...ser.D, ...ser.I];
  if (!all.length) { $('#gInfo').textContent = 'No se detectaron puntos suficientes'; return; }
  const n0 = Math.min(...all.map(x => x[0])), n1 = Math.max(...all.map(x => x[0]));
  let y0 = Math.min(...all.map(x => x[1])), y1 = Math.max(...all.map(x => x[1]));
  const padY = Math.max(3, (y1 - y0) * 0.12); y0 -= padY; y1 += padY;
  const L = 40 * d, R = 8 * d, Tp = 8 * d, B = 16 * d, W = cv.width - L - R, H = cv.height - Tp - B;
  const X = n => L + (n - n0) / ((n1 - n0) || 1) * W, Y = v => Tp + (1 - (v - y0) / ((y1 - y0) || 1)) * H;
  cv._map = { n0, n1, L, W, d };
  ctx.font = `${10 * d}px -apple-system, sans-serif`; ctx.fillStyle = '#9FB2C8'; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
  const stepY = [1, 2, 5, 10, 20, 30, 45].find(s => (y1 - y0) / s <= 6) || 60;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  for (let v = Math.ceil(y0 / stepY) * stepY; v <= y1; v += stepY) { ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(L + W, Y(v)); ctx.stroke(); ctx.fillText(`${v}°`, L - 4 * d, Y(v)); }
  if (y0 < 0 && y1 > 0) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(L + W, Y(0)); ctx.stroke(); }
  // tramo A–B
  if (p.A !== null && p.B !== null) { ctx.fillStyle = 'rgba(200,168,75,.12)'; ctx.fillRect(X(p.A), Tp, X(p.B) - X(p.A), H); }
  // marcas de mediciones
  ctx.fillStyle = 'rgba(127,211,255,.6)';
  new Set(p.anns.filter(a => !a.fixed).map(a => p.frameOf(a.t))).forEach(f => { if (f >= n0 && f <= n1) ctx.fillRect(X(f) - d, Tp, 2 * d, 6 * d); });
  const col = { D: '#FF8A65', I: '#4FC3F7' };
  for (const s of ['D', 'I']) {
    const a = ser[s]; if (!a.length) continue;
    ctx.strokeStyle = col[s]; ctx.lineWidth = 2 * d; ctx.beginPath();
    let prevN = null;
    a.forEach(([n, v]) => { if (prevN === null || n - prevN > 3 * (p.pose.step || 1)) ctx.moveTo(X(n), Y(v)); else ctx.lineTo(X(n), Y(v)); prevN = n; });
    ctx.stroke();
  }
  // eventos de la zancada: ▼ contacto arriba, ▲ despegue abajo
  for (const e of p.events) {
    const f = p.frameOf(e.t); if (f < n0 || f > n1) continue;
    const x = X(f), z = 5 * d; ctx.fillStyle = col[e.side];
    ctx.beginPath();
    if (e.type === 'IC') { ctx.moveTo(x - z, Tp); ctx.lineTo(x + z, Tp); ctx.lineTo(x, Tp + z * 1.6); }
    else { ctx.moveTo(x - z, Tp + H); ctx.lineTo(x + z, Tp + H); ctx.lineTo(x, Tp + H - z * 1.6); }
    ctx.fill();
  }
  // cursor
  const n = p.frame();
  ctx.strokeStyle = '#C8A84B'; ctx.lineWidth = 2 * d; ctx.beginPath(); ctx.moveTo(X(n), Tp); ctx.lineTo(X(n), Tp + H); ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#9FB2C8';
  ctx.fillText(`F ${n0}`, L, Tp + H + 9 * d); ctx.textAlign = 'right'; ctx.fillText(`F ${n1}`, L + W, Tp + H + 9 * d);
  const val = s => { const q = ser[s].reduce((b, x) => Math.abs(x[0] - n) < Math.abs(b[0] - n) ? x : b, [1e9, 0]); return Math.abs(q[0] - n) <= (p.pose.step || 1) ? `${fmt(q[1])}°` : '—'; };
  const mx = s => ser[s].length ? `${fmt(Math.max(...ser[s].map(x => x[1])))}°/${fmt(Math.min(...ser[s].map(x => x[1])))}°` : '—';
  $('#gInfo').innerHTML = `<span style="color:${col.D}">● Dcho ${val('D')}</span> · <span style="color:${col.I}">● Izdo ${val('I')}</span> · máx/mín D ${mx('D')} · I ${mx('I')}`;
}
function construirGrafica() {
  $('#gMetric').onchange = dibujarGrafica; $('#gSmooth').onchange = dibujarGrafica;
  $('#gClose').onclick = () => mostrarGrafica(false);
  const cv = $('#gCanvas');
  const ir = e => {
    const m = cv._map, p = activePane(); if (!m || !p?.ready) return;
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) * m.d;
    const n = Math.round(m.n0 + clamp((x - m.L) / m.W, 0, 1) * (m.n1 - m.n0));
    p.pausar(); p.video.currentTime = p.timeOf(n); p.updateTL(n);
    if (S.link !== null) seguirVinculado(p);
  };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ir(e); });
  cv.addEventListener('pointermove', e => { if (e.buttons || e.pressure > 0) ir(e); });
  $('#gToTpl').onclick = () => {
    const p = activePane(); if (!p?.pose || !p.ready) return;
    const lm = poseEn(p, p.frame());
    if (!lm) { toast('No hay esqueleto en este fotograma'); return; }
    const k = p.pose.view, T = TEMPLATES[k], P = T.fromPose(lm, S.side);
    p.draft = { type: 'tpl', tpl: k, pts: T.lm.map(l => P[l.k] ? { ...P[l.k] } : undefined), cur: 0 };
    p.advanceTpl();
    S.tool = 'tpl:' + k;
    if (p.draftDone()) { p.commit(); toast('Plantilla creada desde la IA: revisa y arrastra los puntos'); }
    else toast('Puntos de la IA colocados. Marca a mano los que faltan (la IA no ve el calcáneo).', 4500);
    refrescar();
  };
}

/* ============================================================
   DETECCIÓN AUTOMÁTICA
   ============================================================ */
let iaCancelar = false, iaCorriendo = false;
function abrirIA() {
  const p = activePane();
  if (!p?.ready) { toast('Primero abre un vídeo'); return; }
  $('#iaMsg').textContent = p.pose ? `Este vídeo ya tiene ${Object.keys(p.pose.frames).length} fotogramas analizados (vista ${p.pose.view}).` : '';
  $('#iaProg').style.width = '0';
  $('#iaTramo').value = p.A !== null && p.B !== null ? 'ab' : 'todo';
  $('#iaBorrar').style.display = p.pose ? '' : 'none';
  $('#mIA').classList.add('show');
}
async function correrIA() {
  const p = activePane(); if (!p?.ready || iaCorriendo) return;
  const vista = $('#iaVista').value, paso = +$('#iaPaso').value;
  let a = 0, b = p.nFrames() - 1;
  if ($('#iaTramo').value === 'ab') {
    if (p.A === null || p.B === null) { $('#iaMsg').textContent = 'Marca antes el tramo con A y B (o elige «Vídeo entero»).'; return; }
    a = Math.min(p.A, p.B); b = Math.max(p.A, p.B);
  }
  const total = Math.floor((b - a) / paso) + 1;
  if (total > 900 && !(await confirmar('Tramo largo', `Son ${total} fotogramas: puede tardar varios minutos. Mejor marca un tramo A–B de 2–3 zancadas. ¿Seguir?`, 'Seguir'))) return;
  const roi = $('#iaRoi').checked && p.userZoom ? p.visibleRect() : { x: 0, y: 0, w: p.vw, h: p.vh };
  if (roi.w < 32 || roi.h < 32) { $('#iaMsg').textContent = 'La zona visible es demasiado pequeña.'; return; }
  iaCorriendo = true; iaCancelar = false;
  $('#iaGo').disabled = true; $('#iaCancel').textContent = 'Detener';
  const msg = t => { $('#iaMsg').textContent = t; };
  let det;
  try {
    msg('Cargando el modelo de IA… (la primera vez descarga ~20 MB)');
    const mod = await import('./pose.js');
    det = await mod.crearDetector();
  } catch (e) {
    console.warn(e);
    msg('No se pudo cargar la IA. Comprueba la conexión la primera vez que la uses. ' + (e.message || ''));
    iaCorriendo = false; $('#iaGo').disabled = false; $('#iaCancel').textContent = 'Cerrar';
    return;
  }
  const sc = Math.min(1, 1280 / Math.max(roi.w, roi.h));
  const off = document.createElement('canvas');
  off.width = Math.round(roi.w * sc); off.height = Math.round(roi.h * sc);
  const octx = off.getContext('2d', { willReadFrequently: false });
  const pose = { view: vista, step: paso, frames: {}, dir: 1, a, b };
  const prevPose = p.pose;
  p.pose = pose;
  p.pausar();
  let ts = 1, hechos = 0, detectados = 0;
  const t0 = performance.now();
  try {
    for (let n = a; n <= b; n += paso) {
      if (iaCancelar) break;
      await p.seekFrame(n, true);
      octx.drawImage(p.video, roi.x, roi.y, roi.w, roi.h, 0, 0, off.width, off.height);
      const r = det.detectForVideo(off, ts); ts += Math.max(1, Math.round(1000 / p.fps * paso));
      const L = r && r.landmarks && r.landmarks[0];
      if (L) {
        const arr = new Array(99);
        L.forEach((l, i) => { arr[i * 3] = roi.x + l.x * roi.w; arr[i * 3 + 1] = roi.y + l.y * roi.h; arr[i * 3 + 2] = l.visibility ?? 1; });
        pose.frames[n] = arr; detectados++;
      }
      hechos++;
      $('#iaProg').style.width = (hechos / total * 100) + '%';
      if (hechos % 4 === 0 || hechos === total) {
        const el = (performance.now() - t0) / 1000, rest = el / hechos * (total - hechos);
        msg(`Analizando ${hechos}/${total} · persona detectada en ${detectados} · quedan ~${Math.ceil(rest)} s`);
        p.render(); p.updateTL(n);
      }
    }
  } catch (e) { console.warn(e); msg('Error durante el análisis: ' + (e.message || e)); }
  try { det.close(); } catch (_) {}
  // Dirección de la marcha: hacia donde apuntan los pies.
  let sdir = 0;
  for (const lm of Object.values(pose.frames)) for (const s of ['D', 'I']) { const h = lmPt(lm, LM.talon, s), t = lmPt(lm, LM.dedo, s); if (h && t) sdir += Math.sign(t.x - h.x); }
  pose.dir = sdir >= 0 ? 1 : -1;
  iaCorriendo = false; $('#iaGo').disabled = false; $('#iaCancel').textContent = 'Cerrar';
  if (!detectados) { p.pose = prevPose; msg('No se detectó a la persona. Haz zoom sobre el paciente y activa «Analizar solo la zona visible».'); p.render(); return; }
  marcarCambios();
  msg(`Listo: ${detectados} de ${hechos} fotogramas con persona detectada.`);
  $('#mIA').classList.remove('show');
  await p.seekFrame(a); p.updateTL();
  $('#gMetric').innerHTML = ''; prepararGrafica(); mostrarGrafica(true); refrescar();
  toast('Análisis listo. Toca la gráfica para ir a un fotograma; «➜ Plantilla» lo convierte en medición editable.', 5000);
}

/* ============================================================
   EVENTOS DE LA ZANCADA · ESPACIO-TEMPORALES · FASES · RANGOS
   Eventos guardados como {type:'IC'|'TO', side:'D'|'I', t, auto?}.
   ============================================================ */
const EV_N = { IC: 'Contacto', TO: 'Despegue' };
const ladoN = s => s === 'D' ? 'Dcho' : 'Izdo';
const framesEv = (p, side, type) => p.events.filter(e => e.side === side && e.type === type).map(e => p.frameOf(e.t)).sort((a, b) => a - b);

function toggleEvento(type, side) {
  const p = activePane(); if (!p?.ready) { toast('Primero abre un vídeo'); return; }
  const n = p.frame();
  const i = p.events.findIndex(e => e.type === type && e.side === side && p.frameOf(e.t) === n);
  if (i >= 0) { p.events.splice(i, 1); toast(`${EV_N[type]} ${ladoN(side)} quitado de F ${n}`); }
  else { p.events.push({ type, side, t: p.timeOf(n) }); toast(`${EV_N[type]} ${ladoN(side)} en F ${n}`); }
  p._mk = null; marcarCambios(); p.updateTL(); actualizarEventos(); if (grafVisible()) dibujarGrafica();
}
function actualizarEventos() {
  const p = activePane(), info = $('#evInfo'); if (!p || !info) return;
  const c = (s, t) => p.events.filter(e => e.side === s && e.type === t).length;
  const n = p.ready ? p.frame() : -1;
  const aqui = p.events.filter(e => p.frameOf(e.t) === n);
  $$('[data-ev]').forEach(b => { const [t, sd] = b.dataset.ev.split(':'); b.classList.toggle('on', aqui.some(e => e.type === t && e.side === sd)); });
  info.textContent = p.events.length
    ? `Dcho: ${c('D', 'IC')} contactos · ${c('D', 'TO')} despegues — Izdo: ${c('I', 'IC')} · ${c('I', 'TO')}` +
      (aqui.length ? ` — aquí: ${aqui.map(e => `${EV_N[e.type]} ${ladoN(e.side)}${e.auto ? ' (auto)' : ''}`).join(', ')}` : '')
    : 'Sin eventos. Márcalos en su fotograma o usa 🤖 Auto tras analizar con IA en vista sagital.';
}
function irEvento(dir) {
  const p = activePane(); if (!p?.ready || !p.events.length) return;
  const n = p.frame();
  const fs = [...new Set(p.events.map(e => p.frameOf(e.t)))].sort((a, b) => a - b);
  const f = dir > 0 ? fs.find(x => x > n) : [...fs].reverse().find(x => x < n);
  if (f === undefined) { toast(dir > 0 ? 'No hay más eventos' : 'No hay eventos anteriores'); return; }
  p.pausar(); p.video.currentTime = p.timeOf(f); p.updateTL(f);
  if (S.link !== null) seguirVinculado(p);
}

/* Detección automática (Zeni et al., 2008): contacto inicial = talón en su punto más
   adelantado respecto a la pelvis; despegue = dedos en su punto más atrasado.
   Funciona en cinta y en suelo porque es relativo a la pelvis. Necesita vista sagital. */
function suavizar(a, h) {
  if (!h) return a.slice();
  return a.map((_, i) => { let sm = 0, c = 0; for (let j = i - h; j <= i + h; j++) if (j >= 0 && j < a.length && isFinite(a[j])) { sm += a[j]; c++; } return c ? sm / c : NaN; });
}
function picos(a, W, signo) {
  const v = a.map(x => x * signo), fin = v.filter(isFinite);
  if (fin.length < 5) return [];
  const rango = Math.max(...fin) - Math.min(...fin), res = [];
  for (let i = 0; i < v.length; i++) {
    if (!isFinite(v[i]) || i < W / 2 || i > v.length - 1 - W / 2) continue;   // bordes del tramo: dudosos
    let esMax = true, lo = Infinity;
    for (let j = i - W; j <= i + W; j++) {
      if (j < 0 || j >= v.length || j === i || !isFinite(v[j])) continue;
      if (v[j] > v[i] || (v[j] === v[i] && j < i)) { esMax = false; break; }
      lo = Math.min(lo, v[j]);
    }
    if (esMax && v[i] - lo >= 0.25 * rango) res.push(i);
  }
  return res;
}
function detectarEventos(p) {
  const pose = p.pose;
  if (!pose) return { error: 'Primero analiza el vídeo con 🤖 IA en vista sagital (lateral).' };
  if (pose.view !== 'sagital') return { error: 'La detección automática necesita la vista sagital (lateral). En vista frontal o posterior marca los eventos a mano con los botones.' };
  const ns = Object.keys(pose.frames).map(Number).sort((a, b) => a - b);
  if (ns.length < 12) return { error: 'Hay muy pocos fotogramas analizados. Analiza al menos 2 zancadas.' };
  const step = pose.step || 1, dir = pose.dir || 1, fr = p.fpsT;
  const W = Math.max(2, Math.round(0.25 * fr / step));          // ventana de ±0,25 s
  const h = Math.max(0, Math.round(0.012 * fr / step));         // suavizado ~±12 ms
  const out = [];
  for (const side of ['D', 'I']) {
    const heel = [], toe = [];
    for (const n of ns) {
      const lm = pose.frames[n], hL = lmAny(lm, 23), hR = lmAny(lm, 24);
      const hip = hL && hR ? mid(hL, hR) : (hL || hR);
      const he = lmPt(lm, LM.talon, side), to = lmPt(lm, LM.dedo, side);
      heel.push(hip && he ? (he.x - hip.x) * dir : NaN);
      toe.push(hip && to ? (to.x - hip.x) * dir : NaN);
    }
    for (const i of picos(suavizar(heel, h), W, +1)) out.push({ type: 'IC', side, t: p.timeOf(ns[i]), auto: true });
    for (const i of picos(suavizar(toe, h), W, -1)) out.push({ type: 'TO', side, t: p.timeOf(ns[i]), auto: true });
  }
  return { events: out };
}
async function autoEventos() {
  const p = activePane(); if (!p?.ready) { toast('Primero abre un vídeo'); return; }
  const r = detectarEventos(p);
  if (r.error) { preguntar('Detección automática', r.error, '', { input: false, ok: 'Entendido' }); return; }
  if (!r.events.length) { toast('No se encontraron zancadas claras en el tramo analizado', 4000); return; }
  if (p.events.length && !(await confirmar('Sustituir eventos', `Se han detectado ${r.events.length} eventos. ¿Sustituyen a los ${p.events.length} actuales?`, 'Sustituir'))) return;
  p.events = r.events; p._mk = null; marcarCambios(); p.updateTL(); actualizarEventos(); if (grafVisible()) dibujarGrafica();
  toast(`${r.events.length} eventos detectados. Revísalos con ⏮ ⏭ y corrige los que no cuadren.`, 5000);
}

/* ---------- parámetros espacio-temporales ---------- */
const estad = arr => {
  const a = arr.filter(isFinite); if (!a.length) return null;
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  const sd = a.length > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)) : 0;
  return { m, sd, n: a.length };
};
function espacioTemporal(p) {
  const fr = p.fpsT, ms = f => f / fr * 1000, res = {}, pasos = [];
  for (const s of ['D', 'I']) {
    const o = s === 'D' ? 'I' : 'D';
    const ic = framesEv(p, s, 'IC'), to = framesEv(p, s, 'TO'), icO = framesEv(p, o, 'IC'), toO = framesEv(p, o, 'TO');
    const gct = [], zan = [], osc = [], duty = [], paso = [], vuelo = [], doble = [];
    ic.forEach((f, i) => {
      const sig = ic[i + 1], lim = sig ?? f + 2.5 * fr;
      const t = to.find(x => x > f && x < lim);
      if (t !== undefined) gct.push(ms(t - f));
      if (sig !== undefined && sig - f < 2.5 * fr) { zan.push(ms(sig - f)); if (t !== undefined) { osc.push(ms(sig - t)); duty.push((t - f) / (sig - f) * 100); } }
      const prevO = [...icO].reverse().find(x => x < f);
      if (prevO !== undefined && f - prevO < 1.5 * fr) paso.push(ms(f - prevO));
      const prevTO = [...toO].reverse().find(x => x < f);
      if (prevTO !== undefined && (prevO === undefined || prevTO > prevO) && f - prevTO < fr) vuelo.push(ms(f - prevTO));
      const nextTO = toO.find(x => x > f);
      if (nextTO !== undefined && (t === undefined || nextTO < t) && nextTO - f < fr) doble.push(ms(nextTO - f));
    });
    res[s] = { gct: estad(gct), zan: estad(zan), osc: estad(osc), duty: estad(duty), paso: estad(paso), vuelo: estad(vuelo), doble: estad(doble) };
    pasos.push(...paso);
  }
  const P = estad(pasos);
  let cad = P ? 60000 / P.m : null;
  if (!cad) { const z = [res.D.zan, res.I.zan].filter(Boolean); if (z.length) cad = 120000 / (z.reduce((a, b) => a + b.m, 0) / z.length); }
  return { res, cadencia: cad, fr };
}

/* ---------- ángulos por fases (IA + eventos) ---------- */
const ETQ = {
  tronco: 'Tronco (° · + adelante)', cadera: 'Cadera (° · + flexión)', rodilla: 'Rodilla (° · + flexión)', tobillo: 'Tobillo (° · + dorsiflexión)',
  tibia: 'Tibia (° · + rodilla delante del tobillo)', pie: 'Pie-suelo (° · + talón primero)', overstride: 'Talón delante de la cadera',
  fppa: 'Rodilla frontal FPPA (° · + valgo)', caida: 'Caída pélvica contralateral (°)', aduccion: 'Aducción de cadera (°)', retropie: 'Retropié (° · + eversión)',
  calcvert: 'Calcáneo-vertical (° · + eversión)', pierna: 'Pierna-vertical (° · + valgo)', progresion: 'Progresión del pie (° · + abducción)',
};
const FASE_N = { IC: 'Contacto inicial', MS: 'Apoyo medio', TO: 'Despegue', pico: 'Picos durante el apoyo', osc: 'Oscilación', '*': 'Cualquier momento' };
function faseCodigo(f) {
  if (!f) return null;
  if (f.startsWith('Contacto')) return 'IC';
  if (f.startsWith('Apoyo medio')) return 'MS';
  if (f === 'Despegue' || f === 'Preoscilación') return 'TO';
  return null;
}
// Pelvis: se expresa como caída del lado contralateral al apoyo (+ = cae el lado libre).
function claveYValor(k, v, side) { return k === 'pelvis' ? { k: 'caida', v: side === 'D' ? v : -v } : { k, v }; }

function fasesPose(p) {
  const pose = p.pose, view = pose.view, distFn = px => p.dist(px);
  const ns = Object.keys(pose.frames).map(Number).sort((a, b) => a - b);
  const valor = (n, side, k) => {
    const lm = poseEn(p, n); if (!lm) return NaN;
    const want = k === 'caida' ? 'pelvis' : k;
    const m = poseMeasures(lm, view, side, pose.dir, distFn).find(x => x.k === want);
    return m ? claveYValor(m.k, m.v, side).v : NaN;
  };
  const unidad = k => k === 'overstride' ? (p.pxPerCm ? 'cm' : 'px') : '°';
  const sag = view === 'sagital', carrera = S.act === 'carrera';
  const FILAS = sag ? [
    ['IC', 'tronco'], ['IC', 'cadera'], ['IC', 'rodilla'], ['IC', 'tobillo'], ['IC', 'tibia'], ['IC', 'pie'], ['IC', 'overstride'],
    ['MS', 'cadera'], ['MS', 'rodilla'], ['MS', 'tobillo'],
    ['TO', 'cadera'], ['TO', 'rodilla'], ['TO', 'tobillo'],
    ['pico', 'rodilla', 'max', 'Flexión máx. de rodilla'], ['pico', 'tobillo', 'max', 'Dorsiflexión máx. de tobillo'], ['pico', 'cadera', 'min', 'Extensión máx. de cadera (mín. del ángulo)'],
    ['osc', 'rodilla', 'max', 'Flexión máx. de rodilla en oscilación'],
  ] : [
    ['IC', 'fppa'], ['IC', 'caida'], ['MS', 'fppa'], ['MS', 'caida'], ['TO', 'fppa'],
    ['pico', 'fppa', 'max', 'Valgo máx. de rodilla (FPPA)'], ['pico', 'caida', 'max', 'Caída pélvica contralateral máx.'],
    ...(view === 'posterior' ? [['pico', 'aduccion', 'max', 'Aducción máx. de cadera']] : []),
  ];
  const acum = {}; FILAS.forEach((_, i) => { acum[i] = { D: [], I: [] }; });
  let ciclos = 0;
  for (const side of ['D', 'I']) {
    const ic = framesEv(p, side, 'IC'), to = framesEv(p, side, 'TO');
    ic.forEach((f, i) => {
      const sig = ic[i + 1], t = to.find(x => x > f && (sig === undefined || x < sig));
      if (t === undefined || t - f > 2 * p.fpsT) return;
      ciclos++;
      const enApoyo = ns.filter(n => n >= f && n <= t);
      const enOsc = sig !== undefined ? ns.filter(n => n > t && n < sig) : [];
      // Apoyo medio: en carrera sagital, el fotograma de máxima flexión de rodilla; si no, la mitad del apoyo.
      let msF = Math.round((f + t) / 2);
      if (sag && carrera && enApoyo.length) msF = enApoyo.reduce((b, n) => (valor(n, side, 'rodilla') > valor(b, side, 'rodilla') ? n : b), enApoyo[0]);
      FILAS.forEach(([fase, k, modo], idx) => {
        let v = NaN;
        if (fase === 'IC') v = valor(f, side, k);
        else if (fase === 'TO') v = valor(t, side, k);
        else if (fase === 'MS') v = valor(msF, side, k);
        else {
          const vals = (fase === 'osc' ? enOsc : enApoyo).map(n => valor(n, side, k)).filter(isFinite);
          if (vals.length) v = modo === 'min' ? Math.min(...vals) : Math.max(...vals);
        }
        acum[idx][side].push(v);
      });
    });
  }
  const filas = FILAS.map(([fase, k, , n], i) => ({ fase, k, n: n || ETQ[k] || k, u: unidad(k), D: estad(acum[i].D), I: estad(acum[i].I) }))
    .filter(f => f.D || f.I);
  return { filas, ciclos, view };
}
// Mediciones manuales (plantillas) agrupadas por fase y lado.
function fasesManual(p) {
  const grupos = new Map();
  for (const a of p.anns) {
    if (a.fixed || a.type !== 'tpl') continue;
    const fase = a.fase && a.fase !== '—' ? a.fase : 'Sin fase';
    for (const m of medir(a, p)) {
      const kv = claveYValor(m.k, m.v, a.side);
      const id = fase + '|' + kv.k;
      if (!grupos.has(id)) grupos.set(id, { faseTxt: fase, fase: faseCodigo(fase), k: kv.k, n: ETQ[kv.k] || m.n, u: m.u, D: [], I: [], act: a.act });
      grupos.get(id)[a.side === 'I' ? 'I' : 'D'].push(kv.v);
    }
  }
  return [...grupos.values()].map(g => ({ ...g, D: estad(g.D), I: estad(g.I) }));
}

/* ---------- rangos de referencia (semáforo) ---------- */
const RANGOS_DEF = [
  { id: 'c-cad', act: 'carrera', k: 'cadencia', f: '*', n: 'Cadencia', u: 'ppm', v: [170, 200], a: [160, 210] },
  { id: 'c-asim', act: 'carrera', k: 'asim', f: '*', n: 'Asimetría temporal', u: '%', v: [0, 5], a: [0, 10] },
  { id: 'c-tronco', act: 'carrera', k: 'tronco', f: '*', n: 'Inclinación del tronco', u: '°', v: [3, 15], a: [0, 20] },
  { id: 'c-tibia-ic', act: 'carrera', k: 'tibia', f: 'IC', n: 'Inclinación de la tibia', u: '°', v: [-6, 4], a: [-10, 8] },
  { id: 'c-over-ic', act: 'carrera', k: 'overstride', f: 'IC', n: 'Talón delante de la cadera', u: 'cm', v: [-5, 12], a: [-10, 20] },
  { id: 'c-rod-ic', act: 'carrera', k: 'rodilla', f: 'IC', n: 'Flexión de rodilla', u: '°', v: [10, 25], a: [5, 30] },
  { id: 'c-rod-ms', act: 'carrera', k: 'rodilla', f: 'MS', n: 'Flexión de rodilla', u: '°', v: [38, 50], a: [32, 55] },
  { id: 'c-rod-pico', act: 'carrera', k: 'rodilla', f: 'pico', n: 'Flexión máx. de rodilla en apoyo', u: '°', v: [38, 50], a: [32, 55] },
  { id: 'c-fppa', act: 'carrera', k: 'fppa', f: '*', n: 'Valgo dinámico (FPPA)', u: '°', v: [-5, 8], a: [-8, 12] },
  { id: 'c-caida', act: 'carrera', k: 'caida', f: '*', n: 'Caída pélvica contralateral', u: '°', v: [-2, 5], a: [-4, 8] },
  { id: 'c-add', act: 'carrera', k: 'aduccion', f: '*', n: 'Aducción de cadera', u: '°', v: [-5, 10], a: [-8, 14] },
  { id: 'c-retro', act: 'carrera', k: 'retropie', f: '*', n: 'Retropié (+ eversión)', u: '°', v: [-2, 10], a: [-5, 15] },
  { id: 'm-cad', act: 'marcha', k: 'cadencia', f: '*', n: 'Cadencia', u: 'ppm', v: [100, 125], a: [90, 135] },
  { id: 'm-asim', act: 'marcha', k: 'asim', f: '*', n: 'Asimetría temporal', u: '%', v: [0, 5], a: [0, 10] },
  { id: 'm-tronco', act: 'marcha', k: 'tronco', f: '*', n: 'Inclinación del tronco', u: '°', v: [-3, 6], a: [-6, 10] },
  { id: 'm-rod-ic', act: 'marcha', k: 'rodilla', f: 'IC', n: 'Flexión de rodilla', u: '°', v: [-2, 8], a: [-5, 12] },
  { id: 'm-rod-ms', act: 'marcha', k: 'rodilla', f: 'MS', n: 'Flexión de rodilla', u: '°', v: [0, 15], a: [-5, 20] },
  { id: 'm-tob-pico', act: 'marcha', k: 'tobillo', f: 'pico', n: 'Dorsiflexión máx. en apoyo', u: '°', v: [5, 15], a: [2, 20] },
  { id: 'm-fppa', act: 'marcha', k: 'fppa', f: '*', n: 'Valgo dinámico (FPPA)', u: '°', v: [-5, 6], a: [-8, 10] },
  { id: 'm-caida', act: 'marcha', k: 'caida', f: '*', n: 'Caída pélvica contralateral', u: '°', v: [-2, 4], a: [-4, 7] },
  { id: 'm-retro', act: 'marcha', k: 'retropie', f: '*', n: 'Retropié (+ eversión)', u: '°', v: [-2, 8], a: [-5, 12] },
];
const KEY_RANGOS = 'videopd_rangos_v1';
function cargarRangos() {
  let mod = {};
  try { mod = JSON.parse(localStorage.getItem(KEY_RANGOS) || '{}'); } catch (_) {}
  return RANGOS_DEF.map(r => ({ ...r, ...(mod[r.id] || {}) }));
}
function guardarRangos(lista) {
  const mod = {};
  lista.forEach(r => { const d = RANGOS_DEF.find(x => x.id === r.id); if (JSON.stringify([r.v, r.a, !!r.off]) !== JSON.stringify([d.v, d.a, !!d.off])) mod[r.id] = { v: r.v, a: r.a, off: !!r.off }; });
  try { localStorage.setItem(KEY_RANGOS, JSON.stringify(mod)); } catch (_) {}
}
function evaluarRango(k, fase, act, v, u) {
  if (!isFinite(v)) return null;
  const rs = cargarRangos().filter(r => !r.off && r.act === (act || S.act) && r.k === k && r.u === u && (r.f === fase || r.f === '*'));
  const r = rs.find(x => x.f === fase) || rs.find(x => x.f === '*');
  if (!r) return null;
  if (v >= r.v[0] && v <= r.v[1]) return 'v';
  if (v >= r.a[0] && v <= r.a[1]) return 'a';
  return 'r';
}
const puntoRango = c => c ? `<span class="dot ${c}" title="${{ v: 'Dentro del rango', a: 'Zona límite', r: 'Fuera del rango' }[c]}"></span>` : '';
function rangoDeMedida(m, a) {
  if (!m.k || a.fixed) return null;
  const kv = claveYValor(m.k, m.v, a.side);
  return evaluarRango(kv.k, faseCodigo(a.fase), a.act, kv.v, m.u);
}

/* ---------- ventana de resumen ---------- */
let resPane = 0;
function abrirResumen() {
  resPane = S.dual ? S.active : 0;
  $('#resVid').style.display = S.dual ? '' : 'none';
  pintarResumen();
  $('#mRes').classList.add('show');
}
function construirResumen(p) {
  const filas = [], act = S.act;
  const st = (x, d = 0) => x ? `${fmt(x.m, d)}${x.n > 1 ? ` ± ${fmt(x.sd, d)}` : ''} <span class="muted">(${x.n})</span>` : '—';
  const csvSt = x => x ? [fmt(x.m, 1), x.n > 1 ? fmt(x.sd, 1) : '', x.n] : ['', '', ''];
  let html = '';
  // 1) espacio-temporales
  const hayEv = p.events.some(e => e.type === 'IC');
  if (hayEv) {
    const et = espacioTemporal(p);
    const asim = (a, b) => a && b ? Math.abs(a.m - b.m) / ((Math.abs(a.m) + Math.abs(b.m)) / 2 || 1) * 100 : null;
    const ROWS = [
      ['gct', 'Tiempo de contacto (ms)'], ['vuelo', 'Tiempo de vuelo antes del contacto (ms)'], ['doble', 'Doble apoyo tras el contacto (ms)'],
      ['osc', 'Tiempo de oscilación (ms)'], ['paso', 'Tiempo de paso (ms)'], ['zan', 'Tiempo de zancada (ms)'], ['duty', 'Duty factor · % del ciclo en apoyo (%)'],
    ];
    html += `<h4>Parámetros espacio-temporales <span class="muted" style="font-weight:400">· tiempos con ${et.fr} fps reales</span></h4><div class="tblwrap"><table class="tbl"><tr><th>Parámetro</th><th>Dcho</th><th>Izdo</th><th>Asimetría</th></tr>`;
    if (et.cadencia) {
      const c = evaluarRango('cadencia', '*', act, et.cadencia, 'ppm');
      html += `<tr><td>Cadencia (pasos/min)</td><td colspan="2" style="text-align:center">${fmt(et.cadencia, 0)}${puntoRango(c)}</td><td></td></tr>`;
      filas.push({ sec: 'Espacio-temporal', p: 'Cadencia (pasos/min)', D: [fmt(et.cadencia, 1), '', ''], I: ['', '', ''], dif: '', cD: c || '', cI: '' });
    }
    for (const [k, n] of ROWS) {
      const D = et.res.D[k], I = et.res.I[k]; if (!D && !I) continue;
      const as = asim(D, I), c = as !== null ? evaluarRango('asim', '*', act, as, '%') : null;
      const d = k === 'duty' ? 1 : 0;
      html += `<tr><td>${n}</td><td>${st(D, d)}</td><td>${st(I, d)}</td><td>${as !== null ? fmt(as, 1) + ' %' + puntoRango(c) : '—'}</td></tr>`;
      filas.push({ sec: 'Espacio-temporal', p: n, D: csvSt(D), I: csvSt(I), dif: as !== null ? fmt(as, 1) + ' %' : '', cD: c || '', cI: '' });
    }
    html += '</table></div>';
  }
  // 2) fases con la IA
  if (p.pose && hayEv) {
    const fp = fasesPose(p);
    if (fp.filas.length) {
      html += `<h4>Ángulos por fases · IA (${fp.view}) <span class="muted" style="font-weight:400">· ${fp.ciclos} apoyos analizados · media ± DE (n)</span></h4><div class="tblwrap"><table class="tbl"><tr><th>Parámetro</th><th>Dcho</th><th>Izdo</th><th>Dif. D−I</th></tr>`;
      let grp = '';
      for (const f of fp.filas) {
        if (f.fase !== grp) { grp = f.fase; html += `<tr class="grp"><td colspan="4">${FASE_N[grp]}${grp === 'MS' && fp.view === 'sagital' && S.act === 'carrera' ? ' (máx. flexión de rodilla)' : grp === 'MS' ? ' (mitad del apoyo)' : ''}</td></tr>`; }
        const d = f.u === 'px' ? 0 : 1;
        const cD = f.D ? evaluarRango(f.k, f.fase, act, f.D.m, f.u) : null, cI = f.I ? evaluarRango(f.k, f.fase, act, f.I.m, f.u) : null;
        const dif = f.D && f.I ? fmt(f.D.m - f.I.m, d) : '—';
        html += `<tr><td>${esc(f.n)}${f.u !== '°' ? ` (${f.u})` : ''}</td><td>${st(f.D, d)}${puntoRango(cD)}</td><td>${st(f.I, d)}${puntoRango(cI)}</td><td>${dif}</td></tr>`;
        filas.push({ sec: 'IA · ' + FASE_N[f.fase], p: f.n + (f.u !== '°' ? ` (${f.u})` : ''), D: csvSt(f.D), I: csvSt(f.I), dif: dif === '—' ? '' : dif, cD: cD || '', cI: cI || '' });
      }
      html += '</table></div>';
    }
  }
  // 3) mediciones manuales por fase
  const man = fasesManual(p);
  if (man.length) {
    html += `<h4>Mediciones manuales (plantillas) por fase</h4><div class="tblwrap"><table class="tbl"><tr><th>Parámetro</th><th>Dcho</th><th>Izdo</th><th>Dif. D−I</th></tr>`;
    let grp = '';
    man.sort((a, b) => a.faseTxt.localeCompare(b.faseTxt));
    for (const f of man) {
      if (f.faseTxt !== grp) { grp = f.faseTxt; html += `<tr class="grp"><td colspan="4">${esc(grp)}</td></tr>`; }
      const d = f.u === 'px' ? 0 : 1;
      const cD = f.D ? evaluarRango(f.k, f.fase, f.act || act, f.D.m, f.u) : null, cI = f.I ? evaluarRango(f.k, f.fase, f.act || act, f.I.m, f.u) : null;
      const dif = f.D && f.I ? fmt(f.D.m - f.I.m, d) : '—';
      html += `<tr><td>${esc(f.n)}${f.u !== '°' ? ` (${f.u})` : ''}</td><td>${st(f.D, d)}${puntoRango(cD)}</td><td>${st(f.I, d)}${puntoRango(cI)}</td><td>${dif}</td></tr>`;
      filas.push({ sec: 'Manual · ' + f.faseTxt, p: f.n + (f.u !== '°' ? ` (${f.u})` : ''), D: csvSt(f.D), I: csvSt(f.I), dif: dif === '—' ? '' : dif, cD: cD || '', cI: cI || '' });
    }
    html += '</table></div>';
  }
  if (!html) html = `<p>Todavía no hay datos para resumir.</p><ul>
    <li><b>Tiempos y cadencia:</b> marca contactos y despegues en «Eventos de la zancada» (o 🤖 Auto tras analizar con IA en vista sagital).</li>
    <li><b>Ángulos por fases:</b> analiza con 🤖 IA y marca los eventos; o usa las plantillas guiadas indicando la fase.</li></ul>`;
  else if (!hayEv) html = `<p class="muted">Sin eventos de la zancada: marca contactos y despegues para obtener tiempos, cadencia y ángulos por fases de la IA.</p>` + html;
  return { html, filas };
}
function pintarResumen() {
  const p = S.panes[resPane];
  $$('#resVid button').forEach(b => b.classList.toggle('on', +b.dataset.v === resPane));
  const fuentes = [p.pose ? `IA ${p.pose.view}` : null, p.events.length ? `${p.events.length} eventos` : null, p.anns.some(a => a.type === 'tpl') ? 'plantillas manuales' : null].filter(Boolean);
  $('#resFuente').textContent = `${p.videoName || p.pending?.name || 'Sin vídeo'} · ${S.act === 'carrera' ? 'Carrera' : 'Marcha'}${fuentes.length ? ' · ' + fuentes.join(' · ') : ''}`;
  const r = construirResumen(p);
  $('#resBody').innerHTML = r.html;
  return r;
}
const COLS_RES = [['sec', 'Sección'], ['p', 'Parámetro'], ['dm', 'Dcho media'], ['dsd', 'Dcho DE'], ['dn', 'Dcho n'], ['im', 'Izdo media'], ['isd', 'Izdo DE'], ['in', 'Izdo n'], ['dif', 'Asimetría / Dif. D−I'], ['cD', 'Semáforo Dcho'], ['cI', 'Semáforo Izdo']];
const SEM_TXT = { v: 'verde', a: 'ámbar', r: 'rojo', '': '' };
function filasResumenCSV() {
  const r = construirResumen(S.panes[resPane]);
  return r.filas.map(f => ({ sec: f.sec, p: f.p, dm: f.D[0], dsd: f.D[1], dn: f.D[2], im: f.I[0], isd: f.I[1], in: f.I[2], dif: f.dif, cD: SEM_TXT[f.cD], cI: SEM_TXT[f.cI] }));
}
function pintarRangos(act) {
  const lista = cargarRangos();
  $$('#rgAct button').forEach(b => b.classList.toggle('on', b.dataset.v === act));
  const t = $('#rgTabla');
  t.dataset.act = act;
  t.innerHTML = `<tr><th>Activo</th><th>Parámetro</th><th>Momento</th><th>Unidad</th><th>Verde mín</th><th>Verde máx</th><th>Ámbar mín</th><th>Ámbar máx</th></tr>` +
    lista.filter(r => r.act === act).map(r => `<tr data-id="${r.id}">
      <td><input type="checkbox" data-c="on" ${r.off ? '' : 'checked'} style="width:20px;height:20px"></td>
      <td>${esc(r.n)}</td><td style="text-align:left">${FASE_N[r.f]}</td><td>${r.u}</td>
      <td><input type="text" inputmode="decimal" data-c="v0" value="${fmt(r.v[0], 0)}"></td><td><input type="text" inputmode="decimal" data-c="v1" value="${fmt(r.v[1], 0)}"></td>
      <td><input type="text" inputmode="decimal" data-c="a0" value="${fmt(r.a[0], 0)}"></td><td><input type="text" inputmode="decimal" data-c="a1" value="${fmt(r.a[1], 0)}"></td></tr>`).join('');
}
function leerTablaRangos() {
  const lista = cargarRangos(), num = el => parseFloat(String(el.value).replace(',', '.'));
  let error = '';
  $$('#rgTabla tr[data-id]').forEach(tr => {
    const r = lista.find(x => x.id === tr.dataset.id);
    const g = c => $(`[data-c="${c}"]`, tr);
    const v = [num(g('v0')), num(g('v1'))], a = [num(g('a0')), num(g('a1'))];
    if (![...v, ...a].every(isFinite) || v[0] > v[1] || a[0] > a[1]) { error = `Revisa los valores de «${r.n}»`; return; }
    r.v = v; r.a = [Math.min(a[0], v[0]), Math.max(a[1], v[1])]; r.off = !g('on').checked;
  });
  if (error) { toast(error, 4000); return false; }
  guardarRangos(lista); return true;
}
function construirResumenUI() {
  $('#bResumen').onclick = abrirResumen;
  $('#resClose').onclick = () => $('#mRes').classList.remove('show');
  $$('#resVid button').forEach(b => b.onclick = () => { resPane = +b.dataset.v; pintarResumen(); });
  $('#resCsv').onclick = async () => {
    const f = filasResumenCSV(); if (!f.length) { toast('No hay datos'); return; }
    const cab = `${S.session ? `Paciente;${S.session.nhc || ''} ${S.session.nombre || ''}\r\n` : ''}Fecha;${hoy()}\r\nVídeo;${S.panes[resPane].videoName}\r\nActividad;${S.act}\r\n\r\n`;
    await entregar(new Blob(['﻿' + cab + csv(f, COLS_RES)], { type: 'text/csv;charset=utf-8' }), `${baseNombre()}_resumen.csv`);
  };
  $('#resCopy').onclick = async () => {
    const f = filasResumenCSV(); if (!f.length) { toast('No hay datos'); return; }
    try { await navigator.clipboard.writeText(csv(f, COLS_RES, '\t')); toast('Resumen copiado: pégalo en Excel o en el informe'); }
    catch (_) { toast('El navegador no deja copiar; usa ⤓ CSV'); }
  };
  $('#resRangos').onclick = () => { pintarRangos(S.act); $('#mRangos').classList.add('show'); };
  $$('#rgAct button').forEach(b => b.onclick = () => { if (leerTablaRangos()) pintarRangos(b.dataset.v); });
  $('#rgClose').onclick = () => { if (!leerTablaRangos()) return; $('#mRangos').classList.remove('show'); if ($('#mRes').classList.contains('show')) pintarResumen(); actualizarLista(); };
  $('#rgReset').onclick = async () => {
    if (!(await confirmar('Restaurar rangos', 'Se pierden tus rangos personalizados y vuelven los orientativos por defecto.', 'Restaurar'))) return;
    try { localStorage.removeItem(KEY_RANGOS); } catch (_) {}
    pintarRangos($('#rgTabla').dataset.act || S.act); actualizarLista();
  };
  // eventos
  $$('[data-ev]').forEach(b => b.onclick = () => { const [t, sd] = b.dataset.ev.split(':'); toggleEvento(t, sd); });
  $('#evPrev').onclick = () => irEvento(-1); $('#evNext').onclick = () => irEvento(1);
  $('#evAuto').onclick = autoEventos;
  $('#evClear').onclick = async () => {
    const p = activePane(); if (!p?.events.length) return;
    if (await confirmar('Borrar eventos', `Se borran los ${p.events.length} eventos de la zancada de este vídeo.`, 'Borrar')) { p.events = []; p._mk = null; marcarCambios(); p.updateTL(); actualizarEventos(); if (grafVisible()) dibujarGrafica(); }
  };
}

/* ============================================================
   ALMACENAMIENTO CIFRADO (mismo esquema que la Ficha PD)
   Clave AES-256-GCM derivada con PBKDF2-SHA256 (600.000 iteraciones).
   Prefijo propio 'videopd_' para no tocar los datos de la ficha.
   ============================================================ */
const KEY_CRIPTO = 'videopd_cripto_v1';
const Cripto = (() => {
  const ITER = 600000, enc = new TextEncoder(), dec = new TextDecoder();
  let clave = null, saltActual = null;
  const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const lsGet = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  async function derivar(pass, salt, it) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: it || ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function cifrarCon(k, txt) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(txt)); return { iv: b64(iv), ct: b64(ct) }; }
  async function descifrarCon(k, p) { return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, k, unb64(p.ct))); }
  return {
    soportado: () => !!(window.crypto && crypto.subtle && window.isSecureContext),
    hayContrasena: () => !!lsGet(KEY_CRIPTO),
    abierta: () => !!clave,
    bloquear() { clave = null; },
    async crear(pass) {
      const salt = crypto.getRandomValues(new Uint8Array(16)), k = await derivar(pass, salt);
      lsSet(KEY_CRIPTO, JSON.stringify({ salt: b64(salt), verificador: await cifrarCon(k, 'videopd-ok'), iteraciones: ITER }));
      clave = k; saltActual = b64(salt);
    },
    async abrir(pass) {
      const cfg = JSON.parse(lsGet(KEY_CRIPTO));
      const k = await derivar(pass, unb64(cfg.salt), cfg.iteraciones);
      try { if (await descifrarCon(k, cfg.verificador) !== 'videopd-ok') return false; clave = k; saltActual = cfg.salt; return true; } catch (_) { return false; }
    },
    cifrar: async obj => cifrarCon(clave, JSON.stringify(obj)),
    descifrar: async p => JSON.parse(await descifrarCon(clave, p)),
    async exportar(obj) { const p = await cifrarCon(clave, JSON.stringify(obj)); return { app: 'videopd', salt: saltActual, iv: p.iv, ct: p.ct, iteraciones: ITER }; },
    async importar(p, pass) { const k = pass ? await derivar(pass, unb64(p.salt), p.iteraciones) : clave; return JSON.parse(await descifrarCon(k, p)); },
  };
})();

/* IndexedDB: las sesiones pueden pesar (datos de IA), mejor que localStorage. */
const DB = (() => {
  let dbp = null;
  const abrir = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('videopd', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('sesiones', { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (modo, fn) => { const db = await abrir(); return new Promise((res, rej) => { const t = db.transaction('sesiones', modo); const st = t.objectStore('sesiones'); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); };
  return {
    put: rec => tx('readwrite', st => st.put(rec)),
    del: id => tx('readwrite', st => st.delete(id)),
    all: () => tx('readonly', st => st.getAll()),
  };
})();
async function leerSesiones() {
  const recs = await DB.all(), out = [];
  for (const r of recs) { try { out.push(await Cripto.descifrar(r.enc)); } catch (_) { out.push({ id: r.id, _ilegible: true }); } }
  return out.sort((a, b) => (b.updated || 0) - (a.updated || 0));
}
const guardarSesionCifrada = async s => DB.put({ id: s.id, enc: await Cripto.cifrar(s) });

/* Bloqueo: contraseña propia, se cierra sola tras 10 min sin uso. */
let ultimoUso = Date.now(), ocultoDesde = null;
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { ultimoUso = Date.now(); }, true));
setInterval(() => { if (Cripto.abierta() && Date.now() - ultimoUso > 10 * 60 * 1000) { Cripto.bloquear(); toast('Sesiones bloqueadas por inactividad'); } }, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) ocultoDesde = Date.now();
  else if (ocultoDesde && Date.now() - ocultoDesde > 5 * 60 * 1000 && Cripto.abierta()) { Cripto.bloquear(); }
});
function pedirDesbloqueo(modo) {
  // modo: 'abrir' | 'crear' | 'cambiar'
  return new Promise(res => {
    if (!Cripto.soportado()) { toast('El cifrado necesita abrir la app desde https (GitHub Pages)', 5000); res(false); return; }
    if (!modo) { if (Cripto.abierta()) { res(true); return; } modo = Cripto.hayContrasena() ? 'abrir' : 'crear'; }
    const m = $('#mLock'), p1 = $('#lockPass'), p2 = $('#lockPass2'), err = $('#lockErr');
    p1.value = p2.value = ''; err.textContent = '';
    $('#lockPass2Wrap').style.display = modo === 'abrir' ? 'none' : '';
    $('#lockTitle').textContent = modo === 'abrir' ? '🔒 Desbloquear sesiones' : modo === 'crear' ? '🔐 Crear contraseña' : '🔑 Nueva contraseña';
    $('#lockMsg').textContent = modo === 'abrir' ? 'Introduce la contraseña de Vídeo PD.' :
      'Las sesiones se guardan cifradas con esta contraseña (mínimo 8 caracteres). Apúntala en un lugar seguro: si la olvidas, no hay forma de recuperar las sesiones.';
    $('#lockOk').textContent = modo === 'abrir' ? 'Abrir' : 'Guardar';
    m.classList.add('show'); setTimeout(() => p1.focus(), 60);
    const fin = v => { m.classList.remove('show'); $('#lockOk').onclick = $('#lockCancel').onclick = p1.onkeydown = p2.onkeydown = null; res(v); };
    const ok = async () => {
      err.textContent = '';
      if (modo === 'abrir') {
        $('#lockOk').disabled = true;
        const bien = await Cripto.abrir(p1.value).catch(() => false);
        $('#lockOk').disabled = false;
        if (bien) fin(true); else { err.textContent = 'Contraseña incorrecta'; p1.select(); }
        return;
      }
      if (p1.value.length < 8) { err.textContent = 'Mínimo 8 caracteres'; return; }
      if (p1.value !== p2.value) { err.textContent = 'Las contraseñas no coinciden'; return; }
      $('#lockOk').disabled = true;
      try {
        if (modo === 'cambiar') {
          const todas = (await leerSesiones()).filter(s => !s._ilegible);
          await Cripto.crear(p1.value);
          for (const s of todas) await guardarSesionCifrada(s);
        } else await Cripto.crear(p1.value);
        fin(true);
      } catch (e) { err.textContent = 'Error: ' + e.message; }
      $('#lockOk').disabled = false;
    };
    $('#lockOk').onclick = ok; $('#lockCancel').onclick = () => fin(false);
    p1.onkeydown = p2.onkeydown = e => { if (e.key === 'Enter') ok(); };
  });
}

/* ---------- sesiones ---------- */
function actualizarCabecera() {
  const s = S.session;
  const txt = s ? `${s.nhc ? 'NHC ' + s.nhc : 'Sin NHC'}${s.nombre ? ' · ' + s.nombre : ''} · ${new Date(s.created).toLocaleDateString('es-ES')}` : 'Sesión nueva';
  $('#sessInfo').textContent = txt + (S.dirty ? ' · sin guardar' : '');
}
function datosSesion(meta) {
  const panes = (S.dual ? S.panes : [S.panes[0]]).map(p => p.serialize());
  return { ...meta, act: S.act, dual: S.dual, panes, updated: Date.now() };
}
async function abrirGuardar() {
  if (!S.panes.some(p => p.ready || p.anns.length)) { toast('No hay nada que guardar todavía'); return; }
  if (!(await pedirDesbloqueo())) return;
  const s = S.session || {};
  $('#svNhc').value = s.nhc || ''; $('#svNombre').value = s.nombre || ''; $('#svNotas').value = s.notas || '';
  $('#svOk').textContent = s.id ? 'Guardar (sobrescribir)' : 'Guardar';
  $('#svNew').style.display = s.id ? '' : 'none';
  $('#mSave').classList.add('show');
}
async function guardar(nueva) {
  if (!Cripto.abierta() && !(await pedirDesbloqueo())) return;
  const nhc = $('#svNhc').value.trim();
  if (!nhc) { toast('Pon al menos el nº de historia o un identificador'); return; }
  const base = S.session && !nueva ? S.session : { id: uid(), created: Date.now() };
  const meta = { id: base.id, created: base.created, nhc, nombre: $('#svNombre').value.trim(), notas: $('#svNotas').value };
  try {
    await guardarSesionCifrada(datosSesion(meta));
    S.session = meta; S.dirty = false; actualizarCabecera();
    $('#mSave').classList.remove('show');
    toast('Sesión guardada y cifrada en este dispositivo');
  } catch (e) { toast('No se pudo guardar: ' + e.message, 5000); }
}
async function abrirSesiones() {
  if (!(await pedirDesbloqueo())) return;
  $('#mSess').classList.add('show');
  $('#ssBuscar').value = '';
  pintarSesiones();
}
async function pintarSesiones() {
  const box = $('#ssList');
  box.innerHTML = '<p class="muted">Cargando…</p>';
  let todas;
  try { todas = await leerSesiones(); } catch (e) { box.innerHTML = `<p class="muted">Error: ${esc(e.message)}</p>`; return; }
  const q = $('#ssBuscar').value.trim().toLowerCase();
  const fil = todas.filter(s => !q || [s.nhc, s.nombre, s.notas].join(' ').toLowerCase().includes(q));
  if (!fil.length) { box.innerHTML = '<p class="muted">No hay sesiones guardadas.</p>'; return; }
  box.innerHTML = fil.map(s => s._ilegible ? `<div class="sessrow"><div class="inf"><b>Sesión ilegible</b><span>Cifrada con otra contraseña</span></div><button data-del="${s.id}" class="danger">🗑</button></div>` : `
    <div class="sessrow">
      <div class="inf"><b>${esc(s.nhc || 'Sin NHC')}${s.nombre ? ' · ' + esc(s.nombre) : ''}</b>
      <span>${new Date(s.created).toLocaleDateString('es-ES')} · ${s.panes.length === 2 ? 'Comparativa · ' : ''}${s.panes.map(p => esc(p.videoName || '¿?')).join(' / ')} · ${s.panes.reduce((n, p) => n + p.anns.length, 0)} mediciones${s.notas ? ' · ' + esc(s.notas.slice(0, 60)) : ''}</span></div>
      <button data-open="${s.id}" class="prim">Abrir</button><button data-del="${s.id}" class="danger">🗑</button>
    </div>`).join('');
  $$('[data-open]', box).forEach(b => b.onclick = async () => {
    const s = fil.find(x => x.id === b.dataset.open);
    if (S.dirty && !(await confirmar('Cambios sin guardar', 'Lo que tienes en pantalla sin guardar se perderá. ¿Abrir la sesión?', 'Abrir'))) return;
    cargarSesion(s); $('#mSess').classList.remove('show');
  });
  $$('[data-del]', box).forEach(b => b.onclick = async () => {
    if (!(await confirmar('Borrar sesión', 'Se borra de forma definitiva de este dispositivo.', 'Borrar'))) return;
    await DB.del(b.dataset.del);
    if (S.session && S.session.id === b.dataset.del) { S.session = null; actualizarCabecera(); }
    pintarSesiones();
  });
}
function cargarSesion(s) {
  S.session = { id: s.id, created: s.created, nhc: s.nhc, nombre: s.nombre, notas: s.notas };
  S.act = s.act || 'carrera'; rellenarFases();
  modoDual(s.panes.length === 2);
  s.panes.forEach((d, i) => S.panes[i].restore(d));
  if (s.panes.length === 1) { const p2 = S.panes[1]; p2.anns = []; p2.pose = null; p2.events = []; p2.pending = null; }
  S.sel = null; S.dirty = false; actualizarCabecera();
  $('#gMetric').innerHTML = ''; mostrarGrafica(false);
  refrescar();
  const falta = S.panes.filter(p => p.pending).map(p => `«${p.pending.name}»`);
  if (falta.length) toast(`Sesión abierta. Carga ${falta.join(' y ')} para ver las mediciones.`, 6000);
}
async function nuevaSesion() {
  if (S.dirty && !(await confirmar('Nueva sesión', 'Se vacía la pantalla. Lo no guardado se pierde.', 'Vaciar'))) return;
  S.panes.forEach(p => { p.anns = []; p.undo = []; p.pose = null; p.events = []; p.fpsReal = null; p.A = p.B = null; p.pending = null; p.unload(); });
  S.session = null; S.sel = null; S.dirty = false; modoDual(false); mostrarGrafica(false); actualizarCabecera(); refrescar();
  $('#mSess').classList.remove('show');
}
async function exportarCopia() {
  const todas = (await leerSesiones()).filter(s => !s._ilegible);
  if (!todas.length) { toast('No hay sesiones que copiar'); return; }
  const paq = await Cripto.exportar(todas);
  await entregar(new Blob([JSON.stringify(paq)], { type: 'application/json' }), `videopd_copia_${new Date().toISOString().slice(0, 10)}.json`);
}
async function importarCopia(file) {
  try {
    const paq = JSON.parse(await file.text());
    if (paq.app !== 'videopd') throw new Error('No es una copia de Vídeo PD');
    let lista;
    try { lista = await Cripto.importar(paq); }
    catch (_) {
      const pass = await preguntar('Contraseña de la copia', 'Esta copia se hizo con otra contraseña. Escríbela para importarla.', '', { tipo: 'password' });
      if (!pass) return;
      lista = await Cripto.importar(paq, pass);
    }
    const actuales = Object.fromEntries((await leerSesiones()).map(s => [s.id, s]));
    let n = 0;
    for (const s of lista) { if (!actuales[s.id] || (actuales[s.id].updated || 0) < (s.updated || 0)) { await guardarSesionCifrada(s); n++; } }
    toast(`Importadas ${n} sesiones`); pintarSesiones();
  } catch (e) { toast('No se pudo importar: ' + (e.message || 'contraseña incorrecta'), 5000); }
}

/* ============================================================
   EXPORTAR
   ============================================================ */
async function entregar(blob, nombre) {
  const file = new File([blob], nombre, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nombre }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 8000);
  return true;
}
const baseNombre = () => `videopd_${(S.session?.nhc || 'sesion').replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
function pieDeFoto(pane) {
  const s = S.session;
  return [s?.nhc ? 'NHC ' + s.nhc : '', hoy(), `F ${pane.frame()} · ${fmtT(pane.video.currentTime)}`, pane.videoName].filter(Boolean).join(' · ');
}
function lienzoExport(pane, opts = {}) {
  const maxL = opts.maxL || 2400;
  const k = Math.min(1, maxL / Math.max(pane.vw, pane.vh));
  const c = document.createElement('canvas');
  const vh = Math.round(pane.vh * k), ui = Math.max(1, vh / 560), franja = opts.pie === false ? 0 : Math.round(30 * ui);
  c.width = Math.round(pane.vw * k); c.height = vh + franja;   // el pie va en una franja aparte: no tapa los pies del paciente
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0F2744'; ctx.fillRect(0, 0, c.width, c.height);
  dibujarEscena(ctx, pane, { s: k, ox: 0, oy: 0 }, ui, { frame: opts.frame ?? pane.frame(), legend: true, legendY: 22 * ui, pose: opts.pose });
  if (franja) {
    ctx.font = `600 ${13 * ui}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'middle'; ctx.fillStyle = '#C8A84B'; ctx.fillText('Pododepor · Vídeo PD', 10 * ui, vh + franja / 2);
    const w = ctx.measureText('Pododepor · Vídeo PD   ').width;
    ctx.fillStyle = '#fff'; ctx.fillText(pieDeFoto(pane), 10 * ui + w, vh + franja / 2);
  }
  return c;
}
async function exportarPNG() {
  const ps = (S.dual ? S.panes : [activePane()]).filter(p => p.ready);
  if (!ps.length) { toast('No hay vídeo'); return; }
  let c;
  if (ps.length === 1) c = lienzoExport(ps[0]);
  else {
    const cs = ps.map(p => lienzoExport(p, { maxL: 1600 }));
    const H = Math.min(...cs.map(x => x.height));
    const ws = cs.map(x => Math.round(x.width * H / x.height));
    c = document.createElement('canvas'); c.width = ws[0] + ws[1] + 8; c.height = H;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#0F2744'; ctx.fillRect(0, 0, c.width, H);
    ctx.drawImage(cs[0], 0, 0, ws[0], H); ctx.drawImage(cs[1], ws[0] + 8, 0, ws[1], H);
  }
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  await entregar(blob, `${baseNombre()}_F${ps[0].frame()}.png`);
}
function filasMediciones() {
  const filas = [];
  (S.dual ? S.panes : [S.panes[0]]).forEach((p, i) => {
    [...p.anns].sort((a, b) => a.t - b.t).forEach(a => {
      medir(a, p).forEach(m => filas.push({
        video: `${i + 1}: ${p.videoName || p.pending?.name || ''}`, frame: a.fixed ? '' : p.frameOf(a.t), t: a.fixed ? '' : fmt(a.t, 3),
        act: a.act || '', fase: a.fase && a.fase !== '—' ? a.fase : '', lado: a.side === 'I' ? 'Izdo' : 'Dcho',
        med: nombreAnn(a), param: m.n, v: fmt(m.v, m.u === 'px' ? 0 : 1), u: m.u, txt: m.txt,
      }));
    });
  });
  return filas;
}
const COLS = [['video', 'Vídeo'], ['frame', 'Fotograma'], ['t', 'Tiempo (s)'], ['act', 'Actividad'], ['fase', 'Fase'], ['lado', 'Lado'], ['med', 'Medición'], ['param', 'Parámetro'], ['v', 'Valor'], ['u', 'Unidad'], ['txt', 'Interpretación']];
function csv(filas, cols, sep = ';') {
  const q = v => { v = String(v ?? ''); return /[;"\n\t]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  return [cols.map(c => q(c[1])).join(sep), ...filas.map(f => cols.map(c => q(f[c[0]])).join(sep))].join('\r\n');
}
async function exportarCSV() {
  const f = filasMediciones(); if (!f.length) { toast('No hay mediciones'); return; }
  const cab = S.session ? `Paciente;${S.session.nhc || ''} ${S.session.nombre || ''}\r\nFecha;${hoy()}\r\n\r\n` : '';
  await entregar(new Blob(['﻿' + cab + csv(f, COLS)], { type: 'text/csv;charset=utf-8' }), `${baseNombre()}_mediciones.csv`);
}
async function copiarMediciones() {
  const f = filasMediciones(); if (!f.length) { toast('No hay mediciones'); return; }
  const txt = csv(f, COLS, '\t');
  try { await navigator.clipboard.writeText(txt); toast('Copiado: pégalo en Excel, Word o en la ficha'); }
  catch (_) { toast('El navegador no deja copiar; usa la exportación CSV'); }
}
async function exportarCinematica() {
  const ps = (S.dual ? S.panes : [S.panes[0]]).filter(p => p.pose);
  if (!ps.length) { toast('No hay datos de IA. Usa 🤖 IA primero.'); return; }
  const filas = [];
  ps.forEach((p, i) => {
    const mets = POSE_METRICS[p.pose.view];
    for (const n of Object.keys(p.pose.frames).map(Number).sort((a, b) => a - b)) {
      const f = { video: `${i + 1}: ${p.videoName}`, vista: p.pose.view, frame: n, t: fmt(p.timeOf(n), 3) };
      for (const s of ['D', 'I']) {
        const ms = poseMeasures(p.pose.frames[n], p.pose.view, s, p.pose.dir);
        for (const [k] of mets) { const m = ms.find(x => x.k === k); f[`${k}_${s}`] = m ? fmt(m.v) : ''; }
      }
      filas.push(f);
    }
  });
  const v0 = ps[0].pose.view;
  const cols = [['video', 'Vídeo'], ['vista', 'Vista'], ['frame', 'Fotograma'], ['t', 'Tiempo (s)']];
  for (const [k, n] of POSE_METRICS[v0]) for (const s of ['D', 'I']) cols.push([`${k}_${s}`, `${n} ${s === 'D' ? 'Dcho' : 'Izdo'} (°)`]);
  await entregar(new Blob(['﻿' + csv(filas, cols)], { type: 'text/csv;charset=utf-8' }), `${baseNombre()}_cinematica_IA.csv`);
}

/* Vídeo anotado con MediaRecorder sobre un lienzo. */
let grabando = null;
async function grabarVideo() {
  const p = activePane();
  if (!p?.ready) { toast('No hay vídeo'); return; }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { $('#vMsg').textContent = 'Este navegador no permite grabar vídeo. Usa la captura PNG.'; return; }
  const tipos = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mime = tipos.find(t => MediaRecorder.isTypeSupported(t)) || '';
  const speed = +$('#vSpeed').value, hold = +$('#vHold').value * 1000, conPose = $('#vPose').checked;
  const a = p.A !== null && p.B !== null ? Math.min(p.A, p.B) : 0, b = p.A !== null && p.B !== null ? Math.max(p.A, p.B) : p.nFrames() - 1;
  const k = Math.min(1, 1280 / Math.max(p.vw, p.vh));
  const c = document.createElement('canvas'); c.width = Math.round(p.vw * k / 2) * 2; c.height = Math.round(p.vh * k / 2) * 2;
  const ctx = c.getContext('2d'), ui = Math.max(1, c.height / 560);
  const dibujar = () => {
    dibujarEscena(ctx, p, { s: c.width / p.vw, ox: 0, oy: 0 }, ui, { frame: p.frame(), legend: true, legendY: 22 * ui, pose: conPose });
    etiqueta(ctx, `Pododepor · ${pieDeFoto(p)}${speed < 1 ? ' · ×' + String(speed).replace('.', ',') : ''}`, 8 * ui, c.height - 13 * ui, ui * 0.8, '#fff');
  };
  const anotados = [...new Set(p.anns.filter(x => !x.fixed).map(x => p.frameOf(x.t)))].filter(f => f >= a && f <= b).sort((x, y) => x - y);
  p.pausar();
  await p.seekFrame(a, true);
  dibujar();
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : undefined);
  const trozos = []; rec.ondataavailable = e => e.data.size && trozos.push(e.data);
  const fin = new Promise(r => rec.onstop = r);
  grabando = { cancel: false };
  const tick = setInterval(dibujar, 33);
  $('#vGo').disabled = true; $('#vCancel').textContent = 'Detener';
  rec.start(500);
  const v = p.video, tEnd = p.timeOf(b), dur = tEnd - p.timeOf(a);
  const prog = () => { $('#vProg').style.width = clamp((v.currentTime - p.timeOf(a)) / (dur || 1), 0, 1) * 100 + '%'; };
  const espera = ms => new Promise(r => setTimeout(r, ms));
  let idx = 0;
  if (hold && anotados[0] === a) { $('#vMsg').textContent = 'Pausa en medición…'; await espera(hold); idx = 1; }
  v.playbackRate = speed;
  while (!grabando.cancel) {
    await v.play().catch(() => {});
    // avanzar hasta el siguiente fotograma anotado o el final
    await new Promise(res => {
      const mirar = () => {
        prog();
        const n = p.frame();
        if (grabando.cancel || v.ended || v.currentTime >= tEnd || (hold && idx < anotados.length && n >= anotados[idx])) { res(); return; }
        v.requestVideoFrameCallback ? v.requestVideoFrameCallback(mirar) : requestAnimationFrame(mirar);
      };
      mirar();
    });
    v.pause();
    if (grabando.cancel || v.ended || v.currentTime >= tEnd || !(hold && idx < anotados.length)) break;
    await p.seekFrame(anotados[idx], true); dibujar();
    $('#vMsg').textContent = `Pausa en F ${anotados[idx]}…`;
    await espera(hold); idx++;
    $('#vMsg').textContent = 'Grabando…';
  }
  await espera(300);
  clearInterval(tick); rec.stop(); await fin;
  v.playbackRate = +$('#tSpeed').value;
  $('#vGo').disabled = false; $('#vCancel').textContent = 'Cerrar';
  const cancelado = grabando.cancel; grabando = null;
  if (cancelado && !trozos.length) { $('#vMsg').textContent = 'Grabación cancelada'; return; }
  const blob = new Blob(trozos, { type: mime.split(';')[0] || 'video/webm' });
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  $('#vProg').style.width = '100%';
  $('#vMsg').innerHTML = `Vídeo listo (${fmt(blob.size / 1048576, 1)} MB). `;
  const bt = document.createElement('button'); bt.className = 'prim'; bt.textContent = '⤓ Guardar / compartir vídeo';
  bt.onclick = () => entregar(blob, `${baseNombre()}_anotado.${ext}`);
  $('#vMsg').appendChild(bt);
  p.render(); p.updateTL();
}

/* ============================================================
   ARRANQUE
   ============================================================ */
function init() {
  const work = $('#work');
  S.panes = [new Pane(0), new Pane(1)];
  S.panes.forEach(p => work.appendChild(p.el));
  S.panes[1].el.style.display = 'none';
  construirLado(); construirTransporte(); construirGrafica(); construirResumenUI();

  $('#fileVideo').onchange = e => { const f = e.target.files[0]; e.target.value = ''; cargarVideoEn(S.panes[S.loadTarget ?? S.active], f); };
  $('#fileCam').onchange = e => { const f = e.target.files[0]; e.target.value = ''; cargarVideoEn(S.panes[S.loadTarget ?? S.active], f); };
  $('#bComparar').onclick = () => modoDual(!S.dual);
  $('#bAyuda').onclick = () => $('#mHelp').classList.add('show');
  $('#helpClose').onclick = () => $('#mHelp').classList.remove('show');
  $('#bGuardar').onclick = abrirGuardar;
  $('#svCancel').onclick = () => $('#mSave').classList.remove('show');
  $('#svOk').onclick = () => guardar(false); $('#svNew').onclick = () => guardar(true);
  $('#bSesiones').onclick = abrirSesiones;
  $('#ssClose').onclick = () => $('#mSess').classList.remove('show');
  $('#ssBuscar').oninput = pintarSesiones;
  $('#ssNueva').onclick = nuevaSesion;
  $('#ssExport').onclick = exportarCopia;
  $('#ssImport').onclick = () => $('#ssFile').click();
  $('#ssFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importarCopia(f); };
  $('#ssLock').onclick = () => { Cripto.bloquear(); $('#mSess').classList.remove('show'); toast('Sesiones bloqueadas'); };
  $('#ssPass').onclick = async () => { if (await pedirDesbloqueo('cambiar')) toast('Contraseña cambiada y sesiones recifradas'); };
  $('#bExportar').onclick = () => $('#mExport').classList.add('show');
  $('#exClose').onclick = () => $('#mExport').classList.remove('show');
  $('#exPng').onclick = exportarPNG; $('#exCsv').onclick = exportarCSV; $('#exCopy').onclick = copiarMediciones; $('#exKin').onclick = exportarCinematica;
  $('#exVid').onclick = () => { $('#mExport').classList.remove('show'); $('#vMsg').textContent = ''; $('#vProg').style.width = '0'; $('#mVid').classList.add('show'); };
  $('#vGo').onclick = grabarVideo;
  $('#vCancel').onclick = () => { if (grabando) grabando.cancel = true; else $('#mVid').classList.remove('show'); };
  $('#tIA').onclick = () => { const p = activePane(); if (p?.pose && !grafVisible()) { prepararGrafica(); mostrarGrafica(true); } else abrirIA(); };
  $('#iaGo').onclick = correrIA;
  $('#iaCancel').onclick = () => { if (iaCorriendo) iaCancelar = true; else $('#mIA').classList.remove('show'); };
  $('#iaBorrar').onclick = async () => {
    const p = activePane(); if (!p) return;
    if (await confirmar('Borrar datos IA', 'Se borra el esqueleto detectado de este vídeo (las mediciones se mantienen).', 'Borrar')) {
      p.pose = null; marcarCambios(); mostrarGrafica(false); $('#mIA').classList.remove('show'); refrescar();
    }
  };
  // Cerrar modales tocando fuera (excepto los que esperan respuesta)
  $$('.modal').forEach(m => m.addEventListener('pointerdown', e => {
    if (e.target === m && !['mLock', 'mPrompt', 'mIA', 'mVid', 'mRangos'].includes(m.id)) m.classList.remove('show');
  }));
  window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  actualizarCabecera(); refrescar();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Hay una versión nueva: cierra la app del todo y vuelve a abrirla', 6000); });
      });
    }).catch(() => {});
  }
}
init();
window.__videopd = { S, TEMPLATES, medir, sagCompute, postCompute, frontCompute, espacioTemporal, detectarEventos, fasesPose, evaluarRango, construirResumen };
