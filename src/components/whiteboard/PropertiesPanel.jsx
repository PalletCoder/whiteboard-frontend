import React from 'react';
import { Copy, Trash2, Link2, ArrowDownToLine, ArrowUpToLine, ArrowDown, ArrowUp } from 'lucide-react';
import {
  STROKE_COLORS, BACKGROUND_COLORS, STROKE_WIDTHS, STROKE_STYLES,
  SLOPPINESS, FILL_STYLES, FONT_SIZES, FONT_FAMILIES,
} from '../../whiteboard/constants';

const TRANSPARENT =
  'repeating-conic-gradient(#e9ecef 0% 25%, #ffffff 0% 50%) 50% / 10px 10px';

function Label({ children }) {
  return <div className="mb-1.5 text-[11px] font-medium text-gray-500">{children}</div>;
}

function OptionRow({ children }) {
  return <div className="flex items-center gap-1">{children}</div>;
}

function Segment({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-gray-700 transition-colors ${
        active ? 'border-gray-900 bg-gray-900 text-white' : 'border-transparent bg-gray-100 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function Swatch({ color, active, onClick }) {
  const isTransparent = color === 'transparent';
  return (
    <button
      type="button"
      title={color}
      onClick={onClick}
      className={`h-6 w-6 rounded-md border ${active ? 'ring-2 ring-gray-900 ring-offset-1' : 'border-gray-300'}`}
      style={isTransparent ? { background: TRANSPARENT } : { backgroundColor: color }}
    />
  );
}

function ColorControl({ colors, value, onChange }) {
  return (
    <OptionRow>
      <div className="flex items-center gap-1">
        {colors.map((c) => (
          <Swatch key={c} color={c} active={value === c} onClick={() => onChange(c)} />
        ))}
      </div>
      <span className="mx-1 h-6 w-px bg-gray-200" />
      <label
        className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-md border border-gray-300"
        title="Custom color"
        style={value === 'transparent' ? { background: TRANSPARENT } : { backgroundColor: value }}
      >
        <input
          type="color"
          value={value === 'transparent' ? '#ffffff' : value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </OptionRow>
  );
}

// -- Small inline glyphs ---------------------------------------------------
const Stroke = (props) => <svg viewBox="0 0 24 24" width="18" height="18" {...props} />;

const WidthIcon = (w) => (
  <Stroke><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={w} strokeLinecap="round" /></Stroke>
);
const StyleIcon = (dash) => (
  <Stroke><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={dash} /></Stroke>
);
const SloppyIcon = (amp) => (
  <Stroke>
    <path
      d={`M4 12 q3 ${-amp} 6 0 t6 0 t6 0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Stroke>
);
const SharpEdge = (
  <Stroke><path d="M5 19 V7 a2 2 0 0 1 2-2 h12" fill="none" stroke="currentColor" strokeWidth="2" /></Stroke>
);
const RoundEdge = (
  <Stroke><path d="M5 19 V11 a6 6 0 0 1 6-6 h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></Stroke>
);
const FillIcon = (style) => {
  if (style === 'solid') return <Stroke><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" /></Stroke>;
  if (style === 'cross-hatch') {
    return (
      <Stroke><g stroke="currentColor" strokeWidth="1.4">
        <path d="M6 10 L14 18 M10 6 L18 14 M6 14 L10 18 M14 6 L18 10" />
      </g></Stroke>
    );
  }
  return (
    <Stroke><g stroke="currentColor" strokeWidth="1.4">
      <path d="M6 12 L12 6 M8 16 L16 8 M12 18 L18 12" />
    </g></Stroke>
  );
};

const nearest = (options, value) =>
  options.reduce((a, b) => (Math.abs(b.value - value) < Math.abs(a.value - value) ? b : a)).value;

export default function PropertiesPanel({
  style,
  onChange,
  showText,
  hasSelection,
  onLayer,
  onDuplicate,
  onDelete,
  onCopy,
}) {
  const widthVal = nearest(STROKE_WIDTHS, style.strokeWidth);
  const roughVal = nearest(SLOPPINESS, style.roughness);

  return (
    <div className="pointer-events-auto max-h-[calc(100vh-13rem)] w-56 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
      <div className="space-y-3">
        <div>
          <Label>Stroke</Label>
          <ColorControl colors={STROKE_COLORS} value={style.strokeColor} onChange={(c) => onChange({ strokeColor: c })} />
        </div>

        <div>
          <Label>Background</Label>
          <ColorControl colors={BACKGROUND_COLORS} value={style.backgroundColor} onChange={(c) => onChange({ backgroundColor: c })} />
        </div>

        {style.backgroundColor !== 'transparent' && (
          <div>
            <Label>Fill</Label>
            <OptionRow>
              {FILL_STYLES.map((f) => (
                <Segment key={f} active={style.fillStyle === f} title={f} onClick={() => onChange({ fillStyle: f })}>
                  {FillIcon(f)}
                </Segment>
              ))}
            </OptionRow>
          </div>
        )}

        <div>
          <Label>Stroke width</Label>
          <OptionRow>
            {STROKE_WIDTHS.map((w, i) => (
              <Segment key={w.value} active={widthVal === w.value} title={w.label} onClick={() => onChange({ strokeWidth: w.value })}>
                {WidthIcon([1.5, 3, 5][i])}
              </Segment>
            ))}
          </OptionRow>
        </div>

        <div>
          <Label>Stroke style</Label>
          <OptionRow>
            {STROKE_STYLES.map((s) => (
              <Segment key={s} active={style.strokeStyle === s} title={s} onClick={() => onChange({ strokeStyle: s })}>
                {StyleIcon(s === 'dashed' ? '6 4' : s === 'dotted' ? '1 4' : '0')}
              </Segment>
            ))}
          </OptionRow>
        </div>

        <div>
          <Label>Sloppiness</Label>
          <OptionRow>
            {SLOPPINESS.map((s, i) => (
              <Segment key={s.value} active={roughVal === s.value} title={s.label} onClick={() => onChange({ roughness: s.value })}>
                {SloppyIcon([1, 4, 7][i])}
              </Segment>
            ))}
          </OptionRow>
        </div>

        <div>
          <Label>Edges</Label>
          <OptionRow>
            <Segment active={style.edges === 'sharp'} title="Sharp" onClick={() => onChange({ edges: 'sharp' })}>{SharpEdge}</Segment>
            <Segment active={style.edges === 'round'} title="Round" onClick={() => onChange({ edges: 'round' })}>{RoundEdge}</Segment>
          </OptionRow>
        </div>

        {showText && (
          <>
            <div>
              <Label>Font size</Label>
              <OptionRow>
                {FONT_SIZES.map((f) => (
                  <Segment key={f.value} active={style.fontSize === f.value} title={f.label} onClick={() => onChange({ fontSize: f.value })}>
                    <span className="text-xs font-semibold">{f.label}</span>
                  </Segment>
                ))}
              </OptionRow>
            </div>
            <div>
              <Label>Font family</Label>
              <OptionRow>
                {Object.keys(FONT_FAMILIES).map((key) => (
                  <Segment key={key} active={style.fontFamily === key} title={key} onClick={() => onChange({ fontFamily: key })}>
                    <span style={{ fontFamily: FONT_FAMILIES[key] }} className="text-sm">A</span>
                  </Segment>
                ))}
              </OptionRow>
            </div>
          </>
        )}

        <div>
          <Label>Opacity</Label>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={style.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-gray-900"
          />
        </div>

        {hasSelection && (
          <>
            <div>
              <Label>Layers</Label>
              <OptionRow>
                <Segment title="Send to back" onClick={() => onLayer('back')}><ArrowDownToLine size={16} /></Segment>
                <Segment title="Send backward" onClick={() => onLayer('backward')}><ArrowDown size={16} /></Segment>
                <Segment title="Bring forward" onClick={() => onLayer('forward')}><ArrowUp size={16} /></Segment>
                <Segment title="Bring to front" onClick={() => onLayer('front')}><ArrowUpToLine size={16} /></Segment>
              </OptionRow>
            </div>
            <div>
              <Label>Actions</Label>
              <OptionRow>
                <Segment title="Duplicate" onClick={onDuplicate}><Copy size={16} /></Segment>
                <Segment title="Delete" onClick={onDelete}><Trash2 size={16} /></Segment>
                <Segment title="Copy to clipboard" onClick={onCopy}><Link2 size={16} /></Segment>
              </OptionRow>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
