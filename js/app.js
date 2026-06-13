let expr = [];
let geneAnnot = [];
let chrLengths = [];
let svgTemplate = "";
let geneCol = "Gene_ID";
let currentGWAS = [];
let currentTableRows = [];
let currentMarkerRows = [];

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

const paletteChoices = {
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

const markerColorChoices = {
  "Red": "#d73027",
  "Blue": "#4575b4",
  "Green": "#1a9850",
  "Purple": "#762a83",
  "Orange": "#f46d43",
  "Black": "#000000",
  "Gray": "#666666"
};

const chrFillChoices = {
  "Light gray": "#f7f7f7",
  "White": "#ffffff",
  "Light green": "#e5f5e0",
  "Light blue": "#deebf7",
  "Light yellow": "#ffffcc",
  "Light orange": "#fee6ce",
  "Light purple": "#efedf5"
};

function parseCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: res => resolve(res.data),
      error: reject
    });
  });
}

function fillSelect(selectId, values, selected = null) {
  const el = document.getElementById(selectId);
  el.innerHTML = "";
  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    if (selected === v) opt.selected = true;
    el.appendChild(opt);
  });
}

function fillMulti(selectId, values, selectedCount = 0) {
  const el = document.getElementById(selectId);
  el.innerHTML = "";
  values.forEach((v, i) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    opt.selected = i < selectedCount;
    el.appendChild(opt);
  });
}

function selectedMulti(selectId) {
  return Array.from(document.getElementById(selectId).selectedOptions).map(x => x.value);
}

