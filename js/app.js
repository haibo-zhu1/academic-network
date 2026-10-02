const STATUS_COLORS = {
  "PhD Student": "#4f7cff",
  "Assistant Professor": "#f59e0b",
  "Tenured Professor": "#7c3aed",
  "Other": "#64748b"
};

// The order here controls BOTH the icons shown above each relationship line
// and the order shown in the right sidebar.
const RELATION_ORDER = [
  "advisor-student",
  "coauthor",
  "same-institution",
  "same-grad-school"
];

const RELATION_META = {
  "advisor-student": {
    label: "Advisor / Student",
    icon: "assets/icons/icon_advisor_student.png"
  },
  "coauthor": {
    label: "Collaborator / Coauthor",
    icon: "assets/icons/icon_collaborator.png"
  },
  "same-institution": {
    label: "Same Institution",
    icon: "assets/icons/icon_same_institution_colleague.png"
  },
  "same-grad-school": {
    label: "Same Graduate School",
    icon: "assets/icons/icon_same_grad_sch.png"
  }
};

let researchers = [];
let relationships = [];
let papers = [];
let cy;
let edgeIconLayer;
const edgeIconMarkers = new Map();

async function loadData() {
  const [researchersRes, relationshipsRes, papersRes] = await Promise.all([
    fetch("data/researchers.json"),
    fetch("data/relationships.json"),
    fetch("data/papers.json")
  ]);

  if (!researchersRes.ok || !relationshipsRes.ok || !papersRes.ok) {
    throw new Error("One or more data files could not be loaded.");
  }

  researchers = await researchersRes.json();
  relationships = await relationshipsRes.json();
  papers = await papersRes.json();
}

function sortRelations(relations = []) {
  return [...relations].sort(
    (a, b) => RELATION_ORDER.indexOf(a) - RELATION_ORDER.indexOf(b)
  );
}

function buildElements() {
  const nodes = researchers.map(person => ({
    data: {
      id: person.id,
      label: person.name,
      institution: person.institution,
      status: person.status,
      color: STATUS_COLORS[person.status] || STATUS_COLORS.Other
    }
  }));

  const edges = relationships.map(rel => ({
    data: {
      id: rel.id,
      source: rel.source,
      target: rel.target,
      relations: sortRelations(rel.relations).join("|")
    }
  }));

  return [...nodes, ...edges];
}

function initGraph() {
  cy = cytoscape({
    container: document.getElementById("cy"),
    elements: buildElements(),
    minZoom: 0.2,
    maxZoom: 2.2,
    wheelSensitivity: 0.2,
    layout: {
      name: "cose",
      animate: true,
      animationDuration: 650,
      randomize: false,
      idealEdgeLength: 230,
      nodeRepulsion: 15000,
      edgeElasticity: 80,
      nestingFactor: 1.1,
      gravity: 0.18,
      numIter: 1200,
      padding: 120,
      fit: true
    },
    style: [
      {
        selector: "node",
        style: {
          "background-color": "data(color)",
          "width": 34,
          "height": 34,
          "label": "data(label)",
          "font-size": 10,
          "font-weight": 650,
          "color": "#18202a",
          "text-valign": "bottom",
          "text-halign": "center",
          "text-margin-y": 8,
          "text-wrap": "wrap",
          "text-max-width": 105,
          "border-width": 2.5,
          "border-color": "#ffffff",
          "overlay-opacity": 0,
          "transition-property": "width height border-width font-size",
          "transition-duration": "220ms"
        }
      },
      {
        selector: "node.focused",
        style: {
          "width": 62,
          "height": 62,
          "font-size": 13,
          "text-max-width": 145,
          "text-margin-y": 11,
          "border-width": 5,
          "border-color": "#111827"
        }
      },
      {
        selector: "edge",
        style: {
          "width": 2,
          "line-color": "#aeb7c4",
          "curve-style": "straight",
          "overlay-opacity": 0
        }
      },
      {
        selector: "edge:selected",
        style: {
          "width": 3.5,
          "line-color": "#111827"
        }
      },
      {
        selector: ".faded",
        style: {
          "opacity": 0.14,
          "text-opacity": 0.14
        }
      }
    ]
  });

  createEdgeIconLayer();
  buildEdgeIconMarkers();

  cy.on("tap", "node", evt => {
    focusResearcher(evt.target.id());
  });

  cy.on("tap", "edge", evt => {
    cy.elements().unselect();
    evt.target.select();
    showRelationship(evt.target.id());
    updateEdgeIconMarkers();
  });

  cy.on("tap", evt => {
    if (evt.target === cy) {
      cy.elements().removeClass("faded focused");
      cy.elements().unselect();
      setInitialView();
      updateEdgeIconMarkers();
    }
  });

  // Keep the DOM icon strip attached to each relationship line as the graph moves.
  cy.on("render pan zoom position layoutstop", updateEdgeIconMarkers);

  cy.one("layoutstop", () => {
    setInitialView();
    setTimeout(updateEdgeIconMarkers, 30);
  });
}

