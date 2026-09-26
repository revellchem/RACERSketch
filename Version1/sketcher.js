'use strict';
/* RACER Sketch – Version 1
   A dependency-free skeletal-structure editor. Model -> tools -> SVG renderer -> exporters.
*/
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  // ---------------------------------------------------------------- settings
  // Everything about appearance lives here; the future settings menu edits this object.
  const S = {
    bondLength: 44,      // px
    lineWidth: 2,        // px
    fontSize: 20,        // px, atom labels and text
    subScale: 0.7,       // subscript size relative to fontSize
    font: 'Arial, Helvetica, sans-serif',
    doubleGap: 6,        // px between the lines of a double/triple bond
    wedgeWidth: 3.5,     // half-width of the wide end of a wedge / hashed bond
    hashSpacing: 3.6,    // px between the lines of a hashed (dash) bond
    colorHetero: true,   // colour heteroatom labels (option)
    imageFormat: 'png',  // 'png' | 'jpg' (option)
    snapAngle: 15,       // degrees, when dragging bonds/arrows
    hitAtom: 10, hitBond: 6,
    exportScale: 2, exportPad: 24,
  };
  try { Object.assign(S, JSON.parse(localStorage.getItem('molsketch.options') || '{}')); } catch (e) { /* storage unavailable */ }
  function saveOptions() {
    try { localStorage.setItem('molsketch.options', JSON.stringify({ colorHetero: S.colorHetero, imageFormat: S.imageFormat })); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- element data
  // [atomic number, symbol, standard atomic weight]
  const ELEMENTS = [
    [1,'H',1.008],[2,'He',4.0026],[3,'Li',6.94],[4,'Be',9.0122],[5,'B',10.81],[6,'C',12.011],[7,'N',14.007],[8,'O',15.999],[9,'F',18.998],[10,'Ne',20.180],
    [11,'Na',22.990],[12,'Mg',24.305],[13,'Al',26.982],[14,'Si',28.085],[15,'P',30.974],[16,'S',32.06],[17,'Cl',35.45],[18,'Ar',39.95],[19,'K',39.098],[20,'Ca',40.078],
    [21,'Sc',44.956],[22,'Ti',47.867],[23,'V',50.942],[24,'Cr',51.996],[25,'Mn',54.938],[26,'Fe',55.845],[27,'Co',58.933],[28,'Ni',58.693],[29,'Cu',63.546],[30,'Zn',65.38],
    [31,'Ga',69.723],[32,'Ge',72.630],[33,'As',74.922],[34,'Se',78.971],[35,'Br',79.904],[36,'Kr',83.798],[37,'Rb',85.468],[38,'Sr',87.62],[39,'Y',88.906],[40,'Zr',91.224],
    [41,'Nb',92.906],[42,'Mo',95.95],[43,'Tc',97],[44,'Ru',101.07],[45,'Rh',102.91],[46,'Pd',106.42],[47,'Ag',107.87],[48,'Cd',112.41],[49,'In',114.82],[50,'Sn',118.71],
    [51,'Sb',121.76],[52,'Te',127.60],[53,'I',126.90],[54,'Xe',131.29],[55,'Cs',132.91],[56,'Ba',137.33],[57,'La',138.91],[58,'Ce',140.12],[59,'Pr',140.91],[60,'Nd',144.24],
    [61,'Pm',145],[62,'Sm',150.36],[63,'Eu',151.96],[64,'Gd',157.25],[65,'Tb',158.93],[66,'Dy',162.50],[67,'Ho',164.93],[68,'Er',167.26],[69,'Tm',168.93],[70,'Yb',173.05],
    [71,'Lu',174.97],[72,'Hf',178.49],[73,'Ta',180.95],[74,'W',183.84],[75,'Re',186.21],[76,'Os',190.23],[77,'Ir',192.22],[78,'Pt',195.08],[79,'Au',196.97],[80,'Hg',200.59],
    [81,'Tl',204.38],[82,'Pb',207.2],[83,'Bi',208.98],[84,'Po',209],[85,'At',210],[86,'Rn',222],[87,'Fr',223],[88,'Ra',226],[89,'Ac',227],[90,'Th',232.04],
    [91,'Pa',231.04],[92,'U',238.03],[93,'Np',237],[94,'Pu',244],[95,'Am',243],[96,'Cm',247],[97,'Bk',247],[98,'Cf',251],[99,'Es',252],[100,'Fm',257],
    [101,'Md',258],[102,'No',259],[103,'Lr',266],[104,'Rf',267],[105,'Db',268],[106,'Sg',269],[107,'Bh',270],[108,'Hs',269],[109,'Mt',278],[110,'Ds',281],
    [111,'Rg',282],[112,'Cn',285],[113,'Nh',286],[114,'Fl',289],[115,'Mc',290],[116,'Lv',293],[117,'Ts',294],[118,'Og',294],
  ];
  const EL = {};
  ELEMENTS.forEach(([z, s, m]) => { EL[s] = { z, mass: m }; });
  // Valence lists used to count implicit hydrogens (lowest valence that fits the bond-order sum).
  const VALENCE = { H: [1], B: [3], C: [4], N: [3], O: [2], F: [1], Si: [4], P: [3, 5], S: [2, 4, 6], Cl: [1], Br: [1], I: [1], Se: [2, 4, 6] };
  const COLORS = { N: '#1a4fd6', O: '#d62020', S: '#b8860b', P: '#c2410c', F: '#1f9d55', Cl: '#1f9d55', Br: '#a0522d', I: '#6a0dad' };
  const KEY_EL = { c: 'C', h: 'H', n: 'N', o: 'O', f: 'F', l: 'Cl', b: 'Br', i: 'I', p: 'P', s: 'S' };
  const PALETTE = ['C', 'H', 'N', 'O', 'F', 'Cl', 'Br', 'I', 'P', 'S'];

  // ---------------------------------------------------------------- model + undo
  let model = newModel();
  function newModel() { return { atoms: [], bonds: [], annots: [], nextId: 1 }; }
  const nid = () => model.nextId++;
  const undoStack = [], redoStack = [];
  function pushUndo() { undoStack.push(JSON.stringify(model)); if (undoStack.length > 300) undoStack.shift(); redoStack.length = 0; }
  function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(model)); model = JSON.parse(undoStack.pop()); selected.clear(); hover = null; render(); }
  function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(model)); model = JSON.parse(redoStack.pop()); selected.clear(); hover = null; render(); }

  const selected = new Set();   // atom ids and annotation ids
  let hover = null;             // {type:'atom'|'bond'|'annot', id}
  let tool = 'bond';
  let currentEl = 'C';

  // ---------------------------------------------------------------- geometry
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const norm = a => ((a % 360) + 360) % 360;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const angleOf = (p, q) => norm(deg(Math.atan2(-(q.y - p.y), q.x - p.x)));   // math angle (y up) from p to q
  const dirOf = a => ({ dx: Math.cos(rad(a)), dy: -Math.sin(rad(a)) });
  const angDiff = (a, b) => { const d = norm(a - b); return d > 180 ? 360 - d : d; };
  function rotateAround(p, pivot, delta) {          // delta in math degrees (counter-clockwise on screen)
    const x = p.x - pivot.x, y = -(p.y - pivot.y), c = Math.cos(rad(delta)), s = Math.sin(rad(delta));
    return { x: pivot.x + x * c - y * s, y: pivot.y - (x * s + y * c) };
  }
  function segDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  function pointInPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  // ---------------------------------------------------------------- graph helpers
  const atomById = id => model.atoms.find(a => a.id === id);
  const annotById = id => model.annots.find(a => a.id === id);
  const bondsOf = id => model.bonds.filter(b => b.a === id || b.b === id);
  const neighbors = id => bondsOf(id).map(b => atomById(b.a === id ? b.b : b.a));
  const degree = id => bondsOf(id).length;
  const bondBetween = (a, b) => model.bonds.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  const bondSum = atom => bondsOf(atom.id).reduce((s, b) => s + b.order, 0);
  function implicitH(atom) {
    const v = VALENCE[atom.el]; if (!v) return 0;
    const bs = bondSum(atom);
    if (atom.el === 'H' && bs === 0) return 0;
    for (const x of v) if (x >= bs) return x - bs;
    return 0;
  }
  const isLabeled = a => a.el !== 'C' || !!a.showLabel;
  function fragmentFrom(startId, blockedId) {         // atoms reachable from start without entering blocked (blocked itself is never included)
    const seen = new Set([startId]), stack = [startId];
    while (stack.length) {
      const id = stack.pop();
      for (const n of neighbors(id)) { if (n.id === blockedId || seen.has(n.id)) continue; seen.add(n.id); stack.push(n.id); }
    }
    return seen;
  }
  function smallestRing(bond, exclude) {              // BFS a -> b avoiding the bond itself (and excluded atoms); returns atom ids or null
    const prev = new Map([[bond.a, null]]), queue = [bond.a];
    while (queue.length) {
      const id = queue.shift();
      for (const bd of bondsOf(id)) {
        if (bd.id === bond.id) continue;
        const n = bd.a === id ? bd.b : bd.a;
        if (prev.has(n) || (exclude && exclude.has(n))) continue;
        prev.set(n, id);
        if (n === bond.b) { const path = []; let c = n; while (c !== null) { path.push(c); c = prev.get(c); } return path; }
        queue.push(n);
      }
    }
    return null;
  }
  // For a bond shared by two rings (e.g. tetralin), pick the ring with more double bonds so the
  // inner line of a double bond is drawn inside the aromatic ring rather than the saturated one.
  function preferredRing(bond) {
    const r1 = smallestRing(bond); if (!r1) return null;
    const r2 = smallestRing(bond, new Set(r1.filter(id => id !== bond.a && id !== bond.b)));
    if (!r2) return r1;
    const doubles = ring => { let n = 0; for (let i = 0; i + 1 < ring.length; i++) { const b = bondBetween(ring[i], ring[i + 1]); if (b && b !== bond && b.order === 2) n++; } return n; };
    return doubles(r2) > doubles(r1) ? r2 : r1;
  }
  function centroid(ids) { let x = 0, y = 0; for (const id of ids) { const a = atomById(id); x += a.x; y += a.y; } return { x: x / ids.length, y: y / ids.length }; }

  // ---------------------------------------------------------------- model edits
  function addAtom(el, x, y, showLabel) { const a = { id: nid(), el, x, y, showLabel: !!showLabel }; model.atoms.push(a); return a; }
  const MAX_BONDS = 6;
  const bondsFull = atom => degree(atom.id) >= MAX_BONDS;
  function addBond(a, b, order) {
    if (bondsFull(a) || bondsFull(b)) { flash(`An atom can have at most ${MAX_BONDS} bonds.`); return null; }
    const bd = { id: nid(), a: a.id, b: b.id, order: order || 1 }; model.bonds.push(bd); return bd;
  }
  function nearestAtom(x, y, r, excludeId) {
    let best = null, bd = r;
    for (const a of model.atoms) { if (a.id === excludeId) continue; const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  function atomAtOrNew(x, y) { return nearestAtom(x, y, S.bondLength * 0.3) || addAtom('C', x, y, false); }
  function removeAtom(id) {
    model.bonds = model.bonds.filter(b => b.a !== id && b.b !== id);
    model.atoms = model.atoms.filter(a => a.id !== id);
    selected.delete(id);
  }
  function removeBond(id) { model.bonds = model.bonds.filter(b => b.id !== id); }
  function cleanupOrphans() { for (const a of [...model.atoms]) if (!isLabeled(a) && degree(a.id) === 0) removeAtom(a.id); }
  function removeAnnot(id) { model.annots = model.annots.filter(a => a.id !== id); selected.delete(id); }

  // Angle for a new bond from an atom: 30° first, then 120° apart, then the largest gap.
  function newBondAngle(atom) {
    const nb = neighbors(atom.id);
    if (!nb.length) return 30;
    const angs = nb.map(n => angleOf(atom, n));
    if (nb.length === 1) {
      const th = angs[0], cands = [norm(th + 120), norm(th - 120)], n = nb[0];
      const nn = neighbors(n.id).filter(x => x.id !== atom.id);
      if (nn.length === 1) { const ref = angleOf(nn[0], n); return angDiff(cands[0], ref) <= angDiff(cands[1], ref) ? cands[0] : cands[1]; }
      cands.sort((a, b) => (Math.abs(Math.cos(rad(b))) - Math.abs(Math.cos(rad(a)))) || (Math.cos(rad(b)) - Math.cos(rad(a))) || (Math.sin(rad(b)) - Math.sin(rad(a))));
      return cands[0];
    }
    angs.sort((a, b) => a - b);
    let best = -1, bestAng = 0;
    for (let i = 0; i < angs.length; i++) {
      const a = angs[i], b = i + 1 < angs.length ? angs[i + 1] : angs[0] + 360, gap = b - a;
      if (gap > best) { best = gap; bestAng = norm(a + gap / 2); }
    }
    return bestAng;
  }
  function extendFromAtom(atom) {
    if (bondsFull(atom)) { flash(`An atom can have at most ${MAX_BONDS} bonds.`); return null; }
    const d = dirOf(newBondAngle(atom));
    const x = atom.x + d.dx * S.bondLength, y = atom.y + d.dy * S.bondLength;
    const target = nearestAtom(x, y, S.bondLength * 0.3, atom.id);
    if (target) { if (!bondBetween(atom.id, target.id)) addBond(atom, target, 1); return target; }
    const nb = addAtom('C', x, y, false); addBond(atom, nb, 1); return nb;
  }
  function ringWouldOverfill(hit) {   // fusing adds one bond to each shared atom; attaching adds two to the atom
    if (hit && hit.type === 'bond') { const b = model.bonds.find(x => x.id === hit.id); return b && (bondsFull(atomById(b.a)) || bondsFull(atomById(b.b))); }
    if (hit && hit.type === 'atom') return degree(hit.id) + 2 > MAX_BONDS;
    return false;
  }
  function bondDragTarget(from, pos, excludeId) {
    const near = nearestAtom(pos.x, pos.y, 14, excludeId);
    if (near) return { atom: near, x: near.x, y: near.y };
    const ang = Math.round(angleOf(from, pos) / S.snapAngle) * S.snapAngle, d = dirOf(ang);
    const x = from.x + d.dx * S.bondLength, y = from.y + d.dy * S.bondLength;
    const near2 = nearestAtom(x, y, S.bondLength * 0.3, excludeId);
    if (near2) return { atom: near2, x: near2.x, y: near2.y };
    return { x, y };
  }

  function setOrder(bond, order) {
    if (bond.order === 3 && order !== 3 && bond.saved) {
      for (const [id, p] of Object.entries(bond.saved)) { const at = atomById(+id); if (at) { at.x = p[0]; at.y = p[1]; } }
      delete bond.saved;
    }
    bond.order = order;
    if (order !== 1) delete bond.stereo;
    if (order === 3) straighten(bond);
  }
  // Wedge / dash: the narrow end sits at bond.a. Cycle none -> wedge -> dash -> none,
  // skipping a style the stereocentre already uses on another bond (one wedge and one dash per centre).
  const centreHas = (atomId, kind, except) => bondsOf(atomId).some(b => b !== except && b.a === atomId && b.stereo === kind);
  function nextStereo(bond, centreId) {
    const seq = ['wedge', 'dash', null];
    let i = seq.indexOf(bond.stereo || null);
    for (let k = 0; k < seq.length; k++) { i = (i + 1) % seq.length; const s = seq[i]; if (!s || !centreHas(centreId, s, bond)) return s; }
    return null;
  }
  function cycleStereo(bond, clickPt) {
    if (!bond.stereo) {   // choose the narrow end: the atom with more bonds (the stereocentre), else the end nearer the click
      const a = atomById(bond.a), b = atomById(bond.b), da = degree(a.id), db = degree(b.id);
      const narrowB = db > da || (db === da && clickPt && dist(clickPt, b) < dist(clickPt, a));
      if (narrowB) { bond.a = b.id; bond.b = a.id; }
    }
    const next = nextStereo(bond, bond.a);
    if (!next) { delete bond.stereo; return; }
    if (bond.order !== 1) setOrder(bond, 1);
    bond.stereo = next;
  }
  function setStereoFrom(bond, fromId, kind) {
    if (bond.b === fromId) { bond.b = bond.a; bond.a = fromId; }
    if (centreHas(fromId, kind, bond)) kind = kind === 'wedge' && !centreHas(fromId, 'dash', bond) ? 'dash' : null;
    if (!kind) { delete bond.stereo; return; }
    if (bond.order !== 1) setOrder(bond, 1);
    bond.stereo = kind;
  }
  function straighten(bond) {
    const a = atomById(bond.a), b = atomById(bond.b);
    const tryEnd = (pivot, other) => {
      const others = neighbors(pivot.id).filter(n => n.id !== other.id);
      if (others.length !== 1) return false;
      const target = angleOf(others[0], pivot), cur = angleOf(pivot, other);
      if (angDiff(target, cur) < 0.5) return true;
      const frag = fragmentFrom(other.id, pivot.id);
      if (others.some(n => frag.has(n.id))) return false;   // the bond is in a ring: leave it alone
      const saved = {};
      let delta = target - cur; if (delta > 180) delta -= 360; if (delta < -180) delta += 360;
      for (const id of frag) { const at = atomById(id); saved[id] = [at.x, at.y]; const p = rotateAround(at, pivot, delta); at.x = p.x; at.y = p.y; }
      bond.saved = saved; return true;
    };
    if (!tryEnd(a, b)) tryEnd(b, a);
  }

  // Rings
  function ringRadius(n, edge) { return edge / (2 * Math.sin(Math.PI / n)); }
  function placeRing(n, x, y) {
    const R = ringRadius(n, S.bondLength), pts = [];
    for (let i = 0; i < n; i++) { const d = dirOf(90 + i * 360 / n); pts.push({ x: x + d.dx * R, y: y + d.dy * R }); }
    return closeRing(pts.map(p => atomAtOrNew(p.x, p.y)));
  }
  function closeRing(atoms) { for (let i = 0; i < atoms.length; i++) { const a = atoms[i], b = atoms[(i + 1) % atoms.length]; if (a !== b && !bondBetween(a.id, b.id)) addBond(a, b, 1); } return atoms; }
  // Make a six-membered ring aromatic (Kekulé form): alternate double bonds wherever no atom ends up with two.
  function aromatize(atoms) {
    const ringBonds = atoms.map((a, i) => bondBetween(a.id, atoms[(i + 1) % atoms.length].id));
    const hasOtherMultiple = (atomId, except) => bondsOf(atomId).some(b => b !== except && b.order > 1);
    const evaluate = pattern => { let n = 0; for (const i of pattern) { const b = ringBonds[i]; if (!b) continue; if (b.order === 2 || (!hasOtherMultiple(b.a, b) && !hasOtherMultiple(b.b, b))) n++; } return n; };
    const patterns = [[0, 2, 4], [1, 3, 5]];
    const best = evaluate(patterns[1]) > evaluate(patterns[0]) ? patterns[1] : patterns[0];
    for (const i of best) { const b = ringBonds[i]; if (b && b.order === 1 && !hasOtherMultiple(b.a, b) && !hasOtherMultiple(b.b, b)) setOrder(b, 2); }
  }
  function fuseRing(n, bond) {
    const a = atomById(bond.a), b = atomById(bond.b), d = dist(a, b) || S.bondLength;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d; let nx = -uy, ny = ux;
    // put the ring on the side away from the existing neighbours
    let side = 0;
    for (const at of [a, b]) for (const nb of neighbors(at.id)) { if (nb === a || nb === b) continue; side += (nb.x - mid.x) * nx + (nb.y - mid.y) * ny; }
    if (side > 0) { nx = -nx; ny = -ny; } else if (side === 0 && ny > 0) { nx = -nx; ny = -ny; }
    const apo = d / (2 * Math.tan(Math.PI / n)), R = ringRadius(n, d);
    const c = { x: mid.x + nx * apo, y: mid.y + ny * apo };
    const phiA = angleOf(c, a), phiB = angleOf(c, b);
    let step = 360 / n; if (angDiff(phiA + step, phiB) > 1) step = -step;
    const atoms = [a, b];
    for (let k = 2; k < n; k++) { const dd = dirOf(phiA + k * step); atoms.push(atomAtOrNew(c.x + dd.dx * R, c.y + dd.dy * R)); }
    return closeRing(atoms);
  }
  function attachRing(n, atom) {
    const th = newBondAngle(atom), R = ringRadius(n, S.bondLength), d = dirOf(th);
    const c = { x: atom.x + d.dx * R, y: atom.y + d.dy * R }, atoms = [atom];
    for (let k = 1; k < n; k++) { const dd = dirOf(th + 180 + k * 360 / n); atoms.push(atomAtOrNew(c.x + dd.dx * R, c.y + dd.dy * R)); }
    return closeRing(atoms);
  }
  function ringAt(n, hit, p) {   // shared by the ring and benzene tools
    if (hit && hit.type === 'bond') return fuseRing(n, model.bonds.find(x => x.id === hit.id));
    if (hit && hit.type === 'atom') return attachRing(n, atomById(hit.id));
    return placeRing(n, p.x, p.y);
  }

  function applyLabel(atom, el) {
    if (el === 'C' && atom.el === 'C') atom.showLabel = !atom.showLabel;
    else { atom.el = el; atom.showLabel = true; }
  }

  // ---------------------------------------------------------------- text measurement & labels
  const mctx = document.createElement('canvas').getContext('2d');
  function textW(t, size) { mctx.font = `${size}px ${S.font}`; return mctx.measureText(t).width; }
  const labelColor = el => (S.colorHetero && COLORS[el]) || '#000';

  function hSide(atom) {
    const nb = neighbors(atom.id);
    if (!nb.length) return /^(O|S|F|Cl|Br|I)$/.test(atom.el) ? 'left' : 'right';   // H2O, H2S, HCl … but NH3, CH4
    let sx = 0, sy = 0;
    for (const n of nb) { const d = dist(atom, n) || 1; sx += (n.x - atom.x) / d; sy += (n.y - atom.y) / d; }
    if (Math.abs(sx) >= Math.abs(sy)) return sx > 0 ? 'left' : 'right';
    return sy > 0 ? 'above' : 'below';
  }
  function labelLayout(atom) {
    const size = S.fontSize, sub = size * S.subScale, nH = implicitH(atom), sym = atom.el;
    const wSym = textW(sym, size), base = atom.y + size * 0.36;
    const runs = [{ t: sym, x: atom.x - wSym / 2, y: base, size }];
    let x0 = atom.x - wSym / 2, x1 = atom.x + wSym / 2, y0 = atom.y - size * 0.38, y1 = atom.y + size * 0.4;
    if (nH > 0) {
      const wH = textW('H', size), wN = nH > 1 ? textW(String(nH), sub) : 0, wG = wH + wN, side = hSide(atom);
      let hx, hy = base;
      if (side === 'right') { hx = x1; x1 += wG; }
      else if (side === 'left') { hx = x0 - wG; x0 -= wG; }
      else if (side === 'above') { hx = atom.x - wG / 2; hy = base - size * 0.95; y0 -= size * 0.95; x0 = Math.min(x0, hx); x1 = Math.max(x1, hx + wG); }
      else { hx = atom.x - wG / 2; hy = base + size * 0.95; y1 += size * 0.95; x0 = Math.min(x0, hx); x1 = Math.max(x1, hx + wG); }
      runs.push({ t: 'H', x: hx, y: hy, size });
      if (nH > 1) runs.push({ t: String(nH), x: hx + wH, y: hy + size * 0.22, size: sub });
    }
    return { runs, bbox: { x0, y0, x1, y1 }, color: labelColor(atom.el) };
  }
  function clipToRect(P, Q, r, pad) {   // point where segment P->Q (Q inside rect r) enters the padded rect
    const x0 = r.x0 - pad, y0 = r.y0 - pad, x1 = r.x1 + pad, y1 = r.y1 + pad, dx = Q.x - P.x, dy = Q.y - P.y;
    let tmin = 1; const cands = [];
    if (dx) cands.push((x0 - P.x) / dx, (x1 - P.x) / dx);
    if (dy) cands.push((y0 - P.y) / dy, (y1 - P.y) / dy);
    for (const t of cands) {
      if (t < 0 || t > 1) continue;
      const x = P.x + t * dx, y = P.y + t * dy;
      if (x >= x0 - 0.01 && x <= x1 + 0.01 && y >= y0 - 0.01 && y <= y1 + 0.01) tmin = Math.min(tmin, t);
    }
    return { x: P.x + tmin * dx, y: P.y + tmin * dy };
  }

  // Text annotations: digits after a letter become subscripts, ^ starts a superscript (until a space).
  function parseText(str) {
    const runs = []; let mode = 0, prev = '';
    for (const ch of str) {
      if (ch === '^') { mode = 1; continue; }
      if (mode === 1 && ch === ' ') mode = 0;
      let m = mode;
      if (mode === 0 && /[0-9]/.test(ch)) {
        const last = runs[runs.length - 1];
        if (/[A-Za-z)\]]/.test(prev) || (last && last.m === -1 && /[0-9.]/.test(prev))) m = -1;
      }
      const last = runs[runs.length - 1];
      if (last && last.m === m) last.t += ch; else runs.push({ t: ch, m });
      prev = ch;
    }
    return runs;
  }
  function textBBox(an) {
    const size = S.fontSize; let w = 0;
    for (const r of parseText(an.text)) w += textW(r.t, r.m ? size * S.subScale : size);
    return { x0: an.x - 2, y0: an.y - size * 0.8, x1: an.x + Math.max(w, 8) + 2, y1: an.y + size * 0.35 };
  }
  function annotBBox(an) {
    if (an.type === 'text') return textBBox(an);
    return { x0: Math.min(an.x1, an.x2) - 8, y0: Math.min(an.y1, an.y2) - 8, x1: Math.max(an.x1, an.x2) + 8, y1: Math.max(an.y1, an.y2) + 8 };
  }

  // ---------------------------------------------------------------- rendering
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  const HL = '#2c6bed';

  function trimmedEnds(bond, layouts) {   // bond end points pulled back from atom labels
    const a = atomById(bond.a), b = atomById(bond.b);
    let p1 = { x: a.x, y: a.y }, p2 = { x: b.x, y: b.y };
    if (layouts.has(a.id)) p1 = clipToRect({ x: b.x, y: b.y }, p1, layouts.get(a.id).bbox, 3);
    if (layouts.has(b.id)) p2 = clipToRect({ x: a.x, y: a.y }, p2, layouts.get(b.id).bbox, 3);
    return [p1, p2];
  }
  function drawStereoBond(g, bond, layouts) {
    const [p1, p2] = trimmedEnds(bond, layouts);   // narrow end at p1 (bond.a)
    const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, w = S.wedgeWidth;
    if (bond.stereo === 'wedge') {
      el('polygon', { points: `${p1.x},${p1.y} ${p2.x + nx * w},${p2.y + ny * w} ${p2.x - nx * w},${p2.y - ny * w}`, fill: '#000', stroke: 'none' }, g);
    } else {
      const n = Math.max(3, Math.round(len / S.hashSpacing));
      for (let i = 1; i <= n; i++) {
        const t = i / n, x = p1.x + dx * t, y = p1.y + dy * t, hw = w * t;
        el('line', { x1: x + nx * hw, y1: y + ny * hw, x2: x - nx * hw, y2: y - ny * hw, 'stroke-width': Math.max(1.4, S.lineWidth * 0.8), 'stroke-linecap': 'butt' }, g);
      }
    }
  }
  function bondGeometry(bond, layouts) {
    const a = atomById(bond.a), b = atomById(bond.b);
    const [p1, p2] = trimmedEnds(bond, layouts);
    const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux, g = S.doubleGap;
    const off = (p, k) => ({ x: p.x + nx * k, y: p.y + ny * k });
    if (bond.order === 1) return [[p1, p2]];
    if (bond.order === 3) return [[p1, p2], [off(p1, g), off(p2, g)], [off(p1, -g), off(p2, -g)]];
    const dA = degree(a.id), dB = degree(b.id);
    const sym = (dA === 1 && dB === 1) || (dA === 1 && isLabeled(a)) || (dB === 1 && isLabeled(b));
    if (sym) return [[off(p1, g / 2), off(p2, g / 2)], [off(p1, -g / 2), off(p2, -g / 2)]];
    let side = 1; const ring = preferredRing(bond);
    if (ring) { const c = centroid(ring); side = Math.sign((c.x - a.x) * nx + (c.y - a.y) * ny) || 1; }
    else {
      let s = 0;
      for (const n of neighbors(a.id)) if (n.id !== b.id) s += Math.sign((n.x - a.x) * nx + (n.y - a.y) * ny);
      for (const n of neighbors(b.id)) if (n.id !== a.id) s += Math.sign((n.x - b.x) * nx + (n.y - b.y) * ny);
      side = s >= 0 ? 1 : -1;
    }
    const sh = g * 1.2;
    const q1 = dA > 1 && !isLabeled(a) ? { x: p1.x + ux * sh, y: p1.y + uy * sh } : p1;
    const q2 = dB > 1 && !isLabeled(b) ? { x: p2.x - ux * sh, y: p2.y - uy * sh } : p2;
    return [[p1, p2], [off(q1, side * g), off(q2, side * g)]];
  }

  function drawArrow(g, an, color) {
    const lw = S.lineWidth, p1 = { x: an.x1, y: an.y1 }, p2 = { x: an.x2, y: an.y2 };
    const len = dist(p1, p2) || 1, ux = (p2.x - p1.x) / len, uy = (p2.y - p1.y) / len, nx = -uy, ny = ux, hl = 12, hw = 5;
    const line = (a, b) => el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: color, 'stroke-width': lw, 'stroke-linecap': 'round' }, g);
    if (an.type === 'arrow') {
      line(p1, { x: p2.x - ux * hl * 0.6, y: p2.y - uy * hl * 0.6 });
      el('polygon', { points: `${p2.x},${p2.y} ${p2.x - ux * hl + nx * hw},${p2.y - uy * hl + ny * hw} ${p2.x - ux * hl - nx * hw},${p2.y - uy * hl - ny * hw}`, fill: color }, g);
    } else {
      const o = 3.5;
      const t1 = { x: p1.x - nx * o, y: p1.y - ny * o }, t2 = { x: p2.x - nx * o, y: p2.y - ny * o };
      const b1 = { x: p1.x + nx * o, y: p1.y + ny * o }, b2 = { x: p2.x + nx * o, y: p2.y + ny * o };
      line(t1, t2); line(t2, { x: t2.x - ux * hl - nx * hw * 1.3, y: t2.y - uy * hl - ny * hw * 1.3 });
      line(b2, b1); line(b1, { x: b1.x + ux * hl + nx * hw * 1.3, y: b1.y + uy * hl + ny * hw * 1.3 });
    }
  }
  function drawText(g, an, color) {
    const size = S.fontSize, t = el('text', { x: an.x, y: an.y, 'font-size': size, 'font-family': S.font, fill: color }, g);
    let shift = 0;
    for (const r of parseText(an.text)) {
      const target = r.m === -1 ? size * 0.25 : r.m === 1 ? -size * 0.45 : 0;
      const ts = el('tspan', { 'font-size': r.m ? size * S.subScale : size, dy: target - shift }, t);
      ts.textContent = r.t; shift = target;
    }
  }

  let lastLayouts = new Map();
  let editing = null;   // annotation being edited in the text box

  function renderScene(root, clean) {
    while (root.firstChild) root.removeChild(root.firstChild);
    const layouts = new Map();
    for (const a of model.atoms) if (isLabeled(a)) layouts.set(a.id, labelLayout(a));

    if (!clean) {
      const hg = el('g', {}, root);
      for (const a of model.atoms) if (selected.has(a.id)) el('circle', { cx: a.x, cy: a.y, r: 9, fill: HL, 'fill-opacity': 0.2 }, hg);
      for (const b of model.bonds) if (selected.has(b.a) && selected.has(b.b)) {
        const A = atomById(b.a), B = atomById(b.b);
        el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: HL, 'stroke-opacity': 0.2, 'stroke-width': 9, 'stroke-linecap': 'round' }, hg);
      }
      for (const an of model.annots) if (selected.has(an.id)) {
        const bb = annotBBox(an);
        el('rect', { x: bb.x0, y: bb.y0, width: bb.x1 - bb.x0, height: bb.y1 - bb.y0, fill: 'none', stroke: HL, 'stroke-dasharray': '4 3', 'stroke-width': 1 }, hg);
        if (an.type !== 'text') for (const p of [[an.x1, an.y1], [an.x2, an.y2]]) el('circle', { cx: p[0], cy: p[1], r: 5, fill: '#fff', stroke: HL, 'stroke-width': 1.5 }, hg);
      }
      if (hover) {
        if (hover.type === 'atom') { const a = atomById(hover.id); if (a) el('circle', { cx: a.x, cy: a.y, r: 11, fill: HL, 'fill-opacity': 0.15, stroke: HL, 'stroke-width': 1.5 }, hg); }
        else if (hover.type === 'bond') { const b = model.bonds.find(x => x.id === hover.id); if (b) { const A = atomById(b.a), B = atomById(b.b); el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: HL, 'stroke-opacity': 0.3, 'stroke-width': 10, 'stroke-linecap': 'round' }, hg); } }
        else { const an = annotById(hover.id); if (an && !selected.has(an.id)) { const bb = annotBBox(an); el('rect', { x: bb.x0, y: bb.y0, width: bb.x1 - bb.x0, height: bb.y1 - bb.y0, fill: HL, 'fill-opacity': 0.08, stroke: HL, 'stroke-width': 1, 'stroke-dasharray': '4 3' }, hg); } }
      }
    }

    const bg = el('g', { stroke: '#000', 'stroke-width': S.lineWidth, 'stroke-linecap': 'round', fill: 'none' }, root);
    for (const b of model.bonds) {
      if (b.stereo && b.order === 1) { drawStereoBond(bg, b, layouts); continue; }
      for (const [p, q] of bondGeometry(b, layouts)) el('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y }, bg);
    }

    const ag = el('g', { 'font-family': S.font }, root);
    for (const L of layouts.values()) for (const r of L.runs) { const t = el('text', { x: r.x, y: r.y, 'font-size': r.size, fill: L.color }, ag); t.textContent = r.t; }

    const ng = el('g', {}, root);
    for (const an of model.annots) {
      if (editing && editing.id === an.id) continue;
      if (an.type === 'text') drawText(ng, an, '#000'); else drawArrow(ng, an, '#000');
    }
    return layouts;
  }

  // ---------------------------------------------------------------- DOM
  const $ = id => document.getElementById(id);
  const sheet = $('sheet'), sceneG = el('g', { id: 'scene' }, sheet), overlayG = el('g', { id: 'overlay' }, sheet);
  const canvasBox = $('canvas'), editor = $('text-editor'), statusEl = $('status');
  let overlay = null;   // {type:'lasso', pts} | {type:'bondpreview', from, to, snap} | {type:'arrowpreview', an}

  function renderOverlay() {
    while (overlayG.firstChild) overlayG.removeChild(overlayG.firstChild);
    if (!model.atoms.length && !model.annots.length && !overlay) {
      const r = sheet.getBoundingClientRect();
      const t = el('text', { x: r.width / 2, y: r.height / 2, 'text-anchor': 'middle', 'font-size': 15, fill: '#aab', 'font-family': 'Segoe UI, system-ui, sans-serif' }, overlayG);
      t.textContent = 'Pick a tool on the left and click here to start drawing. Hover an atom and press O, N, Cl (L), Br (B) … to label it.';
    }
    if (!overlay) return;
    if (overlay.type === 'lasso') {
      el('polygon', { points: overlay.pts.map(p => `${p.x},${p.y}`).join(' '), fill: HL, 'fill-opacity': 0.06, stroke: HL, 'stroke-width': 1, 'stroke-dasharray': '5 4' }, overlayG);
    } else if (overlay.type === 'bondpreview') {
      el('line', { x1: overlay.from.x, y1: overlay.from.y, x2: overlay.to.x, y2: overlay.to.y, stroke: HL, 'stroke-width': S.lineWidth, 'stroke-opacity': 0.6, 'stroke-linecap': 'round' }, overlayG);
      el('circle', { cx: overlay.to.x, cy: overlay.to.y, r: overlay.snap ? 11 : 5, fill: HL, 'fill-opacity': 0.25, stroke: HL, 'stroke-width': 1 }, overlayG);
    } else if (overlay.type === 'arrowpreview') {
      const g = el('g', { opacity: 0.6 }, overlayG); drawArrow(g, overlay.an, HL);
    }
  }
  function render() { lastLayouts = renderScene(sceneG, false); renderOverlay(); $('btn-undo').disabled = !undoStack.length; $('btn-redo').disabled = !redoStack.length; }

  // ---------------------------------------------------------------- hit testing
  function hitTest(p) {
    let best = null, bd = S.hitAtom;
    for (const a of model.atoms) {
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      const L = lastLayouts.get(a.id);
      const inLabel = L && p.x >= L.bbox.x0 && p.x <= L.bbox.x1 && p.y >= L.bbox.y0 && p.y <= L.bbox.y1;
      if (d < bd || (inLabel && !best)) { bd = d; best = a; }
    }
    if (best) return { type: 'atom', id: best.id };
    for (const b of model.bonds) { if (segDist(p, atomById(b.a), atomById(b.b)) <= S.hitBond) return { type: 'bond', id: b.id }; }
    for (let i = model.annots.length - 1; i >= 0; i--) {
      const an = model.annots[i];
      if (an.type === 'text') { const bb = textBBox(an); if (p.x >= bb.x0 && p.x <= bb.x1 && p.y >= bb.y0 && p.y <= bb.y1) return { type: 'annot', id: an.id }; }
      else if (segDist(p, { x: an.x1, y: an.y1 }, { x: an.x2, y: an.y2 }) <= 7) return { type: 'annot', id: an.id };
    }
    return null;
  }
  function pt(e) { const r = sheet.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  // ---------------------------------------------------------------- selection helpers
  function selectOnly(hit) {
    selected.clear();
    addToSelection(hit);
  }
  function addToSelection(hit) {
    if (!hit) return;
    if (hit.type === 'atom' || hit.type === 'annot') selected.add(hit.id);
    else { const b = model.bonds.find(x => x.id === hit.id); if (b) { selected.add(b.a); selected.add(b.b); } }
  }
  const isSelected = hit => hit && (hit.type === 'bond' ? (() => { const b = model.bonds.find(x => x.id === hit.id); return b && selected.has(b.a) && selected.has(b.b); })() : selected.has(hit.id));
  function selectAll() { selected.clear(); for (const a of model.atoms) selected.add(a.id); for (const n of model.annots) selected.add(n.id); render(); }
  function deleteSelection() {
    if (!selected.size) return;
    pushUndo();
    for (const id of [...selected]) { if (atomById(id)) removeAtom(id); else removeAnnot(id); }
    cleanupOrphans(); selected.clear(); hover = null; render();
  }
  function deleteHit(hit) {
    pushUndo();
    if (hit.type === 'atom') removeAtom(hit.id);
    else if (hit.type === 'bond') removeBond(hit.id);
    else removeAnnot(hit.id);
    cleanupOrphans(); hover = null; render();
  }
  function moveSelection(dx, dy) {
    for (const a of model.atoms) if (selected.has(a.id)) { a.x += dx; a.y += dy; }
    for (const n of model.annots) if (selected.has(n.id)) { if (n.type === 'text') { n.x += dx; n.y += dy; } else { n.x1 += dx; n.y1 += dy; n.x2 += dx; n.y2 += dy; } }
  }

  // ---------------------------------------------------------------- clipboard (copy / paste)
  let clip = null;
  function copySelection() {
    const atoms = model.atoms.filter(a => selected.has(a.id)), ids = new Set(atoms.map(a => a.id));
    const bonds = model.bonds.filter(b => ids.has(b.a) && ids.has(b.b)), annots = model.annots.filter(n => selected.has(n.id));
    if (!atoms.length && !annots.length) { flash('Nothing selected to copy'); return; }
    clip = JSON.parse(JSON.stringify({ atoms, bonds, annots }));
    if (atoms.length && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(toMol(atoms, bonds)).catch(() => {});
    flash('Copied. Ctrl+V pastes a copy.');
  }
  function paste() {
    if (!clip) return;
    pushUndo(); selected.clear();
    const map = new Map(), off = S.bondLength;
    for (const a of clip.atoms) { const na = Object.assign({}, a, { id: nid(), x: a.x + off, y: a.y + off }); map.set(a.id, na.id); model.atoms.push(na); selected.add(na.id); }
    for (const b of clip.bonds) { const nb = Object.assign({}, b, { id: nid(), a: map.get(b.a), b: map.get(b.b) }); delete nb.saved; model.bonds.push(nb); }
    for (const n of clip.annots) {
      const nn = Object.assign({}, n, { id: nid() });
      if (nn.type === 'text') { nn.x += off; nn.y += off; } else { nn.x1 += off; nn.y1 += off; nn.x2 += off; nn.y2 += off; }
      model.annots.push(nn); selected.add(nn.id);
    }
    clip = JSON.parse(JSON.stringify({
      atoms: clip.atoms.map(a => Object.assign({}, a, { x: a.x + off, y: a.y + off })), bonds: clip.bonds,
      annots: clip.annots.map(n => n.type === 'text' ? Object.assign({}, n, { x: n.x + off, y: n.y + off }) : Object.assign({}, n, { x1: n.x1 + off, y1: n.y1 + off, x2: n.x2 + off, y2: n.y2 + off })),
    }));
    render();
  }

  // ---------------------------------------------------------------- pointer handling
  let drag = null;
  sheet.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (editing) commitEditor();
    const p = pt(e), hit = hitTest(p);
    try { sheet.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already-released pointer */ }
    drag = { start: p, last: p, hit, moved: false, pushed: false };

    if (tool === 'select') {
      if (hit) {
        const an = hit.type === 'annot' ? annotById(hit.id) : null;
        if (an && an.type !== 'text') {
          const d1 = Math.hypot(an.x1 - p.x, an.y1 - p.y), d2 = Math.hypot(an.x2 - p.x, an.y2 - p.y);
          if (d1 <= 9 || d2 <= 9) { drag.kind = 'arrowEnd'; drag.an = an; drag.end = d1 <= d2 ? 1 : 2; selectOnly(hit); render(); return; }
        }
        if (e.shiftKey) { if (isSelected(hit)) { /* toggle off */ if (hit.type === 'bond') { const b = model.bonds.find(x => x.id === hit.id); selected.delete(b.a); selected.delete(b.b); } else selected.delete(hit.id); } else addToSelection(hit); }
        else if (!isSelected(hit)) selectOnly(hit);
        drag.kind = 'move';
      } else {
        if (!e.shiftKey) selected.clear();
        drag.kind = 'lasso'; overlay = { type: 'lasso', pts: [p] };
      }
      render();
    } else if (tool === 'bond' || tool === 'wedge') {
      if (hit && hit.type === 'atom') drag.kind = 'newbond';
      else if (hit && hit.type === 'bond') drag.kind = tool === 'wedge' ? 'stereo' : 'cycle';
      else drag.kind = 'newbondEmpty';
    } else if (tool === 'eraser') {
      if (hit) { deleteHit(hit); drag.pushed = true; }
      drag.kind = 'erase';
    } else if (tool === 'arrow' || tool === 'eq') {
      drag.kind = 'arrow';
    } else {
      drag.kind = 'click';
    }
  });

  sheet.addEventListener('pointermove', e => {
    const p = pt(e);
    if (!drag) {
      const h = hitTest(p);
      if ((h && !hover) || (!h && hover) || (h && hover && (h.type !== hover.type || h.id !== hover.id))) { hover = h; render(); }
      return;
    }
    if (!drag.moved && dist(p, drag.start) < 4) return;
    drag.moved = true;
    const dx = p.x - drag.last.x, dy = p.y - drag.last.y; drag.last = p;

    if (drag.kind === 'move') {
      if (!drag.pushed) { pushUndo(); drag.pushed = true; }
      moveSelection(dx, dy); render();
    } else if (drag.kind === 'arrowEnd') {
      if (!drag.pushed) { pushUndo(); drag.pushed = true; }
      const an = drag.an, fixed = drag.end === 1 ? { x: an.x2, y: an.y2 } : { x: an.x1, y: an.y1 };
      const len = dist(fixed, p), ang = Math.round(angleOf(fixed, p) / S.snapAngle) * S.snapAngle, d = dirOf(ang);
      const np = { x: fixed.x + d.dx * len, y: fixed.y + d.dy * len };
      if (drag.end === 1) { an.x1 = np.x; an.y1 = np.y; } else { an.x2 = np.x; an.y2 = np.y; }
      render();
    } else if (drag.kind === 'lasso') {
      overlay.pts.push(p); renderOverlay();
    } else if (drag.kind === 'newbond' || drag.kind === 'newbondEmpty') {
      const from = drag.kind === 'newbond' ? atomById(drag.hit.id) : drag.start;
      const t = bondDragTarget(from, p, drag.kind === 'newbond' ? drag.hit.id : -1);
      overlay = { type: 'bondpreview', from, to: t, snap: !!t.atom }; renderOverlay();
    } else if (drag.kind === 'arrow') {
      const len = dist(drag.start, p), ang = Math.round(angleOf(drag.start, p) / S.snapAngle) * S.snapAngle, d = dirOf(ang);
      overlay = { type: 'arrowpreview', an: { type: tool, x1: drag.start.x, y1: drag.start.y, x2: drag.start.x + d.dx * len, y2: drag.start.y + d.dy * len } }; renderOverlay();
    } else if (drag.kind === 'erase') {
      const h = hitTest(p);
      if (h) { if (!drag.pushed) { pushUndo(); drag.pushed = true; } if (h.type === 'atom') removeAtom(h.id); else if (h.type === 'bond') removeBond(h.id); else removeAnnot(h.id); cleanupOrphans(); render(); }
    }
  });

  sheet.addEventListener('pointerup', e => {
    if (!drag) return;
    const p = pt(e), d = drag; drag = null;
    const hit = d.hit;
    if (d.kind === 'lasso') {
      if (d.moved && overlay && overlay.pts.length > 2) {
        // A nearly straight drag encloses nothing, so treat it as a rectangle (marquee) instead of a lasso.
        let poly = overlay.pts, area = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p.x * q.y - q.x * p.y; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
        if (Math.abs(area) / 2 < 0.2 * (x1 - x0) * (y1 - y0)) poly = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
        for (const a of model.atoms) if (pointInPoly(a, poly)) selected.add(a.id);
        for (const an of model.annots) { const bb = annotBBox(an); if (pointInPoly({ x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 }, poly)) selected.add(an.id); }
      }
      overlay = null; render(); return;
    }
    if (d.kind === 'move' || d.kind === 'arrowEnd') { render(); return; }
    if (d.kind === 'erase') { return; }

    if (d.kind === 'cycle') {
      if (!d.moved) { const b = model.bonds.find(x => x.id === hit.id); if (b) { pushUndo(); setOrder(b, b.order === 3 ? 1 : b.order + 1); } }
      render(); return;
    }
    if (d.kind === 'stereo') {
      if (!d.moved) { const b = model.bonds.find(x => x.id === hit.id); if (b) { pushUndo(); cycleStereo(b, p); } }
      render(); return;
    }
    if (d.kind === 'newbond' || d.kind === 'newbondEmpty') {
      overlay = null;
      if (d.kind === 'newbond') {
        const from0 = atomById(hit.id), t0 = d.moved ? bondDragTarget(from0, p, from0.id) : null;
        if (bondsFull(from0) || (t0 && t0.atom && t0.atom !== from0 && !bondBetween(from0.id, t0.atom.id) && bondsFull(t0.atom))) { flash(`An atom can have at most ${MAX_BONDS} bonds.`); render(); return; }
      }
      pushUndo();
      let from, to;
      if (d.kind === 'newbond') {
        from = atomById(hit.id);
        if (!d.moved) to = extendFromAtom(from);
        else { const t = bondDragTarget(from, p, from.id); to = t.atom || addAtom('C', t.x, t.y, false); if (to !== from && !bondBetween(from.id, to.id)) addBond(from, to, 1); }
      } else {
        from = addAtom('C', d.start.x, d.start.y, false);
        if (!d.moved) { const dd = dirOf(30); to = addAtom('C', from.x + dd.dx * S.bondLength, from.y + dd.dy * S.bondLength, false); addBond(from, to, 1); }
        else { const t = bondDragTarget(from, p, from.id); to = t.atom || addAtom('C', t.x, t.y, false); addBond(from, to, 1); }
      }
      if (tool === 'wedge' && to && to !== from) { const bd = bondBetween(from.id, to.id); if (bd) setStereoFrom(bd, from.id, 'wedge'); }
      render(); return;
    }
    if (d.kind === 'arrow') {
      overlay = null; pushUndo();
      let an;
      if (!d.moved) an = { id: nid(), type: tool, x1: d.start.x - 50, y1: d.start.y, x2: d.start.x + 50, y2: d.start.y };
      else { const len = dist(d.start, p), ang = Math.round(angleOf(d.start, p) / S.snapAngle) * S.snapAngle, dd = dirOf(ang); an = { id: nid(), type: tool, x1: d.start.x, y1: d.start.y, x2: d.start.x + dd.dx * len, y2: d.start.y + dd.dy * len }; }
      model.annots.push(an); render(); return;
    }
    if (d.kind === 'click' && !d.moved) {
      if (tool === 'atom') {
        pushUndo();
        if (hit && hit.type === 'atom') applyLabel(atomById(hit.id), currentEl);
        else if (hit && hit.type === 'bond') { /* nothing */ }
        else addAtom(currentEl, p.x, p.y, true);
        render();
      } else if (tool === 'ring5' || tool === 'ring6' || tool === 'benzene') {
        if (ringWouldOverfill(hit)) { flash(`An atom can have at most ${MAX_BONDS} bonds.`); return; }
        pushUndo();
        const atoms = ringAt(tool === 'ring5' ? 5 : 6, hit, p);
        if (tool === 'benzene') aromatize(atoms);
        render();
      } else if (tool === 'text') {
        if (hit && hit.type === 'annot' && annotById(hit.id).type === 'text') openEditor(annotById(hit.id), false);
        else openEditor({ id: nid(), type: 'text', x: p.x, y: p.y, text: '' }, true);
      }
    }
  });
  sheet.addEventListener('dblclick', e => {
    const hit = hitTest(pt(e));
    if (hit && hit.type === 'annot') { const an = annotById(hit.id); if (an.type === 'text') openEditor(an, false); }
  });
  sheet.addEventListener('pointerleave', () => { if (!drag && hover) { hover = null; render(); } });

  // ---------------------------------------------------------------- text editor overlay
  function openEditor(an, isNew) {
    editing = an; editing.isNew = isNew;
    editor.value = an.text;
    editor.style.left = an.x - 3 + 'px';
    editor.style.top = an.y - S.fontSize * 0.95 + 'px';
    editor.style.font = `${S.fontSize}px ${S.font}`;
    editor.classList.remove('hidden'); sizeEditor(); render(); editor.focus(); editor.select();
  }
  function sizeEditor() { editor.style.width = Math.max(90, textW(editor.value, S.fontSize) + 24) + 'px'; }
  function commitEditor() {
    if (!editing) return;
    const an = editing, txt = editor.value.trim(); editing = null;
    editor.blur(); editor.classList.add('hidden');
    if (an.isNew) { if (txt) { pushUndo(); an.text = txt; delete an.isNew; model.annots.push(an); } }
    else if (txt !== an.text) { pushUndo(); an.text = txt; if (!txt) removeAnnot(an.id); }
    delete an.isNew; render();
  }
  function cancelEditor() { if (!editing) return; const an = editing; editing = null; editor.blur(); editor.classList.add('hidden'); if (!an.isNew && !an.text) removeAnnot(an.id); delete an.isNew; render(); }
  editor.addEventListener('input', sizeEditor);
  editor.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commitEditor(); } else if (e.key === 'Escape') { e.preventDefault(); cancelEditor(); } e.stopPropagation(); });
  editor.addEventListener('blur', () => { if (editing) commitEditor(); });

  // ---------------------------------------------------------------- keyboard
  window.addEventListener('keydown', e => {
    if (editing || document.querySelector('dialog[open]') || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key, lower = k.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (lower === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (lower === 'y') { e.preventDefault(); redo(); }
      else if (lower === 'c') { e.preventDefault(); copySelection(); }
      else if (lower === 'v') { e.preventDefault(); paste(); }
      else if (lower === 'x') { e.preventDefault(); copySelection(); deleteSelection(); }
      else if (lower === 'a') { e.preventDefault(); selectAll(); }
      return;
    }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); if (hover) deleteHit(hover); else deleteSelection(); return; }
    if (k === 'Escape') { selected.clear(); closePalette(); setTool('select'); render(); return; }
    if (hover && hover.type === 'atom' && KEY_EL[lower]) { const a = atomById(hover.id); if (a) { pushUndo(); applyLabel(a, KEY_EL[lower]); render(); } return; }
    if (hover && hover.type === 'bond' && /^[123]$/.test(k)) { const b = model.bonds.find(x => x.id === hover.id); if (b) { pushUndo(); setOrder(b, +k); render(); } return; }
    const toolKeys = { v: 'select', b: 'bond', w: 'wedge', x: 'atom', 5: 'ring5', 6: 'ring6', a: 'benzene', r: 'arrow', q: 'eq', t: 'text', e: 'eraser' };
    if (toolKeys[lower]) { setTool(toolKeys[lower]); if (lower === 'x') togglePalette(true); }
  });

  // ---------------------------------------------------------------- tools UI
  const HINTS = {
    select: 'Select: click an item, or drag on empty space to lasso. Drag to move. Shift+click adds. Delete removes. Ctrl+C / Ctrl+V copy and paste. Double-click text to edit it.',
    bond: 'Bond: click empty space for a new bond at 30°. Click an atom to add a bond (120° apart). Drag from an atom to choose the direction. Click a bond: single → double → triple. Hover an atom and press C H N O F L B I P S to label it.',
    wedge: 'Wedge / dash: click a bond once for a wedge, again for a dash, again to clear. Each stereocentre allows one wedge and one dash. Click or drag from an atom to add a new wedged bond.',
    benzene: 'Benzene: click empty space to place a benzene ring, click a bond to fuse one onto it, or click an atom to attach a phenyl ring there.',
    atom: 'Atom label: click an atom to make it {EL}. Click empty space to place a new {EL}. Pressing C on a carbon that already shows its label hides the label again.',
    ring5: '5-ring: click empty space to place a ring, click a bond to fuse a ring to it, or click an atom to attach a ring there.',
    ring6: '6-ring: click empty space to place a ring, click a bond to fuse a ring to it, or click an atom to attach a ring there.',
    arrow: 'Arrow: click to place a reaction arrow, or drag to set its length and direction. Use Select to move it or drag its ends.',
    eq: 'Equilibrium arrow: click to place, or drag to set its length and direction. Use Select to move it or drag its ends.',
    text: 'Text: click to place text, Enter to finish. Digits after letters become subscripts (H2O → H₂O); ^ makes a superscript (^+). Click existing text to edit it.',
    eraser: 'Eraser: click or drag across atoms, bonds, arrows, or text to remove them. Undo with Ctrl+Z.',
  };
  let flashTimer = null;
  function setStatus() { statusEl.textContent = HINTS[tool].replace(/\{EL\}/g, currentEl); statusEl.classList.remove('flash'); }
  function flash(msg) { clearTimeout(flashTimer); statusEl.textContent = msg; statusEl.classList.add('flash'); flashTimer = setTimeout(setStatus, 3500); }
  function setTool(t) {
    tool = t; overlay = null; drag = null;
    document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    sheet.style.cursor = t === 'select' ? 'default' : t === 'text' ? 'text' : 'crosshair';
    if (t !== 'atom') closePalette();
    setStatus(); render();
  }
  document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.tool === 'atom') { setTool('atom'); togglePalette(); } else setTool(b.dataset.tool);
  }));

  // atom palette
  const palette = $('atom-palette'), paletteGrid = $('palette-grid');
  for (const s of PALETTE) { const d = document.createElement('button'); d.className = 'el'; d.textContent = s; d.style.color = labelColor(s); d.dataset.el = s; d.addEventListener('click', () => { setElement(s); closePalette(); }); paletteGrid.appendChild(d); }
  $('palette-more').addEventListener('click', () => { closePalette(); openPTable(); });
  function setElement(s) { currentEl = s; $('atom-el').textContent = s; $('atom-el').style.color = labelColor(s); paletteGrid.querySelectorAll('.el').forEach(x => x.classList.toggle('sel', x.dataset.el === s)); setTool('atom'); }
  function togglePalette(forceOpen) { const open = forceOpen === true ? true : palette.classList.contains('hidden'); palette.classList.toggle('hidden', !open); }
  function closePalette() { palette.classList.add('hidden'); }
  document.addEventListener('pointerdown', e => { if (!palette.contains(e.target) && !e.target.closest('[data-tool="atom"]')) closePalette(); });

  // periodic table
  function openPTable() {
    const grid = $('ptable-grid');
    if (!grid.childElementCount) {
      for (const [z, s] of ELEMENTS) {
        let row, col;
        if (z === 1) { row = 1; col = 1; } else if (z === 2) { row = 1; col = 18; }
        else if (z <= 4) { row = 2; col = z - 2; } else if (z <= 10) { row = 2; col = z + 8; }
        else if (z <= 12) { row = 3; col = z - 10; } else if (z <= 18) { row = 3; col = z; }
        else if (z <= 36) { row = 4; col = z - 18; } else if (z <= 54) { row = 5; col = z - 36; }
        else if (z <= 56) { row = 6; col = z - 54; } else if (z <= 71) { row = 9; col = z - 54; } else if (z <= 86) { row = 6; col = z - 68; }
        else if (z <= 88) { row = 7; col = z - 86; } else if (z <= 103) { row = 10; col = z - 86; } else { row = 7; col = z - 100; }
        const b = document.createElement('button'); b.className = 'pt'; b.style.gridRow = row; b.style.gridColumn = col;
        b.innerHTML = `<span class="z">${z}</span>${s}`; b.style.color = labelColor(s);
        if (VALENCE[s]) b.classList.add('organic');
        b.addEventListener('click', () => { setElement(s); $('dlg-ptable').close(); });
        grid.appendChild(b);
      }
    }
    $('dlg-ptable').showModal();
  }

  // ---------------------------------------------------------------- export: image
  function contentBBox() {
    let bb = null;
    const add = (x0, y0, x1, y1) => { if (!bb) bb = { x0, y0, x1, y1 }; else { bb.x0 = Math.min(bb.x0, x0); bb.y0 = Math.min(bb.y0, y0); bb.x1 = Math.max(bb.x1, x1); bb.y1 = Math.max(bb.y1, y1); } };
    for (const a of model.atoms) { if (isLabeled(a)) { const b = labelLayout(a).bbox; add(b.x0, b.y0, b.x1, b.y1); } else add(a.x - 3, a.y - 3, a.x + 3, a.y + 3); }
    for (const an of model.annots) { const b = annotBBox(an); add(b.x0, b.y0, b.x1, b.y1); }
    return bb;
  }
  function exportSvg() {
    const bb = contentBBox(); if (!bb) return null;
    const pad = S.exportPad, w = Math.ceil(bb.x1 - bb.x0 + 2 * pad), h = Math.ceil(bb.y1 - bb.y0 + 2 * pad);
    const svg = el('svg', { xmlns: NS, viewBox: `${bb.x0 - pad} ${bb.y0 - pad} ${w} ${h}`, width: w, height: h });
    el('rect', { x: bb.x0 - pad, y: bb.y0 - pad, width: w, height: h, fill: '#fff' }, svg);
    renderScene(el('g', {}, svg), true);
    return { svg, w, h };
  }
  function svgToCanvas(ex, scale) {
    return new Promise((resolve, reject) => {
      const str = new XMLSerializer().serializeToString(ex.svg);
      const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = Math.round(ex.w * scale); c.height = Math.round(ex.h * scale);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not rasterise the drawing')); };
      img.src = url;
    });
  }
  const toBlob = (c, type, q) => new Promise(res => c.toBlob(res, type, q));
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  async function copyImage() {
    const ex = exportSvg(); if (!ex) { flash('Nothing to copy yet'); return; }
    try {
      const c = await svgToCanvas(ex, S.exportScale), blob = await toBlob(c, 'image/png');
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no clipboard');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash('Image copied to the clipboard.');
    } catch (err) {
      try { const c = await svgToCanvas(ex, S.exportScale); download(await toBlob(c, 'image/png'), 'structure.png'); flash('Clipboard not available in this browser; the PNG was downloaded instead.'); }
      catch (e2) { flash('Copy failed: ' + e2.message); }
    }
  }
  async function saveImage() {
    const ex = exportSvg(); if (!ex) { flash('Nothing to save yet'); return; }
    try {
      const c = await svgToCanvas(ex, S.exportScale);
      if (S.imageFormat === 'jpg') download(await toBlob(c, 'image/jpeg', 0.92), 'structure.jpg'); else download(await toBlob(c, 'image/png'), 'structure.png');
    } catch (err) { flash('Save failed: ' + err.message); }
  }

  // ---------------------------------------------------------------- export / import: molfile (V2000)
  function toMol(atoms, bonds) {
    atoms = atoms || model.atoms; bonds = (bonds || model.bonds);
    const idx = new Map(atoms.map((a, i) => [a.id, i + 1]));
    const bs = bonds.filter(b => idx.has(b.a) && idx.has(b.b));
    const sc = 1.5 / S.bondLength;
    let cx = 0, cy = 0; for (const a of atoms) { cx += a.x; cy += a.y; } if (atoms.length) { cx /= atoms.length; cy /= atoms.length; }
    const f = (n, w, d) => n.toFixed(d).padStart(w), i3 = n => String(n).padStart(3);
    const d = new Date(), p2 = n => String(n).padStart(2, '0');
    const stamp = p2(d.getMonth() + 1) + p2(d.getDate()) + String(d.getFullYear()).slice(2) + p2(d.getHours()) + p2(d.getMinutes());
    const lines = ['', '  RACERSkt' + stamp + '2D', ''];
    lines.push(i3(atoms.length) + i3(bs.length) + '  0  0  0  0  0  0  0  0999 V2000');
    for (const a of atoms) lines.push(f((a.x - cx) * sc, 10, 4) + f(-(a.y - cy) * sc, 10, 4) + f(0, 10, 4) + ' ' + a.el.padEnd(3) + ' 0  0  0  0  0  0  0  0  0  0  0  0');
    for (const b of bs) lines.push(i3(idx.get(b.a)) + i3(idx.get(b.b)) + i3(b.order) + i3(b.stereo === 'wedge' ? 1 : b.stereo === 'dash' ? 6 : 0) + '  0  0  0');
    lines.push('M  END');
    return lines.join('\n') + '\n';
  }
  function fromMol(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length < 4) throw new Error('This does not look like a molfile.');
    const counts = lines[3];
    if (/V3000/.test(counts)) throw new Error('V3000 molfiles are not supported yet. Please save as V2000.');
    let na = parseInt(counts.slice(0, 3), 10), nb = parseInt(counts.slice(3, 6), 10);
    if (isNaN(na) || isNaN(nb)) { const t = counts.trim().split(/\s+/); na = parseInt(t[0], 10); nb = parseInt(t[1], 10); }
    if (isNaN(na) || isNaN(nb)) throw new Error('Could not read the counts line of the molfile.');
    const atoms = [], bonds = [];
    for (let i = 0; i < na; i++) {
      const l = lines[4 + i] || '';
      let x = parseFloat(l.slice(0, 10)), y = parseFloat(l.slice(10, 20)), sym = l.slice(31, 34).trim();
      if (isNaN(x) || isNaN(y) || !sym) { const t = l.trim().split(/\s+/); x = parseFloat(t[0]); y = parseFloat(t[1]); sym = t[3]; }
      if (isNaN(x) || isNaN(y) || !sym) throw new Error('Could not read atom ' + (i + 1) + '.');
      sym = sym[0].toUpperCase() + sym.slice(1).toLowerCase();
      atoms.push({ el: sym, x, y });
    }
    let aromatic = false;
    for (let i = 0; i < nb; i++) {
      const l = lines[4 + na + i] || '';
      let a = parseInt(l.slice(0, 3), 10), b = parseInt(l.slice(3, 6), 10), o = parseInt(l.slice(6, 9), 10), st = parseInt(l.slice(9, 12), 10);
      if (isNaN(a) || isNaN(b) || isNaN(o)) { const t = l.trim().split(/\s+/); a = parseInt(t[0], 10); b = parseInt(t[1], 10); o = parseInt(t[2], 10); st = parseInt(t[3], 10); }
      if (isNaN(a) || isNaN(b)) throw new Error('Could not read bond ' + (i + 1) + '.');
      if (o === 4) { aromatic = true; o = 1; }
      if (o < 1 || o > 3) o = 1;
      const stereo = o === 1 && st === 1 ? 'wedge' : o === 1 && st === 6 ? 'dash' : null;
      bonds.push({ a: a - 1, b: b - 1, order: o, stereo });
    }
    return { atoms, bonds, aromatic };
  }
  function loadMol(text, name) {
    let parsed;
    try { parsed = fromMol(text); } catch (err) { flash('Open failed: ' + err.message); return; }
    pushUndo(); model = newModel(); selected.clear(); hover = null;
    const lens = parsed.bonds.map(b => Math.hypot(parsed.atoms[b.a].x - parsed.atoms[b.b].x, parsed.atoms[b.a].y - parsed.atoms[b.b].y)).filter(l => l > 0).sort((p, q) => p - q);
    const unit = lens.length ? lens[Math.floor(lens.length / 2)] : 1.5, sc = S.bondLength / unit;
    const r = sheet.getBoundingClientRect();
    let cx = 0, cy = 0; for (const a of parsed.atoms) { cx += a.x; cy += a.y; } if (parsed.atoms.length) { cx /= parsed.atoms.length; cy /= parsed.atoms.length; }
    const made = parsed.atoms.map(a => addAtom(a.el, r.width / 2 + (a.x - cx) * sc, r.height / 2 - (a.y - cy) * sc, false));
    for (const b of parsed.bonds) if (made[b.a] && made[b.b] && made[b.a] !== made[b.b]) { const nb = addBond(made[b.a], made[b.b], b.order); if (nb && b.stereo) nb.stereo = b.stereo; }
    render();
    flash(`Opened ${name || 'molfile'}: ${parsed.atoms.length} atoms, ${parsed.bonds.length} bonds.` + (parsed.aromatic ? ' Aromatic bonds were read as single bonds; click them to set double bonds.' : ''));
  }
  function openFile(file) { const rd = new FileReader(); rd.onload = () => loadMol(String(rd.result), file.name); rd.readAsText(file); }
  $('file-input').addEventListener('change', e => { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; });
  canvasBox.addEventListener('dragover', e => { e.preventDefault(); });
  canvasBox.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) openFile(e.dataTransfer.files[0]); });

  // ---------------------------------------------------------------- analyze
  function analyze() {
    let atoms = model.atoms.filter(a => selected.has(a.id)); const usedSel = atoms.length > 0;
    if (!usedSel) atoms = model.atoms;
    if (!atoms.length) { flash('Draw a structure first, then select it and click Analyze.'); return; }
    const counts = {};
    for (const a of atoms) { counts[a.el] = (counts[a.el] || 0) + 1; const h = implicitH(a); if (h) counts.H = (counts.H || 0) + h; }
    const keys = Object.keys(counts), order = [];
    if (counts.C) { order.push('C'); if (counts.H) order.push('H'); order.push(...keys.filter(k => k !== 'C' && k !== 'H').sort()); }
    else order.push(...keys.sort());
    let plain = '', html = '', mass = 0;
    for (const k of order) { const n = counts[k]; plain += k + (n > 1 ? n : ''); html += k + (n > 1 ? `<sub>${n}</sub>` : ''); mass += n * (EL[k] ? EL[k].mass : 0); }
    const massStr = mass.toFixed(2);
    $('an-formula').innerHTML = html; $('an-mass').textContent = massStr + ' g/mol';
    $('an-note').textContent = usedSel ? `Based on the ${atoms.length} selected atom${atoms.length > 1 ? 's' : ''} (plus their hydrogens).` : 'Nothing was selected, so everything on the canvas was analysed.';
    const dlg = $('dlg-analyze'); dlg.dataset.plain = plain + '   ' + massStr + ' g/mol';
    let bb = null; for (const a of atoms) { const b = isLabeled(a) ? labelLayout(a).bbox : { x0: a.x, y0: a.y, x1: a.x, y1: a.y }; bb = bb ? { x0: Math.min(bb.x0, b.x0), y0: Math.min(bb.y0, b.y0), x1: Math.max(bb.x1, b.x1), y1: Math.max(bb.y1, b.y1) } : Object.assign({}, b); }
    dlg.dataset.x = bb.x0; dlg.dataset.y = bb.y1 + S.fontSize * 1.8;
    dlg.showModal();
  }
  $('an-add').addEventListener('click', () => {
    const dlg = $('dlg-analyze'); pushUndo();
    model.annots.push({ id: nid(), type: 'text', x: +dlg.dataset.x, y: +dlg.dataset.y, text: dlg.dataset.plain });
    dlg.close(); render();
  });
  $('an-copy').addEventListener('click', async () => {
    const t = $('dlg-analyze').dataset.plain;
    try { await navigator.clipboard.writeText(t); flash('Formula and molar mass copied as text.'); } catch (e) { flash('Could not access the clipboard.'); }
    $('dlg-analyze').close();
  });

  // ---------------------------------------------------------------- options
  function applyOptionsUI() {
    document.querySelector(`input[name="hetero"][value="${S.colorHetero ? 'color' : 'black'}"]`).checked = true;
    document.querySelector(`input[name="imgfmt"][value="${S.imageFormat}"]`).checked = true;
    $('btn-saveimg').textContent = S.imageFormat === 'jpg' ? 'Save JPG' : 'Save PNG';
    paletteGrid.querySelectorAll('.el').forEach(x => { x.style.color = labelColor(x.dataset.el); });
    $('atom-el').style.color = labelColor(currentEl);
    document.querySelectorAll('#ptable-grid .pt').forEach(b => { b.style.color = labelColor(b.textContent.replace(/^\d+/, '')); });
  }
  document.querySelectorAll('input[name="hetero"]').forEach(r => r.addEventListener('change', () => { S.colorHetero = r.value === 'color'; saveOptions(); applyOptionsUI(); render(); }));
  document.querySelectorAll('input[name="imgfmt"]').forEach(r => r.addEventListener('change', () => { S.imageFormat = r.value; saveOptions(); applyOptionsUI(); }));

  // ---------------------------------------------------------------- top bar buttons
  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);
  $('btn-clear').addEventListener('click', () => { if (!model.atoms.length && !model.annots.length) return; pushUndo(); model = newModel(); selected.clear(); hover = null; render(); flash('Canvas cleared. Ctrl+Z brings it back.'); });
  $('btn-open').addEventListener('click', () => $('file-input').click());
  $('btn-analyze').addEventListener('click', analyze);
  $('btn-copy').addEventListener('click', copyImage);
  $('btn-saveimg').addEventListener('click', saveImage);
  $('btn-savemol').addEventListener('click', () => { if (!model.atoms.length) { flash('Nothing to save yet'); return; } download(new Blob([toMol()], { type: 'chemical/x-mdl-molfile' }), 'structure.mol'); if (model.annots.length) flash('Saved. Note: arrows and text are not part of the .mol format; they are kept in image exports only.'); });
  $('btn-options').addEventListener('click', () => { applyOptionsUI(); $('dlg-options').showModal(); });
  document.querySelectorAll('dialog .close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
  window.addEventListener('resize', render);

  // ---------------------------------------------------------------- small public API (for embedding as a widget later)
  window.RACERSketch = window.MolSketch = {
    getMol: () => toMol(),                       // current drawing as a V2000 molfile string
    setMol: text => loadMol(text, 'molfile'),    // replace the drawing with a molfile
    clear: () => { pushUndo(); model = newModel(); selected.clear(); hover = null; render(); },
    getModel: () => JSON.parse(JSON.stringify(model)),
    settings: S,
  };

  // ---------------------------------------------------------------- start
  setElement('C'); setTool('bond'); applyOptionsUI(); render();
})();
