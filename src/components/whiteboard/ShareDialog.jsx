import React, { useState } from 'react';
import { X, Copy, Check, Users, Play, Square } from 'lucide-react';

export default function ShareDialog({
  open,
  onClose,
  roomId,
  isHost,
  shareLink,
  collaboratorsCount,
  onStart,
  onStop,
  onJoin,
}) {
  const [copied, setCopied] = useState(false);
  const [joinValue, setJoinValue] = useState('');

  if (!open) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleJoin = () => {
    const value = joinValue.trim();
    if (!value) return;
    const match = value.match(/room=([\w-]+)/);
    onJoin(match ? match[1] : value);
    setJoinValue('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Live collaboration</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {roomId ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <Users size={16} />
              Session is live · {collaboratorsCount} {collaboratorsCount === 1 ? 'person' : 'people'} here
            </div>
            <p className="text-xs text-gray-500">
              {isHost
                ? 'People who open the link will request to join — you approve them. Ending the session returns everyone to their own board.'
                : 'You are collaborating in a shared session hosted by someone else.'}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Shareable link</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareLink}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={onStop}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              <Square size={16} /> {isHost ? 'End session for everyone' : 'Leave session'}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-gray-600">
              Invite people to collaborate on this workspace in real time. When someone opens the link,
              you’ll get a request to let them in.
            </p>
            <button
              type="button"
              onClick={onStart}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black"
            >
              <Play size={16} /> Start live collaboration
            </button>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="h-px flex-1 bg-gray-200" /> or join a session <span className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="flex items-center gap-2">
              <input
                value={joinValue}
                onChange={(e) => setJoinValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Paste link or room ID"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-gray-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleJoin}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Join
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
