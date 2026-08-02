import React from 'react';

const initials = (name) =>
  (name || '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function Collaborators({ collaborators, mySocketId }) {
  if (!collaborators || collaborators.length <= 1) return null;
  const others = collaborators.filter((c) => c.socketId !== mySocketId);
  const shown = others.slice(0, 4);
  const extra = others.length - shown.length;

  return (
    <div className="pointer-events-auto flex items-center -space-x-2">
      {shown.map((c) => (
        <div
          key={c.socketId}
          title={c.username}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow"
          style={{ backgroundColor: c.color || '#7048e8' }}
        >
          {initials(c.username)}
        </div>
      ))}
      {extra > 0 && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-500 text-[11px] font-semibold text-white shadow">
          +{extra}
        </div>
      )}
    </div>
  );
}
