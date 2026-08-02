import React, { useState } from 'react';
import { X, Workflow } from 'lucide-react';

const SAMPLE = `graph TD
  A[Start] --> B{Works?}
  B -->|Yes| C[Ship it]
  B -->|No| D[Fix it]
  D --> B`;

export default function MermaidDialog({ open, onClose, onInsert }) {
  const [code, setCode] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    try {
      await onInsert(code);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Workflow size={18} className="text-gray-900" /> Insert Mermaid diagram
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <p className="mb-2 text-xs text-gray-500">
          Paste Mermaid code below (or just paste it directly onto the canvas).
        </p>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="h-52 w-full resize-none rounded-lg border border-gray-300 p-3 font-mono text-xs outline-none focus:border-gray-900"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
          >
            {busy ? 'Rendering…' : 'Insert diagram'}
          </button>
        </div>
      </div>
    </div>
  );
}
