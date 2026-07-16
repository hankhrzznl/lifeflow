// ============================================================
// Design Tokens — 织光者的工作台
// 所有颜色/字体/间距常量集中管理
// ============================================================

export const COLORS = {
  // 品牌色
  brandPrimary: '#E88D67',
  brandPrimaryHover: '#D97A54',
  brandPrimaryLight: '#FDE8E0',
  brandSecondary: '#8B6F5E',
  brandSecondaryHover: '#7A6050',

  // 表面/背景
  surfaceDesk: '#D4C5B5',
  surfaceDeskLight: '#E8DDD4',
  surfaceFabric: '#F5F0E8',
  surfaceFabricHover: '#EDE7DB',

  // 语义
  success: '#7CA982',
  successLight: '#E8F0EA',
  warning: '#D4736E',
  warningLight: '#F9E5E3',
  info: '#7BA3C7',
  infoLight: '#E3EDF5',

  // 文字
  textPrimary: '#3D342E',
  textSecondary: '#6B5E54',
  textTertiary: '#A39E99',
  textInverse: '#FAF6F0',

  // 边框
  border: '#D4C5B5',
  borderLight: '#E8DDD4',
  borderDashed: '#C4B5A5',

  // 编织进度条
  knitThread: '#E88D67',
  knitDone: '#7CA982',
  knitPartial: '#F5C542',
  knitBg: '#E8DDD4',
  knitGrid: '#C4B5A5',
} as const;

export const FONTS = {
  display: ['"ZCOOL KuaiLe"', '"LXGW WenKai"', 'cursive'].join(', '),
  body: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'].join(', '),
  mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'].join(', '),
} as const;

export const FONT_SIZES = {
  display: 36,
  h1: 24,
  h2: 20,
  h3: 18,
  body: 16,
  bodySm: 14,
  caption: 12,
} as const;

export const FONT_WEIGHTS = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const LINE_HEIGHTS = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const RADIUS = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const SHADOWS = {
  subtle: '0 1px 2px rgba(61, 52, 46, 0.05)',
  card: '0 4px 6px rgba(61, 52, 46, 0.08)',
  modal: '0 8px 16px rgba(61, 52, 46, 0.12)',
  knit: '0 2px 0 #C4B5A5',
} as const;

export const EASING = {
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  outExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  knit: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// ============================================================
// 深色模式
// ============================================================

export const darkColors = {
  surface: {
    desk: '#2D2520',
    deskLight: '#3D342E',
    fabric: '#3A322C',
    fabricHover: '#453D36',
  },
  brand: {
    primary: '#E88D67',
    primaryHover: '#F09B7A',
    primaryLight: 'rgba(232,141,103,0.15)',
    secondary: '#A89080',
    secondaryHover: '#B8A090',
  },
  semantic: {
    success: '#7CA982',
    successLight: 'rgba(124,169,130,0.15)',
    warning: '#D4736E',
    warningLight: 'rgba(212,115,110,0.15)',
    info: '#7BA3C7',
    infoLight: 'rgba(123,163,199,0.15)',
  },
  text: {
    primary: '#F5F0E8',
    secondary: '#C4B5A5',
    tertiary: '#8B7D6B',
    inverse: '#3D342E',
  },
  knit: {
    thread: '#E88D67',
    completed: '#7CA982',
    partial: '#F5C542',
    bg: '#4A423C',
    grid: '#5A524C',
  },
} as const;
