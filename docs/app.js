const PLAYERS = 6;

// Column order on the card
const COLS = [
  ...Array.from({ length: 9 }, (_, i) => String(i + 1)),
  "OUT",
  ...Array.from({ length: 9 }, (_, i) => String(i + 10)),
  "IN",
  "TOT",
  "HCP",
  "NET",
];

const LS_CAL = "cw_board_cal_v2";
const LS_SCORES = "cw_board_scores_v2";

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

function cellKey(p, col) {
  if (col === "OUT") return `p${p}_out`;
  if (col === "IN") return `p${p}_in`;
  if (col === "TOT") return `p${p}_tot`;
  if (col === "HCP") return `p${p}_hcp`;
  if (col === "NET") return `p${p}_net`;
  return `p${p}_h${parseInt(col, 10)}`;
}

let scores = loadScores();
let cal = loadCal();   // {startX,startY,rowH,rowGap,colW[],colG[]}
let boxes = [];        // computed in canvas px
let selected = null;   // {p, idx, col}

function loadScores(){
  try{
    const raw = localStorage.getItem(LS_SCORES);
    if(raw) return JSON.parse(raw);
  }catch{}
  const obj = {};
  for(let p=1;p<=PLAYERS;p++){
    for(let h=1;h<=18;h++) obj[`p${p}_h${h}`] = "";
    obj[`p${p}_hcp`] = "";
    obj[`p${p}_net`] = "";
    obj[`p${p}_out`] = "";
    obj[`p${p}_in`] = "";
    obj[`p${p}_tot`] = "";
  }
  return obj;
}
function saveScores(){ localStorage.setItem(LS_SCORES, JSON.stringify(scores)); }

function loadCal(){
  try{
    const raw = localStorage.getItem(LS_CAL);
    if(raw) return JSON.parse(raw);
  }catch{}
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

function fitCanvasToImage(){
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
    const top = cal.startY + (p-1)*(cal.rowH + cal.rowGap);
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
  fitCanvasToImage();

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bg,0,0,canvas.width,canvas.height);

  if(!cal){
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "800 28px -apple-system, system-ui, Segoe UI, Roboto, Arial";
    ctx.fillText("Tap Calibrate to map the score boxes.", 40, 60);
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

    const small = (b.col==="OUT"||b.col==="IN"||b.col==="TOT"||b.col==="HCP"||b.col==="NET");
    ctx.font = small
      ? "900 28px -apple-system, system-ui, Segoe UI, Roboto, Arial"
      : "900 32px -apple-system, system-ui, Segoe UI, Roboto, Arial";
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
  if(idx < 0){ idx = COLS.length-1; p = Math.max(1,p-1); }
  if(idx >= COLS.length){ idx = 0; p = Math.min(PLAYERS,p+1); }
  const b = boxes.find(z=>z.p===p && z.idx===idx);
  if(b) setSelected(b);
}

function applySet(n){
  if(!selected) return;
  if(["OUT","IN","TOT"].includes(selected.col)) return; // totals locked
  const k = cellKey(selected.p, selected.col);
  scores[k] = String(n);
  saveScores();
  setSelected(boxes.find(z=>z.p===selected.p && z.idx===selected.idx));
}

function applyOp(op){
  if(!selected) return;
  if(["OUT","IN","TOT"].includes(selected.col)) return;
  const k = cellKey(selected.p, selected.col);

  if(op==="clear"){ scores[k]=""; saveScores(); setSelected(boxes.find(z=>z.p===selected.p && z.idx===selected.idx)); return; }

  const cur = parseInt(scores[k]||"0",10);
  const next = (op==="+") ? cur+1 : Math.max(0,cur-1);
  scores[k] = String(next);
  saveScores();
  setSelected(boxes.find(z=>z.p===selected.p && z.idx===selected.idx));
}

// Tap board
canvas.addEventListener("click",(e)=>{
  if(calMode) return; // calibration handler below
  if(!cal) return;
  const r = canvas.getBoundingClientRect();
  const px = (e.clientX-r.left)*(canvas.width/r.width);
  const py = (e.clientY-r.top)*(canvas.height/r.height);
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

// Save
saveBtn.addEventListener("click",()=>{
  try{
    draw();
    const url = canvas.toDataURL("image/png");
    const w = window.open();
    if(w) w.document.write(`<img src="${url}" style="width:100%;height:auto;"/>`);
  }catch{
    alert("Save failed. Try again.");
  }
});

// ---------------- Calibration ----------------
let calMode=false;
let step=0;
let pts={ x0:0,y0:0,y1:0,x1:0,y6:0, bounds:[] };

function hint(t){ calHint.textContent=t; }
function resetCal(){
  step=0; pts={ x0:0,y0:0,y1:0,x1:0,y6:0, bounds:[] };
  calFinish.disabled=true;
  calOut.value="";
  hint("Step 1: Tap top-left of Player 1 / Hole 1 box.");
}
function openCal(){ calMode=true; calPanel.classList.remove("hidden"); resetCal(); }
function closeCal(){ calMode=false; calPanel.classList.add("hidden"); }

calBtn.addEventListener("click",openCal);
calClose.addEventListener("click",closeCal);
calReset.addEventListener("click",resetCal);

canvas.addEventListener("click",(e)=>{
  if(!calMode) return;

  const r = canvas.getBoundingClientRect();
  const px = (e.clientX-r.left)*(canvas.width/r.width);
  const py = (e.clientY-r.top)*(canvas.height/r.height);

  if(step===0){ pts.x0=px; pts.y0=py; step=1; hint("Step 2: Tap top-left of Player 2 / Hole 1 box."); }
  else if(step===1){ pts.y1=py; step=2; hint("Step 3: Tap top-right of Player 1 / NET box (far right)."); }
  else if(step===2){ pts.x1=px; step=3; hint("Step 4: Tap bottom-left of Player 6 / Hole 1 box."); }
  else if(step===3){ pts.y6=py; step=4; hint("Step 5: Tap vertical boundaries between columns (22 taps total)."); }
  else{
    pts.bounds.push(px);
    if(pts.bounds.length >= COLS.length-1){
      calFinish.disabled=false;
      hint("All boundaries captured. Tap Finish.");
    }else{
      hint(`Captured boundary ${pts.bounds.length}/${COLS.length-1}. Keep going.`);
    }
  }

  calOut.value = JSON.stringify({step, pts}, null, 2);
});

calFinish.addEventListener("click",()=>{
  if(pts.bounds.length < COLS.length-1) return;

  const bounds = [...pts.bounds].sort((a,b)=>a-b);
  const edges = [pts.x0, ...bounds, pts.x1];

  const colW=[], colG=[];
  for(let i=0;i<COLS.length;i++){
    colW.push(Math.max(1, edges[i+1]-edges[i]));
    colG.push(0);
  }

  // Row height & gap from y0 (row1) and y1 (row2) and y6 (row6)
  const rowStep = Math.max(1, pts.y1 - pts.y0); // rowH + rowGap
  const totalSpan = Math.max(1, pts.y6 - pts.y0);
  const rowH = totalSpan / PLAYERS;             // good approximation
  const rowGap = Math.max(0, rowStep - rowH);   // refine gap

  cal = { startX: pts.x0, startY: pts.y0, rowH, rowGap, colW, colG };
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