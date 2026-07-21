let expressionData = [];
let annotationData = [];
let svgOriginalText = "";
let currentGene = null;
let currentBarGene = null;
let currentGwasResults = [];
let chromosomeLengths = [];
let chromosomeDataLoaded = false;
let currentChromosomeMarkers = [];
let websiteGeneMaster=[]; let goGeneMapping=[]; let geneDomainMapping=[]; let domainReference=[]; let tissueMarkerGenes=[]; let housekeepingGenes=[];
let currentGoResults=[]; let currentDomainResults=[]; let currentTfResults=[]; let currentTfFamilyCounts=[]; let currentTfMarkers=[]; let currentTfFamilyMatrix=[];

const tissues = [
  "Androecium", "Bracteole", "Embryo", "Endosperm",
  "Flower_1", "Flower_2", "Flower_3", "Flower_4", "Flower_5",
  "Flower_bud_1", "Flower_bud_2", "Flower_bud_3", "Flower_bud_4",
  "Germinating_Seedling", "Gynoecium", "Mature_leaf", "Nodule",
  "Pedicel", "Petal", "Pod_Shell", "Root", "Root_Hair", "Root_tip",
  "SAM", "Seed_10_dap", "Seed_20_dap", "Seed_30_dap", "Seed_5_dap",
  "Seed_Coat", "Sepal", "Shoot", "Young_leaf"
];

const tissueGroups = {
  "All tissues": tissues,
  "Root/Nodule": ["Root", "Root_Hair", "Root_tip", "Nodule"],
  "Leaf/Shoot/SAM": ["Mature_leaf", "Young_leaf", "Shoot", "SAM"],
  "Flower organs": [
    "Flower_1", "Flower_2", "Flower_3", "Flower_4", "Flower_5",
    "Flower_bud_1", "Flower_bud_2", "Flower_bud_3", "Flower_bud_4",
    "Androecium", "Gynoecium", "Petal", "Sepal", "Pedicel", "Bracteole"
  ],
  "Seed/Pod": [
    "Seed_5_dap", "Seed_10_dap", "Seed_20_dap", "Seed_30_dap",
    "Seed_Coat", "Embryo", "Endosperm", "Pod_Shell"
  ]
};

const palettes = {
  "Yellow-orange-red": ["#ffffcc", "#ffeda0", "#feb24c", "#f03b20", "#bd0026"],
  "White-yellow-red": ["#f7fbff", "#ffffb2", "#fd8d3c", "#bd0026"],
  "White-orange-red": ["#fff7ec", "#fdd49e", "#fc8d59", "#b30000"],
  "Blue-white-red": ["#2166ac", "#f7f7f7", "#b2182b"],
  "Purple-yellow": ["#2d004b", "#762a83", "#f7f7f7", "#fdb863", "#e66101"],
  "Viridis": ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
  "Magma": ["#000004", "#3b0f70", "#8c2981", "#de4968", "#fe9f6d", "#fcfdbf"],
  "Plasma": ["#0d0887", "#6a00a8", "#b12a90", "#e16462", "#fca636", "#f0f921"],
  "Cividis": ["#00204c", "#31446b", "#666970", "#958f78", "#c6ba7c", "#ffea46"],
  "Green-yellow-red": ["#006837", "#78c679", "#ffffbf", "#fdae61", "#a50026"],
  "Light-blue-dark-blue": ["#f7fbff", "#c6dbef", "#6baed6", "#2171b5", "#08306b"]
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupTabs();
  populatePaletteOptions();
  populateGroupOptions();

  expressionData = await loadCsv("data/TPM_File_RK.csv");
  annotationData = await loadCsv("data/gene_annotation.csv");
  svgOriginalText = await fetch("assets/Chickpea_gene_expression_atlas_RK.svg").then(r => r.text());
  await loadPortalDatasets();

  expressionData.forEach(row => {
    tissues.forEach(t => row[t] = Number(row[t]) || 0);
  });

  populateGeneOptions();

  currentGene = expressionData[0].Gene_ID;
  currentBarGene = currentGene;
  document.getElementById("geneInput").value = currentGene;
  document.getElementById("barGeneInput").value = currentBarGene;


  setupEvents();
  setupNewPortalEvents();
  populateNewPortalSelectors();
  renderTfPortal();
  renderAtlas();
  renderBarPlot();
}

function loadCsv(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err)
    });
  });
}

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");

      if (btn.dataset.tab === "mapper") {
        await ensureChromosomeMapperLoaded();
      }
    });
  });
}

function populatePaletteOptions() {
  const sel = document.getElementById("paletteSelect");
  Object.keys(palettes).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

function populateGroupOptions() {
  ["barGroup", "summaryGroup", "heatmapGroup"].forEach(id => {
    const sel = document.getElementById(id);
    Object.keys(tissueGroups).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  });
}

function populateGeneOptions() {
  const geneIds = expressionData.map(row => row.Gene_ID).sort();

  const datalist = document.getElementById("geneList");

  geneIds.forEach(gene => {
    const opt1 = document.createElement("option");
    opt1.value = gene;
    datalist.appendChild(opt1);
  });
}

function setupEvents() {
  document.getElementById("loadGeneBtn").addEventListener("click", () => {
    const gene = normalizeGeneId(document.getElementById("geneInput").value);
    const found = expressionData.find(row => normalizeGeneId(row.Gene_ID) === gene);

    if (!found) {
      document.getElementById("geneStatus").textContent = "Gene not found in expression matrix.";
      document.getElementById("geneStatus").style.color = "#b2182b";
      return;
    }

    currentGene = gene;
    document.getElementById("geneStatus").textContent = "Gene loaded.";
    document.getElementById("geneStatus").style.color = "#1b7837";
    renderAtlas();
  });

  ["maxTpm", "paletteSelect", "strokeMode", "customStrokeColor", "strokeWidth"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderAtlas);
  });

  document.getElementById("maxTpm").addEventListener("input", e => {
    document.getElementById("maxTpmLabel").textContent = e.target.value;
  });

  document.getElementById("strokeWidth").addEventListener("input", e => {
    document.getElementById("strokeWidthLabel").textContent = e.target.value;
  });

  document.getElementById("downloadSvgBtn").addEventListener("click", downloadCurrentSvg);
  document.getElementById("downloadPngBtn").addEventListener("click", () => downloadAtlasImage("png"));
  document.getElementById("downloadJpegBtn").addEventListener("click", () => downloadAtlasImage("jpeg"));

  document.getElementById("loadBarGeneBtn").addEventListener("click", () => {
    const gene = normalizeGeneId(document.getElementById("barGeneInput").value);
    const found = expressionData.find(row => normalizeGeneId(row.Gene_ID) === gene);

    if (!found) {
      document.getElementById("barGeneStatus").textContent = "Gene not found in expression matrix.";
      document.getElementById("barGeneStatus").style.color = "#b2182b";
      return;
    }

    currentBarGene = gene;
    document.getElementById("barGeneStatus").textContent = "Gene loaded.";
    document.getElementById("barGeneStatus").style.color = "#1b7837";
    renderBarPlot();
  });

  document.getElementById("barGroup").addEventListener("change", renderBarPlot);
  document.getElementById("barLog").addEventListener("change", renderBarPlot);

  document.getElementById("summaryBtn").addEventListener("click", renderSummaryPlot);
  document.getElementById("heatmapBtn").addEventListener("click", renderHeatmap);
  document.getElementById("searchGwasBtn").addEventListener("click", runGwasSearch);
  document.getElementById("downloadGwasCsvBtn").addEventListener("click", () => downloadCsv(currentGwasResults, "GWAS_candidate_genes.csv"));

  const generateChrBtn = document.getElementById("generateChrMapBtn");
  if (generateChrBtn) {
    generateChrBtn.addEventListener("click", generateChromosomeMaps);
  }

  const chrVersion = document.getElementById("chrVersion");
  if (chrVersion) {
    chrVersion.addEventListener("change", renderChromosomeSelector);
  }

  const chrSelectBox = document.getElementById("chrSelectBox");
  if (chrSelectBox) {
    chrSelectBox.addEventListener("change", renderChromosomeMarkerInputs);
  }

}

