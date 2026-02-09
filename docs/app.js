const PLAYERS = 6;
const HOLES = 18;

// Build player rows
const playersBody = document.getElementById("playersBody");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const exportArea = document.getElementById("exportArea");

const LS_KEY = "cw_html_replica_scores_v1";

function key(p, h){ return `p${p}_h${h}`; }
function kOut(p){ return `p${p}_out`; }
function kIn(p){ return `p${p}_in`; }
function kTot(p){ return `p${p}_tot`; }
function kHcp(p){ return `p${p}_hcp`; }
function kNet(p){ return `p${p}_net`; }

let data = loadData();

function loadData(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw) return JSON.parse(raw);
  }catch{}
  const obj = {};
  for(let p=1;p<=PLAYERS;p++){
    for(let h=1;h<=HOLES;h++) obj[key(p,h)] = "";
    obj[kHcp(p)] = "";
    obj[kNet(p)] = "";
    obj[kOut(p)] = "";
    obj[kIn(p)] = "";
    obj[kTot(p)] = "";
  }
  return obj;
}
function saveData(){
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function onlyNum2(s){
  return (s || "").replace(/[^\d]/g,"").slice(0,2);
}

function sumRange(p, a, b){
  let total = 0;
  let any = false;
  for(let h=a; h<=b; h++){
    const v = parseInt(data[key(p,h)] || "", 10);
    if(!Number.isNaN(v)){ total += v; any = true; }
  }
  return any ? total : "";
}

function recalc(p){
  const out = sumRange(p, 1, 9);
  const inn = sumRange(p, 10, 18);
  data[kOut(p)] = out === "" ? "" : String(out);
  data[kIn(p)] = inn === "" ? "" : String(inn);
  if(out === "" && inn === "") data[kTot(p)] = "";
  else data[kTot(p)] = String((out || 0) + (inn || 0));
}

function makeCellInput({p, h, readOnly=false, storeKey, placeholder=""}){
  const td = document.createElement("td");
  td.className = "cell" + (readOnly ? " readonly" : "");

  const input = document.createElement("input");
  input.inputMode = "numeric";
  input.pattern = "[0-9]*";
  input.autocomplete = "off";
  input.placeholder = placeholder;

  input.value = data[storeKey] ?? "";

  if(readOnly){
    input.readOnly = true;
    input.tabIndex = -1;
  }else{
    input.addEventListener("input", (e)=>{
      const v = onlyNum2(e.target.value);
      e.target.value = v;
      data[storeKey] = v;
      recalc(p);
      // refresh totals cells for this player
      document.getElementById(kOut(p)).value = data[kOut(p)];
      document.getElementById(kIn(p)).value  = data[kIn(p)];
      document.getElementById(kTot(p)).value = data[kTot(p)];
      saveData();
    });
  }

  // For totals, give them IDs so we can update fast
  if(readOnly && (storeKey.endsWith("_out") || storeKey.endsWith("_in") || storeKey.endsWith("_tot"))){
    input.id = storeKey;
  }

  td.appendChild(input);
  return td;
}

function render(){
  playersBody.innerHTML = "";

  for(let p=1; p<=PLAYERS; p++){
    recalc(p);

    const tr = document.createElement("tr");
    tr.className = "player-row";

    const label = document.createElement("td");
    label.className = "player-label";
    label.textContent = `Player ${p}`;
    tr.appendChild(label);

    // Holes 1-9
    for(let h=1; h<=9; h++){
      tr.appendChild(makeCellInput({p, h, storeKey: key(p,h)}));
    }

    // OUT (read-only)
    tr.appendChild(makeCellInput({p, readOnly:true, storeKey: kOut(p)}));

    // Holes 10-18
    for(let h=10; h<=18; h++){
      tr.appendChild(makeCellInput({p, h, storeKey: key(p,h)}));
    }

    // IN, TOT (read-only)
    tr.appendChild(makeCellInput({p, readOnly:true, storeKey: kIn(p)}));
    tr.appendChild(makeCellInput({p, readOnly:true, storeKey: kTot(p)}));

    // HCP + NET (editable)
    tr.appendChild(makeCellInput({p, storeKey: kHcp(p)}));
    tr.appendChild(makeCellInput({p, storeKey: kNet(p)}));

    playersBody.appendChild(tr);
  }

  saveData();
}

clearBtn.addEventListener("click", ()=>{
  if(!confirm("Clear all scores?")) return;
  localStorage.removeItem(LS_KEY);
  data = loadData();
  render();
});

saveBtn.addEventListener("click", async ()=>{
  try{
    // export the HTML scorecard into a PNG
    const canvas = await html2canvas(exportArea, { backgroundColor: null, scale: 2 });
    canvas.toBlob((blob)=>{
      if(!blob) return alert("Could not generate image.");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank"); // user can Share -> Save Image
    }, "image/png");
  }catch(e){
    console.error(e);
    alert("Save failed. Try again.");
  }
});

render();