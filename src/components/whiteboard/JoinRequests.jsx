import React from 'react';
import { UserPlus, Check, X } from 'lucide-react';

// Prompts shown to the host when someone requests to join the session.
export default function JoinRequests({ requests, onRespond }) {
  if (!requests || requests.length === 0) return null;

  return (
    <div className="pointer-events-auto flex w-72 max-w-[calc(100vw-1.5rem)] flex-col gap-2">
      {requests.map((r) => (
        <div key={r.socketId} className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm text-gray-800">
            <UserPlus size={16} className="text-gray-900" />
            <span>
              <b>{r.user?.username || 'Someone'}</b> wants to join
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onRespond(r.socketId, true)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black"
            >
              <Check size={15} /> Accept
            </button>
            <button
              type="button"
              onClick={() => onRespond(r.socketId, false)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <X size={15} /> Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