function setInitialView() {
  cy.fit(cy.elements(), 120);

  // Cytoscape may zoom in too much when the graph is small. Cap the opening view
  // so the network stays airy rather than filling the screen with large nodes.
  if (cy.zoom() > 0.78) {
    cy.zoom(0.78);
    cy.center();
  }
}

function focusResearcher(id) {
  const node = cy.getElementById(id);
  if (!node.length) return;

  cy.elements().removeClass("focused");
  cy.elements().unselect();
  node.addClass("focused");
  node.select();

  const neighborhood = node.closedNeighborhood();
  cy.elements().addClass("faded");
  neighborhood.removeClass("faded");

  cy.animate({
    center: { eles: node },
    zoom: 1.05,
    duration: 420
  });

  showResearcher(id);
  setTimeout(updateEdgeIconMarkers, 230);
}

function createEdgeIconLayer() {
  const graphPanel = document.querySelector(".graph-panel");
  edgeIconLayer = document.createElement("div");
  edgeIconLayer.id = "edgeIconLayer";
  edgeIconLayer.setAttribute("aria-hidden", "true");
  graphPanel.appendChild(edgeIconLayer);
}

function buildEdgeIconMarkers() {
  edgeIconLayer.innerHTML = "";
  edgeIconMarkers.clear();

  relationships.forEach(rel => {
    const marker = document.createElement("div");
    marker.className = "edge-icon-strip";
    marker.dataset.edgeId = rel.id;

    sortRelations(rel.relations).forEach(type => {
      const meta = RELATION_META[type];
      if (!meta) return;

      const img = document.createElement("img");
      img.src = meta.icon;
      img.alt = "";
      img.title = meta.label;
      marker.appendChild(img);
    });

    edgeIconLayer.appendChild(marker);
    edgeIconMarkers.set(rel.id, marker);
  });

  updateEdgeIconMarkers();
}

function updateEdgeIconMarkers() {
  if (!cy || !edgeIconLayer) return;

  relationships.forEach(rel => {
    const edge = cy.getElementById(rel.id);
    const marker = edgeIconMarkers.get(rel.id);
    if (!edge.length || !marker) return;

    const source = edge.source().renderedPosition();
    const target = edge.target().renderedPosition();

    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.hypot(dx, dy) || 1;

    // Perpendicular offset: keep the icon strip beside/above the line,
    // rather than letting the line run through the icons.
    let nx = -dy / length;
    let ny = dx / length;

    // Prefer the visually upper side of the line for consistency.
    if (ny > 0) {
      nx *= -1;
      ny *= -1;
    }

    const offset = 18;
    marker.style.left = `${midX + nx * offset}px`;
    marker.style.top = `${midY + ny * offset}px`;
    marker.style.opacity = edge.hasClass("faded") ? "0.13" : "1";
    marker.classList.toggle("selected", edge.selected());
  });
}

function relationSummaryHtml(relationCounts) {
  return RELATION_ORDER
    .filter(type => relationCounts[type])
    .map(type => {
      const meta = RELATION_META[type];
      return `
        <div class="connection-summary-item">
          <img class="relation-icon" src="${meta.icon}" alt="" />
          <span>${escapeHtml(meta.label)}</span>
          <strong>${relationCounts[type]}</strong>
        </div>
      `;
    })
    .join("");
}

function showResearcher(id) {
  const person = researchers.find(r => r.id === id);
  if (!person) return;

  const connected = relationships.filter(
    r => r.source === id || r.target === id
  );

  const relationCounts = {};
  connected.forEach(rel => {
    rel.relations.forEach(type => {
      relationCounts[type] = (relationCounts[type] || 0) + 1;
    });
  });

  const careerHtml = (person.career || [])
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join("");

  document.getElementById("sidebar").innerHTML = `
    <div class="profile-kicker">Researcher</div>
    <h2>${escapeHtml(person.name)}</h2>
    <div class="role-line">
      ${escapeHtml(person.position)} · ${escapeHtml(person.institution)}
    </div>

    <div class="info-section">
      <h3>Profile</h3>
      <div class="info-row">
        <div class="label">Status</div>
        <div>${escapeHtml(person.status)}</div>
      </div>
      <div class="info-row">
        <div class="label">Institution</div>
        <div>${escapeHtml(person.institution)}</div>
      </div>
      <div class="info-row">
        <div class="label">Education</div>
        <div>${escapeHtml(person.education || "—")}</div>
      </div>
    </div>

    <div class="info-section">
      <h3>Connections</h3>
      <div class="connection-summary">
        ${relationSummaryHtml(relationCounts) || "No connections yet"}
      </div>
    </div>

    <div class="info-section">
      <h3>Career</h3>
      <ul class="career-list">
        ${careerHtml || "<li>Not added yet.</li>"}
      </ul>
    </div>
  `;
}