function getCurrentGeneRow() {
  return expressionData.find(row => normalizeGeneId(row.Gene_ID) === normalizeGeneId(currentGene));
}

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map(x => x + x).join("");
  }
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const h = Math.round(x).toString(16);
    return h.length === 1 ? "0" + h : h;
  }).join("");
}

function interpolateColor(c1, c2, t) {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );
}

function expressionToColor(value, maxValue, palette) {
  value = Math.max(0, Math.min(Number(value) || 0, maxValue));
  const scaled = value / maxValue;

  const n = palette.length - 1;
  const pos = scaled * n;
  const i = Math.min(Math.floor(pos), n - 1);
  const t = pos - i;

  return interpolateColor(palette[i], palette[i + 1], t);
}

function getStrokeSettings() {
  const mode = document.getElementById("strokeMode").value;
  const width = document.getElementById("strokeWidth").value;

  if (mode === "No stroke") return { color: "none", width: 0 };
  if (mode === "Black stroke") return { color: "#000000", width };
  if (mode === "Gray stroke") return { color: "#333333", width };
  if (mode === "White stroke") return { color: "#FFFFFF", width };
  return { color: document.getElementById("customStrokeColor").value, width };
}

function generateColoredSvgText() {
  const geneRow = getCurrentGeneRow();
  if (!geneRow) return svgOriginalText;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgOriginalText, "image/svg+xml");
  const maxTpm = Number(document.getElementById("maxTpm").value);
  const palette = palettes[document.getElementById("paletteSelect").value];
  const stroke = getStrokeSettings();

  tissues.forEach(tissue => {
    const node = doc.getElementById(tissue);
    if (node) {
      const color = expressionToColor(geneRow[tissue], maxTpm, palette);
      node.setAttribute("style", `fill:${color};stroke:${stroke.color};stroke-width:${stroke.width};`);
      node.setAttribute("fill", color);
      node.setAttribute("stroke", stroke.color);
      node.setAttribute("stroke-width", stroke.width);
    }
  });

  return new XMLSerializer().serializeToString(doc);
}

function renderAtlas() {
  const svgText = generateColoredSvgText();
  document.getElementById("svgContainer").innerHTML = svgText;
}

function downloadCurrentSvg() {
  const svgText = generateColoredSvgText();
  downloadText(svgText, `${currentGene}_expression_atlas.svg`, "image/svg+xml");
}

async function downloadAtlasImage(format) {
  const finalWidth = 4500;
  const finalHeight = 3250;
  const svgText = generateColoredSvgText();

  const canvas = document.createElement("canvas");
  canvas.width = finalWidth;
  canvas.height = finalHeight;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, finalWidth, finalHeight);

  const atlasImg = await svgToImage(svgText);

  const topMargin = 70;
  const sideMargin = 100;
  const legendHeight = 260;
  const gap = 70;
  const bottomMargin = 70;

  const availableWidth = finalWidth - 2 * sideMargin;
  const availableHeight = finalHeight - topMargin - legendHeight - gap - bottomMargin;

  const scale = Math.min(availableWidth / atlasImg.width, availableHeight / atlasImg.height);
  const drawWidth = atlasImg.width * scale;
  const drawHeight = atlasImg.height * scale;

  const x = (finalWidth - drawWidth) / 2;
  const y = topMargin;

  ctx.drawImage(atlasImg, x, y, drawWidth, drawHeight);

  drawLegend(ctx, finalWidth, finalHeight, legendHeight);

  const mime = format === "jpeg" ? "image/jpeg" : "image/png";
  const ext = format === "jpeg" ? "jpeg" : "png";

  canvas.toBlob(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${currentGene}_expression_atlas.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, mime, 0.95);
}

function svgToImage(svgText) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = reject;
    img.src = url;
  });
}

function drawLegend(ctx, finalWidth, finalHeight, legendHeight) {
  const palette = palettes[document.getElementById("paletteSelect").value];
  const maxTpm = Number(document.getElementById("maxTpm").value);

  const legendWidth = 1400;
  const barHeight = 95;
  const x0 = (finalWidth - legendWidth) / 2;
  const y0 = finalHeight - legendHeight + 30;

  const grad = ctx.createLinearGradient(x0, y0, x0 + legendWidth, y0);
  palette.forEach((color, i) => {
    grad.addColorStop(i / (palette.length - 1), color);
  });

  ctx.fillStyle = grad;
  ctx.fillRect(x0, y0, legendWidth, barHeight);

  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, legendWidth, barHeight);

  ctx.fillStyle = "#111111";
  ctx.font = "34px Arial";
  ctx.textAlign = "center";

  const ticks = [0, maxTpm * 0.25, maxTpm * 0.5, maxTpm * 0.75, maxTpm];
  ticks.forEach(tick => {
    const x = x0 + (tick / maxTpm) * legendWidth;
    ctx.beginPath();
    ctx.moveTo(x, y0 + barHeight);
    ctx.lineTo(x, y0 + barHeight + 15);
    ctx.stroke();
    ctx.fillText(Math.round(tick), x, y0 + barHeight + 55);
  });

  ctx.font = "40px Arial";
  ctx.fillText("TPM expression", finalWidth / 2, y0 + barHeight + 115);
}

function renderBarPlot() {
  const gene = currentBarGene || currentGene;
  const group = document.getElementById("barGroup").value || "All tissues";
  const useLog = document.getElementById("barLog").checked;

  const row = expressionData.find(r => normalizeGeneId(r.Gene_ID) === normalizeGeneId(gene));
  if (!row) return;

  const selectedTissues = tissueGroups[group];

  const x = selectedTissues.map(t => useLog ? Math.log2(row[t] + 1) : row[t]);
  const y = selectedTissues;

  Plotly.newPlot("barPlot", [{
    x,
    y,
    type: "bar",
    orientation: "h",
    marker: { color: "#2c7fb8" }
  }], {
    title: `Expression profile of ${gene}`,
    xaxis: { title: useLog ? "log2(TPM + 1)" : "TPM" },
    yaxis: { automargin: true },
    margin: { l: 160, r: 30, t: 70, b: 60 }
  }, { responsive: true });
}

function parseGeneText(text) {
  return [...new Set(text.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean))];
}

function renderSummaryPlot() {
  const genes = parseGeneText(document.getElementById("summaryGenes").value);
  const group = document.getElementById("summaryGroup").value || "All tissues";
  const useLog = document.getElementById("summaryLog").checked;
  const selectedTissues = tissueGroups[group];

  const rows = expressionData.filter(r => genes.includes(r.Gene_ID));
  if (rows.length === 0) return alert("No valid genes found.");

  const means = [];
  const medians = [];

  selectedTissues.forEach(tissue => {
    const values = rows.map(r => useLog ? Math.log2(r[tissue] + 1) : r[tissue]);
    means.push(mean(values));
    medians.push(median(values));
  });

  Plotly.newPlot("summaryPlot", [
    { x: means, y: selectedTissues, type: "bar", orientation: "h", name: "Mean" },
    { x: medians, y: selectedTissues, type: "bar", orientation: "h", name: "Median" }
  ], {
    title: "Mean and median expression across selected genes",
    barmode: "group",
    xaxis: { title: useLog ? "log2(TPM + 1)" : "TPM" },
    margin: { l: 160, r: 30, t: 70, b: 60 }
  }, { responsive: true });
}

