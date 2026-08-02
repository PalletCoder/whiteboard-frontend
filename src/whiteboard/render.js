import {
  seededRandom,
  roughLine,
  roughPolyline,
  roughRectangle,
  roughDiamond,
  roughEllipse,
  smoothCurve,
  buildRectPath,
  buildDiamondPath,
  buildEllipsePath,
  fillHachure,
} from './rough';
import {
  getElementBounds,
  getElementCenter,
  getHandlePositions,
  getMidpointHandle,
  isLinearType,
} from './elements';
import { TOOL, FONT_FAMILIES, HANDLE_SIZE } from './constants';

// Sample a quadratic bezier (start, control, end) into `n` line points.
function sampleQuadratic(p0, c, p1, n) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const mt = 1 - t;
    out.push([
      mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * p1[0],
      mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * p1[1],
    ]);
  }
  return out;
}

const SELECTION_COLOR = '#6965db';

// -- Image cache -----------------------------------------------------------
const imageCache = new Map();
export function getCachedImage(src, onLoad) {
  if (!src) return null;
  let entry = imageCache.get(src);
  if (!entry) {
    const img = new Image();
    entry = { img, loaded: false };
    img.onload = () => {
      entry.loaded = true;
      if (onLoad) onLoad();
    };
    img.src = src;
    imageCache.set(src, entry);
  }
  return entry;
}

function applyDash(ctx, style, strokeWidth) {
  if (style === 'dashed') ctx.setLineDash([strokeWidth * 3.5, strokeWidth * 3]);
  else if (style === 'dotted') ctx.setLineDash([strokeWidth * 0.2, strokeWidth * 2.2]);
  else ctx.setLineDash([]);
}

function cornerRadius(el) {
  if (el.edges !== 'round') return 0;
  return Math.min(32, Math.abs(el.width) / 4, Math.abs(el.height) / 4);
}