function numeric(x) {
  const n = Number(String(x ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function cleanChr(x) {
  x = String(x ?? "");
  x = x.replace(/^chromosome/i, "Chr");
  x = x.replace(/^chr/i, "Chr");
  x = x.replace(/^Ca_LG/i, "Chr");
  x = x.replace(/^Ca/i, "Chr");
  x = x.replace(/_v2.0$/i, "");
  return x.startsWith("Chr") ? x : "Chr" + x;
}

function normalizeChr(x) {
  return String(x ?? "").replace(/chr/i, "").replace(/^0+/, "");
}

function hexToRgb(h) {
  h = h.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, "0")).join("");
}

function interpolateColor(colors, value01) {
  const v = Math.max(0, Math.min(1, value01));
  const n = colors.length - 1;
  const i = Math.min(n - 1, Math.floor(v * n));
  const f = v * n - i;
  const a = hexToRgb(colors[i]);
  const b = hexToRgb(colors[i + 1]);
  return rgbToHex(a.r + (b.r - a.r) * f, a.g + (b.g - a.g) * f, a.b + (b.b - a.b) * f);
}

function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadPlot(plotId, filename) {
  Plotly.downloadImage(plotId, { format: "png", filename: filename.replace(".png", ""), width: 1500, height: 1000, scale: 2 });
}

function downloadSVGElement(id, filename) {
  const svg = document.getElementById(id);
  if (!svg) return;
  const txt = new XMLSerializer().serializeToString(svg);
  downloadText(filename, txt, "image/svg+xml");
}

async function init() {
  expr = await parseCSV("data/TPM_File_RK.csv");
  geneAnnot = await parseCSV("data/gene_annotation.csv");
  chrLengths = await parseCSV("data/chickpea_chromosome_lengths.csv");
  svgTemplate = await fetch("www/Chickpea_gene_expression_atlas_RK.svg").then(r => r.text());

  expr.forEach(row => tissues.forEach(t => row[t] = numeric(row[t])));
  geneAnnot.forEach(row => {
    row.Start = numeric(row.Start);
    row.End = numeric(row.End);
    row.Gene_length_bp = numeric(row.Gene_length_bp);
  });
  chrLengths.forEach(row => {
    row.Chr = cleanChr(row.Chr);
    row.Length_bp = numeric(row.Length_bp);
    row.Chr_num = numeric(String(row.Chr).replace(/\D/g, ""));
  });

  const genes = expr.map(r => r[geneCol]).filter(Boolean).sort();

  fillSelect("palette", Object.keys(paletteChoices), "Yellow-orange-red");
  fillSelect("bar_gene", genes);
  fillMulti("summary_genes", genes, 1);
  fillMulti("heatmap_genes", genes, Math.min(10, genes.length));
  fillMulti("table_genes", genes, 1);

  const dl = document.getElementById("gene_list");
  genes.forEach(g => {
    const o = document.createElement("option");
    o.value = g;
    dl.appendChild(o);
  });

  document.getElementById("single_gene_text").value = genes[0] || "";

  const groups = Object.keys(tissueGroups);
  ["bar_tissue_group", "summary_tissue_group", "heatmap_tissue_group"].forEach(id => fillSelect(id, groups, "All tissues"));

  fillSelect("chr_fill_choice", Object.keys(chrFillChoices), "Light gray");
  fillSelect("chr_border_choice", Object.keys(markerColorChoices), "Black");

  const versions = [...new Set(chrLengths.map(r => r.Version))].filter(Boolean);
  fillSelect("chr_version", versions, versions[0]);

  document.getElementById("loading-card").style.display = "none";
  updateChrSelect();
  loadGeneAtlas();
  drawBar();
  drawSummary();
  drawHeatmap();
  renderExpressionTable();
}

function switchTab(tabId) {
  document.querySelectorAll(".nav-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".tab-page").forEach(p => p.classList.toggle("active", p.id === tabId));
}

function selectedStrokeColor() {
  const mode = document.getElementById("stroke_mode").value;
  if (mode === "Black stroke") return "#000000";
  if (mode === "Gray stroke") return "#333333";
  if (mode === "White stroke") return "#ffffff";
  if (mode === "Custom color") return document.getElementById("custom_stroke_color").value || "#333333";
  return "none";
}

function loadGeneAtlas() {
  const typed = document.getElementById("single_gene_text").value.trim();
  const row = expr.find(r => r[geneCol] === typed);
  const status = document.getElementById("atlas_gene_status");

  if (!row) {
    status.innerHTML = "<span style='color:#B2182B; font-weight:bold;'>Gene not found in expression matrix.</span>";
    return;
  }

  status.innerHTML = "<span style='color:#1B7837; font-weight:bold;'>Gene found. Loaded.</span>";

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgTemplate, "image/svg+xml");
  const maxTpm = Number(document.getElementById("max_tpm").value);
  const pal = paletteChoices[document.getElementById("palette").value];
  const stroke = selectedStrokeColor();
  const sw = Number(document.getElementById("stroke_width").value);

  tissues.forEach(t => {
    const node = doc.getElementById(t);
    if (!node) return;
    const val = numeric(row[t]);
    const col = interpolateColor(pal, Math.min(val, maxTpm) / maxTpm);
    node.setAttribute("style", stroke === "none" ? `fill:${col};stroke:none;` : `fill:${col};stroke:${stroke};stroke-width:${sw};`);
  });

  document.getElementById("svg_output").innerHTML = new XMLSerializer().serializeToString(doc);
}

function geneInputList(selectGenes, textGenes) {
  const pasted = textGenes.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  const all = [...new Set([...selectGenes, ...pasted])];
  const valid = new Set(expr.map(r => r[geneCol]));
  return all.filter(g => valid.has(g));
}

function drawBar() {
  const gene = document.getElementById("bar_gene").value;
  const row = expr.find(r => r[geneCol] === gene);
  if (!row) return;
  const selectedTissues = tissueGroups[document.getElementById("bar_tissue_group").value];
  const useLog = document.getElementById("bar_log").checked;
  const vals = selectedTissues.map(t => numeric(row[t]));
  const yVals = useLog ? vals.map(v => Math.log2(v + 1)) : vals;

  Plotly.newPlot("barplot", [{
    x: yVals,
    y: selectedTissues,
    type: "bar",
    orientation: "h",
    marker: { color: "#2C7FB8" },
    text: selectedTissues.map((t, i) => `Tissue: ${t}<br>TPM: ${vals[i].toFixed(3)}<br>${useLog ? "log2(TPM + 1)" : "TPM"}: ${yVals[i].toFixed(3)}`),
    hoverinfo: "text"
  }], {
    title: `Expression profile of ${gene}`,
    xaxis: { title: useLog ? "log2(TPM + 1)" : "TPM" },
    yaxis: { title: "Tissue", automargin: true },
    margin: { l: 160, r: 40, t: 60, b: 60 },
    paper_bgcolor: "white",
    plot_bgcolor: "white"
  }, { responsive: true });
}

function drawSummary() {
  const genes = geneInputList(selectedMulti("summary_genes"), document.getElementById("custom_genes").value);
  if (!genes.length) return;

  const selectedTissues = tissueGroups[document.getElementById("summary_tissue_group").value];
  const useLog = document.getElementById("summary_log").checked;

  const means = [];
  const medians = [];

  selectedTissues.forEach(t => {
    const values = genes.map(g => {
      const row = expr.find(r => r[geneCol] === g);
      const v = numeric(row?.[t]);
      return useLog ? Math.log2(v + 1) : v;
    }).filter(v => Number.isFinite(v));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    means.push(mean);
    medians.push(med);
  });

  Plotly.newPlot("summary_plot", [
    { x: means, y: selectedTissues, type: "bar", orientation: "h", name: "Mean" },
    { x: medians, y: selectedTissues, type: "bar", orientation: "h", name: "Median" }
  ], {
    title: "Mean and median expression across selected genes",
    barmode: "group",
    xaxis: { title: useLog ? "log2(TPM + 1)" : "TPM" },
    yaxis: { title: "Tissue", automargin: true },
    margin: { l: 160, r: 40, t: 60, b: 60 },
    legend: { orientation: "h" },
    paper_bgcolor: "white",
    plot_bgcolor: "white"
  }, { responsive: true });
}

function drawHeatmap() {
  const genes = geneInputList(selectedMulti("heatmap_genes"), document.getElementById("heatmap_custom_genes").value);
  if (!genes.length) return;
  const selectedTissues = tissueGroups[document.getElementById("heatmap_tissue_group").value];
  const scale = document.getElementById("heatmap_scale").value;

  const rows = genes.map(g => expr.find(r => r[geneCol] === g)).filter(Boolean);
  let z = rows.map(r => selectedTissues.map(t => numeric(r[t])));

  if (scale === "log2(TPM + 1)") z = z.map(row => row.map(v => Math.log2(v + 1)));
  if (scale === "Row-scaled Z-score") {
    z = z.map(row => {
      const log = row.map(v => Math.log2(v + 1));
      const mean = log.reduce((a, b) => a + b, 0) / log.length;
      const sd = Math.sqrt(log.reduce((a, b) => a + (b - mean) ** 2, 0) / log.length) || 1;
      return log.map(v => (v - mean) / sd);
    });
  }

  Plotly.newPlot("heatmap_plot", [{
    z,
    x: selectedTissues,
    y: rows.map(r => r[geneCol]).reverse(),
    type: "heatmap",
    colorscale: [
      [0, "#f7fbff"],
      [0.35, "#ffffb2"],
      [0.7, "#fd8d3c"],
      [1, "#bd0026"]
    ],
    reversescale: false
  }], {
    title: "Gene expression heatmap",
    xaxis: { automargin: true },
    yaxis: { automargin: true },
    margin: { l: 140, r: 40, t: 60, b: 140 },
    paper_bgcolor: "white"
  }, { responsive: true });
}

function searchGWAS() {
  const chrInput = normalizeChr(document.getElementById("gwas_chr").value);
  const snpPos = Number(document.getElementById("gwas_snp_pos").value);
  const up = Number(document.getElementById("gwas_upstream").value);
  const down = Number(document.getElementById("gwas_downstream").value);
  const start = Math.max(1, snpPos - up);
  const end = snpPos + down;
  const snpId = document.getElementById("gwas_snp_id").value.trim() || "";

  currentGWAS = geneAnnot
    .filter(g => normalizeChr(g.Chr) === chrInput && numeric(g.End) >= start && numeric(g.Start) <= end)
    .map(g => {
      const mid = (numeric(g.Start) + numeric(g.End)) / 2;
      return {
        SNP_ID: snpId || "",
        Chr: g.Chr,
        SNP_position: snpPos,
        Region_start: start,
        Region_end: end,
        Gene_ID: g.Gene_ID,
        Gene_raw: g.Gene_raw,
        Start: g.Start,
        End: g.End,
        Strand: g.Strand,
        Gene_length_bp: g.Gene_length_bp,
        Distance_from_SNP_bp: Math.round(Math.abs(mid - snpPos)),
        Direction: numeric(g.End) < snpPos ? "Upstream" : (numeric(g.Start) > snpPos ? "Downstream" : "SNP within/overlapping gene"),
        Annotation: g.Annotation,
        Dbxref: g.Dbxref,
        Present_in_expression_matrix: expr.some(r => r[geneCol] === g.Gene_ID) ? "Yes" : "No"
      };
    })
    .sort((a, b) => a.Distance_from_SNP_bp - b.Distance_from_SNP_bp);

  document.getElementById("gwas_region_text").innerHTML =
    `<b>Search region:</b> Chr${chrInput}: ${start.toLocaleString()} - ${end.toLocaleString()}<br>` +
    `<b>SNP position:</b> ${snpPos.toLocaleString()}<br>` +
    `<b>Candidate genes found:</b> ${currentGWAS.length}`;

  renderTable("gwas_candidate_table", currentGWAS);
}

function renderTable(id, rows) {
  const table = document.getElementById(id);
  if (!rows || !rows.length) {
    table.innerHTML = "<tr><td>No data available</td></tr>";
    return;
  }
  const cols = Object.keys(rows[0]);
  table.innerHTML =
    `<thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${r[c] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

function updateChrSelect() {
  const version = document.getElementById("chr_version").value;
  const rows = chrLengths.filter(r => r.Version === version).sort((a, b) => a.Chr_num - b.Chr_num);
  const box = document.getElementById("chr_select_ui");
  box.innerHTML = `<label>Chromosomes to display</label>` + rows.map(r =>
    `<label class="checkbox-label"><input type="checkbox" class="selected_chr" value="${r.Chr}"> ${r.Chr}</label>`
  ).join("");
  document.getElementById("chromosome_marker_input_ui").innerHTML = "<p class='small-note'>Select one or more chromosomes first. Marker input boxes will appear only for the selected chromosomes.</p>";
  document.getElementById("chromosome_map_output_ui").innerHTML = "";
  renderTable("chr_marker_table", []);
}

function currentSelectedChr() {
  return Array.from(document.querySelectorAll(".selected_chr:checked")).map(x => x.value);
}

function updateMarkerInputs() {
  const selected = currentSelectedChr();
  if (!selected.length) {
    document.getElementById("chromosome_marker_input_ui").innerHTML = "<p class='small-note'>Select one or more chromosomes first. Marker input boxes will appear only for the selected chromosomes.</p>";
    return;
  }

  const colorOptions = Object.keys(markerColorChoices).map(c => `<option>${c}</option>`).join("");

  document.getElementById("chromosome_marker_input_ui").innerHTML = selected.map(chr => {
    const safe = chr.replace(/[^A-Za-z0-9]/g, "_");
    const left = Array.from({ length: 5 }, (_, idx) => {
      const i = idx + 1;
      return `<label>Left marker group ${i} color</label>
        <select id="marker_color_${safe}_left_${i}">${colorOptions}</select>
        <label>Left group ${i}</label>
        <textarea id="marker_${safe}_left_${i}" rows="2" placeholder="SNP_1, 347586, 348200&#10;SNP_2, 758321, 759000"></textarea>`;
    }).join("");

    const right = Array.from({ length: 5 }, (_, idx) => {
      const i = idx + 1;
      return `<label>Right marker group ${i} color</label>
        <select id="marker_color_${safe}_right_${i}">${colorOptions}</select>
        <label>Right group ${i}</label>
        <textarea id="marker_${safe}_right_${i}" rows="2" placeholder="Gene_1, 1457832, 1460200&#10;QTL_1, 3920000, 3950000"></textarea>`;
    }).join("");

    return `<div class="marker-block">
      <h5>${chr} marker input</h5>
      <div class="marker-grid">
        <div><h6>Left side</h6>${left}</div>
        <div><h6>Right side</h6>${right}</div>
      </div>
    </div>`;
  }).join("");
}

function parseMarkerText(txt, chr, side, colorName, groupId) {
  const out = [];
  const color = markerColorChoices[colorName] || markerColorChoices.Red;
  txt.split(/\n|;/).map(x => x.trim()).filter(Boolean).forEach(line => {
    const p = line.split(",").map(x => x.trim());
    if (p.length < 3) return;
    let start = numeric(p[1]);
    let end = numeric(p[2]);
    if (!start || !end) return;
    if (end < start) [start, end] = [end, start];
    out.push({
      Chr: chr,
      Side: side,
      Label: p[0],
      Start: start,
      End: end,
      Position: (start + end) / 2,
      Color_name: colorName,
      Color: color,
      Group: groupId
    });
  });
  return out;
}

function collectMarkers(selected) {
  const all = [];
  selected.forEach(chr => {
    const safe = chr.replace(/[^A-Za-z0-9]/g, "_");
    ["left", "right"].forEach(side => {
      for (let i = 1; i <= 5; i++) {
        const txt = document.getElementById(`marker_${safe}_${side}_${i}`)?.value || "";
        const colorName = document.getElementById(`marker_color_${safe}_${side}_${i}`)?.value || "Red";
        all.push(...parseMarkerText(txt, chr, side, colorName, `${side}_group_${i}`));
      }
    });
  });
  return all;
}

function makeChromosomeSVG(chrRow, markers, settings) {
  const chr = chrRow.Chr;
  const lengthBp = numeric(chrRow.Length_bp);
  const chrMb = lengthBp / 1e6;

  const W = settings.width;
  const H = settings.height;
  const top = 80;
  const bottom = 80;
  const usableH = H - top - bottom;
  const cx = W / 2;
  const chrW = Math.max(16, settings.chrWidth * 180);
  const rx = chrW / 2;
  const yScale = bp => top + (numeric(bp) / lengthBp) * usableH;

  const labelOffset = settings.labelOffset * 260;
  const leftLabelX = cx - chrW / 2 - labelOffset;
  const rightLabelX = cx + chrW / 2 + labelOffset;

  const labelSpreadPx = settings.labelSpread * (usableH / chrMb) * 0.35;

  const ms = markers.filter(m => m.Chr === chr).sort((a, b) => a.Position - b.Position);
  ["left", "right"].forEach(side => {
    const arr = ms.filter(m => m.Side === side).sort((a, b) => a.Position - b.Position);
    let lastY = -Infinity;
    arr.forEach((m, idx) => {
      let ly = yScale(m.Position);
      if (ly - lastY < labelSpreadPx) ly = lastY + labelSpreadPx;
      ly = Math.max(top, Math.min(top + usableH, ly));
      m.labelY = ly;
      lastY = ly;
    });
  });

  const title = settings.showNames ? `${settings.title} - ${chr}` : settings.title;

  const scaleTicks = [];
  const step = chrMb > 50 ? 10 : 5;
  for (let mb = 0; mb <= Math.ceil(chrMb); mb += step) {
    const y = top + (mb / chrMb) * usableH;
    if (y <= top + usableH) {
      scaleTicks.push(`<line x1="75" x2="90" y1="${y}" y2="${y}" stroke="black" stroke-width="1"/>
        <text x="68" y="${y + 4}" text-anchor="end" font-size="12" fill="black">${mb} Mb</text>`);
    }
  }

  const scaleSVG = settings.showScale ? `
    <line x1="82" x2="82" y1="${top}" y2="${top + usableH}" stroke="black" stroke-width="1.2"/>
    <line x1="70" x2="94" y1="${top}" y2="${top}" stroke="black" stroke-width="1.3"/>
    <line x1="70" x2="94" y1="${top + usableH}" y2="${top + usableH}" stroke="black" stroke-width="1.3"/>
    ${scaleTicks.join("")}` : "";

  const bandSVG = ms.map(m => {
    const y1 = yScale(m.Start);
    const y2 = yScale(m.End);
    const h = Math.max(settings.minBandMb * (usableH / chrMb), Math.abs(y2 - y1));
    const yMid = yScale(m.Position);
    const yy = yMid - h / 2;
    return `<rect x="${cx - chrW/2}" y="${yy}" width="${chrW}" height="${h}" fill="${m.Color}" stroke="${m.Color}" opacity="0.9"/>`;
  }).join("");

  const labelSVG = ms.map(m => {
    const y = yScale(m.Position);
    const ly = m.labelY ?? y;
    const left = m.Side === "left";
    const x1 = left ? cx - chrW / 2 : cx + chrW / 2;
    const x2 = left ? leftLabelX : rightLabelX;
    const tx = left ? x2 - 10 : x2 + 10;
    const anchor = left ? "end" : "start";
    return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${ly}" stroke="${m.Color}" stroke-width="${settings.stroke}"/>
      <text x="${tx}" y="${ly + settings.labelSize/3}" text-anchor="${anchor}" font-size="${settings.labelSize}" fill="${m.Color}">${escapeXML(m.Label)}</text>`;
  }).join("");

  return `<svg id="chr_svg_${chr}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    <text x="${W/2}" y="35" text-anchor="middle" font-size="20" font-weight="bold">${escapeXML(title)}</text>
    ${scaleSVG}
    <rect x="${cx - chrW/2}" y="${top}" width="${chrW}" height="${usableH}" rx="${rx}" ry="${rx}" fill="${settings.fill}" stroke="${settings.border}" stroke-width="2"/>
    ${bandSVG}
    ${labelSVG}
  </svg>`;
}