function renderHeatmap() {
  const genes = parseGeneText(document.getElementById("heatmapGenes").value);
  const group = document.getElementById("heatmapGroup").value || "All tissues";
  const scaleType = document.getElementById("heatmapScale").value;
  const selectedTissues = tissueGroups[group];

  const rows = expressionData.filter(r => genes.includes(r.Gene_ID));
  if (rows.length === 0) return alert("No valid genes found.");

  const z = rows.map(row => {
    let values = selectedTissues.map(t => {
      if (scaleType === "Raw TPM") return row[t];
      return Math.log2(row[t] + 1);
    });

    if (scaleType === "Row-scaled Z-score") {
      const m = mean(values);
      const sd = std(values);
      values = values.map(v => sd === 0 ? 0 : (v - m) / sd);
    }

    return values;
  });

  Plotly.newPlot("heatmapPlot", [{
    z,
    x: selectedTissues,
    y: rows.map(r => r.Gene_ID),
    type: "heatmap",
    colorscale: [
      [0, "#f7fbff"],
      [0.33, "#ffffb2"],
      [0.66, "#fd8d3c"],
      [1, "#bd0026"]
    ]
  }], {
    title: "Gene expression heatmap",
    margin: { l: 160, r: 30, t: 70, b: 150 },
    xaxis: { tickangle: -45 }
  }, { responsive: true });
}

function normalizeChr(x) {
  return String(x).replace(/chr/gi, "").replace(/^0+/, "");
}

function runGwasSearch() {
  const snpId = document.getElementById("snpId").value.trim();
  const chr = normalizeChr(document.getElementById("gwasChr").value);
  const pos = Number(document.getElementById("snpPos").value);
  const upstream = Number(document.getElementById("upstream").value);
  const downstream = Number(document.getElementById("downstream").value);

  const start = Math.max(1, pos - upstream);
  const end = pos + downstream;

  currentGwasResults = annotationData
    .filter(g => normalizeChr(g.Chr) === chr && Number(g.End) >= start && Number(g.Start) <= end)
    .map(g => {
      const midpoint = (Number(g.Start) + Number(g.End)) / 2;
      let direction = "SNP within/overlapping gene";
      if (Number(g.End) < pos) direction = "Upstream";
      if (Number(g.Start) > pos) direction = "Downstream";

      return {
        SNP_ID: snpId,
        Chr: g.Chr,
        SNP_position: pos,
        Region_start: start,
        Region_end: end,
        Gene_ID: g.Gene_ID,
        Gene_raw: g.Gene_raw,
        Start: g.Start,
        End: g.End,
        Strand: g.Strand,
        Gene_length_bp: g.Gene_length_bp,
        Distance_from_SNP_bp: Math.round(Math.abs(midpoint - pos)),
        Direction: direction,
        Annotation: g.Annotation,
        Dbxref: g.Dbxref,
        Present_in_expression_matrix: expressionData.some(r => r.Gene_ID === g.Gene_ID) ? "Yes" : "No"
      };
    })
    .sort((a, b) => a.Distance_from_SNP_bp - b.Distance_from_SNP_bp);

  document.getElementById("gwasSummary").innerHTML =
    `<strong>Search region:</strong> Chr${chr}: ${start.toLocaleString()} - ${end.toLocaleString()}<br>
     <strong>SNP position:</strong> ${pos.toLocaleString()}<br>
     <strong>Candidate genes found:</strong> ${currentGwasResults.length}`;

  renderTable("gwasTable", currentGwasResults);
}

