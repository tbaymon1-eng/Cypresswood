/* Canvas Scorecard Board
   - 18 holes, 6 players
   - Uneven columns supported (rows uniform)
   - Tap cell -> bottom controller sets score
   - Draws scores onto canvas (authentic)
*/

const PLAYERS = 6;

// Columns in order on the card
const COLS = [
  ...Array.from({ length: 9 }, (_, i) => String(i + 1)),
  "OUT",
  ...Array.from({ length: 9 }, (_, i) => String(i + 10)),
  "IN",
  "TOT",
  "HCP",
  "NET",
];

// Keys to store values
function cellKey(p, col) {
  if (col === "OUT") return `p${p}_out`;
  if (col === "IN") return `p${p}_in`;
  if (col === "TOT") return `p${p}_tot`;
  if (col === "HCP") return `p${p}_hcp`;
  if (col === "NET") return `p${p}_net`;
  return `p${p}_h${parseInt(col, 10)}`;
}

const LS_CAL = "cw_board_cal_v1";
const LS_SCORES = "cw_board_scores_v1";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const saveBtn = document.getElementById("saveBtn");
const calBtn = document.getElementById("calBtn");
const calPanel = document.getElementById("calPanel");
const calClose = document.getElementById("calClose");
const calReset = document.getElementById("calReset");
const calFinish = document.getElementById("calFinish");
const calOut = document.getElementById("calOut");
const calHint = document.getElementById("calHint");

const selLabel = document.getElementById("selLabel");
const selValue = document.getElementById("selValue");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");

const bg = new Image();
bg.src = "scorecard.jpg";

let scores = loadScores();
let cal = loadCal();      // geometry calibration
let boxes = [];           // computed rectangles in *canvas pixels*

let selected = null;      // {p, col, idx} idx = column index

// -------------------- Storage --------------------
function loadScores() {
  try {
    const raw = localStorage.getItem(LS_SCORES);
    if (raw) return JSON.parse(raw);
  } catch {}
  const obj = {};
  for (let p = 1; p <= PLAYERS; p++) {
    for (let h = 1; h <= 18; h++) obj[`p${p}_h${h}`] = "";
    obj[`p${p}_hcp`] = "";
    obj[`p${p}_net`] = "";
  }
  return obj;
}
function saveScores() { localStorage.setItem(LS_SCORES, JSON.stringify(scores)); }