function generateChromosomeMaps() {
  const version = document.getElementById("chr_version").value;
  const selected = currentSelectedChr();
  if (!selected.length) {
    alert("Please select at least one chromosome.");
    return;
  }

  const markers = collectMarkers(selected);
  currentMarkerRows = markers;
  renderTable("chr_marker_table", markers);

  const settings = {
    fill: chrFillChoices[document.getElementById("chr_fill_choice").value],
    border: markerColorChoices[document.getElementById("chr_border_choice").value],
    chrWidth: Number(document.getElementById("chr_width").value),
    stroke: Number(document.getElementById("marker_stroke").value),
    labelSize: Number(document.getElementById("marker_label_size").value),
    minBandMb: Number(document.getElementById("marker_band_height").value),
    labelSpread: Number(document.getElementById("marker_label_spread").value),
    labelOffset: Number(document.getElementById("marker_label_offset").value),
    width: Number(document.getElementById("chr_download_width").value),
    height: Number(document.getElementById("chr_download_height").value),
    showScale: document.getElementById("show_chr_scale").checked,
    showNames: document.getElementById("show_chr_names").checked,
    title: document.getElementById("chr_map_title").value
  };

  const container = document.getElementById("chromosome_map_output_ui");
  container.innerHTML = "";

  selected.forEach(chr => {
    const chrRow = chrLengths.find(r => r.Version === version && r.Chr === chr);
    if (!chrRow) return;
    const svg = makeChromosomeSVG(chrRow, markers, settings);
    container.insertAdjacentHTML("beforeend", `
      <div class="chr-map-box">
        <h4>${chr} map</h4>
        <p class="small-note">Reference version: ${version}</p>
        <div class="chr-svg-wrap">${svg}</div>
        <button class="download-btn" onclick="downloadSVGElement('chr_svg_${chr}', '${version}_${chr}_chickpea_chromosome_map.svg')">Download SVG</button>
      </div>
    `);
  });
}

