/**
 * A small, self-contained "hand-drawn" rendering library, written from scratch.
 * It powers the Sloppiness (Architect / Artist / Cartoonist) look by drawing
 * every shape with a seeded pseudo-random jitter so results stay stable between
 * re-renders. All functions operate on the current canvas path in scene
 * coordinates; the caller is responsible for beginPath()/stroke()/fill().
 */

const MAX_OFFSET = 2;
const BOWING = 0.85;

// Deterministic PRNG (mulberry32) so a given seed always produces the same shape.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitter(rng, roughness, min, max) {
  return roughness * (rng() * (max - min) + min);
}

// Append a single hand-drawn segment (a slightly bowed bezier) to the path.
function sketchSegment(ctx, x1, y1, x2, y2, rng, roughness, overlay) {
  const lengthSq = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  const length = Math.sqrt(lengthSq);
  let offset = MAX_OFFSET;
  if (offset * offset * 100 > lengthSq) {
    offset = length / 10;
  }
  if (overlay) offset /= 2;
  const halfOffset = offset / 2;
  const diverge = 0.2 + rng() * 0.2;

  let midX = (BOWING * MAX_OFFSET * (y2 - y1)) / 200;
  let midY = (BOWING * MAX_OFFSET * (x1 - x2)) / 200;
  midX = jitter(rng, roughness, -midX, midX);
  midY = jitter(rng, roughness, -midY, midY);

  const o = () => jitter(rng, roughness, -offset, offset);
  const h = () => jitter(rng, roughness, -halfOffset, halfOffset);

  ctx.moveTo(x1 + h(), y1 + h());
  ctx.bezierCurveTo(
    midX + x1 + (x2 - x1) * diverge + o(),
    midY + y1 + (y2 - y1) * diverge + o(),
    midX + x1 + 2 * (x2 - x1) * diverge + o(),
    midY + y1 + 2 * (y2 - y1) * diverge + o(),
    x2 + h(),
    y2 + h(),
  );
}

// A double-stroked line, the basic building block of every straight edge.
export function roughLine(ctx, x1, y1, x2, y2, rng, roughness) {
  sketchSegment(ctx, x1, y1, x2, y2, rng, roughness, false);
  sketchSegment(ctx, x1, y1, x2, y2, rng, roughness, true);
}

export function roughPolyline(ctx, points, rng, roughness, closed) {
  for (let i = 0; i < points.length - 1; i += 1) {
    roughLine(ctx, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], rng, roughness);
  }
  if (closed && points.length > 2) {
    const a = points[points.length - 1];
    const b = points[0];
    roughLine(ctx, a[0], a[1], b[0], b[1], rng, roughness);
  }
}

export function roughRectangle(ctx, x, y, w, h, rng, roughness) {
  roughPolyline(
    ctx,
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    rng,
    roughness,
    true,
  );
}

export function roughDiamond(ctx, x, y, w, h, rng, roughness) {
  roughPolyline(
    ctx,
    [
      [x + w / 2, y],
      [x + w, y + h / 2],
      [x + w / 2, y + h],
      [x, y + h / 2],
    ],
    rng,
    roughness,
    true,
  );
}

// Smoothly connect points with quadratic curves through their midpoints.
export function smoothCurve(ctx, points, closed) {
  if (points.length < 2) return;
  ctx.moveTo(points[0][0], points[0][1]);
  if (points.length === 2) {
    ctx.lineTo(points[1][0], points[1][1]);
    return;
  }
  for (let i = 1; i < points.length - 1; i += 1) {
    const xc = (points[i][0] + points[i + 1][0]) / 2;
    const yc = (points[i][1] + points[i + 1][1]) / 2;
    ctx.quadraticCurveTo(points[i][0], points[i][1], xc, yc);
  }
  const last = points[points.length - 1];
  ctx.quadraticCurveTo(
    points[points.length - 2][0],
    points[points.length - 2][1],
    last[0],
    last[1],
  );
  if (closed) ctx.closePath();
}

export function roughEllipse(ctx, x, y, w, h, rng, roughness) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = Math.abs(w) / 2;
  const ry = Math.abs(h) / 2;
  const steps = Math.max(12, Math.floor(Math.sqrt(rx + ry) * 3.2));
  const inc = (Math.PI * 2) / steps;
  const amp = roughness * 1.1;

  for (let pass = 0; pass < 2; pass += 1) {
    const pts = [];
    for (let i = 0; i <= steps; i += 1) {
      const angle = i * inc + jitter(rng, roughness, -0.03, 0.03);
      const rox = rx + jitter(rng, amp, -1.4, 1.4);
      const roy = ry + jitter(rng, amp, -1.4, 1.4);
      pts.push([cx + Math.cos(angle) * rox, cy + Math.sin(angle) * roy]);
    }
    smoothCurve(ctx, pts, true);
  }
}

// Build an exact (non-sketchy) geometric path — used for fills, clipping and hit areas.
export function buildRectPath(ctx, x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2));
  if (!r) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function buildDiamondPath(ctx, x, y, w, h) {
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}

export function buildEllipsePath(ctx, x, y, w, h) {
  ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
}

/**
 * Add hachure (parallel diagonal) fill lines covering the given bounds to the
 * current path. The caller should clip to the shape before stroking these.
 */
export function fillHachure(ctx, x, y, w, h, gap, crossHatch) {
  const step = Math.max(4, gap);
  for (let p = x - h; p <= x + w; p += step) {
    ctx.moveTo(p, y);
    ctx.lineTo(p + h, y + h);
  }
  if (crossHatch) {
    for (let p = x; p <= x + w + h; p += step) {
      ctx.moveTo(p, y);
      ctx.lineTo(p - h, y + h);
    }
  }
}
