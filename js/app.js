let expr = [], geneAnnot = [], chrLengths = [], svgTemplate = "";
let geneCol = "Gene_ID";

const tissues = [
  "Androecium","Bracteole","Embryo","Endosperm","Flower_1","Flower_2","Flower_3","Flower_4","Flower_5",
  "Flower_bud_1","Flower_bud_2","Flower_bud_3","Flower_bud_4","Germinating_Seedling","Gynoecium",
  "Mature_leaf","Nodule","Pedicel","Petal","Pod_Shell","Root","Root_Hair","Root_tip","SAM",
  "Seed_10_dap","Seed_20_dap","Seed_30_dap","Seed_5_dap","Seed_Coat","Sepal","Shoot","Young_leaf"
];

const tissueGroups = {
  "All tissues": tissues,
  "Root/Nodule": ["Root","Root_Hair","Root_tip","Nodule"],
  "Leaf/Shoot/SAM": ["Mature_leaf","Young_leaf","Shoot","SAM"],
  "Flower organs": ["Flower_1","Flower_2","Flower_3","Flower_4","Flower_5","Flower_bud_1","Flower_bud_2","Flower_bud_3","Flower_bud_4","Androecium","Gynoecium","Petal","Sepal","Pedicel","Bracteole"],
  "Seed/Pod": ["Seed_5_dap","Seed_10_dap","Seed_20_dap","Seed_30_dap","Seed_Coat","Embryo","Endosperm","Pod_Shell"]
};

const palettes = {
  YlOrRd: ["#ffffcc","#ffeda0","#feb24c","#f03b20","#bd0026"],
  WhiteYlRed: ["#f7fbff","#ffffb2","#fd8d3c","#bd0026"],
  Viridis: ["#440154","#3b528b","#21918c","#5ec962","#fde725"],
  BlueRed: ["#2166ac","#f7f7f7","#b2182b"]
};

const markerColors = {
  Red:"#d73027", Blue:"#4575b4", Green:"#1a9850", Purple:"#762a83", Orange:"#f46d43", Black:"#000000", Gray:"#666666"
};

function parseCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: r => resolve(r.data), error: reject});
  });
}

async function init() {
  expr = await parseCSV("data/TPM_File_RK.csv");
  geneAnnot = await parseCSV("data/gene_annotation.csv");
  chrLengths = await parseCSV("data/chickpea_chromosome_lengths.csv");
  svgTemplate = await fetch("www/Chickpea_gene_expression_atlas_RK.svg").then(r => r.text());

  expr.forEach(row => tissues.forEach(t => row[t] = Number(row[t] || 0)));
  geneAnnot.forEach(r => { r.Start = Number(r.Start); r.End = Number(r.End); });
  chrLengths.forEach(r => { r.Length_bp = Number(r.Length_bp); r.Chr = cleanChr(r.Chr); });

  fillGeneControls();
  fillGroupControls();
  fillChrVersion();

  document.getElementById("loading").style.display = "none";
  loadGene();
}

function fillGeneControls() {
  const genes = expr.map(r => r[geneCol]).sort();
  const dl = document.getElementById("geneList");
  const barGene = document.getElementById("barGene");
  genes.forEach(g => {
    dl.insertAdjacentHTML("beforeend", `<option value="${g}"></option>`);
    barGene.insertAdjacentHTML("beforeend", `<option>${g}</option>`);
  });
  document.getElementById("geneInput").value = genes[0] || "";
}

function fillGroupControls() {
  for (const g of Object.keys(tissueGroups)) {
    document.getElementById("barGroup").insertAdjacentHTML("beforeend", `<option>${g}</option>`);
    document.getElementById("heatmapGroup").insertAdjacentHTML("beforeend", `<option>${g}</option>`);
  }
}

function fillChrVersion() {
  const versions = [...new Set(chrLengths.map(r => r.Version))];
  const sel = document.getElementById("chrVersion");
  sel.innerHTML = versions.map(v => `<option>${v}</option>`).join("");
  updateChrChecks();
}

function cleanChr(x) {
  x = String(x);
  x = x.replace(/^chromosome/i, "Chr").replace(/^chr/i, "Chr").replace(/^Ca_LG/i, "Chr").replace(/^Ca/i, "Chr").replace(/_v2.0$/i, "");
  return x.startsWith("Chr") ? x : "Chr" + x;
}

