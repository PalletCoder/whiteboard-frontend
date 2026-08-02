/**
 * Mermaid support. The library is loaded lazily from a CDN at runtime so no
 * extra local dependency/install is required. A diagram is rendered to an SVG
 * data URL that we drop onto the canvas as a regular image element.
 */
let mermaidLib = null;

async function loadMermaid() {
  if (!mermaidLib) {
    const mod = await import(
      /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
    );
    mermaidLib = mod.default;
    mermaidLib.initialize({ startOnLoad: false, securityLevel: 'loose' });
  }
  return mermaidLib;
}

function stripFence(code) {
  let c = String(code).trim();
  if (c.startsWith('```')) {
    c = c.replace(/^```(?:mermaid)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  return c;
}

// Heuristic: does this pasted text look like a Mermaid diagram definition?
export function isMermaid(text) {
  const t = stripFence(text);
  return /^(graph\s|flowchart\s|sequenceDiagram|classDiagram|stateDiagram(-v2)?\b|erDiagram|gantt\b|pie\b|journey\b|mindmap\b|gitGraph\b|timeline\b|quadrantChart\b|requirementDiagram\b|C4Context\b)/i.test(t);
}

export async function renderMermaidToDataUrl(code) {
  const mermaid = await loadMermaid();
  const clean = stripFence(code);
  const id = `mmd-${Math.random().toString(36).slice(2)}`;
  const { svg } = await mermaid.render(id, clean);
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