function roundedRectPoints(x, y, w, h, r) {
  const pts = [];
  const k = 8;
  const arc = (cx, cy, start) => {
    for (let i = 0; i <= k; i += 1) {
      const a = start + (Math.PI / 2) * (i / k);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  arc(x + w - r, y + r, -Math.PI / 2);
  arc(x + w - r, y + h - r, 0);
  arc(x + r, y + h - r, Math.PI / 2);
  arc(x + r, y + r, Math.PI);
  return pts;
}

function drawSketchyClosed(ctx, points, rng, roughness) {
  for (let pass = 0; pass < 2; pass += 1) {
    const jittered = points.map(([x, y]) => [
      x + roughness * (rng() - 0.5) * 2,
      y + roughness * (rng() - 0.5) * 2,
    ]);
    smoothCurve(ctx, jittered, true);
  }
}

function fillShape(ctx, el) {
  ctx.save();
  ctx.beginPath();
  const r = cornerRadius(el);
  if (el.type === TOOL.RECTANGLE) buildRectPath(ctx, el.x, el.y, el.width, el.height, r);
  else if (el.type === TOOL.DIAMOND) buildDiamondPath(ctx, el.x, el.y, el.width, el.height);
  else if (el.type === TOOL.ELLIPSE) buildEllipsePath(ctx, el.x, el.y, el.width, el.height);
  ctx.clip();

  const b = getElementBounds(el);
  if (el.fillStyle === 'solid') {
    ctx.fillStyle = el.backgroundColor;
    ctx.fillRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
  } else {
    ctx.beginPath();
    ctx.setLineDash([]);
    fillHachure(ctx, b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1, 8, el.fillStyle === 'cross-hatch');
    ctx.strokeStyle = el.backgroundColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawElement(ctx, el, requestRender, ghost) {
  const [cx, cy] = getElementCenter(el);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, el.opacity / 100)) * (ghost ? 0.35 : 1);
  ctx.translate(cx, cy);
  ctx.rotate(el.angle);
  ctx.translate(-cx, -cy);

  const rng = seededRandom(el.seed);
  const roughness = el.roughness;

  // Fill (drawn beneath the stroke) for closed shapes with a background.
  if (
    el.backgroundColor &&
    el.backgroundColor !== 'transparent' &&
    [TOOL.RECTANGLE, TOOL.DIAMOND, TOOL.ELLIPSE].includes(el.type)
  ) {
    fillShape(ctx, el);
  }

  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  applyDash(ctx, el.strokeStyle, el.strokeWidth);

  if (el.type === TOOL.RECTANGLE) {
    ctx.beginPath();
    if (el.edges === 'round') {
      const r = cornerRadius(el);
      drawSketchyClosed(ctx, roundedRectPoints(el.x, el.y, el.width, el.height, r), rng, roughness);
    } else {
      roughRectangle(ctx, el.x, el.y, el.width, el.height, rng, roughness);
    }
    ctx.stroke();
  } else if (el.type === TOOL.DIAMOND) {
    ctx.beginPath();
    roughDiamond(ctx, el.x, el.y, el.width, el.height, rng, roughness);
    ctx.stroke();
  } else if (el.type === TOOL.ELLIPSE) {
    ctx.beginPath();
    roughEllipse(ctx, el.x, el.y, el.width, el.height, rng, roughness);
    ctx.stroke();
  } else if (el.type === TOOL.LINE || el.type === TOOL.ARROW) {
    const pts = el.points || [];
    if (pts.length >= 2) {
      let abs;
      let tangentFrom;
      if (pts.length >= 3) {
        // Curved: quadratic bezier through the middle control point.
        const p0 = [el.x + pts[0][0], el.y + pts[0][1]];
        const cc = [el.x + pts[1][0], el.y + pts[1][1]];
        const pe = [el.x + pts[pts.length - 1][0], el.y + pts[pts.length - 1][1]];
        abs = sampleQuadratic(p0, cc, pe, 18);
        tangentFrom = cc;
      } else {
        abs = pts.map((p) => [el.x + p[0], el.y + p[1]]);
        tangentFrom = abs[abs.length - 2];
      }
      ctx.beginPath();
      roughPolyline(ctx, abs, rng, roughness, false);
      ctx.stroke();
      if (el.type === TOOL.ARROW) {
        const p2 = abs[abs.length - 1];
        const angle = Math.atan2(p2[1] - tangentFrom[1], p2[0] - tangentFrom[0]);
        const size = 14 + el.strokeWidth * 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        roughLine(ctx, p2[0], p2[1], p2[0] - Math.cos(angle - 0.45) * size, p2[1] - Math.sin(angle - 0.45) * size, rng, roughness);
        roughLine(ctx, p2[0], p2[1], p2[0] - Math.cos(angle + 0.45) * size, p2[1] - Math.sin(angle + 0.45) * size, rng, roughness);
        ctx.stroke();
      }
    }
  } else if (el.type === TOOL.DRAW) {
    const abs = (el.points || []).map((p) => [el.x + p[0], el.y + p[1]]);
    if (abs.length) {
      ctx.setLineDash([]);
      ctx.beginPath();
      if (abs.length === 1) {
        ctx.arc(abs[0][0], abs[0][1], el.strokeWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = el.strokeColor;
        ctx.fill();
      } else {
        smoothCurve(ctx, abs, false);
        ctx.stroke();
      }
    }
  } else if (el.type === TOOL.TEXT) {
    ctx.setLineDash([]);
    ctx.fillStyle = el.strokeColor;
    ctx.textBaseline = 'top';
    ctx.font = `${el.fontSize}px ${FONT_FAMILIES[el.fontFamily] || FONT_FAMILIES.hand}`;
    const lineHeight = el.fontSize * 1.25;
    String(el.text).split('\n').forEach((line, i) => {
      ctx.fillText(line, el.x, el.y + i * lineHeight);
    });
  } else if (el.type === TOOL.IMAGE) {
    ctx.setLineDash([]);
    const entry = getCachedImage(el.src, requestRender);
    if (entry && entry.loaded) {
      ctx.drawImage(entry.img, el.x, el.y, el.width, el.height);
    } else {
      ctx.fillStyle = '#f1f3f5';
      ctx.strokeStyle = '#ced4da';
      ctx.lineWidth = 1;
      ctx.fillRect(el.x, el.y, el.width, el.height);
      ctx.strokeRect(el.x, el.y, el.width, el.height);
    }
  }

  ctx.restore();
}

function drawGrid(ctx, appState, width, height) {
  const { gridSize, scrollX, scrollY, zoom } = appState;
  if (!gridSize) return;
  const startX = -scrollX / zoom;
  const startY = -scrollY / zoom;
  const endX = startX + width / zoom;
  const endY = startY + height / zoom;

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }
  for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSelection(ctx, elements, selectedIds, zoom) {
  if (!selectedIds.length) return;
  const selected = elements.filter((el) => selectedIds.includes(el.id));
  const handleSize = HANDLE_SIZE / zoom;

  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([]);

  for (const el of selected) {
    const b = getElementBounds(el);
    const [cx, cy] = getElementCenter(el);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(el.angle);
    ctx.translate(-cx, -cy);
    const pad = 4 / zoom;
    ctx.strokeRect(b.x1 - pad, b.y1 - pad, b.x2 - b.x1 + pad * 2, b.y2 - b.y1 + pad * 2);
    ctx.restore();
  }

  // Handles for a single selected element.
  if (selected.length === 1) {
    const el = selected[0];
    const handles = getHandlePositions(el, zoom);
    const cornerKeys = isLinearType(el.type)
      ? ['nw', 'ne', 'sw', 'se']
      : ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];

    // Rotation handle stem + knob
    const [cx, cy] = getElementCenter(el);
    const topMid = handles.n || [cx, cy];
    ctx.beginPath();
    ctx.moveTo(topMid[0], topMid[1]);
    ctx.lineTo(handles.rotation[0], handles.rotation[1]);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(handles.rotation[0], handles.rotation[1], handleSize / 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    for (const key of cornerKeys) {
      const [hx, hy] = handles[key];
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.rect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      ctx.fill();
      ctx.stroke();
    }

    // Bend handle (the middle dot) for lines and arrows.
    if (isLinearType(el.type)) {
      const mid = getMidpointHandle(el);
      if (mid) {
        ctx.beginPath();
        ctx.fillStyle = SELECTION_COLOR;
        ctx.arc(mid[0], mid[1], handleSize / 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1.5 / zoom;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = 1 / zoom;
      }
    }
  }
  ctx.restore();
}

/**
 * Render the whole scene onto the canvas.
 * `canvas` must already be sized to (cssWidth*dpr, cssHeight*dpr).
 */
export function renderScene(canvas, params) {
  const { elements, appState, selectedIds = [], editingId = null, selectionBox = null, requestRender } = params;
  const ctx = canvas.getContext('2d');
  const dpr = params.pixelRatio || window.devicePixelRatio || 1;
  const { zoom, scrollX, scrollY } = appState;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = appState.viewBackgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, scrollX * dpr, scrollY * dpr);

  const cssWidth = canvas.width / dpr;
  const cssHeight = canvas.height / dpr;
  drawGrid(ctx, appState, cssWidth, cssHeight);

  const eraserSet = new Set(params.eraserIds || []);
  for (const el of elements) {
    if (el.id === editingId && el.type === TOOL.TEXT) continue; // being edited via textarea
    if (el.isDeleted) continue;
    drawElement(ctx, el, requestRender, eraserSet.has(el.id));
  }

  drawSelection(ctx, elements, selectedIds, zoom);

  if (selectionBox) {
    ctx.save();
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.fillStyle = 'rgba(105,101,219,0.08)';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    const x = Math.min(selectionBox.x1, selectionBox.x2);
    const y = Math.min(selectionBox.y1, selectionBox.y2);
    const w = Math.abs(selectionBox.x2 - selectionBox.x1);
    const h = Math.abs(selectionBox.y2 - selectionBox.y1);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
}