function interpColor(colors, v) {
  v = Math.max(0, Math.min(1, v));
  const n = colors.length - 1, i = Math.min(n - 1, Math.floor(v * n));
  const f = v * n - i;
  const a = hexToRgb(colors[i]), b = hexToRgb(colors[i+1]);
  return rgbToHex(
    Math.round(a.r + (b.r-a.r)*f),
    Math.round(a.g + (b.g-a.g)*f),
    Math.round(a.b + (b.b-a.b)*f)
  );
}
function hexToRgb(h){ h=h.replace("#",""); return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}; }
function rgbToHex(r,g,b){ return "#" + [r,g,b].map(x => x.toString(16).padStart(2,"0")).join(""); }

function loadGene() {
  const gene = document.getElementById("geneInput").value.trim();
  const row = expr.find(r => r[geneCol] === gene);
  if (!row) { alert("Gene not found"); return; }

  const maxTPM = Number(document.getElementById("maxTPM").value);
  const colors = palettes[document.getElementById("paletteSelect").value];
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgTemplate, "image/svg+xml");

  const strokeMode = document.getElementById("strokeMode").value;
  const sw = document.getElementById("strokeWidth").value;
  let stroke = "none";
  if (strokeMode === "Black stroke") stroke = "#000000";
  if (strokeMode === "Gray stroke") stroke = "#333333";
  if (strokeMode === "White stroke") stroke = "#ffffff";

  tissues.forEach(t => {
    const node = doc.getElementById(t);
    if (node) {
      const val = Number(row[t] || 0);
      const fill = interpColor(colors, Math.min(val, maxTPM) / maxTPM);
      node.setAttribute("style", `fill:${fill};stroke:${stroke};stroke-width:${sw};`);
    }
  });

  document.getElementById("svgBox").innerHTML = new XMLSerializer().serializeToString(doc);
}

function drawBar() {
  const gene = document.getElementById("barGene").value;
  const row = expr.find(r => r[geneCol] === gene);
  const group = tissueGroups[document.getElementById("barGroup").value];
  const useLog = document.getElementById("barLog").checked;
  const y = group.map(t => useLog ? Math.log2(Number(row[t]||0)+1) : Number(row[t]||0));
  Plotly.newPlot("barPlot", [{x:y, y:group, type:"bar", orientation:"h", marker:{color:"#2C7FB8"}}],
    {title:`Expression profile of ${gene}`, xaxis:{title:useLog?"log2(TPM + 1)":"TPM"}, yaxis:{automargin:true}});
}

function drawHeatmap() {
  const genes = document.getElementById("heatmapGenes").value.split(/[\s,;]+/).filter(Boolean);
  const group = tissueGroups[document.getElementById("heatmapGroup").value];
  const scale = document.getElementById("heatmapScale").value;

  const rows = genes.map(g => expr.find(r => r[geneCol] === g)).filter(Boolean);
  let z = rows.map(r => group.map(t => Number(r[t]||0)));

  if (scale === "log2(TPM + 1)") z = z.map(row => row.map(v => Math.log2(v+1)));
  if (scale === "Row-scaled Z-score") {
    z = z.map(row => {
      const vals = row.map(v => Math.log2(v+1));
      const m = vals.reduce((a,b)=>a+b,0)/vals.length;
      const sd = Math.sqrt(vals.reduce((a,b)=>a+(b-m)**2,0)/vals.length) || 1;
      return vals.map(v => (v-m)/sd);
    });
  }

  Plotly.newPlot("heatmapPlot", [{z, x:group, y:rows.map(r=>r[geneCol]), type:"heatmap", colorscale:"YlOrRd"}],
    {title:"Gene expression heatmap", xaxis:{automargin:true}, yaxis:{automargin:true}});
}

function normalizeChr(x){ return String(x).replace(/chr/i,"").replace(/^0+/,""); }

function searchGWAS() {
  const chr = normalizeChr(document.getElementById("gwasChr").value);
  const pos = Number(document.getElementById("gwasPos").value);
  const start = Math.max(1, pos - Number(document.getElementById("gwasUp").value));
  const end = pos + Number(document.getElementById("gwasDown").value);
  const hits = geneAnnot.filter(g => normalizeChr(g.Chr) === chr && Number(g.End) >= start && Number(g.Start) <= end)
    .map(g => ({...g, Distance_from_SNP_bp: Math.round(Math.abs(((Number(g.Start)+Number(g.End))/2)-pos))}))
    .sort((a,b) => a.Distance_from_SNP_bp - b.Distance_from_SNP_bp);
  renderTable("gwasTable", hits);
  document.getElementById("gwasSummary").innerHTML = `<b>Region:</b> Chr${chr}:${start.toLocaleString()}-${end.toLocaleString()}<br><b>Candidate genes found:</b> ${hits.length}`;
  window.currentGWAS = hits;
}

