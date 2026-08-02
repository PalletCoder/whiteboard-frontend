import React from 'react';
import {
  Lock, Unlock, Hand, MousePointer2, Square, Diamond, Circle,
  MoveRight, Minus, Pencil, Type, Image as ImageIcon, Eraser,
} from 'lucide-react';
import { TOOL } from '../../whiteboard/constants';

const TOOLS = [
  { tool: TOOL.HAND, icon: Hand, label: 'Hand — pan', key: null },
  { tool: TOOL.SELECTION, icon: MousePointer2, label: 'Selection', key: '1' },
  { tool: TOOL.RECTANGLE, icon: Square, label: 'Rectangle', key: '2' },
  { tool: TOOL.DIAMOND, icon: Diamond, label: 'Diamond', key: '3' },
  { tool: TOOL.ELLIPSE, icon: Circle, label: 'Ellipse', key: '4' },
  { tool: TOOL.ARROW, icon: MoveRight, label: 'Arrow', key: '5' },
  { tool: TOOL.LINE, icon: Minus, label: 'Line', key: '6' },
  { tool: TOOL.DRAW, icon: Pencil, label: 'Draw', key: '7' },
  { tool: TOOL.TEXT, icon: Type, label: 'Text', key: '8' },
  { tool: TOOL.IMAGE, icon: ImageIcon, label: 'Insert image', key: '9' },
  { tool: TOOL.ERASER, icon: Eraser, label: 'Eraser', key: '0' },
];

function ToolButton({ active, label, badge, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
      {badge && (
        <span className="pointer-events-none absolute bottom-0.5 right-1 text-[9px] font-medium text-gray-400">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function TopToolbar({ activeTool, onToolChange, locked, onToggleLock }) {
  return (
    <div className="pointer-events-auto flex max-w-[calc(100vw-1rem)] items-center gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white px-1.5 py-1.5 shadow-md">
      <ToolButton
        active={locked}
        label={locked ? 'Keep selected tool active (on)' : 'Keep selected tool active (off)'}
        onClick={onToggleLock}
      >
        {locked ? <Lock size={17} /> : <Unlock size={17} />}
      </ToolButton>

      <span className="mx-0.5 h-6 w-px shrink-0 bg-gray-200" />

      {TOOLS.map(({ tool, icon: Icon, label, key }) => (
        <ToolButton
          key={tool}
          active={activeTool === tool}
          label={key ? `${label} — ${key}` : label}
          badge={key}
          onClick={() => onToolChange(tool)}
        >
          <Icon size={17} />
        </ToolButton>
      ))}
    </div>
  );
}
