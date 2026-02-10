const PLAYERS = 5;

// Column order (matches card)
const COLS = [
  ...Array.from({ length: 9 }, (_, i) => String(i + 1)),
  "OUT",
  ...Array.from({ length: 9 }, (_, i) => String(i + 10)),
  "IN",
  "TOT",
  "HCP",
  "NET",
];

const LS_CAL = "cw_cal_v3";
const LS_SCORES = "cw_scores_v3";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");

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

function cellKey(p, col){
  if(col==="OUT") return `p${p}_out`;
  if(col==="IN")  return `p${p}_in`;
  if(col==="TOT") return `p${p}_tot`;
  if(col==="HCP") return `p${p}_hcp`;
  if(col==="NET") return `p${p}_net`;
  return `p${p}_h${parseInt(col,10)}`;
}

let scores = loadScores();
let cal = loadCal();      // {startX,startY,rowY[],rowH,colW[],colG[]}
let boxes = [];
let selected = null;

function loadScores(){
  try{ const raw = localStorage.getItem(LS_SCORES); if(raw) return JSON.parse(raw); }catch{}
  const obj = {};
  for(let p=1;p<=PLAYERS;p++){
    for(let h=1;h<=18;h++) obj[`p${p}_h${h}`] = "";
    obj[`p${p}_hcp`] = "";
    obj[`p${p}_net`] = "";
    obj[`p${p}_out`] = "";
    obj[`p${p}_in`]  = "";
    obj[`p${p}_tot`] = "";
  }
  return obj;
}
function saveScores(){ localStorage.setItem(LS_SCORES, JSON.stringify(scores)); }

function loadCal(){
  try{ const raw = localStorage.getItem(LS_CAL); if(raw) return JSON.parse(raw); }catch{}
  return null;
}
function saveCal(){ localStorage.setItem(LS_CAL, JSON.stringify(cal)); }

function recalcTotals(){
  for(let p=1;p<=PLAYERS;p++){
    let out=0, inn=0, anyOut=false, anyIn=false;
    for(let h=1;h<=9;h++){
      const v = parseInt(scores[`p${p}_h${h}`]||"",10);
      if(!Number.isNaN(v)){ out+=v; anyOut=true; }
    }
    for(let h=10;h<=18;h++){
      const v = parseInt(scores[`p${p}_h${h}`]||"",10);
      if(!Number.isNaN(v)){ inn+=v; anyIn=true; }
    }
    scores[`p${p}_out`] = anyOut ? String(out) : "";
    scores[`p${p}_in`]  = anyIn ? String(inn) : "";
    scores[`p${p}_tot`] = (anyOut||anyIn) ? String((anyOut?out:0)+(anyIn?inn:0)) : "";
  }
}

function fitCanvas(){
  canvas.width  = bg.naturalWidth  || 1600;
  canvas.height = bg.naturalHeight || 900;
}

function computeBoxes(){
  boxes = [];
  if(!cal) return;

  const xPos = [];
  let x = cal.startX;
  for(let i=0;i<COLS.length;i++){
    xPos[i] = x;
    x += cal.colW[i] + cal.colG[i];
  }

  for(let p=1;p<=PLAYERS;p++){
    const top = cal.rowY[p-1]; // explicit row positions (Player 5 break supported)
    for(let i=0;i<COLS.length;i++){
      boxes.push({ p, idx:i, col:COLS[i], x:xPos[i], y:top, w:cal.colW[i], h:cal.rowH });
    }
  }
}

function findBoxAt(px,py){
  for(const b of boxes){
    if(px>=b.x && px<=b.x+b.w && py>=b.y && py<=b.y+b.h) return b;
  }
  return null;
}

function draw(){
  if(!bg.complete) return;
  fitCanvas();

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bg,0,0,canvas.width,canvas.height);

  if(!cal){
    ctx.save();
    ctx.fillStyle="rgba(255,255,255,.9)";
    ctx.font="800 28px -apple-system,system-ui,Segoe UI,Roboto,Arial";
    ctx.fillText("Tap Calibrate to map the boxes.", 40, 60);
    ctx.restore();
    return;
  }

  recalcTotals();

  // Draw numbers
  ctx.save();
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillStyle="#0b0f14";

  for(const b of boxes){
    const val = scores[cellKey(b.p,b.col)] ?? "";
    if(!val) continue;
    const small = ["OUT","IN","TOT","HCP","NET"].includes(b.col);
    ctx.font = small
      ? "900 28px -apple-system,system-ui,Segoe UI,Roboto,Arial"
      : "900 32px -apple-system,system-ui,Segoe UI,Roboto,Arial";
    ctx.fillText(val, b.x+b.w/2, b.y+b.h/2);
  }
  ctx.restore();

  // Highlight selection
  if(selected){
    const b = boxes.find(z=>z.p===selected.p && z.idx===selected.idx);
    if(b){
      ctx.save();
      ctx.strokeStyle="rgba(0,220,255,.95)";
      ctx.lineWidth=4;
      ctx.strokeRect(b.x+2,b.y+2,b.w-4,b.h-4);
      ctx.restore();
    }
  }
}

function setSelected(b){
  selected = b ? {p:b.p, idx:b.idx, col:b.col} : null;
  if(!selected){
    selLabel.textContent="Tap a box to start";
    selValue.textContent="";
  }else{
    const k = cellKey(selected.p, selected.col);
    selLabel.textContent = `P${selected.p} • ${selected.col}`;
    selValue.textContent = scores[k] ? `= ${scores[k]}` : "";
  }
  draw();
}