function renderExpressionTable() {
  const genes = geneInputList(selectedMulti("table_genes"), document.getElementById("table_custom_genes").value);
  currentTableRows = expr.filter(r => genes.includes(r[geneCol]));
  renderTable("expr_table", currentTableRows);
}

function escapeXML(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[m]));
}

document.addEventListener("click", e => {
  if (e.target.classList.contains("nav-tab")) switchTab(e.target.dataset.tab);
});

document.getElementById("load_gene_atlas").addEventListener("click", loadGeneAtlas);
document.getElementById("max_tpm").addEventListener("input", e => { document.getElementById("max_tpm_value").textContent = e.target.value; });
document.getElementById("stroke_mode").addEventListener("change", e => {
  document.getElementById("custom_stroke_wrap").classList.toggle("hidden", e.target.value !== "Custom color");
});
document.getElementById("download_atlas_svg").addEventListener("click", () => {
  downloadText(`${document.getElementById("single_gene_text").value}_expression_atlas.svg`, document.getElementById("svg_output").innerHTML, "image/svg+xml");
});

document.getElementById("bar_gene").addEventListener("change", drawBar);
document.getElementById("bar_tissue_group").addEventListener("change", drawBar);
document.getElementById("bar_log").addEventListener("change", drawBar);
document.getElementById("download_bar_png").addEventListener("click", () => downloadPlot("barplot", `${document.getElementById("bar_gene").value}_barplot.png`));
document.getElementById("download_bar_svg").addEventListener("click", () => Plotly.downloadImage("barplot", {format: "svg", filename: `${document.getElementById("bar_gene").value}_barplot`}));

