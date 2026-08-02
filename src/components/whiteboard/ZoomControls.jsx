import React from 'react';
import { Plus, Minus, Undo2, Redo2 } from 'lucide-react';

export default function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-md">
        <button
          type="button"
          title="Zoom out"
          onClick={onZoomOut}
          className="flex h-9 w-9 items-center justify-center rounded-l-lg text-gray-700 hover:bg-gray-100"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          title="Reset zoom"
          onClick={onZoomReset}
          className="h-9 w-14 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          title="Zoom in"
          onClick={onZoomIn}
          className="flex h-9 w-9 items-center justify-center rounded-r-lg text-gray-700 hover:bg-gray-100"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-md">
        <button
          type="button"
          title="Undo"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex h-9 w-9 items-center justify-center rounded-l-lg text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          title="Redo"
          onClick={onRedo}
          disabled={!canRedo}
          className="flex h-9 w-9 items-center justify-center rounded-r-lg text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
        >
          <Redo2 size={16} />
        </button>
      </div>
    </div>
  );
}