function moveSelection(delta){
  if(!selected) return;
  let idx = selected.idx + delta;
  let p = selected.p;
  if(idx<0){ idx=COLS.length-1; p=Math.max(1,p-1); }
  if(idx>=COLS.length){ idx=0; p=Math.min(PLAYERS,p+1); }
  const b = boxes.find(z=>z.p===p && z.idx===idx);
  if(b) setSelected(b);
}

function applySet(n){
  if(!selected) return;
  if(["OUT","IN","TOT"].includes(selected.col)) return;
  scores[cellKey(selected.p, selected.col)] = String(n);
  saveScores();
  setSelected(boxes.find(z=>z.p===selected.p && z.idx===selected.idx));
}
function applyOp(op){
  if(!selected) return;
  if(["OUT","IN","TOT"].includes(selected.col)) return;
  const k = cellKey(selected.p, selected.col);
  if(op==="clear"){ scores[k]=""; saveScores(); setSelected(boxes.find(z=>z.p===selected.p && z.idx===selected.idx)); return; }
  const cur = parseInt(scores[k]||"0",10);
  scores[k] = String(op==="+" ? cur+1 : Math.max(0,cur-1));
  saveScores();
  setSelected(boxes.find(z=>z.p===selected.p && z.idx===selected.idx));
}

// Use pointerdown for better mobile reliability
function canvasPointFromEvent(e){
  const r = canvas.getBoundingClientRect();
  const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
  const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
  const px = (clientX - r.left) * (canvas.width / r.width);
  const py = (clientY - r.top)  * (canvas.height / r.height);
  return {px,py};
}

// -------- Gameplay tap (disabled during calibration) ----------
canvas.addEventListener("pointerdown",(e)=>{
  if(calMode) return;
  if(!cal) return;
  const {px,py} = canvasPointFromEvent(e);
  const b = findBoxAt(px,py);
  if(b) setSelected(b);
});

// Buttons
document.querySelectorAll(".key").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const set = btn.getAttribute("data-set");
    const op  = btn.getAttribute("data-op");
    if(set) applySet(parseInt(set,10));
    if(op) applyOp(op);
  });
});
nextBtn.addEventListener("click",()=>moveSelection(+1));
backBtn.addEventListener("click",()=>moveSelection(-1));

// Save Image
saveBtn.addEventListener("click",()=>{
  draw();
  const url = canvas.toDataURL("image/png");
  const w = window.open();
  if(w) w.document.write(`<img src="${url}" style="width:100%;height:auto;" />`);
});

// Full reset (scores + calibration)
resetBtn.addEventListener("click",()=>{
  if(!confirm("Reset everything (scores + calibration)?")) return;
  localStorage.removeItem(LS_SCORES);
  localStorage.removeItem(LS_CAL);
  scores = loadScores();
  cal = null;
  boxes = [];
  selected = null;
  draw();
});

// ----------------- Calibration -----------------
let calMode=false;
let step=0;
let pts;

function hint(t){ calHint.textContent=t; }

function resetCalibration(){
  step=0;
  pts = { startX:0, startY:0, rowY:[], rowH:0, x1:0, bounds:[] };
  calFinish.disabled=true;
  calOut.value="";
  hint("Tap TOP-LEFT of Player 1 / Hole 1 box.");
}

function openCal(){ calMode=true; calPanel.classList.remove("hidden"); resetCalibration(); }
function closeCal(){ calMode=false; calPanel.classList.add("hidden"); }

calBtn.addEventListener("click",openCal);
calClose.addEventListener("click",closeCal);
calReset.addEventListener("click",resetCalibration);

canvas.addEventListener("pointerdown",(e)=>{
  if(!calMode) return;
  const {px,py} = canvasPointFromEvent(e);

  if(step>=0 && step<=4){
    if(step===0){ pts.startX=px; pts.startY=py; }
    pts.rowY.push(py);
    step++;
    const msg = [
      "Tap TOP-LEFT of Player 2 / Hole 1 box.",
      "Tap TOP-LEFT of Player 3 / Hole 1 box.",
      "Tap TOP-LEFT of Player 4 / Hole 1 box.",
      "Tap TOP-LEFT of Player 5 / Hole 1 box (below Handicap row).",
      "Tap BOTTOM-LEFT of Player 1 / Hole 1 box (row height)."
    ][step-1];
    hint(msg);
  }
  else if(step===5){
    pts.rowH = Math.max(1, py - pts.startY);
    step=6;
    hint("Tap TOP-RIGHT of Player 1 / NET box (far right).");
  }
  else if(step===6){
    pts.x1 = px;
    step=7;
    hint("Now tap vertical boundaries between columns across top row (22 taps).");
  }
  else {
    pts.bounds.push(px);
    if(pts.bounds.length >= COLS.length-1){
      calFinish.disabled=false;
      hint("All boundaries captured. Tap Finish.");
    }else{
      hint(`Boundary ${pts.bounds.length}/${COLS.length-1} captured. Keep going.`);
    }
  }

  calOut.value = JSON.stringify({step, pts}, null, 2);
});

calFinish.addEventListener("click",()=>{
  if(pts.rowY.length !== PLAYERS) return;
  if(pts.bounds.length < COLS.length-1) return;

  const bounds = [...pts.bounds].sort((a,b)=>a-b);
  const edges = [pts.startX, ...bounds, pts.x1];

  const colW=[], colG=[];
  for(let i=0;i<COLS.length;i++){
    colW.push(Math.max(1, edges[i+1]-edges[i]));
    colG.push(0);
  }

  cal = { startX: pts.startX, startY: pts.startY, rowY: pts.rowY, rowH: pts.rowH, colW, colG };
  saveCal();
  computeBoxes();
  closeCal();
  setSelected(null);
  draw();
});

// Boot
bg.onload = ()=>{
  if(cal) computeBoxes();
  draw();
};
if(bg.complete){
  if(cal) computeBoxes();
  draw();
}