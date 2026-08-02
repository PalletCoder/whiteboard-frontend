import { TOOL, DEFAULT_ELEMENT_STYLE, HANDLE_SIZE, ROTATION_HANDLE_DISTANCE, FONT_FAMILIES } from './constants';

let seedCounter = Math.floor(Math.random() * 100000);

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newSeed() {
  seedCounter = (seedCounter + 1) % 2147483647;
  return (seedCounter * 2654435761) % 2147483647;
}

const POINT_TYPES = [TOOL.LINE, TOOL.ARROW, TOOL.DRAW];
export const isLinearType = (type) => POINT_TYPES.includes(type);

export function createElement(type, x, y, style = {}) {
  const base = {
    id: newId(),
    type,
    x,
    y,
    width: 0,
    height: 0,
    angle: 0,
    seed: newSeed(),
    strokeColor: DEFAULT_ELEMENT_STYLE.strokeColor,
    backgroundColor: DEFAULT_ELEMENT_STYLE.backgroundColor,
    fillStyle: DEFAULT_ELEMENT_STYLE.fillStyle,
    strokeWidth: DEFAULT_ELEMENT_STYLE.strokeWidth,
    strokeStyle: DEFAULT_ELEMENT_STYLE.strokeStyle,
    roughness: DEFAULT_ELEMENT_STYLE.roughness,
    edges: DEFAULT_ELEMENT_STYLE.edges,
    opacity: DEFAULT_ELEMENT_STYLE.opacity,
    ...style,
  };

  if (isLinearType(type)) {
    base.points = [[0, 0]];
  }
  if (type === TOOL.TEXT) {
    base.text = '';
    base.fontSize = style.fontSize ?? DEFAULT_ELEMENT_STYLE.fontSize;
    base.fontFamily = style.fontFamily ?? DEFAULT_ELEMENT_STYLE.fontFamily;
    base.textAlign = 'left';
  }
  if (type === TOOL.IMAGE) {
    base.src = style.src ?? null;
  }
  return base;
}

