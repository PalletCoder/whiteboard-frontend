import React, { useEffect, useRef, useState } from 'react';
import {
  Menu, Save, FolderOpen, ImageDown, FileDown, FileUp, Workflow, Trash2, Grid3x3, LogOut, Check,
} from 'lucide-react';
import { CANVAS_BACKGROUNDS } from '../../whiteboard/constants';

function Item({ icon: Icon, label, onClick, right }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
    >
      <Icon size={16} className="text-gray-500" />
      <span className="flex-1">{label}</span>
      {right}
    </button>
  );
}

export default function MainMenu({
  user,
  saving,
  onSave,
  onOpen,
  onExportImage,
  onExportFile,
  onImportFile,
  onInsertMermaid,
  onClear,
  gridEnabled,
  onToggleGrid,
  canvasBackground,
  onCanvasBackground,
  onSignOut,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const run = (fn) => () => {
    setOpen(false);
    fn?.();
  };

  return (
    <div className="pointer-events-auto relative" ref={ref}>
      <button
        type="button"
        title="Menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-md hover:bg-gray-100"
      >
        <Menu size={18} />
      </button>

      {open && (
        <div className="absolute left-0 top-12 w-60 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
          <Item icon={Save} label={saving ? 'Saving…' : 'Save workspace'} onClick={run(onSave)} />
          <Item icon={FolderOpen} label="Open workspace…" onClick={run(onOpen)} />
          <Item icon={FileUp} label="Import from file (.json)" onClick={run(onImportFile)} />
          <Item icon={Workflow} label="Insert diagram (Mermaid)…" onClick={run(onInsertMermaid)} />
          <Item icon={ImageDown} label="Export image (PNG)" onClick={run(onExportImage)} />
          <Item icon={FileDown} label="Save to file (.json)" onClick={run(onExportFile)} />
          <Item icon={Trash2} label="Reset the canvas" onClick={run(onClear)} />

          <div className="my-1.5 h-px bg-gray-100" />

          <Item
            icon={Grid3x3}
            label="Show grid"
            onClick={onToggleGrid}
            right={gridEnabled ? <Check size={15} className="text-gray-900" /> : null}
          />

          <div className="px-2.5 py-2">
            <div className="mb-1.5 text-[11px] font-medium text-gray-500">Canvas background</div>
            <div className="flex items-center gap-1.5">
              {CANVAS_BACKGROUNDS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => onCanvasBackground(c)}
                  className={`h-6 w-6 rounded-md border ${
                    canvasBackground === c ? 'ring-2 ring-gray-900 ring-offset-1' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="my-1.5 h-px bg-gray-100" />

          {user && (
            <div className="px-2.5 pb-1 pt-0.5 text-[11px] text-gray-400">
              Signed in as {user.username}
            </div>
          )}
          <Item icon={LogOut} label="Sign out" onClick={run(onSignOut)} />
        </div>
      )}
    </div>
  );
}