function renderTable(id, rows) {
  const table = document.getElementById(id);
  if (!rows.length) { table.innerHTML = "<tr><td>No results</td></tr>"; return; }
  const cols = Object.keys(rows[0]);
  table.innerHTML = `<thead><tr>${cols.map(c=>`<th>${c}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(r => `<tr>${cols.map(c=>`<td>${r[c] ?? ""}</td>`).join("")}</tr>`).join("") + "</tbody>";
}

function updateChrChecks() {
  const version = document.getElementById("chrVersion").value;
  const chrs = chrLengths.filter(r => r.Version === version).sort((a,b)=>parseInt(a.Chr.replace(/\D/g,""))-parseInt(b.Chr.replace(/\D/g,"")));
  document.getElementById("chrChecks").innerHTML = `<label>Chromosomes to display</label>` +
    chrs.map(r => `<label><input class="chrCheck" type="checkbox" value="${r.Chr}" /> ${r.Chr}</label>`).join("");
  document.getElementById("markerInputs").innerHTML = "";
  document.getElementById("chrMaps").innerHTML = "";
}

function createMarkerInputs() {
  const selected = [...document.querySelectorAll(".chrCheck:checked")].map(x => x.value);
  const colors = Object.keys(markerColors).map(c => `<option>${c}</option>`).join("");
  document.getElementById("markerInputs").innerHTML = selected.map(chr => `
    <div class="marker-block">
      <h4>${chr} marker input</h4>
      <div class="marker-grid">
        <div><h5>Left side</h5>${[1,2,3,4,5].map(i => `
          <label>Left group ${i} color</label><select id="color_${chr}_left_${i}">${colors}</select>
          <textarea id="marker_${chr}_left_${i}" rows="2" placeholder="SNP_1, 347586, 348200"></textarea>`).join("")}</div>
        <div><h5>Right side</h5>${[1,2,3,4,5].map(i => `
          <label>Right group ${i} color</label><select id="color_${chr}_right_${i}">${colors}</select>
          <textarea id="marker_${chr}_right_${i}" rows="2" placeholder="Gene_1, 1457832, 1460200"></textarea>`).join("")}</div>
      </div>
    </div>`).join("");
}

function collectMarkers(chr) {
  const out = [];
  ["left","right"].forEach(side => {
    for (let i=1;i<=5;i++) {
      const txt = document.getElementById(`marker_${chr}_${side}_${i}`)?.value || "";
      const colorName = document.getElementById(`color_${chr}_${side}_${i}`)?.value || "Red";
      txt.split(/\n|;/).map(x=>x.trim()).filter(Boolean).forEach(line => {
        const p = line.split(",").map(x=>x.trim());
        if (p.length >= 3) {
          let s = Number(p[1].replace(/,/g,"")), e = Number(p[2].replace(/,/g,""));
          if (!isNaN(s) && !isNaN(e)) {
            if (e < s) [s,e] = [e,s];
            out.push({label:p[0], start:s, end:e, pos:(s+e)/2, side, color:markerColors[colorName]});
          }
        }
      });
    }
  });
  return out;
}

function generateMaps() {
  const version = document.getElementById("chrVersion").value;
  const selected = [...document.querySelectorAll(".chrCheck:checked")].map(x => x.value);
  const container = document.getElementById("chrMaps");
  container.innerHTML = "";

  selected.forEach(chr => {
    const row = chrLengths.find(r => r.Version === version && r.Chr === chr);
    const markers = collectMarkers(chr);
    const svg = chromosomeSVG(chr, row.Length_bp, markers);
    container.insertAdjacentHTML("beforeend", `<div class="chr-map-box"><h3>${chr} (${version})</h3>${svg}<button onclick="downloadSVGElement('map_${chr}', '${version}_${chr}_map.svg')">Download SVG</button></div>`);
  });
}