export function duplicateElement(el, dx = 12, dy = 12) {
  return {
    ...el,
    id: newId(),
    seed: newSeed(),
    x: el.x + dx,
    y: el.y + dy,
    points: el.points ? el.points.map((p) => [...p]) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Text measurement (shared offscreen canvas)
// ---------------------------------------------------------------------------
let measureCtx = null;
export function measureText(text, fontSize, fontFamily) {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  const family = FONT_FAMILIES[fontFamily] || FONT_FAMILIES.hand;
  measureCtx.font = `${fontSize}px ${family}`;
  const lines = String(text).split('\n');
  const lineHeight = fontSize * 1.25;
  let width = 0;
  for (const line of lines) {
    width = Math.max(width, measureCtx.measureText(line || ' ').width);
  }
  return { width: Math.ceil(width) || fontSize, height: Math.ceil(lineHeight * lines.length) };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
export function rotatePoint(px, py, cx, cy, angle) {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

// Axis-aligned bounds of an element (handles negative sizes and point lists).
export function getElementBounds(el) {
  if (isLinearType(el.type) && el.points && el.points.length) {
    const pts = el.points;
    let coords = pts;
    if (pts.length >= 3) {
      // Sample the quadratic (start, control, end) for a snug bounding box.
      const p0 = pts[0];
      const c = pts[1];
      const pe = pts[pts.length - 1];
      coords = [];
      const n = 16;
      for (let i = 0; i <= n; i += 1) {
        const t = i / n;
        const mt = 1 - t;
        coords.push([
          mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * pe[0],
          mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * pe[1],
        ]);
      }
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [pxp, pyp] of coords) {
      minX = Math.min(minX, pxp);
      minY = Math.min(minY, pyp);
      maxX = Math.max(maxX, pxp);
      maxY = Math.max(maxY, pyp);
    }
    return { x1: el.x + minX, y1: el.y + minY, x2: el.x + maxX, y2: el.y + maxY };
  }
  const x1 = Math.min(el.x, el.x + el.width);
  const y1 = Math.min(el.y, el.y + el.height);
  const x2 = Math.max(el.x, el.x + el.width);
  const y2 = Math.max(el.y, el.y + el.height);
  return { x1, y1, x2, y2 };
}

export function getElementCenter(el) {
  const b = getElementBounds(el);
  return [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2];
}

export function getBoundingBox(elements) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.x1);
    minY = Math.min(minY, b.y1);
    maxX = Math.max(maxX, b.x2);
    maxY = Math.max(maxY, b.y2);
  }
  return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Hit test in scene coordinates. `threshold` is in scene units.
export function hitTest(el, sx, sy, threshold = 8) {
  const [cx, cy] = getElementCenter(el);
  const [px, py] = rotatePoint(sx, sy, cx, cy, -el.angle);

  if (isLinearType(el.type) && el.points) {
    const pts = el.points;
    if (pts.length >= 3) {
      // Sample the quadratic bezier and test distance to each chord.
      const p0 = [el.x + pts[0][0], el.y + pts[0][1]];
      const c = [el.x + pts[1][0], el.y + pts[1][1]];
      const pe = [el.x + pts[pts.length - 1][0], el.y + pts[pts.length - 1][1]];
      let prev = p0;
      const n = 16;
      for (let i = 1; i <= n; i += 1) {
        const t = i / n;
        const mt = 1 - t;
        const cur = [
          mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * pe[0],
          mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * pe[1],
        ];
        if (distanceToSegment(px, py, prev[0], prev[1], cur[0], cur[1]) <= threshold + el.strokeWidth) {
          return true;
        }
        prev = cur;
      }
      return false;
    }
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      if (
        distanceToSegment(px, py, el.x + a[0], el.y + a[1], el.x + b[0], el.y + b[1]) <=
        threshold + el.strokeWidth
      ) {
        return true;
      }
    }
    if (pts.length === 1) {
      return Math.hypot(px - el.x, py - el.y) <= threshold + el.strokeWidth;
    }
    return false;
  }

  const b = getElementBounds(el);
  const hasFill = el.type === TOOL.TEXT || el.type === TOOL.IMAGE || el.backgroundColor !== 'transparent';

  if (hasFill) {
    return px >= b.x1 - threshold && px <= b.x2 + threshold && py >= b.y1 - threshold && py <= b.y2 + threshold;
  }

  // Only the outline is clickable for unfilled shapes.
  const nearVert = (px >= b.x1 - threshold && px <= b.x2 + threshold) &&
    (Math.abs(py - b.y1) <= threshold || Math.abs(py - b.y2) <= threshold);
  const nearHorz = (py >= b.y1 - threshold && py <= b.y2 + threshold) &&
    (Math.abs(px - b.x1) <= threshold || Math.abs(px - b.x2) <= threshold);

  if (el.type === TOOL.ELLIPSE) {
    const rx = (b.x2 - b.x1) / 2;
    const ry = (b.y2 - b.y1) / 2;
    if (rx <= 0 || ry <= 0) return false;
    const nx = (px - (b.x1 + rx)) / rx;
    const ny = (py - (b.y1 + ry)) / ry;
    const d = nx * nx + ny * ny;
    const t = threshold / Math.min(rx, ry);
    return d <= (1 + t) * (1 + t) && d >= (1 - t) * (1 - t);
  }
  return nearVert || nearHorz;
}

export function isElementInBox(el, box) {
  const b = getElementBounds(el);
  return b.x1 >= box.x1 && b.x2 <= box.x2 && b.y1 >= box.y1 && b.y2 <= box.y2;
}

// ---------------------------------------------------------------------------
// Selection handles
// ---------------------------------------------------------------------------
export function getHandlePositions(el, zoom) {
  const b = getElementBounds(el);
  const [cx, cy] = [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2];
  const rot = ROTATION_HANDLE_DISTANCE / zoom;
  const local = {
    nw: [b.x1, b.y1],
    ne: [b.x2, b.y1],
    sw: [b.x1, b.y2],
    se: [b.x2, b.y2],
    n: [(b.x1 + b.x2) / 2, b.y1],
    s: [(b.x1 + b.x2) / 2, b.y2],
    w: [b.x1, (b.y1 + b.y2) / 2],
    e: [b.x2, (b.y1 + b.y2) / 2],
    rotation: [(b.x1 + b.x2) / 2, b.y1 - rot],
  };
  const handles = {};
  for (const key of Object.keys(local)) {
    handles[key] = rotatePoint(local[key][0], local[key][1], cx, cy, el.angle);
  }
  return handles;
}

// Return the handle name at a scene point, or null. Linear elements only expose corners.
export function getHandleAt(el, sx, sy, zoom) {
  const size = (HANDLE_SIZE + 4) / zoom;
  const handles = getHandlePositions(el, zoom);
  const order = isLinearType(el.type)
    ? ['rotation', 'nw', 'ne', 'sw', 'se']
    : ['rotation', 'nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
  for (const key of order) {
    const [hx, hy] = handles[key];
    if (Math.abs(sx - hx) <= size && Math.abs(sy - hy) <= size) {
      return key;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------
export function moveElement(el, dx, dy) {
  return { ...el, x: el.x + dx, y: el.y + dy };
}

// Normalize negative width/height into positive values (called after creating a shape).
export function normalizeElement(el) {
  if (isLinearType(el.type)) return el;
  let { x, y, width, height } = el;
  if (width < 0) {
    x += width;
    width = -width;
  }
  if (height < 0) {
    y += height;
    height = -height;
  }
  return { ...el, x, y, width, height };
}

/**
 * Resize an element by dragging `handle` to scene point (px, py).
 * Uses the element's local (unrotated) frame with the opposite corner anchored.
 */
export function resizeElement(el, handle, px, py) {
  if (handle === 'rotation') return el;

  const b = getElementBounds(el);
  const oldW = b.x2 - b.x1;
  const oldH = b.y2 - b.y1;
  const cx = (b.x1 + b.x2) / 2;
  const cy = (b.y1 + b.y2) / 2;
  const hw = oldW / 2;
  const hh = oldH / 2;

  // Pointer in the element's local frame, relative to its center.
  const [lx, ly] = rotatePoint(px, py, cx, cy, -el.angle);
  const lxC = lx - cx;
  const lyC = ly - cy;

  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;

  const minSize = 2;
  let newW = oldW;
  let newH = oldH;
  if (sx !== 0) newW = Math.max(minSize, (lxC + sx * hw) * sx);
  if (sy !== 0) newH = Math.max(minSize, (lyC + sy * hh) * sy);

  // World position of the anchored (opposite) corner, using the OLD center/angle.
  const anchorLocalX = -sx * hw;
  const anchorLocalY = -sy * hh;
  const cos = Math.cos(el.angle);
  const sin = Math.sin(el.angle);
  const anchorWorldX = cx + anchorLocalX * cos - anchorLocalY * sin;
  const anchorWorldY = cy + anchorLocalX * sin + anchorLocalY * cos;

  // New center so the anchored corner stays fixed in world space.
  const newAnchorLocalX = -sx * (newW / 2);
  const newAnchorLocalY = -sy * (newH / 2);
  const newCx = anchorWorldX - (newAnchorLocalX * cos - newAnchorLocalY * sin);
  const newCy = anchorWorldY - (newAnchorLocalX * sin + newAnchorLocalY * cos);

  const newX = newCx - newW / 2;
  const newY = newCy - newH / 2;

  if (isLinearType(el.type) && el.points) {
    const scaleX = oldW ? newW / oldW : 1;
    const scaleY = oldH ? newH / oldH : 1;
    const minX = Math.min(...el.points.map((p) => p[0]));
    const minY = Math.min(...el.points.map((p) => p[1]));
    const points = el.points.map((p) => [
      (p[0] - minX) * scaleX,
      (p[1] - minY) * scaleY,
    ]);
    return { ...el, x: newX, y: newY, points };
  }

  return { ...el, x: newX, y: newY, width: newW, height: newH };
}

export function rotateElement(el, px, py) {
  const [cx, cy] = getElementCenter(el);
  const angle = Math.atan2(py - cy, px - cx) + Math.PI / 2;
  return { ...el, angle };
}

// ---------------------------------------------------------------------------
// Curved line / arrow support (the draggable middle "bend" dot)
// ---------------------------------------------------------------------------

// Scene position of the on-curve midpoint where the bend handle is drawn.
export function getMidpointHandle(el) {
  if (!isLinearType(el.type) || !el.points || el.points.length < 2) return null;
  const p0 = el.points[0];
  const pe = el.points[el.points.length - 1];
  let mx;
  let my;
  if (el.points.length >= 3) {
    const c = el.points[1];
    // Point of the quadratic bezier at t = 0.5.
    mx = 0.25 * p0[0] + 0.5 * c[0] + 0.25 * pe[0];
    my = 0.25 * p0[1] + 0.5 * c[1] + 0.25 * pe[1];
  } else {
    mx = (p0[0] + pe[0]) / 2;
    my = (p0[1] + pe[1]) / 2;
  }
  const [cx, cy] = getElementCenter(el);
  return rotatePoint(el.x + mx, el.y + my, cx, cy, el.angle);
}

export function isBendHandleAt(el, sx, sy, zoom) {
  const mid = getMidpointHandle(el);
  if (!mid) return false;
  return Math.hypot(sx - mid[0], sy - mid[1]) <= (HANDLE_SIZE + 5) / zoom;
}

// Bend a line/arrow so its curve passes through scene point (px, py).
export function setBend(el, px, py) {
  if (!isLinearType(el.type) || !el.points || el.points.length < 2) return el;
  const [cx, cy] = getElementCenter(el);
  const [lx, ly] = rotatePoint(px, py, cx, cy, -el.angle);
  const mx = lx - el.x;
  const my = ly - el.y;
  const p0 = el.points[0];
  const pe = el.points[el.points.length - 1];
  // Control point so the quadratic passes through (mx, my) at t = 0.5.
  const control = [2 * mx - 0.5 * (p0[0] + pe[0]), 2 * my - 0.5 * (p0[1] + pe[1])];
  return { ...el, points: [p0, control, pe] };
}