document.getElementById("summary_genes").addEventListener("change", drawSummary);
document.getElementById("custom_genes").addEventListener("input", drawSummary);
document.getElementById("summary_tissue_group").addEventListener("change", drawSummary);
document.getElementById("summary_log").addEventListener("change", drawSummary);
document.getElementById("download_summary_png").addEventListener("click", () => downloadPlot("summary_plot", "mean_median_expression.png"));
document.getElementById("download_summary_csv").addEventListener("click", () => downloadText("mean_median_expression_summary.csv", "Use plot values from interface.\n"));

document.getElementById("heatmap_genes").addEventListener("change", drawHeatmap);
document.getElementById("heatmap_custom_genes").addEventListener("input", drawHeatmap);
document.getElementById("heatmap_tissue_group").addEventListener("change", drawHeatmap);
document.getElementById("heatmap_scale").addEventListener("change", drawHeatmap);
document.getElementById("download_heatmap_png").addEventListener("click", () => downloadPlot("heatmap_plot", "gene_expression_heatmap.png"));
document.getElementById("download_heatmap_csv").addEventListener("click", () => downloadText("heatmap_expression_values.csv", "Export from static heatmap interface.\n"));

document.getElementById("search_gwas_region").addEventListener("click", searchGWAS);
document.getElementById("download_gwas_candidates_csv").addEventListener("click", () => downloadText("GWAS_candidate_genes.csv", Papa.unparse(currentGWAS), "text/csv"));

document.getElementById("chr_version").addEventListener("change", updateChrSelect);
document.getElementById("chr_select_ui").addEventListener("change", updateMarkerInputs);
document.getElementById("apply_chr_mapper").addEventListener("click", generateChromosomeMaps);

document.getElementById("table_genes").addEventListener("change", renderExpressionTable);
document.getElementById("table_custom_genes").addEventListener("input", renderExpressionTable);
document.getElementById("download_table_csv").addEventListener("click", () => downloadText("selected_gene_expression_table.csv", Papa.unparse(currentTableRows), "text/csv"));

init().catch(err => {
  document.getElementById("loading-card").innerHTML = `<h2>Error loading atlas files</h2><pre>${err}</pre>`;
  console.error(err);
});
