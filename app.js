let expressionData = [];
let annotationData = [];
let svgOriginalText = "";
let currentGene = null;
let currentBarGene = null;
let currentGwasResults = [];
let currentExpressionTable = [];
let chromosomeLengths = [];
let chromosomeDataLoaded = false;
let currentChromosomeMarkers = [];

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

  expressionData.forEach(row => {
    tissues.forEach(t => row[t] = Number(row[t]) || 0);
  });

  populateGeneOptions();

  currentGene = expressionData[0].Gene_ID;
  currentBarGene = currentGene;
  document.getElementById("geneInput").value = currentGene;
  document.getElementById("barGeneInput").value = currentBarGene;


  setupEvents();
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
    const gene = document.getElementById("geneInput").value.trim();
    const found = expressionData.find(row => row.Gene_ID === gene);

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
    const gene = document.getElementById("barGeneInput").value.trim();
    const found = expressionData.find(row => row.Gene_ID === gene);

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

  document.getElementById("tableBtn").addEventListener("click", renderExpressionTable);
  document.getElementById("downloadExprCsvBtn").addEventListener("click", () => downloadCsv(currentExpressionTable, "selected_gene_expression_table.csv"));

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
  return expressionData.find(row => row.Gene_ID === currentGene);
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

  const row = expressionData.find(r => r.Gene_ID === gene);
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

function renderExpressionTable() {
  const genes = parseGeneText(document.getElementById("tableGenes").value);
  currentExpressionTable = expressionData.filter(r => genes.includes(r.Gene_ID));

  if (currentExpressionTable.length === 0) return alert("No valid genes found.");

  renderTable("exprTable", currentExpressionTable);
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


function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function std(arr) {
  const m = mean(arr);
  const variance = mean(arr.map(v => (v - m) ** 2));
  return Math.sqrt(variance);
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadCsv(data, filename) {
  if (!data || data.length === 0) return alert("No data to download.");

  const csv = Papa.unparse(data);
  downloadText(csv, filename, "text/csv");
}
