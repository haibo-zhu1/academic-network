const STATUS_COLORS = {
  "PhD Student": "#4f7cff",
  "Assistant Professor": "#f59e0b",
  "Tenured Professor": "#7c3aed",
  "Other": "#64748b"
};

const RELATION_LABELS = {
  "advisor-student": "Mentor / Student",
  "coauthor": "Coauthor",
  "same-institution": "Same Institution",
  "same-alma-mater": "Same Alma Mater"
};

let researchers = [];
let relationships = [];
let papers = [];
let cy;

async function loadData() {
  const [researchersRes, relationshipsRes, papersRes] = await Promise.all([
    fetch("data/researchers.json"),
    fetch("data/relationships.json"),
    fetch("data/papers.json")
  ]);

  researchers = await researchersRes.json();
  relationships = await relationshipsRes.json();
  papers = await papersRes.json();
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
      relationText: rel.relations.map(r => RELATION_LABELS[r] || r).join(" · "),
      relations: rel.relations.join("|")
    }
  }));

  return [...nodes, ...edges];
}

function initGraph() {
  cy = cytoscape({
    container: document.getElementById("cy"),
    elements: buildElements(),
    layout: {
      name: "cose",
      animate: true,
      randomize: false,
      idealEdgeLength: 150,
      nodeRepulsion: 8500,
      gravity: 0.35,
      padding: 80
    },
    style: [
      {
        selector: "node",
        style: {
          "background-color": "data(color)",
          "width": 54,
          "height": 54,
          "label": "data(label)",
          "font-size": 12,
          "font-weight": 650,
          "color": "#18202a",
          "text-valign": "bottom",
          "text-halign": "center",
          "text-margin-y": 10,
          "text-wrap": "wrap",
          "text-max-width": 120,
          "border-width": 3,
          "border-color": "#ffffff",
          "overlay-opacity": 0
        }
      },
      {
        selector: "node:selected",
        style: {
          "border-width": 5,
          "border-color": "#111827"
        }
      },
      {
        selector: "edge",
        style: {
          "width": 2.5,
          "line-color": "#aeb7c4",
          "curve-style": "bezier",
          "label": "data(relationText)",
          "font-size": 9,
          "color": "#5f6875",
          "text-background-color": "#ffffff",
          "text-background-opacity": 0.88,
          "text-background-padding": 3,
          "text-rotation": "autorotate",
          "overlay-opacity": 0
        }
      },
      {
        selector: "edge:selected",
        style: {
          "width": 4,
          "line-color": "#111827",
          "color": "#111827"
        }
      },
      {
        selector: ".faded",
        style: {
          "opacity": 0.16,
          "text-opacity": 0.16
        }
      }
    ]
  });

  cy.on("tap", "node", evt => {
    focusResearcher(evt.target.id());
  });

  cy.on("tap", "edge", evt => {
    showRelationship(evt.target.id());
  });

  cy.on("tap", evt => {
    if (evt.target === cy) {
      cy.elements().removeClass("faded");
      cy.elements().unselect();
    }
  });

  setTimeout(() => focusResearcher("you", false), 350);
}

function focusResearcher(id, animate = true) {
  const node = cy.getElementById(id);
  if (!node.length) return;

  cy.elements().unselect();
  node.select();

  const neighborhood = node.closedNeighborhood();

  cy.elements().addClass("faded");
  neighborhood.removeClass("faded");

  if (animate) {
    cy.animate({
      center: { eles: node },
      zoom: 1.15,
      duration: 450
    });
  } else {
    cy.center(node);
    cy.zoom(1.05);
  }

  showResearcher(id);
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

  const relationSummary = Object.entries(relationCounts)
    .map(
      ([type, count]) =>
        `<span class="relation-pill">${escapeHtml(
          RELATION_LABELS[type] || type
        )} · ${count}</span>`
    )
    .join("");

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
      <div class="relation-pills">
        ${relationSummary || "No connections yet"}
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

  const hasCoauthor = rel.relations.includes("coauthor");

  const jointPapers = hasCoauthor
    ? papers.filter(
        p =>
          p.authors.includes(rel.source) &&
          p.authors.includes(rel.target)
      )
    : [];

  const pills = rel.relations
    .map(
      type =>
        `<span class="relation-pill">${escapeHtml(
          RELATION_LABELS[type] || type
        )}</span>`
    )
    .join("");

  const papersHtml = jointPapers.length
    ? `
      <ul class="paper-list">
        ${jointPapers
          .sort((a, b) => b.year - a.year)
          .map(
            p =>
              `<li>
                <span class="paper-year">${p.year}</span>
                ${escapeHtml(p.title)}
              </li>`
          )
          .join("")}
      </ul>
    `
    : `
      <p style="font-size:13px;color:#6b7280;margin:0;">
        ${
          hasCoauthor
            ? "No joint papers have been added yet."
            : "This relationship is not a coauthor relationship."
        }
      </p>
    `;

  document.getElementById("sidebar").innerHTML = `
    <div class="panel-kicker">Relationship</div>

    <h2>
      ${escapeHtml(source.name)} × ${escapeHtml(target.name)}
    </h2>

    <div class="relation-pills">
      ${pills}
    </div>

    <div class="info-section">
      <h3>${hasCoauthor ? "Joint Publications" : "Details"}</h3>
      ${papersHtml}
    </div>
  `;
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
      .filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          r.institution.toLowerCase().includes(q) ||
          (r.position || "").toLowerCase().includes(q)
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

      <p>
        The site could not load the JSON files.
      </p>
    `;
  }
}

start();