function loadCal() {
  try {
    const raw = localStorage.getItem(LS_CAL);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
function saveCal() { localStorage.setItem(LS_CAL, JSON.stringify(cal)); }

// -------------------- Totals --------------------
function recalcTotals() {
  for (let p = 1; p <= PLAYERS; p++) {
    let out = 0, inn = 0, anyOut = false, anyIn = false;
    for (let h = 1; h <= 9; h++) {
      const v = parseInt(scores[`p${p}_h${h}`] || "", 10);
      if (!Number.isNaN(v)) { out += v; anyOut = true; }
    }
    for (let h = 10; h <= 18; h++) {
      const v = parseInt(scores[`p${p}_h${h}`] || "", 10);
      if (!Number.isNaN(v)) { inn += v; anyIn = true; }
    }
    scores[`p${p}_out`] = anyOut ? String(out) : "";
    scores[`p${p}_in`] = anyIn ? String(inn) : "";
    scores[`p${p}_tot`] = (anyOut || anyIn) ? String((anyOut?out:0) + (anyIn?inn:0)) : "";
  }
}

// -------------------- Geometry (uses calibration) --------------------
/*
  Calibration we store in % relative to the drawn canvas:
  cal = {
    startX, startY, rowH, rowGap,
    colW: [23 widths], colG: [23 gaps]
  }
*/
function computeBoxes() {
  boxes = [];
  if (!cal) return;

  // Precompute X positions
  const xPos = [];
  let x = cal.startX;
  for (let i = 0; i < COLS.length; i++) {
    xPos[i] = x;
    x += cal.colW[i] + cal.colG[i];
  }

  for (let p = 1; p <= PLAYERS; p++) {
    const top = cal.startY + (p - 1) * (cal.rowH + cal.rowGap);
    for (let i = 0; i < COLS.length; i++) {
      boxes.push({
        p, col: COLS[i], idx: i,
        x: xPos[i], y: top,
        w: cal.colW[i], h: cal.rowH
      });
    }
  }
}

// Hit test: tap -> box
function findBoxAt(px, py) {
  for (const b of boxes) {
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b;
  }
  return null;
}

// -------------------- Drawing --------------------
function fitCanvasToImage() {
  // Canvas internal size matches image pixel size for crisp drawing
  canvas.width = bg.naturalWidth || 1200;
  canvas.height = bg.naturalHeight || 800;
}

function draw() {
  if (!bg.complete) return;
  fitCanvasToImage();

  // Background
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  if (!cal) {
    // hint text
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "700 28px -apple-system, system-ui, Segoe UI, Roboto, Arial";
    ctx.fillText("Tap Calibrate to map the boxes.", 40, 60);
    ctx.restore();
    return;
  }

  // Draw scores
  recalcTotals();
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#0b0f14";
  ctx.font = "800 32px -apple-system, system-ui, Segoe UI, Roboto, Arial";

  for (const b of boxes) {
    const key = cellKey(b.p, b.col);
    const val = scores[key] ?? "";
    if (!val) continue;

    // Slightly smaller in totals/meta columns
    const isSmall = (b.col === "OUT" || b.col === "IN" || b.col === "TOT" || b.col === "HCP" || b.col === "NET");
    ctx.font = isSmall
      ? "800 28px -apple-system, system-ui, Segoe UI, Roboto, Arial"
      : "800 32px -apple-system, system-ui, Segoe UI, Roboto, Arial";

    ctx.fillText(val, b.x + b.w / 2, b.y + b.h / 2);
  }
  ctx.restore();

  // Highlight selection
  if (selected) {
    const b = boxes.find(z => z.p === selected.p && z.idx === selected.idx);
    if (b) {
      ctx.save();
      ctx.strokeStyle = "rgba(0, 220, 255, .95)";
      ctx.lineWidth = 4;
      ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
      ctx.restore();
    }
  }
}

// -------------------- Interaction --------------------
function setSelected(b) {
  selected = b ? { p: b.p, col: b.col, idx: b.idx } : null;
  if (!selected) {
    selLabel.textContent = "Tap a box to start";
    selValue.textContent = "";
  } else {
    const key = cellKey(selected.p, selected.col);
    selLabel.textContent = `P${selected.p} • ${selected.col}`;
    selValue.textContent = scores[key] ? `= ${scores[key]}` : "";
  }
  draw();
}

function moveSelection(delta) {
  if (!selected) return;
  // Move across columns (feels like filling a row)
  let idx = selected.idx + delta;
  let p = selected.p;
  if (idx < 0) { idx = COLS.length - 1; p = Math.max(1, p - 1); }
  if (idx >= COLS.length) { idx = 0; p = Math.min(PLAYERS, p + 1); }
  const b = boxes.find(z => z.p === p && z.idx === idx);
  if (b) setSelected(b);
}

function applySet(val) {
  if (!selected) return;
  const col = selected.col;
  // Keep totals read-only
  if (col === "OUT" || col === "IN" || col === "TOT") return;

  const key = cellKey(selected.p, col);
  scores[key] = String(val);
  saveScores();
  setSelected(boxes.find(z => z.p === selected.p && z.idx === selected.idx));
}

function applyOp(op) {
  if (!selected) return;
  const col = selected.col;
  if (col === "OUT" || col === "IN" || col === "TOT") return;

  const key = cellKey(selected.p, col);
  if (op === "clear") {
    scores[key] = "";
    saveScores();
    setSelected(boxes.find(z => z.p === selected.p && z.idx === selected.idx));
    return;
  }

  const cur = parseInt(scores[key] || "0", 10);
  const next = op === "+" ? cur + 1 : Math.max(0, cur - 1);
  scores[key] = String(next);
  saveScores();
  setSelected(boxes.find(z => z.p === selected.p && z.idx === selected.idx));
}

canvas.addEventListener("click", (e) => {
  if (!cal) return;
  const rect = canvas.getBoundingClientRect();
  // convert client coords to canvas coords
  const px = (e.clientX - rect.left) * (canvas.width / rect.width);
  const py = (e.clientY - rect.top) * (canvas.height / rect.height);
  const b = findBoxAt(px, py);
  if (b) setSelected(b);
});

document.querySelectorAll(".key").forEach(btn => {
  btn.addEventListener("click", () => {
    const set = btn.getAttribute("data-set");
    const op = btn.getAttribute("data-op");
    if (set) applySet(parseInt(set, 10));
    if (op) applyOp(op);
  });
});

nextBtn.addEventListener("click", () => moveSelection(+1));
backBtn.addEventListener("click", () => moveSelection(-1));

// -------------------- Save Image --------------------
saveBtn.addEventListener("click", () => {
  // Export the current canvas to a PNG and open it
  try {
    draw();
    const url = canvas.toDataURL("image/png");
    const w = window.open();
    if (w) w.document.write(`<img src="${url}" style="width:100%;height:auto;"/>`);
  } catch {
    alert("Save failed. Try again.");
  }
});

// -------------------- Calibration --------------------
/*
  Calibration captures:
  1) TL of P1/H1 (x0,y0)
  2) TR of P1/NET (x1,y0)
  3) BL of P6 row (x0,y6bottom)
  4) vertical boundaries taps (x positions) to compute widths+gaps
*/

let calMode = false;
let calStep = 0;
let calPts = { x0:0,y0:0,x1:0,y6:0, boundaries:[] };

function setCalHint(text) { calHint.textContent = text; }

function resetCalibration() {
  calStep = 0;
  calPts = { x0:0,y0:0,x1:0,y6:0, boundaries:[] };
  calFinish.disabled = true;
  calOut.value = "";
  setCalHint("Step 1: Tap top-left of Player 1 / Hole 1 box.");
  draw();
}

function openCal() {
  calMode = true;
  calPanel.classList.remove("hidden");
  resetCalibration();
}

function closeCal() {
  calMode = false;
  calPanel.classList.add("hidden");
}

calBtn.addEventListener("click", openCal);
calClose.addEventListener("click", closeCal);
calReset.addEventListener("click", resetCalibration);

canvas.addEventListener("click", (e) => {
  if (!calMode) return;

  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (canvas.width / rect.width);
  const py = (e.clientY - rect.top) * (canvas.height / rect.height);

  // Steps 0-2 capture anchor points
  if (calStep === 0) { calPts.x0 = px; calPts.y0 = py; calStep = 1; setCalHint("Step 2: Tap top-right of Player 1 / NET box (far right)."); }
  else if (calStep === 1) { calPts.x1 = px; calStep = 2; setCalHint("Step 3: Tap bottom-left of Player 6 row (same left edge)."); }
  else if (calStep === 2) { calPts.y6 = py; calStep = 3; setCalHint("Step 4: Tap vertical boundaries between columns (top row), starting after Hole 1, then after Hole 2... all the way to after NET."); }
  else {
    // collect boundary x's
    calPts.boundaries.push(px);
    // Need 22 boundaries for 23 columns (after each column except last)
    if (calPts.boundaries.length >= COLS.length - 1) {
      calFinish.disabled = false;
      setCalHint("All boundaries captured. Tap Finish.");
    } else {
      setCalHint(`Captured boundary ${calPts.boundaries.length}/${COLS.length - 1}. Keep tapping next boundary.`);
    }
  }

  calOut.value = JSON.stringify({ step: calStep, points: calPts }, null, 2);
});

calFinish.addEventListener("click", () => {
  if (calPts.boundaries.length < COLS.length - 1) return;

  // Sort boundaries left->right (in case)
  const bounds = [...calPts.boundaries].sort((a,b)=>a-b);

  // Build col widths + gaps:
  // We treat boundaries as the RIGHT edge of each column.
  // Left edge of first column is x0; right edge of last column is x1.
  // So we create an edges array: [x0, b1, b2, ... b22, x1]
  const edges = [calPts.x0, ...bounds, calPts.x1];

  const colW = [];
  const colG = [];
  for (let i = 0; i < COLS.length; i++) {
    const left = edges[i];
    const right = edges[i+1];
    colW.push(Math.max(1, right - left));
    // gap unknown separately; set to 0 (we already captured true right edges)
    colG.push(0);
  }

  // Row geometry from y0 and y6:
  // y6 is bottom-left of row 6 box region. We assume 6 rows same height with uniform gaps.
  // We cannot uniquely solve rowGap without another tap, so we assume rowGap=0
  // and the row height is total/6. (Works well if the rows are tight.)
  const totalH = Math.max(10, calPts.y6 - calPts.y0);
  const rowH = totalH / PLAYERS;
  const rowGap = 0;

  cal = {
    startX: calPts.x0,
    startY: calPts.y0,
    rowH,
    rowGap,
    colW,
    colG
  };

  saveCal();
  computeBoxes();
  closeCal();
  setSelected(null);

  // Show calibration JSON for your records
  calOut.value = JSON.stringify(cal, null, 2);
  draw();
});

// -------------------- Boot --------------------
bg.onload = () => {
  // If we have calibration, compute boxes
  if (cal) computeBoxes();
  draw();
};

// If image cached
if (bg.complete) {
  if (cal) computeBoxes();
  draw();
}