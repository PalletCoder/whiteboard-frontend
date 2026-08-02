import React from 'react';
import { X, Plus, Trash2, FileText } from 'lucide-react';

export default function WorkspacesDialog({
  open,
  onClose,
  rooms,
  loading,
  currentRoomId,
  onOpen,
  onDelete,
  onNew,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-md flex-col rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Your workspaces</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          onClick={onNew}
          className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          <Plus size={16} /> New workspace
        </button>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
          ) : rooms.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No saved workspaces yet.</div>
          ) : (
            <ul className="space-y-1">
              {rooms.map((room) => (
                <li
                  key={room.roomId}
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50 ${
                    room.roomId === currentRoomId ? 'bg-gray-100' : ''
                  }`}
                >
                  <FileText size={16} className="text-gray-400" />
                  <button type="button" onClick={() => onOpen(room.roomId)} className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-800">{room.name || 'Untitled workspace'}</div>
                    <div className="text-[11px] text-gray-400">
                      {new Date(room.updatedAt).toLocaleString()}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(room.roomId)}
                    className="rounded-md p-1.5 text-gray-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
