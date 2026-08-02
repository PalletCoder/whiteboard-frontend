import React from 'react';
import { MousePointer2 } from 'lucide-react';

/**
 * Renders remote collaborators' cursors. `pointers` carries positions already
 * projected into local screen (CSS pixel) coordinates.
 */
export default function CollabCursors({ pointers }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {pointers.map((p) => (
        <div
          key={p.socketId}
          className="absolute transition-transform duration-75 ease-linear"
          style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
        >
          <MousePointer2 size={18} style={{ color: p.color }} fill={p.color} />
          <span
            className="ml-3 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium text-white shadow"
            style={{ backgroundColor: p.color }}
          >
            {p.username}
          </span>
        </div>
      ))}
    </div>
  );
}