function renderTable(tableId, data) {
  const table = document.getElementById(tableId);
  table.innerHTML = "";

  if (!data || data.length === 0) {
    table.innerHTML = "<tr><td>No data found.</td></tr>";
    return;
  }

  const keys = Object.keys(data[0]);

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");

  keys.forEach(k => {
    const th = document.createElement("th");
    th.textContent = k;
    trh.appendChild(th);
  });

  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  data.forEach(row => {
    const tr = document.createElement("tr");
    keys.forEach(k => {
      const td = document.createElement("td");
      td.textContent = row[k] ?? "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
}



const APPROVED_CLASSES = ["Tissue-specific", "Broad", "Ubiquitous", "Weak", "Null"];
const APPROVED_GROUPS = ["Root/Nodule", "Leaf/Shoot/SAM", "Flower organs", "Seed/Pod"];

function normalizeGeneId(value){
  const text=String(value??"").trim();
  const m=text.match(/Ca_(?:v2\.0_)?(\d+)/i);
  return m ? `Ca_${m[1].padStart(5,"0")}` : text;
}
function normalizeText(v){return String(v??"").replace(/^\uFEFF/,"").trim().toLowerCase().replace(/\s+/g," ");}
function validValue(v){const x=normalizeText(v); return x && x!=="na" && x!=="n/a" && x!=="null";}
function unique(arr){return [...new Set(arr.filter(Boolean))];}
async function safeLoad(path){try{return await loadCsv(path);}catch(e){console.warn(`Could not load ${path}`,e);return [];}}
async function loadPortalDatasets(){
  [websiteGeneMaster,goGeneMapping,geneDomainMapping,domainReference,tissueMarkerGenes,housekeepingGenes]=await Promise.all([
    safeLoad("data/website_gene_master.csv"), safeLoad("data/GO_gene_mapping_with_terms.csv"), safeLoad("data/combined_gene_domain_mapping.csv"), safeLoad("data/interpro_pfam_domain_reference.csv"), safeLoad("data/high_confidence_tissue_marker_genes.csv"), safeLoad("data/candidate_housekeeping_genes.csv")
  ]);
  [websiteGeneMaster,goGeneMapping,geneDomainMapping,tissueMarkerGenes,housekeepingGenes].forEach(rows=>rows.forEach(r=>{if(r.Gene_ID)r.Gene_ID=normalizeGeneId(r.Gene_ID);}));
}
function geneIdFrom(row){return normalizeGeneId(row?.Gene_ID || row?.gene_id || row?.Gene || row?.gene || Object.values(row||{})[0]);}
function markerTissueFrom(row){return row?.Tissue || row?.Marker_Tissue || row?.Maximum_Tissue || "";}
function populateSelectSimple(id,values,firstLabel=""){
  const el=document.getElementById(id); if(!el)return;
  el.innerHTML=firstLabel?`<option value="">${firstLabel}</option>`:"";
  values.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;el.appendChild(o);});
}
function populateNewPortalSelectors(){
  populateSelectSimple("goExpressionClass",APPROVED_CLASSES);
  populateSelectSimple("domainExpressionClass",APPROVED_CLASSES);
  const tfRows=getTfRows();
  populateSelectSimple("tfFamilyFilter",unique(tfRows.map(r=>r.TF_Family)).sort(),"All TF families");
  populateSelectSimple("tfClassFilter",APPROVED_CLASSES,"All expression classes");
  populateSelectSimple("tfTissueFilter",unique(tfRows.map(r=>r.Maximum_Tissue).filter(validValue)).sort(),"All tissues");
  updateAnalysisVisibility("go"); updateAnalysisVisibility("domain");
}
function setupNewPortalEvents(){
  ["goSourceMode","domainSourceMode"].forEach(id=>document.getElementById(id)?.addEventListener("change",()=>updateAnalysisVisibility(id.startsWith("go")?"go":"domain")));
  document.getElementById("runGoBtn")?.addEventListener("click",runGoEnrichment);
  document.getElementById("runDomainBtn")?.addEventListener("click",runDomainEnrichment);
  document.getElementById("downloadGoCsvBtn")?.addEventListener("click",()=>downloadCsv(currentGoResults,"GO_enrichment_results.csv"));
  document.getElementById("downloadGoXlsxBtn")?.addEventListener("click",()=>downloadXlsx(currentGoResults,"GO_enrichment_results.xlsx","GO enrichment"));
  document.getElementById("downloadGoPlotBtn")?.addEventListener("click",()=>downloadEnrichmentPlot("goPlot","GO_enrichment_dot_plot"));
  document.getElementById("downloadDomainCsvBtn")?.addEventListener("click",()=>downloadCsv(currentDomainResults,"functional_annotation_enrichment.csv"));
  document.getElementById("downloadDomainXlsxBtn")?.addEventListener("click",()=>downloadXlsx(currentDomainResults,"functional_annotation_enrichment.xlsx","Functional annotation"));
  document.getElementById("downloadDomainPlotBtn")?.addEventListener("click",()=>{const db=document.getElementById("domainDatabase")?.value||"Functional_annotation";downloadEnrichmentPlot("domainPlot",`${db}_enrichment_dot_plot`);});
  document.getElementById("tfSearchBtn")?.addEventListener("click",runTfSearch);
  document.getElementById("renderTfPortalBtn")?.addEventListener("click",renderTfPortal);
  document.getElementById("downloadTfSearchBtn")?.addEventListener("click",()=>downloadCsv(currentTfResults,"filtered_TF_annotation.csv"));
  document.getElementById("downloadTfFamilyCountsBtn")?.addEventListener("click",()=>downloadCsv(currentTfFamilyCounts,"TF_family_counts.csv"));
  document.getElementById("downloadTfMarkersBtn")?.addEventListener("click",()=>downloadCsv(currentTfMarkers,"high_confidence_TF_markers.csv"));
  document.getElementById("downloadTfFamilyMatrixBtn")?.addEventListener("click",()=>downloadCsv(currentTfFamilyMatrix,"TF_family_expression_matrix.csv"));
}
function updateAnalysisVisibility(prefix){
  const mode=document.getElementById(`${prefix}SourceMode`)?.value||"pasted";
  document.querySelectorAll(`[data-analysis-prefix="${prefix}"]`).forEach(node=>{
    const type=node.dataset.selectorType;
    node.classList.toggle("hidden-control",!((mode==="pasted"&&type==="pasted")||(mode==="expression_class"&&type==="class")));
  });
}
function parseGeneTextNormalized(text){return unique(String(text||"").split(/[\s,;]+/).map(normalizeGeneId));}
function getSingleGeneSet(prefix){
  const mode=document.getElementById(`${prefix}SourceMode`)?.value||"pasted";
  if(mode==="pasted") return [{Set_Name:"Custom gene list",genes:parseGeneTextNormalized(document.getElementById(`${prefix}Genes`)?.value)}];
  if(mode==="expression_class"){
    const cls=document.getElementById(`${prefix}ExpressionClass`)?.value||"";
    return [{Set_Name:cls,genes:unique(websiteGeneMaster.filter(r=>normalizeText(r.Expression_Class)===normalizeText(cls)).map(geneIdFrom))}];
  }
  if(mode==="four_tissue_groups"){
    return APPROVED_GROUPS.map(group=>({Set_Name:group,genes:unique(websiteGeneMaster.filter(r=>String(r.Maximum_Tissue_Group||"").trim()===group).map(geneIdFrom))}));
  }
  if(mode==="housekeeping") return [{Set_Name:"Candidate housekeeping genes",genes:unique(housekeepingGenes.map(geneIdFrom))}];
  if(mode==="markers") return [{Set_Name:"High-confidence marker genes",genes:unique(tissueMarkerGenes.map(geneIdFrom))}];
  return [];
}
function fisherRight(a,b,c,d){
  const n=a+b+c+d, row=a+b, col=a+c;
  const logFact=[0]; for(let i=1;i<=n;i++)logFact[i]=logFact[i-1]+Math.log(i);
  const logChoose=(nn,k)=>k<0||k>nn?-Infinity:logFact[nn]-logFact[k]-logFact[nn-k];
  const logDen=logChoose(n,row); let p=0;
  const max=Math.min(row,col);
  for(let x=a;x<=max;x++) p+=Math.exp(logChoose(col,x)+logChoose(n-col,row-x)-logDen);
  return Math.min(1,p);
}
function bhAdjust(rows){
  const sorted=rows.map((r,i)=>({i,p:Number(r.P_Value)})).sort((a,b)=>a.p-b.p); let prev=1;
  for(let k=sorted.length-1;k>=0;k--){const adj=Math.min(prev,sorted[k].p*sorted.length/(k+1));rows[sorted[k].i].FDR=adj;prev=adj;}
}
function runOraForSet({setName,genes,mappings,termIdKey,termNameKey,categoryKey,categoryValue,minCount,fdrCutoff,foldCutoff}){
  const atlas=new Set(expressionData.map(r=>normalizeGeneId(r.Gene_ID)));
  const rows=mappings.filter(r=>!categoryValue||normalizeText(r[categoryKey])===normalizeText(categoryValue)).map(r=>({gene:geneIdFrom(r),id:String(r[termIdKey]||"").trim(),name:String(r[termNameKey]||"").trim(),cat:String(r[categoryKey]||"").trim()})).filter(r=>atlas.has(r.gene)&&r.id);
  const background=new Set(rows.map(r=>r.gene)); const foreground=new Set(genes.filter(g=>background.has(g)));
  if(foreground.size<5)return {results:[],background:background.size,submitted:genes.length,testable:foreground.size};
  const termMap=new Map();
  rows.forEach(r=>{if(!termMap.has(r.id))termMap.set(r.id,{name:r.name,cat:r.cat,bg:new Set(),fg:new Set()});const t=termMap.get(r.id);t.bg.add(r.gene);if(foreground.has(r.gene))t.fg.add(r.gene);});
  const out=[];
  termMap.forEach((t,id)=>{const a=t.fg.size;if(a<minCount)return;const fgN=foreground.size,bgN=background.size,b=fgN-a,c=t.bg.size-a,d=bgN-fgN-c;const fold=(a/fgN)/(t.bg.size/bgN);const p=fisherRight(a,b,c,d);out.push({Set_Name:setName,Term_ID:id,Term_Name:t.name||id,Category:t.cat,Foreground_Count:a,Foreground_Total:fgN,Background_Count:t.bg.size,Background_Total:bgN,Fold_Enrichment:fold,P_Value:p,FDR:1,Genes:[...t.fg].sort().join(";")});});
  bhAdjust(out); return {results:out.filter(r=>r.FDR<fdrCutoff&&r.Fold_Enrichment>foldCutoff).sort((a,b)=>a.FDR-b.FDR||b.Fold_Enrichment-a.Fold_Enrichment),background:background.size,submitted:genes.length,testable:foreground.size};
}
function topPerSet(rows,n){const m=new Map();rows.forEach(r=>{if(!m.has(r.Set_Name))m.set(r.Set_Name,[]);m.get(r.Set_Name).push(r);});return [...m.values()].flatMap(a=>a.slice().sort((x,y)=>x.FDR-y.FDR||y.Fold_Enrichment-x.Fold_Enrichment).slice(0,n));}
function wrapLabel(name,id){const words=String(name||id).split(/\s+/); if(words.length>6){const mid=Math.ceil(words.length/2);return `${words.slice(0,mid).join(" ")}<br>${words.slice(mid).join(" ")}<br>[${id}]`;}return `${name||id}<br>[${id}]`;}
function calculateEnrichmentPlotHeight(plotRows){
  const uniqueTerms=new Set(plotRows.map(row=>`${row.Term_ID}||${row.Term_Name}`));
  return Math.max(620,250+uniqueTerms.size*34);
}
function resetEnrichmentPlot(plotId,desiredHeight){
  const plotElement=document.getElementById(plotId);
  if(!plotElement)return null;
  try{Plotly.purge(plotElement);}catch(error){console.warn(`Could not purge ${plotId}:`,error);}
  plotElement.innerHTML="";
  plotElement.removeAttribute("style");
  plotElement.style.display="block";
  plotElement.style.width="100%";
  plotElement.style.maxWidth="100%";
  plotElement.style.minWidth="0";
  plotElement.style.height=`${desiredHeight}px`;
  plotElement.style.boxSizing="border-box";
  plotElement.style.overflowX="hidden";
  plotElement.style.overflowY="visible";
  return plotElement;
}
function showEnrichmentEmptyPlot(plotId,message){
  const plotElement=resetEnrichmentPlot(plotId,520);
  if(!plotElement)return;
  plotElement.innerHTML=`<div class="enrichment-empty-message">${escapeXml(message)}</div>`;
}
async function downloadEnrichmentPlot(plotId,fileName){
  const plotElement=document.getElementById(plotId);
  if(!plotElement||!plotElement.classList.contains("js-plotly-plot")){
    alert("Please run the enrichment analysis before downloading the plot.");
    return;
  }
  try{
    const renderedHeight=plotElement.clientHeight||900;
    await Plotly.downloadImage(plotElement,{format:"jpeg",filename:fileName,width:1800,height:Math.max(1000,Math.round(renderedHeight*1.4)),scale:1});
  }catch(error){console.error("JPEG plot download failed:",error);alert("The plot could not be downloaded.");}
}
function renderComparisonDotPlot(divId,rows,title,topN){
  if(!Array.isArray(rows)||!rows.length){
    showEnrichmentEmptyPlot(divId,"No significant enriched terms passed the selected filters.");
    return;
  }
  const p=topPerSet(rows,topN);
  if(!p.length){
    showEnrichmentEmptyPlot(divId,"No terms are available for plotting.");
    return;
  }
  const plotHeight=calculateEnrichmentPlotHeight(p);
  const plotElement=resetEnrichmentPlot(divId,plotHeight);
  if(!plotElement)return;

  const foregroundCounts=p.map(r=>Number(r.Foreground_Count)||0);
  const maxCount=Math.max(...foregroundCounts);
  const legendStep=Math.max(1,Math.ceil(maxCount/4/5)*5);
  const sizeLegendCounts=[
    legendStep,
    legendStep*2,
    legendStep*3,
    legendStep*4
  ].filter(count=>count<=maxCount||count===legendStep);
  const enrichmentDotSize=count=>Math.min(38,Math.max(8,5+Math.sqrt(Number(count)||0)*3.5));

  const trace={
    x:p.map(r=>r.Set_Name),
    y:p.map(r=>wrapLabel(r.Term_Name,r.Term_ID)),
    mode:"markers",
    type:"scatter",
    showlegend:false,
    marker:{
      size:foregroundCounts.map(enrichmentDotSize),
      color:p.map(r=>-Math.log10(Math.max(Number(r.FDR)||1,1e-300))),
      colorscale:"Viridis",
      showscale:true,
      colorbar:{
        title:{text:"−log₁₀(FDR)",side:"top"},
        thickness:20,
        len:0.32,
        x:1.04,
        xanchor:"left",
        y:0.65,
        yanchor:"middle",
        outlinewidth:0,
        ticks:"outside",
        ticklen:4
      },
      line:{width:0.5,color:"#333333"}
    },
    customdata:p.map(r=>[r.Fold_Enrichment,r.Foreground_Count,r.Foreground_Total,r.Background_Count,r.Background_Total,r.FDR,r.Genes]),
    hovertemplate:"<b>%{y}</b><br>Set: %{x}<br>Fold enrichment: %{customdata[0]:.2f}<br>Foreground: %{customdata[1]}/%{customdata[2]}<br>Background: %{customdata[3]}/%{customdata[4]}<br>FDR: %{customdata[5]:.3g}<br>Genes: %{customdata[6]}<extra></extra>"
  };

  const sizeLegendTraces=sizeLegendCounts.map(count=>({
    x:[null],
    y:[null],
    mode:"markers",
    type:"scatter",
    name:String(count),
    marker:{
      size:enrichmentDotSize(count),
      color:"#111111",
      line:{color:"#111111",width:0}
    },
    hoverinfo:"skip",
    showlegend:true,
    legendgroup:"foreground-count"
  }));

  const layout={
    title:{text:title,x:0.5,xanchor:"center",y:0.98,yanchor:"top"},
    autosize:true,
    height:plotHeight,
    xaxis:{title:{text:"Gene set"},automargin:true,fixedrange:false},
    yaxis:{automargin:true,fixedrange:false,type:"category"},
    margin:{l:350,r:230,t:30,b:110,pad:4},
    legend:{
      title:{text:"Foreground genes",font:{size:14}},
      x:1.04,
      xanchor:"left",
      y:0.95,
      yanchor:"top",
      orientation:"v",
      bgcolor:"rgba(255,255,255,0)",
      borderwidth:0,
      font:{size:12,color:"#111111"},
      tracegroupgap:8
    },
    hovermode:"closest",
    paper_bgcolor:"#ffffff",
    plot_bgcolor:"#ffffff"
  };
  const config={
    responsive:true,
    displaylogo:false,
    modeBarButtonsToRemove:["lasso2d","select2d","toggleSpikelines"],
    toImageButtonOptions:{format:"jpeg",filename:title.replace(/[^A-Za-z0-9_-]+/g,"_"),width:1800,height:Math.max(1000,Math.round(plotHeight*1.4)),scale:1}
  };
  Plotly.newPlot(plotElement,[trace,...sizeLegendTraces],layout,config).then(()=>{
    plotElement.style.width="100%";
    plotElement.style.maxWidth="100%";
    requestAnimationFrame(()=>Plotly.Plots.resize(plotElement));
  });
}
function runGoEnrichment(){
  const ontology=document.getElementById("goOntology").value,sets=getSingleGeneSet("go"),min=Number(document.getElementById("goMinCount").value)||3,fdr=Number(document.getElementById("goFdr").value)||.05,fold=Number(document.getElementById("goFold").value)||1,top=Number(document.getElementById("goTopN").value)||10;
  currentGoResults=[];const diagnostics=[];
  sets.forEach(s=>{const a=runOraForSet({setName:s.Set_Name,genes:s.genes,mappings:goGeneMapping,termIdKey:"GO_ID",termNameKey:"GO_Term",categoryKey:"Ontology",categoryValue:ontology,minCount:min,fdrCutoff:fdr,foldCutoff:fold});currentGoResults.push(...a.results);diagnostics.push(`${s.Set_Name}: ${a.submitted} selected, ${a.testable} GO-annotated, ${a.results.length} significant`);});
  document.getElementById("goSummary").innerHTML=`<strong>Ontology:</strong> ${ontology}<br>${diagnostics.join("<br>")}`;renderComparisonDotPlot("goPlot",currentGoResults,`GO enrichment (${ontology})`,top);renderTable("goTable",currentGoResults);
}
function runDomainEnrichment(){
  const db=document.getElementById("domainDatabase").value,sets=getSingleGeneSet("domain"),min=Number(document.getElementById("domainMinCount").value)||3,fdr=Number(document.getElementById("domainFdr").value)||.05,fold=Number(document.getElementById("domainFold").value)||1,top=Number(document.getElementById("domainTopN").value)||10;
  const ref=new Map(domainReference.filter(r=>normalizeText(r.Annotation_Type)===normalizeText(db)).map(r=>[String(r.Domain_ID||"").trim(),r]));
  currentDomainResults=[];const diagnostics=[];
  sets.forEach(s=>{const a=runOraForSet({setName:s.Set_Name,genes:s.genes,mappings:geneDomainMapping,termIdKey:"Domain_ID",termNameKey:"Domain_ID",categoryKey:"Annotation_Type",categoryValue:db,minCount:min,fdrCutoff:fdr,foldCutoff:fold});a.results.forEach(r=>{const rr=ref.get(r.Term_ID)||{};r.Term_Name=rr.Final_Domain_Name||rr.Final_Domain_Plot_Label||r.Term_ID;r.Domain_Description=rr.Final_Domain_Description||"";});currentDomainResults.push(...a.results);diagnostics.push(`${s.Set_Name}: ${a.submitted} selected, ${a.testable} ${db}-annotated, ${a.results.length} significant`);});
  document.getElementById("domainSummary").innerHTML=`<strong>Database:</strong> ${db}<br>${diagnostics.join("<br>")}`;renderComparisonDotPlot("domainPlot",currentDomainResults,`${db} enrichment`,top);renderTable("domainTable",currentDomainResults);
}
function downloadXlsx(data,filename,sheet){if(!data?.length)return alert("No data to download.");if(typeof XLSX==="undefined")return alert("Excel library did not load.");const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(data);XLSX.utils.book_append_sheet(wb,ws,sheet.slice(0,31));XLSX.writeFile(wb,filename);}

function getTfRows(){return websiteGeneMaster.filter(r=>validValue(r.TF_Family));}
function tfMarkerMap(){const m=new Map();tissueMarkerGenes.forEach(r=>{const g=geneIdFrom(r);if(g)m.set(g,markerTissueFrom(r));});return m;}
function runTfSearch(){
  const q=normalizeText(document.getElementById("tfSearchInput")?.value),fam=document.getElementById("tfFamilyFilter")?.value||"",cls=document.getElementById("tfClassFilter")?.value||"",tissue=document.getElementById("tfTissueFilter")?.value||"",markerOnly=document.getElementById("tfMarkerOnly")?.checked,mm=tfMarkerMap();
  currentTfResults=getTfRows().filter(r=>!fam||r.TF_Family===fam).filter(r=>!cls||normalizeText(r.Expression_Class)===normalizeText(cls)).filter(r=>!tissue||r.Maximum_Tissue===tissue).filter(r=>!markerOnly||mm.has(geneIdFrom(r))).filter(r=>!q||[r.Gene_ID,r.TF_Family,r.Description,r.Description_full,r.Expression_Class,r.Maximum_Tissue].some(v=>normalizeText(v).includes(q))).map(r=>({Gene_ID:geneIdFrom(r),TF_Family:r.TF_Family,Description:r.Description,Chromosome:r.Chromosome,Start:r.Start,End:r.End,Strand:r.Strand,Expression_Class:r.Expression_Class,Maximum_Tissue:r.Maximum_Tissue,Maximum_Tissue_Group:r.Maximum_Tissue_Group,Maximum_Median_TPM:r.Maximum_Median_TPM,Marker_Status:mm.has(geneIdFrom(r))?"Yes":"No",Marker_Tissue:mm.get(geneIdFrom(r))||""}));
  document.getElementById("tfSearchSummary").textContent=`${currentTfResults.length.toLocaleString()} TF genes found.`;renderTable("tfSearchTable",currentTfResults,{clickable:true,onClick:row=>showSelectedTf(row.Gene_ID)});
}
function showSelectedTf(gene){const r=getTfRows().find(x=>geneIdFrom(x)===gene),mm=tfMarkerMap();if(!r)return;const fields={"Gene ID":geneIdFrom(r),"TF family":r.TF_Family,"Description":r.Description,"Full gene ID":r.Full_Gene_ID,"Chromosome":r.Chromosome,"Start":r.Start,"End":r.End,"Strand":r.Strand,"Gene length (bp)":r.Gene_Length_bp,"Expression class":r.Expression_Class,"Maximum tissue":r.Maximum_Tissue,"Maximum tissue group":r.Maximum_Tissue_Group,"Maximum median TPM":r.Maximum_Median_TPM,"High-confidence TF marker":mm.has(gene)?"Yes":"No","Marker tissue":mm.get(gene)||"—","GO":r.GO,"InterPro":r.InterPro,"Pfam":r.Pfam_combined||r.Pfam};document.getElementById("selectedTfInfo").innerHTML=Object.entries(fields).map(([k,v])=>`<div class="info-item"><strong>${escapeXml(k)}</strong>${escapeXml(v||"—")}</div>`).join("");const ev={"Mapping status":r.TF_Mapping_Status,"Family conflict":r.TF_Family_Conflict,"Ambiguous mapping":r.Any_Ambiguous_Mapping,"Supporting PlantTFDB proteins":r.Supporting_PlantTFDB_Proteins,"Maximum percent identity":r.Maximum_Percent_Identity,"Maximum query coverage":r.Maximum_Query_Coverage,"Maximum bitscore":r.Maximum_Bitscore};document.getElementById("selectedTfEvidence").innerHTML=Object.entries(ev).map(([k,v])=>`<div class="info-item"><strong>${escapeXml(k)}</strong>${escapeXml(v||"—")}</div>`).join("");}
function renderTfPortal(){runTfSearch();renderTfFamilyCounts();renderTfMarkers();renderTfFamilyHeatmap();}
function renderTfFamilyCounts(){const c=new Map();getTfRows().forEach(r=>c.set(r.TF_Family,(c.get(r.TF_Family)||0)+1));currentTfFamilyCounts=[...c].map(([TF_Family,Number_of_TF_Genes])=>({TF_Family,Number_of_TF_Genes})).sort((a,b)=>b.Number_of_TF_Genes-a.Number_of_TF_Genes);const n=Number(document.getElementById("tfTopFamilies")?.value)||20,p=currentTfFamilyCounts.slice(0,n).reverse();Plotly.newPlot("tfFamilyCountPlot",[{x:p.map(r=>r.Number_of_TF_Genes),y:p.map(r=>r.TF_Family),type:"bar",orientation:"h"}],{xaxis:{title:"Number of TF genes"},margin:{l:150,r:30,t:30,b:60}},{responsive:true});}
function renderTfMarkers(){const tf=new Map(getTfRows().map(r=>[geneIdFrom(r),r])),mm=tfMarkerMap();currentTfMarkers=[...mm].filter(([g])=>tf.has(g)).map(([g,t])=>({Gene_ID:g,TF_Family:tf.get(g).TF_Family,Tissue:t,Expression_Class:tf.get(g).Expression_Class}));if(!tissueMarkerGenes.length){document.getElementById("tfMarkerNotice").textContent="high_confidence_tissue_marker_genes.csv was not loaded.";Plotly.purge("tfMarkerCountPlot");return;}document.getElementById("tfMarkerNotice").textContent=`${currentTfMarkers.length.toLocaleString()} high-confidence TF marker records.`;const c=new Map();currentTfMarkers.forEach(r=>c.set(r.Tissue,(c.get(r.Tissue)||0)+1));const p=[...c].map(([Tissue,Count])=>({Tissue,Count})).sort((a,b)=>a.Count-b.Count);Plotly.newPlot("tfMarkerCountPlot",[{x:p.map(r=>r.Count),y:p.map(r=>r.Tissue),type:"bar",orientation:"h"}],{xaxis:{title:"High-confidence TF marker genes"},margin:{l:170,r:30,t:30,b:60},height:Math.max(600,p.length*28)},{responsive:true});}
function medianLocal(a){const s=a.slice().sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
function renderTfFamilyHeatmap(){const tf=getTfRows(),exp=new Map(expressionData.map(r=>[normalizeGeneId(r.Gene_ID),r])),families=new Map();tf.forEach(r=>{const e=exp.get(geneIdFrom(r));if(!e)return;if(!families.has(r.TF_Family))families.set(r.TF_Family,[]);families.get(r.TF_Family).push(e);});const limit=Number(document.getElementById("tfFamilyHeatmapLimit")?.value)||42,method=document.getElementById("tfFamilySummary")?.value||"median",selected=[...families].sort((a,b)=>b[1].length-a[1].length).slice(0,limit);currentTfFamilyMatrix=selected.map(([fam,rows])=>{const out={TF_Family:fam,Member_Genes:rows.length};tissues.forEach(t=>{const vals=rows.map(r=>Number(r[t])||0);out[t]=method==="mean"?mean(vals):medianLocal(vals);});return out;});const z=currentTfFamilyMatrix.map(r=>{const vals=tissues.map(t=>Math.log2(Number(r[t])+1)),m=mean(vals),sd=std(vals);return vals.map(v=>sd?((v-m)/sd):0);});const plotHeight=Math.max(760,currentTfFamilyMatrix.length*24),plotElement=document.getElementById("tfFamilyHeatmapPlot");if(!plotElement)return;plotElement.style.height=`${plotHeight}px`;plotElement.style.minHeight=`${plotHeight}px`;Plotly.newPlot(plotElement,[{z,x:tissues,y:currentTfFamilyMatrix.map(r=>r.TF_Family),type:"heatmap",colorscale:"RdBu",zmid:0}],{xaxis:{tickangle:-45},yaxis:{automargin:true},margin:{l:150,r:40,t:30,b:150},height:plotHeight},{responsive:true});}

// ============================================================
// Chromosome Mapper functions
// ============================================================

const markerColorChoices = {
  "Red": "#d73027",
  "Blue": "#4575b4",
  "Green": "#1a9850",
  "Purple": "#762a83",
  "Orange": "#f46d43",
  "Black": "#000000",
  "Gray": "#666666"
};

async function ensureChromosomeMapperLoaded() {
  if (chromosomeDataLoaded) {
    if (document.getElementById("chrVersion") && document.getElementById("chrVersion").options.length === 0) {
      populateChromosomeVersionSelect();
      renderChromosomeSelector();
    }
    return;
  }

  try {
    chromosomeLengths = await loadCsv("data/chickpea_chromosome_lengths.csv");
  } catch (err) {
    const box = document.getElementById("chrSelectBox");
    if (box) {
      box.innerHTML = "<p class='status' style='color:#b2182b;'>Could not load data/chickpea_chromosome_lengths.csv. Please confirm the file name and location.</p>";
    }
    console.error("Chromosome length CSV loading failed:", err);
    return;
  }

  chromosomeLengths.forEach(row => {
    row.Chr = cleanChrMapper(row.Chr);
    row.Length_bp = Number(String(row.Length_bp || "").replace(/,/g, "")) || 0;
    row.Chr_num = Number(String(row.Chr).replace(/[^0-9]/g, "")) || 0;
  });

  chromosomeDataLoaded = true;
  populateChromosomeVersionSelect();
  renderChromosomeSelector();
}

function populateChromosomeVersionSelect() {
  const versionSelect = document.getElementById("chrVersion");
  if (!versionSelect) return;

  const versions = [...new Set(chromosomeLengths.map(row => row.Version).filter(Boolean))];

  versionSelect.innerHTML = "";
  versions.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    versionSelect.appendChild(opt);
  });

  if (versions.length === 0) {
    versionSelect.innerHTML = "<option>No genome versions found</option>";
  }
}

function cleanChrMapper(x) {
  x = String(x || "");
  x = x.replace(/^chromosome/i, "Chr");
  x = x.replace(/^chr/i, "Chr");
  x = x.replace(/^Ca_LG/i, "Chr");
  x = x.replace(/^Ca/i, "Chr");
  x = x.replace(/_v2.0$/i, "");
  return x.startsWith("Chr") ? x : "Chr" + x;
}

function getSelectedChromosomes() {
  return [...document.querySelectorAll(".chr-check:checked")].map(x => x.value);
}

function renderChromosomeSelector() {
  const versionEl = document.getElementById("chrVersion");
  const box = document.getElementById("chrSelectBox");
  if (!versionEl || !box) return;

  const version = versionEl.value;
  const rows = chromosomeLengths
    .filter(row => row.Version === version)
    .sort((a, b) => a.Chr_num - b.Chr_num);

  if (rows.length === 0) {
    box.innerHTML = "<p class='note'>No chromosomes found for this genome version.</p>";
    document.getElementById("chrMarkerInputs").innerHTML = "";
    document.getElementById("chrMapOutput").innerHTML = "";
    renderTable("chrMarkerTable", []);
    return;
  }

  box.innerHTML = "<label>Chromosomes to display</label>" + rows.map(row => `
    <label class="checkbox-label">
      <input type="checkbox" class="chr-check" value="${row.Chr}" />
      ${row.Chr}
    </label>
  `).join("");

  document.getElementById("chrMarkerInputs").innerHTML =
    "<p class='note'>Select one or more chromosomes first. Marker input boxes will appear only for selected chromosomes.</p>";

  document.getElementById("chrMapOutput").innerHTML = "";
  renderTable("chrMarkerTable", []);
}

function renderChromosomeMarkerInputs() {
  const selected = getSelectedChromosomes();

  if (selected.length === 0) {
    document.getElementById("chrMarkerInputs").innerHTML =
      "<p class='note'>Select one or more chromosomes first. Marker input boxes will appear only for selected chromosomes.</p>";
    return;
  }

  const colorOptions = Object.keys(markerColorChoices)
    .map(c => `<option value="${c}">${c}</option>`)
    .join("");

  document.getElementById("chrMarkerInputs").innerHTML = selected.map(chr => {
    const safe = chr.replace(/[^A-Za-z0-9]/g, "_");

    const leftGroups = Array.from({ length: 5 }, (_, idx) => {
      const i = idx + 1;
      return `
        <label>Left marker group ${i} color</label>
        <select id="markerColor_${safe}_left_${i}">${colorOptions}</select>
        <label>Left group ${i}</label>
        <textarea id="marker_${safe}_left_${i}" rows="2" placeholder="SNP_1, 347586, 348200&#10;SNP_2, 758321, 759000"></textarea>
      `;
    }).join("");

    const rightGroups = Array.from({ length: 5 }, (_, idx) => {
      const i = idx + 1;
      return `
        <label>Right marker group ${i} color</label>
        <select id="markerColor_${safe}_right_${i}">${colorOptions}</select>
        <label>Right group ${i}</label>
        <textarea id="marker_${safe}_right_${i}" rows="2" placeholder="Gene_1, 1457832, 1460200&#10;QTL_1, 3920000, 3950000"></textarea>
      `;
    }).join("");

    return `
      <div class="marker-block">
        <h3>${chr} marker input</h3>
        <div class="marker-grid">
          <div>
            <h4>Left side</h4>
            ${leftGroups}
          </div>
          <div>
            <h4>Right side</h4>
            ${rightGroups}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function parseMarkerText(txt, chr, side, colorName, groupId) {
  const color = markerColorChoices[colorName] || markerColorChoices.Red;
  const rows = [];

  txt.split(/\n|;/)
    .map(x => x.trim())
    .filter(Boolean)
    .forEach(line => {
      const parts = line.split(",").map(x => x.trim());
      if (parts.length < 3) return;

      let start = Number(parts[1].replace(/,/g, ""));
      let end = Number(parts[2].replace(/,/g, ""));

      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      if (end < start) [start, end] = [end, start];

      rows.push({
        Chr: chr,
        Side: side,
        Label: parts[0],
        Start: start,
        End: end,
        Position: (start + end) / 2,
        Color_name: colorName,
        Color: color,
        Group: groupId
      });
    });

  return rows;
}

function collectChromosomeMarkers(selected) {
  const all = [];

  selected.forEach(chr => {
    const safe = chr.replace(/[^A-Za-z0-9]/g, "_");

    ["left", "right"].forEach(side => {
      for (let i = 1; i <= 5; i++) {
        const txt = document.getElementById(`marker_${safe}_${side}_${i}`)?.value || "";
        const colorName = document.getElementById(`markerColor_${safe}_${side}_${i}`)?.value || "Red";
        all.push(...parseMarkerText(txt, chr, side, colorName, `${side}_group_${i}`));
      }
    });
  });

  return all;
}

async function generateChromosomeMaps() {
  await ensureChromosomeMapperLoaded();

  const version = document.getElementById("chrVersion").value;
  const selected = getSelectedChromosomes();

  if (selected.length === 0) {
    alert("Please select at least one chromosome.");
    return;
  }

  currentChromosomeMarkers = collectChromosomeMarkers(selected);
  renderTable("chrMarkerTable", currentChromosomeMarkers);

  const settings = {
    title: document.getElementById("chrMapTitle").value || "Chickpea chromosome map",
    fill: document.getElementById("chrFillChoice").value,
    border: document.getElementById("chrBorderChoice").value,
    chrWidth: Number(document.getElementById("chrWidth").value),
    stroke: Number(document.getElementById("markerStroke").value),
    labelSize: Number(document.getElementById("markerLabelSize").value),
    minBandMb: Number(document.getElementById("markerBandHeight").value),
    labelSpread: Number(document.getElementById("markerLabelSpread").value),
    labelOffset: Number(document.getElementById("markerLabelOffset").value),
    width: Number(document.getElementById("chrDownloadWidth").value),
    height: Number(document.getElementById("chrDownloadHeight").value),
    showScale: document.getElementById("showChrScale").checked,
    showNames: document.getElementById("showChrNames").checked
  };

  const output = document.getElementById("chrMapOutput");
  output.innerHTML = "";

  selected.forEach(chr => {
    const chrRow = chromosomeLengths.find(row => row.Version === version && row.Chr === chr);
    if (!chrRow) return;

    const svg = makeChromosomeSvg(chrRow, currentChromosomeMarkers.filter(m => m.Chr === chr), settings);

    output.insertAdjacentHTML("beforeend", `
      <div class="chr-map-box">
        <h3>${chr} map</h3>
        <p class="note">Reference version: ${version}</p>
        <div class="chr-svg-wrap">${svg}</div>
        <button class="download-btn" onclick="downloadChrJpgElement('chr_svg_${chr}', '${version}_${chr}_chickpea_chromosome_map.jpg')">Download JPG</button>
      </div>
    `);
  });
}

function makeChromosomeSvg(chrRow, markers, settings) {
  const chr = chrRow.Chr;
  const lengthBp = Number(chrRow.Length_bp);
  const chrMb = lengthBp / 1e6;

  const W = settings.width;
  const H = settings.height;
  const top = 80;
  const bottom = 80;
  const usableH = H - top - bottom;
  const cx = W / 2;
  const chrW = Math.max(18, settings.chrWidth * 185);
  const rx = chrW / 2;
  const yScale = bp => top + (Number(bp) / lengthBp) * usableH;

  const labelOffset = settings.labelOffset * 260;
  const leftLabelX = cx - chrW / 2 - labelOffset;
  const rightLabelX = cx + chrW / 2 + labelOffset;

  const pxPerMb = usableH / chrMb;
  const labelSpreadPx = settings.labelSpread * pxPerMb * 0.35;

  ["left", "right"].forEach(side => {
    const arr = markers.filter(m => m.Side === side).sort((a, b) => a.Position - b.Position);
    let lastY = -Infinity;

    arr.forEach(m => {
      let yLabel = yScale(m.Position);
      if (yLabel - lastY < labelSpreadPx) yLabel = lastY + labelSpreadPx;
      yLabel = Math.max(top, Math.min(top + usableH, yLabel));
      m.labelY = yLabel;
      lastY = yLabel;
    });
  });

  const title = settings.showNames ? `${settings.title} - ${chr}` : settings.title;

  const tickStep = chrMb > 50 ? 10 : 5;
  let scaleTicks = "";

  for (let mb = 0; mb <= Math.ceil(chrMb); mb += tickStep) {
    const y = top + (mb / chrMb) * usableH;
    if (y <= top + usableH) {
      scaleTicks += `
        <line x1="75" x2="90" y1="${y}" y2="${y}" stroke="black" stroke-width="1" />
        <text x="68" y="${y + 4}" text-anchor="end" font-size="12" fill="black">${mb} Mb</text>
      `;
    }
  }

  const scaleSvg = settings.showScale ? `
    <line x1="82" x2="82" y1="${top}" y2="${top + usableH}" stroke="black" stroke-width="1.2" />
    <line x1="70" x2="94" y1="${top}" y2="${top}" stroke="black" stroke-width="1.3" />
    <line x1="70" x2="94" y1="${top + usableH}" y2="${top + usableH}" stroke="black" stroke-width="1.3" />
    ${scaleTicks}
  ` : "";

  const bandSvg = markers.map(m => {
    const y1 = yScale(m.Start);
    const y2 = yScale(m.End);
    const yMid = yScale(m.Position);
    const h = Math.max(settings.minBandMb * pxPerMb, Math.abs(y2 - y1));
    const y = yMid - h / 2;

    return `
      <rect x="${cx - chrW / 2}" y="${y}" width="${chrW}" height="${h}" fill="${m.Color}" stroke="${m.Color}" opacity="0.9" />
    `;
  }).join("");

  const labelSvg = markers.map(m => {
    const y = yScale(m.Position);
    const yLabel = m.labelY ?? y;
    const isLeft = m.Side === "left";
    const x1 = isLeft ? cx - chrW / 2 : cx + chrW / 2;
    const x2 = isLeft ? leftLabelX : rightLabelX;
    const tx = isLeft ? x2 - 10 : x2 + 10;
    const anchor = isLeft ? "end" : "start";

    return `
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${yLabel}" stroke="${m.Color}" stroke-width="${settings.stroke}" />
      <text x="${tx}" y="${yLabel + settings.labelSize / 3}" text-anchor="${anchor}" font-size="${settings.labelSize}" fill="${m.Color}">${escapeXml(m.Label)}</text>
    `;
  }).join("");

  return `
    <svg id="chr_svg_${chr}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white" />
      <text x="${W / 2}" y="35" text-anchor="middle" font-size="20" font-weight="bold">${escapeXml(title)}</text>
      ${scaleSvg}
      <rect x="${cx - chrW / 2}" y="${top}" width="${chrW}" height="${usableH}" rx="${rx}" ry="${rx}" fill="${settings.fill}" stroke="${settings.border}" stroke-width="2" />
      ${bandSvg}
      ${labelSvg}
    </svg>
  `;
}

function downloadSvgElement(id, filename) {
  const svg = document.getElementById(id);
  if (!svg) return;

  const svgText = new XMLSerializer().serializeToString(svg);
  downloadText(svgText, filename, "image/svg+xml");
}

function downloadChrJpgElement(id, filename) {
  const svg = document.getElementById(id);
  if (!svg) return;

  const svgText = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();

  img.onload = function () {
    const width = svg.viewBox.baseVal.width || svg.width.baseVal.value;
    const height = svg.viewBox.baseVal.height || svg.height.baseVal.value;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    canvas.toBlob(function (jpgBlob) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(jpgBlob);
      a.download = filename;
      a.click();

      URL.revokeObjectURL(a.href);
      URL.revokeObjectURL(url);
    }, "image/jpeg", 0.95);
  };

  img.src = url;
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  }[m]));
}


function mean(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;}
function median(arr){const s=[...arr].sort((a,b)=>a-b),mid=Math.floor(s.length/2);return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;}
function std(arr){const m=mean(arr);return Math.sqrt(mean(arr.map(v=>(v-m)**2)));}
function downloadText(text,filename,mime){const blob=new Blob([text],{type:mime}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);}
function downloadCsv(data,filename){if(!data?.length)return alert("No data to download.");downloadText(Papa.unparse(data),filename,"text/csv");}
function renderTable(tableId,data,options={}){const table=document.getElementById(tableId);if(!table)return;table.innerHTML="";if(!data?.length){table.innerHTML="<tr><td>No data found.</td></tr>";return;}const keys=Object.keys(data[0]),thead=document.createElement("thead"),hr=document.createElement("tr");keys.forEach(k=>{const th=document.createElement("th");th.textContent=k;hr.appendChild(th);});thead.appendChild(hr);table.appendChild(thead);const tb=document.createElement("tbody");data.forEach(row=>{const tr=document.createElement("tr");if(options.clickable){tr.className="table-row-clickable";tr.addEventListener("click",()=>options.onClick?.(row));}keys.forEach(k=>{const td=document.createElement("td");td.textContent=row[k]??"";tr.appendChild(td);});tb.appendChild(tr);});table.appendChild(tb);}