function chromosomeSVG(chr, lengthBp, markers) {
  const W=720, H=950, top=80, bottom=80, chrX=360, chrW=44, chrH=730;
  const fill = document.getElementById("chrFill").value;
  const labelSize = Number(document.getElementById("chrLabelSize").value);
  const title = document.getElementById("chrTitle").value;
  const chrLenMb = lengthBp/1e6;
  const yScale = bp => top + (bp/lengthBp)*chrH;
  const mapId = `map_${chr}`;

  const grouped = {left: markers.filter(m=>m.side==="left").sort((a,b)=>a.pos-b.pos), right: markers.filter(m=>m.side==="right").sort((a,b)=>a.pos-b.pos)};
  for (const side of ["left","right"]) {
    grouped[side].forEach((m,i,arr) => {
      let y = yScale(m.pos);
      if (i>0 && y - arr[i-1].labelY < 18) y = arr[i-1].labelY + 18;
      m.labelY = Math.min(top+chrH, Math.max(top, y));
    });
  }

  const band = m => {
    const y1 = yScale(m.start), y2 = yScale(m.end);
    const h = Math.max(2, y2-y1);
    return `<rect x="${chrX-chrW/2}" y="${(y1+y2)/2-h/2}" width="${chrW}" height="${h}" fill="${m.color}" opacity="0.9"/>`;
  };

  const lineLabel = m => {
    const y = yScale(m.pos), ly = m.labelY;
    const isLeft = m.side === "left";
    const x1 = isLeft ? chrX-chrW/2 : chrX+chrW/2;
    const x2 = isLeft ? 180 : 540;
    const anchor = isLeft ? "end" : "start";
    const tx = isLeft ? x2-8 : x2+8;
    return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${ly}" stroke="${m.color}" stroke-width="1.5"/>
            <text x="${tx}" y="${ly+4}" text-anchor="${anchor}" font-size="${labelSize}" fill="${m.color}">${escapeXML(m.label)}</text>`;
  };

  const scaleTicks = [];
  for (let mb=0; mb<=Math.ceil(chrLenMb); mb+=10) {
    const y = top + (mb/chrLenMb)*chrH;
    if (y <= top+chrH) scaleTicks.push(`<line x1="70" x2="85" y1="${y}" y2="${y}" stroke="black"/><text x="62" y="${y+4}" text-anchor="end" font-size="12">${mb} Mb</text>`);
  }

  return `<svg id="${mapId}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <text x="${W/2}" y="34" text-anchor="middle" font-size="20" font-weight="bold">${escapeXML(title)} - ${chr}</text>
    <line x1="78" x2="78" y1="${top}" y2="${top+chrH}" stroke="black"/>
    <line x1="68" x2="88" y1="${top}" y2="${top}" stroke="black"/>
    <line x1="68" x2="88" y1="${top+chrH}" y2="${top+chrH}" stroke="black"/>
    ${scaleTicks.join("")}
    <rect x="${chrX-chrW/2}" y="${top}" width="${chrW}" height="${chrH}" rx="${chrW/2}" ry="${chrW/2}" fill="${fill}" stroke="#333" stroke-width="2"/>
    ${markers.map(band).join("")}
    ${markers.map(lineLabel).join("")}
  </svg>`;
}

function escapeXML(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[m])); }

function downloadSVGElement(id, filename) {
  const svg = document.getElementById(id);
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], {type:"image/svg+xml"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

function downloadText(filename, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], {type:"text/plain"}));
  a.download = filename; a.click();
}

document.addEventListener("click", e => {
  if (e.target.classList.contains("tab-btn")) {
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".tab-section").forEach(s=>s.classList.remove("active"));
    e.target.classList.add("active");
    document.getElementById(e.target.dataset.tab).classList.add("active");
  }
});

document.getElementById("loadGene").onclick = loadGene;
document.getElementById("maxTPM").oninput = e => { document.getElementById("maxTPMLabel").textContent = e.target.value; };
document.getElementById("downloadSVG").onclick = () => downloadText(`${document.getElementById("geneInput").value}_expression_atlas.svg`, document.getElementById("svgBox").innerHTML);
document.getElementById("drawBar").onclick = drawBar;
document.getElementById("drawHeatmap").onclick = drawHeatmap;
document.getElementById("searchGWAS").onclick = searchGWAS;
document.getElementById("downloadGWAS").onclick = () => {
  const rows = window.currentGWAS || [];
  if (!rows.length) return;
  const csv = Papa.unparse(rows);
  downloadText("GWAS_candidate_genes.csv", csv);
};
document.getElementById("chrVersion").onchange = updateChrChecks;
document.getElementById("chrChecks").addEventListener("change", createMarkerInputs);
document.getElementById("generateMaps").onclick = generateMaps;

init().catch(err => {
  document.getElementById("loading").innerHTML = `<h2>Error loading files</h2><pre>${err}</pre>`;
});
