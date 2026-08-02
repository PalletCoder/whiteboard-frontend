 // Editor tools
export const TOOL = {
  SELECTION: 'selection',
  HAND: 'hand',
  RECTANGLE: 'rectangle',
  DIAMOND: 'diamond',
  ELLIPSE: 'ellipse', 
  ARROW: 'arrow',
  LINE: 'line',
  DRAW: 'draw',
  TEXT: 'text',
  IMAGE: 'image',
  ERASER: 'eraser',
};

// Tools that create a new element by dragging
export const SHAPE_TOOLS = [
  TOOL.RECTANGLE,
  TOOL.DIAMOND,
  TOOL.ELLIPSE,
  TOOL.ARROW,
  TOOL.LINE,
  TOOL.DRAW,
];

// Palette shown in the properties panel
export const STROKE_COLORS = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
export const BACKGROUND_COLORS = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];
export const CANVAS_BACKGROUNDS = ['#ffffff', '#f8f9fa', '#f5faff', '#fffce8', '#1e1e1e'];

export const STROKE_WIDTHS = [
  { label: 'Thin', value: 1 },
  { label: 'Bold', value: 2.5 },
  { label: 'Extra bold', value: 4 },
];

export const STROKE_STYLES = ['solid', 'dashed', 'dotted'];

// Sloppiness -> roughness value fed to the hand-drawn renderer
export const SLOPPINESS = [
  { label: 'Architect', value: 0.5 },
  { label: 'Artist', value: 1.2 },
  { label: 'Cartoonist', value: 2.4 },
];

export const FILL_STYLES = ['hachure', 'cross-hatch', 'solid'];

export const FONT_SIZES = [
  { label: 'S', value: 16 },
  { label: 'M', value: 20 },
  { label: 'L', value: 28 },
  { label: 'XL', value: 36 },
];

export const FONT_FAMILIES = {
  hand: '"Comic Sans MS", "Segoe Print", "Bradley Hand", cursive',
  normal: '"Helvetica Neue", Arial, sans-serif',
  code: '"Cascadia Code", "Fira Code", Consolas, monospace',
};

// Defaults applied to a freshly created element
export const DEFAULT_ELEMENT_STYLE = {
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  fillStyle: 'hachure',
  strokeWidth: 2.5,
  strokeStyle: 'solid',
  roughness: 1.2,
  edges: 'round',
  opacity: 100,
  fontSize: 20,
  fontFamily: 'hand',
};

export const DEFAULT_APP_STATE = {
  viewBackgroundColor: '#ffffff',
  scrollX: 0,
  scrollY: 0,
  zoom: 1,
  gridSize: 0,
};

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 30;
export const ZOOM_STEP = 0.1;

// Size of resize handles in screen pixels
export const HANDLE_SIZE = 8;
export const ROTATION_HANDLE_DISTANCE = 28;