function showRelationship(edgeId) {
  const rel = relationships.find(r => r.id === edgeId);
  if (!rel) return;

  const source = researchers.find(r => r.id === rel.source);
  const target = researchers.find(r => r.id === rel.target);
  if (!source || !target) return;

  const relationSections = sortRelations(rel.relations)
    .map(type => relationshipSectionHtml(type, rel, source, target))
    .join("");

  document.getElementById("sidebar").innerHTML = `
    <div class="panel-kicker">Relationship</div>
    <h2>${escapeHtml(source.name)} × ${escapeHtml(target.name)}</h2>
    <div class="relationship-list">
      ${relationSections}
    </div>
  `;
}

function relationshipSectionHtml(type, rel, source, target) {
  const meta = RELATION_META[type];
  if (!meta) return "";

  let detailHtml = "";

  if (type === "coauthor") {
    const jointPapers = papers
      .filter(
        p => p.authors.includes(rel.source) && p.authors.includes(rel.target)
      )
      .sort((a, b) => b.year - a.year);

    detailHtml = jointPapers.length
      ? `
        <ul class="paper-list relation-detail-list">
          ${jointPapers
            .map(
              p => `
                <li>
                  <span class="paper-year">${escapeHtml(p.year)}</span>
                  <span>${escapeHtml(p.title)}</span>
                </li>
              `
            )
            .join("")}
        </ul>
      `
      : `<p class="relationship-note">No joint papers have been added yet.</p>`;
  }

  if (type === "same-institution") {
    detailHtml = `
      <div class="institution-pair">
        <div>
          <strong>${escapeHtml(source.name)}</strong>
          <span>${escapeHtml(source.institution || "Not added")}</span>
        </div>
        <div>
          <strong>${escapeHtml(target.name)}</strong>
          <span>${escapeHtml(target.institution || "Not added")}</span>
        </div>
      </div>
    `;
  }

  if (type === "same-grad-school") {
    const sharedSchool = getSharedGraduateSchool(rel, source, target);
    detailHtml = sharedSchool
      ? `<p class="shared-school">${escapeHtml(sharedSchool)}</p>`
      : `<p class="relationship-note">Shared graduate school has not been added yet.</p>`;
  }

  // Advisor/student intentionally has no extra detail below the label.
  return `
    <section class="relationship-section">
      <div class="relationship-heading">
        <img class="relation-icon relation-icon-large" src="${meta.icon}" alt="" />
        <span>${escapeHtml(meta.label)}</span>
      </div>
      ${detailHtml}
    </section>
  `;
}

function getSharedGraduateSchool(rel, source, target) {
  if (rel.sharedGraduateSchool) return rel.sharedGraduateSchool;

  if (
    source.graduateSchool &&
    target.graduateSchool &&
    source.graduateSchool === target.graduateSchool
  ) {
    return source.graduateSchool;
  }

  return "";
}

function initSearch() {
  const input = document.getElementById("searchInput");
  const resultsBox = document.getElementById("searchResults");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();

    if (!q) {
      resultsBox.classList.add("hidden");
      resultsBox.innerHTML = "";
      return;
    }

    const matches = researchers
      .filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.institution || "").toLowerCase().includes(q) ||
        (r.position || "").toLowerCase().includes(q) ||
        (r.graduateSchool || "").toLowerCase().includes(q)
      )
      .slice(0, 10);

    if (!matches.length) {
      resultsBox.innerHTML = `
        <div style="padding:12px 13px;color:#6b7280;font-size:13px;">
          No matches
        </div>
      `;
      resultsBox.classList.remove("hidden");
      return;
    }

    resultsBox.innerHTML = matches
      .map(
        r => `
          <button class="search-result" data-id="${r.id}">
            <strong>${escapeHtml(r.name)}</strong>
            <span>
              ${escapeHtml(r.position)} · ${escapeHtml(r.institution)}
            </span>
          </button>
        `
      )
      .join("");

    resultsBox.classList.remove("hidden");
  });

  resultsBox.addEventListener("click", evt => {
    const button = evt.target.closest(".search-result");
    if (!button) return;

    const id = button.dataset.id;
    const person = researchers.find(r => r.id === id);

    input.value = person ? person.name : "";
    resultsBox.classList.add("hidden");
    focusResearcher(id);
  });

  document.addEventListener("click", evt => {
    if (!evt.target.closest(".search-wrap")) {
      resultsBox.classList.add("hidden");
    }
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function start() {
  try {
    await loadData();
    initGraph();
    initSearch();
  } catch (error) {
    console.error(error);
    document.getElementById("sidebar").innerHTML = `
      <h2>Could not load the data</h2>
      <p>Please confirm that the JSON files exist and contain valid JSON.</p>
    `;
  }
}

start();
