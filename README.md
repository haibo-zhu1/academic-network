# Academic Network — V0

A small static website for visualizing an academic relationship network.

## Run locally

From this folder:

```bash
python -m http.server 8000
```

Then open:

http://localhost:8000

## Data files

- `data/researchers.json` — researcher profiles
- `data/relationships.json` — relationships between researchers
- `data/papers.json` — publications used for coauthor relationship details

## Main files

- `index.html` — page structure
- `css/style.css` — visual design
- `js/app.js` — Cytoscape graph and interactions

## Next step

Replace the placeholder researchers and relationships with real data.
