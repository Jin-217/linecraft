/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { create, all } from 'mathjs';
import { 
  LineChart, 
  Settings, 
  Download, 
  Plus, 
  Trash2, 
  Info, 
  Maximize2, 
  Minimize2,
  FunctionSquare,
  Crosshair,
  Activity,
  ChevronLeft,
  ChevronRight,
  Search,
  Copy,
  RotateCcw,
  Share2,
  Moon,
  Sun,
  HelpCircle,
  Edit3,
  Sliders,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Sparkles,
  Layers,
  Grid,
  Table,
  Bookmark,
  BookOpen,
  MousePointer,
  Hand,
  ZoomIn,
  ZoomOut,
  Focus,
  Check,
  MoreHorizontal,
  X,
  GitCommit,
  Move,
  MapPin,
  BarChart2,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  LogOut,
  User as UserIcon,
  Loader2,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  auth, 
  logOut, 
  syncUserProfile, 
  UserProfile, 
  fetchAdminNotifications 
} from './firebase';
import { AuthPage } from './components/AuthPage';
import { AdminPanel } from './components/AdminPanel';

const math = create(all);

// --- Types ---
interface FunctionConfig {
  id: string;
  equation: string;
  color: string;
  visible: boolean;
  style: 'solid' | 'dashed';
  strokeWidth: number;
  showDerivative: boolean;
  showTangent: boolean;
  tangentPoint: number;
  showExtrema: boolean;
}

interface IntersectionPoint {
  x: number;
  y: number;
  label?: string;
}

// --- Default Function Colors ---
const COLORS = ['#3b82f6', '#ef4444', '#a855f7', '#10b981', '#f59e0b', '#ec4899'];

// --- Logo Component ---
const AppLogo = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <div 
    className={`relative inline-flex items-center justify-center bg-gradient-to-br from-indigo-900/80 to-slate-900 rounded-xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10 ${className}`} 
    style={{ width: size * 1.5, height: size * 1.5 }}
  >
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size }}>
      <path 
        d="M22 12h-4l-3 9L9 3l-3 9H2" 
        stroke="url(#neonGradient)" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <defs>
        <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// --- Sample Presets ---
const FUNCTION_SAMPLES = [
  { label: 'Quadratic', value: 'x^2' },
  { label: 'Linear Shift', value: 'x + 2' },
  { label: 'Sine Wave', value: 'sin(x)' },
  { label: 'Cosine Wave', value: 'cos(x)' },
  { label: 'Exponential', value: 'e^x' },
  { label: 'Logarithmic', value: 'ln(x)' },
  { label: 'Cubic Curve', value: 'x^3 - 3*x' },
  { label: 'Absolute Value', value: 'abs(x)' },
  { label: 'Rational (1/x)', value: '1/x' },
  { label: 'Gaussian Curve', value: 'e^(-x^2)' },
];

// --- Bounds Clamping Helper ---
function clampBounds(domain: [number, number], minVal = -100, maxVal = 100): [number, number] {
  let [d0, d1] = domain;
  let span = d1 - d0;
  if (span >= (maxVal - minVal)) {
    return [minVal, maxVal];
  }
  if (d0 < minVal) {
    d0 = minVal;
    d1 = d0 + span;
  }
  if (d1 > maxVal) {
    d1 = maxVal;
    d0 = d1 - span;
  }
  return [d0, d1];
}

// --- Zoom Scale Mapping Helpers (0% to 100%) ---
function spanToZoomPercent(spanX: number): number {
  const minSpan = 0.5;
  const maxSpan = 200;
  const clampedSpan = Math.max(minSpan, Math.min(maxSpan, spanX));
  const percent = 100 * (Math.log(clampedSpan / maxSpan) / Math.log(minSpan / maxSpan));
  return Math.round(Math.max(0, Math.min(100, percent)));
}

function zoomPercentToSpan(percent: number): number {
  const minSpan = 0.5;
  const maxSpan = 200;
  const p = Math.max(0, Math.min(100, percent)) / 100;
  return maxSpan * Math.pow(minSpan / maxSpan, p);
}

// --- Color conversion helper for html2canvas (converts oklch/oklab to rgb/rgba) ---
function oklabToRgb(l: number, aLab: number, bLab: number, alpha: number = 1): string {
  const l_ = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
  const m_ = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
  const s_ = l - 0.0894841775 * aLab - 1.2914855480 * bLab;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  let rLin = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  let gLin = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  let bLin = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S;

  const toSrgb = (x: number) => {
    const clamped = Math.max(0, Math.min(1, x));
    return clamped > 0.0031308
      ? 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055
      : 12.92 * clamped;
  };

  const r = Math.round(toSrgb(rLin) * 255);
  const g = Math.round(toSrgb(gLin) * 255);
  const b = Math.round(toSrgb(bLin) * 255);

  if (alpha < 1) {
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function oklchToRgb(l: number, c: number, h: number, alpha: number = 1): string {
  const hRad = (h * Math.PI) / 180;
  const aLab = c * Math.cos(hRad);
  const bLab = c * Math.sin(hRad);
  return oklabToRgb(l, aLab, bLab, alpha);
}

let canvas2dContext: CanvasRenderingContext2D | null = null;
if (typeof document !== 'undefined') {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    canvas2dContext = canvas.getContext('2d');
  } catch {
    // ignore
  }
}

function convertCssValueToRgb(val: string): string {
  if (!val || typeof val !== 'string') return val;
  if (!val.includes('oklch') && !val.includes('oklab') && !val.includes('color(')) {
    return val;
  }

  return val.replace(/(oklch|oklab|color)\([^)]+\)/gi, (match) => {
    if (canvas2dContext) {
      try {
        canvas2dContext.fillStyle = '#000000';
        canvas2dContext.fillStyle = match;
        const converted = canvas2dContext.fillStyle;
        if (
          converted && 
          converted !== '#000000' && 
          !converted.includes('oklch') && 
          !converted.includes('oklab') && 
          !converted.includes('color(')
        ) {
          return converted;
        }
      } catch {
        // fallback to manual parsing
      }
    }

    try {
      const isOklch = /^oklch/i.test(match);
      const isOklab = /^oklab/i.test(match);
      const isColor = /^color/i.test(match);

      const inner = match.substring(match.indexOf('(') + 1, match.lastIndexOf(')')).trim();
      const parts = inner.split('/');
      const colorTokens = parts[0].trim().split(/\s+/);
      
      let alpha = 1;
      if (parts.length > 1) {
        const aStr = parts[1].trim();
        if (aStr.endsWith('%')) {
          alpha = parseFloat(aStr) / 100;
        } else {
          alpha = parseFloat(aStr);
        }
      }

      if (isOklch && colorTokens.length >= 3) {
        let l = parseFloat(colorTokens[0]);
        if (colorTokens[0].endsWith('%') || l > 1) l = l / 100;
        let c = parseFloat(colorTokens[1]);
        let h = parseFloat(colorTokens[2]);
        return oklchToRgb(l, c, h, alpha);
      }

      if (isOklab && colorTokens.length >= 3) {
        let l = parseFloat(colorTokens[0]);
        if (colorTokens[0].endsWith('%') || l > 1) l = l / 100;
        let aLab = parseFloat(colorTokens[1]);
        let bLab = parseFloat(colorTokens[2]);
        return oklabToRgb(l, aLab, bLab, alpha);
      }

      if (isColor && colorTokens.length >= 4) {
        let r = parseFloat(colorTokens[1]);
        if (colorTokens[1].endsWith('%')) r = r / 100;
        let g = parseFloat(colorTokens[2]);
        if (colorTokens[2].endsWith('%')) g = g / 100;
        let b = parseFloat(colorTokens[3]);
        if (colorTokens[3].endsWith('%')) b = b / 100;
        const r255 = Math.round(r * 255);
        const g255 = Math.round(g * 255);
        const b255 = Math.round(b * 255);
        if (alpha < 1) {
          return `rgba(${r255}, ${g255}, ${b255}, ${alpha.toFixed(3)})`;
        }
        return `rgb(${r255}, ${g255}, ${b255})`;
      }
    } catch {
      // fallback
    }

    return 'rgb(18, 21, 36)';
  });
}

export default function App() {
  // --- Auth & User State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const { profile } = await syncUserProfile(user);
          setUserProfile(profile);

          if (profile.role === 'admin' || user.email?.toLowerCase() === 'alibertendless999.ko@gmail.com') {
            const notifs = await fetchAdminNotifications();
            setUnreadAdminCount(notifs.filter(n => !n.read).length);
          }
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- States ---
  const [functions, setFunctions] = useState<FunctionConfig[]>([
    { id: '1', equation: 'x^2', color: '#3b82f6', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: true },
    { id: '2', equation: 'x + 2', color: '#ef4444', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: true },
  ]);

  const [activeTab, setActiveTab] = useState<'Graph' | 'Analysis' | 'Table' | 'Intersections' | 'Transform' | 'Examples' | 'Saved'>('Graph');
  const [commandInput, setCommandInput] = useState('');
  const [editingFunctionId, setEditingFunctionId] = useState<string | null>('1');
  const [intersections, setIntersections] = useState<IntersectionPoint[]>([]);
  const [viewportDomain, setViewportDomain] = useState<[number, number]>([-6, 6]);
  const [viewportRange, setViewportRange] = useState<[number, number]>([-4, 6]);
  const [isExporting, setIsExporting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [cartesianType, setCartesianType] = useState('Cartesian');
  const [gridStyle, setGridStyle] = useState<'Cartesian' | 'Polar' | 'Isometric' | 'Blank'>('Cartesian');
  const [angleUnit, setAngleUnit] = useState<'radians' | 'degrees'>('radians');
  const [decimalPrecision, setDecimalPrecision] = useState<number>(2);
  const [showAxisLabels, setShowAxisLabels] = useState<boolean>(true);
  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [helpActiveTab, setHelpActiveTab] = useState<'syntax' | 'tools' | 'calculus' | 'export'>('syntax');
  const [activeGraphTool, setActiveGraphTool] = useState<'select' | 'pan' | 'zoomIn' | 'zoomOut' | 'fit' | 'center'>('select');
  const [isGridLocked, setIsGridLocked] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(spanToZoomPercent(12));
  // --- Quick Actions & Pins State ---
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
  const [placedPins, setPlacedPins] = useState<{ id: string; x: number; y: number; label: string }[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleQuickAction = (actionId: string) => {
    if (activeQuickAction === actionId) {
      setActiveQuickAction(null);
      return;
    }

    setActiveQuickAction(actionId);

    if (actionId === 'intersect') {
      const visibleFns = functions.filter(f => f.visible);
      if (visibleFns.length >= 2) {
        const pts = findIntersections(visibleFns[0].equation, visibleFns[1].equation, viewportDomain);
        if (pts.length > 0) {
          const xs = pts.map(p => p.x);
          const ys = pts.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const marginX = Math.max((maxX - minX) * 0.6, 3);
          const marginY = Math.max((maxY - minY) * 0.6, 3);

          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          setViewportDomain([centerX - marginX, centerX + marginX]);
          setViewportRange([centerY - marginY, centerY + marginY]);
          showToast(`Found ${pts.length} intersection points`);
        } else {
          showToast('No intersection points in view range');
        }
      } else {
        showToast('Need at least 2 visible functions for intersections');
      }
    } else if (actionId === 'tangent') {
      const targetId = editingFunctionId || functions.find(f => f.visible)?.id;
      if (targetId) {
        setFunctions(prev => prev.map(f => f.id === targetId ? { ...f, showTangent: true, tangentPoint: f.tangentPoint ?? 0 } : f));
        showToast('Tangent Inspector Mode — click curve to move x₀');
      } else {
        showToast('Please add a function to calculate tangents');
      }
    } else if (actionId === 'point') {
      showToast('Point Inspector Active — Click on graph canvas to drop pins');
    } else if (actionId === 'reset') {
      handleResetZoom();
      setPlacedPins([]);
      setActiveQuickAction(null);
      showToast('Graph view & placed pins reset');
    }
  };

  // Transform parameters
  const [transformA, setTransformA] = useState(1);
  const [transformB, setTransformB] = useState(1);
  const [transformC, setTransformC] = useState(0);
  const [transformD, setTransformD] = useState(0);

  // Table parameters
  const [tableMinX, setTableMinX] = useState(-5);
  const [tableMaxX, setTableMaxX] = useState(5);
  const [tableStep, setTableStep] = useState(1);

  // Analysis & Preset state
  const [evalX, setEvalX] = useState<number>(0);
  const [newPresetName, setNewPresetName] = useState<string>('');

  // Saved presets
  const [savedPresets, setSavedPresets] = useState<{ id: string; name: string; funcs: FunctionConfig[] }[]>(() => {
    try {
      const local = localStorage.getItem('graphing_calc_saved_presets');
      if (local) return JSON.parse(local);
    } catch {}
    return [
      {
        id: 'p1',
        name: 'Parabola & Line Intersection',
        funcs: [
          { id: '1', equation: 'x^2', color: '#3b82f6', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: true },
          { id: '2', equation: 'x + 2', color: '#ef4444', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: true },
        ]
      },
      {
        id: 'p2',
        name: 'Trigonometric Resonance',
        funcs: [
          { id: '1', equation: 'sin(x)', color: '#3b82f6', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: false },
          { id: '2', equation: 'cos(x)', color: '#a855f7', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: false },
        ]
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('graphing_calc_saved_presets', JSON.stringify(savedPresets));
    } catch {}
  }, [savedPresets]);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // --- Math Helpers ---
  const evaluateFunction = (expr: string, x: number): number | null => {
    try {
      let scope: Record<string, any> = { x, e: Math.E, pi: Math.PI, PI: Math.PI };
      if (angleUnit === 'degrees') {
        scope = {
          ...scope,
          sin: (val: number) => Math.sin((val * Math.PI) / 180),
          cos: (val: number) => Math.cos((val * Math.PI) / 180),
          tan: (val: number) => Math.tan((val * Math.PI) / 180),
        };
      }
      const result = math.evaluate(expr, scope);
      return typeof result === 'number' && isFinite(result) && !isNaN(result) ? result : null;
    } catch {
      return null;
    }
  };

  const getDerivative = (expr: string, x: number): number | null => {
    try {
      const derivativeExpr = math.derivative(expr, 'x');
      const result = derivativeExpr.evaluate({ x, e: Math.E, pi: Math.PI });
      return typeof result === 'number' && isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };

  // --- Intersection Finder ---
  const findIntersections = (f1: string, f2: string, xRange: [number, number]) => {
    const points: IntersectionPoint[] = [];
    const steps = 300;
    const dx = (xRange[1] - xRange[0]) / steps;
    
    for (let i = 0; i < steps; i++) {
      const x1 = xRange[0] + i * dx;
      const x2 = x1 + dx;
      
      const y1_f1 = evaluateFunction(f1, x1);
      const y1_f2 = evaluateFunction(f2, x1);
      const y2_f1 = evaluateFunction(f1, x2);
      const y2_f2 = evaluateFunction(f2, x2);

      if (y1_f1 !== null && y1_f2 !== null && y2_f1 !== null && y2_f2 !== null) {
        const diff1 = y1_f1 - y1_f2;
        const diff2 = y2_f1 - y2_f2;

        if (diff1 * diff2 <= 0) {
          let low = x1, high = x2;
          for (let j = 0; j < 15; j++) {
            const mid = (low + high) / 2;
            const dMid = (evaluateFunction(f1, mid) || 0) - (evaluateFunction(f2, mid) || 0);
            if (((evaluateFunction(f1, low) || 0) - (evaluateFunction(f2, low) || 0)) * dMid <= 0) {
              high = mid;
            } else {
              low = mid;
            }
          }
          const finalX = (low + high) / 2;
          const finalY = evaluateFunction(f1, finalX);
          if (finalY !== null && !points.some(p => Math.abs(p.x - finalX) < 0.05)) {
            points.push({ x: finalX, y: finalY, label: `P${points.length + 1}` });
          }
        }
      }
    }
    return points;
  };

  const findExtrema = (expr: string, xRange: [number, number]) => {
    const points: { x: number; y: number; type: 'max' | 'min' }[] = [];
    const steps = 400;
    const dx = (xRange[1] - xRange[0]) / steps;
    
    for (let i = 1; i < steps; i++) {
      const xPrev = xRange[0] + (i - 1) * dx;
      const xCurr = xRange[0] + i * dx;
      const xNext = xRange[0] + (i + 1) * dx;
      
      const yPrev = evaluateFunction(expr, xPrev);
      const yCurr = evaluateFunction(expr, xCurr);
      const yNext = evaluateFunction(expr, xNext);

      if (yPrev !== null && yCurr !== null && yNext !== null) {
        if (yCurr > yPrev && yCurr > yNext) {
          points.push({ x: xCurr, y: yCurr, type: 'max' });
        } else if (yCurr < yPrev && yCurr < yNext) {
          points.push({ x: xCurr, y: yCurr, type: 'min' });
        }
      }
    }
    return points;
  };

  const findRoots = (expr: string, xRange: [number, number]) => {
    const roots: number[] = [];
    const steps = 300;
    const dx = (xRange[1] - xRange[0]) / steps;
    for (let i = 0; i < steps; i++) {
      const x1 = xRange[0] + i * dx;
      const x2 = x1 + dx;
      const y1 = evaluateFunction(expr, x1);
      const y2 = evaluateFunction(expr, x2);
      if (y1 !== null && y2 !== null && y1 * y2 <= 0) {
        let low = x1, high = x2;
        for (let j = 0; j < 15; j++) {
          const mid = (low + high) / 2;
          const yMid = evaluateFunction(expr, mid) || 0;
          if ((evaluateFunction(expr, low) || 0) * yMid <= 0) {
            high = mid;
          } else {
            low = mid;
          }
        }
        const rootX = (low + high) / 2;
        if (!roots.some(r => Math.abs(r - rootX) < 0.05)) {
          roots.push(rootX);
        }
      }
    }
    return roots;
  };

  // --- Handlers for Functions Management ---
  const handleAddFunction = () => {
    const nextColor = COLORS[functions.length % COLORS.length];
    const newFn: FunctionConfig = {
      id: Date.now().toString(),
      equation: 'x',
      color: nextColor,
      visible: true,
      style: 'solid',
      strokeWidth: 2.5,
      showDerivative: false,
      showTangent: false,
      tangentPoint: 0,
      showExtrema: false
    };
    setFunctions(prev => [...prev, newFn]);
    setEditingFunctionId(newFn.id);
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    if (editingFunctionId) {
      updateFunction(editingFunctionId, { equation: commandInput.trim() });
    } else {
      const nextColor = COLORS[functions.length % COLORS.length];
      const newFn: FunctionConfig = {
        id: Date.now().toString(),
        equation: commandInput.trim(),
        color: nextColor,
        visible: true,
        style: 'solid',
        strokeWidth: 2.5,
        showDerivative: false,
        showTangent: false,
        tangentPoint: 0,
        showExtrema: false
      };
      setFunctions(prev => [...prev, newFn]);
      setEditingFunctionId(newFn.id);
    }
    setCommandInput('');
  };

  const updateFunction = (id: string, updates: Partial<FunctionConfig>) => {
    setFunctions(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFunction = (id: string) => {
    setFunctions(prev => prev.filter(f => f.id !== id));
    if (editingFunctionId === id) {
      setEditingFunctionId(functions.find(f => f.id !== id)?.id || null);
    }
  };

  const appendSmartInput = (symbol: string) => {
    if (!editingFunctionId) return;
    const targetFn = functions.find(f => f.id === editingFunctionId);
    if (!targetFn) return;
    let newEq = targetFn.equation;
    if (newEq === '0' || newEq === '') {
      newEq = symbol;
    } else {
      newEq += symbol;
    }
    updateFunction(editingFunctionId, { equation: newEq });
  };

  // --- Export Handlers ---
  const applyExportStylesProxy = () => {
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function (elt, pseudoElt) {
      const originalStyle = originalGetComputedStyle.call(window, elt, pseudoElt);
      return new Proxy(originalStyle, {
        get(target, prop) {
          if (prop === 'backdropFilter' || prop === 'WebkitBackdropFilter') {
            return 'none';
          }
          const value = Reflect.get(target, prop);
          if (prop === 'getPropertyValue') {
            return (propertyName: string) => {
              if (propertyName === 'backdrop-filter' || propertyName === '-webkit-backdrop-filter') {
                return 'none';
              }
              const raw = target.getPropertyValue(propertyName);
              return convertCssValueToRgb(raw);
            };
          }
          if (typeof value === 'function') return value.bind(target);
          if (typeof prop === 'string' && typeof value === 'string') {
            return convertCssValueToRgb(value);
          }
          return value;
        }
      });
    };
    return () => {
      window.getComputedStyle = originalGetComputedStyle;
    };
  };

  const [exportHideControls, setExportHideControls] = useState(true);

  const getHtml2CanvasOptions = () => ({
    scale: 2,
    useCORS: true,
    backgroundColor: '#090b17',
    ignoreElements: (element: Element) => {
      if (element.hasAttribute('data-export-hide')) {
        return true;
      }
      return false;
    },
    onclone: (clonedDoc: Document) => {
      // Unconditionally hide all toolbars, panels, buttons, and controls during export
      const hideElements = clonedDoc.querySelectorAll('[data-export-hide="true"]');
      hideElements.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
        }
      });

      // 1. Sanitize all <style> tags in the cloned document
      const styleTags = clonedDoc.querySelectorAll('style');
      styleTags.forEach(tag => {
        if (tag.textContent) {
          let cssText = tag.textContent;
          cssText = cssText.replace(/backdrop-filter\s*:[^;}]+/gi, 'backdrop-filter: none !important');
          cssText = cssText.replace(/-webkit-backdrop-filter\s*:[^;}]+/gi, '-webkit-backdrop-filter: none !important');
          cssText = convertCssValueToRgb(cssText);
          tag.textContent = cssText;
        }
      });

      // 2. Sanitize all elements in clonedDoc
      const allElements = clonedDoc.querySelectorAll('*');
      allElements.forEach((el) => {
        if (el instanceof HTMLElement || el instanceof SVGElement) {
          if (el instanceof HTMLElement) {
            el.style.backdropFilter = 'none';
            (el.style as any).webkitBackdropFilter = 'none';
          }

          const inlineStyle = el.getAttribute('style');
          if (inlineStyle) {
            let newInline = inlineStyle
              .replace(/backdrop-filter\s*:[^;]+/gi, 'backdrop-filter: none')
              .replace(/-webkit-backdrop-filter\s*:[^;]+/gi, '-webkit-backdrop-filter: none');
            newInline = convertCssValueToRgb(newInline);
            el.setAttribute('style', newInline);
          }

          ['fill', 'stroke', 'stop-color', 'color'].forEach(attr => {
            const val = el.getAttribute(attr);
            if (val && (val.includes('oklch') || val.includes('oklab') || val.includes('color('))) {
              el.setAttribute(attr, convertCssValueToRgb(val));
            }
          });
        }
      });
    }
  });

  const exportToPDF = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportMenuOpen(false);

    const restoreStyles = applyExportStylesProxy();

    try {
      const canvas = await html2canvas(containerRef.current, getHtml2CanvasOptions());
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('linecraft-visualization.pdf');
      showToast('Exported PDF successfully');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('PDF export failed');
    } finally {
      restoreStyles();
      setIsExporting(false);
    }
  };

  const exportToPNG = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportMenuOpen(false);

    const restoreStyles = applyExportStylesProxy();

    try {
      const canvas = await html2canvas(containerRef.current, getHtml2CanvasOptions());
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = 'linecraft-graph.png';
      link.click();
      showToast('Exported PNG successfully');
    } catch (err) {
      console.error(err);
      showToast('PNG export failed');
    } finally {
      restoreStyles();
      setIsExporting(false);
    }
  };

  const exportToSVG = () => {
    if (!svgRef.current) return;
    setExportMenuOpen(false);
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'linecraft-vector.svg';
    link.click();
  };

  // --- D3 Rendering Effect ---
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    const margin = { top: 30, right: 30, bottom: 30, left: 30 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // High-contrast Dark Scales
    let xScale = d3.scaleLinear().domain(viewportDomain).range([0, chartWidth]);
    let yScale = d3.scaleLinear().domain(viewportRange).range([chartHeight, 0]);

    // Groups
    const gridGroup = g.append('g').attr('class', 'grid');
    const axisGroup = g.append('g').attr('class', 'axis');
    const graphGroup = g.append('g').attr('class', 'graphs');
    const overlayGroup = g.append('g').attr('class', 'overlay');

    const draw = () => {
      gridGroup.selectAll('*').remove();
      axisGroup.selectAll('*').remove();
      graphGroup.selectAll('*').remove();
      overlayGroup.selectAll('*').remove();

      const xDomain = xScale.domain() as [number, number];
      const yDomain = yScale.domain() as [number, number];

      const xRangeVal = xDomain[1] - xDomain[0];
      const step = xRangeVal > 20 ? 2 : xRangeVal > 10 ? 1 : xRangeVal > 5 ? 0.5 : 0.2;

      const xTicksMajor = d3.range(Math.floor(xDomain[0] / step) * step, Math.ceil(xDomain[1] / step) * step + step, step);
      const yTicksMajor = d3.range(Math.floor(yDomain[0] / step) * step, Math.ceil(yDomain[1] / step) * step + step, step);

      // Theme colors
      const gridStroke = isDarkMode ? '#1e243d' : '#e2e8f0';
      const axisStroke = isDarkMode ? '#64748b' : '#475569';
      const axisTextFill = isDarkMode ? '#94a3b8' : '#334155';

      // --- Draw Grid Lines ---
      if (showGridLines) {
        if (gridStyle === 'Polar') {
          const maxR = Math.max(chartWidth, chartHeight);
          const numRings = 10;
          const originX = xScale(0);
          const originY = yScale(0);

          for (let r = 1; r <= numRings; r++) {
            const radius = (maxR / numRings) * r;
            gridGroup.append('circle')
              .attr('cx', originX).attr('cy', originY)
              .attr('r', radius)
              .attr('fill', 'none')
              .attr('stroke', gridStroke)
              .attr('stroke-width', 0.8)
              .attr('stroke-dasharray', '2,2');
          }

          for (let deg = 0; deg < 360; deg += 30) {
            const rad = (deg * Math.PI) / 180;
            const x2 = originX + Math.cos(rad) * maxR;
            const y2 = originY + Math.sin(rad) * maxR;
            gridGroup.append('line')
              .attr('x1', originX).attr('y1', originY)
              .attr('x2', x2).attr('y2', y2)
              .attr('stroke', gridStroke)
              .attr('stroke-width', 0.8)
              .attr('stroke-dasharray', '2,2');
          }
        } else if (gridStyle === 'Isometric') {
          const stepPx = 40;
          for (let x = -chartHeight; x < chartWidth + chartHeight; x += stepPx) {
            gridGroup.append('line')
              .attr('x1', x).attr('y1', 0)
              .attr('x2', x + chartHeight * 0.577).attr('y2', chartHeight)
              .attr('stroke', gridStroke)
              .attr('stroke-width', 0.8)
              .attr('stroke-dasharray', '2,2');

            gridGroup.append('line')
              .attr('x1', x).attr('y1', chartHeight)
              .attr('x2', x + chartHeight * 0.577).attr('y2', 0)
              .attr('stroke', gridStroke)
              .attr('stroke-width', 0.8)
              .attr('stroke-dasharray', '2,2');
          }
        } else if (gridStyle === 'Cartesian') {
          gridGroup.selectAll('.x-grid')
            .data(xTicksMajor)
            .enter().append('line')
            .attr('class', 'x-grid')
            .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
            .attr('y1', 0).attr('y2', chartHeight)
            .attr('stroke', gridStroke)
            .attr('stroke-width', d => Math.abs(d) < 0.001 ? 0 : 0.8)
            .attr('stroke-dasharray', '2,2');

          gridGroup.selectAll('.y-grid')
            .data(yTicksMajor)
            .enter().append('line')
            .attr('class', 'y-grid')
            .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
            .attr('x1', 0).attr('x2', chartWidth)
            .attr('stroke', gridStroke)
            .attr('stroke-width', d => Math.abs(d) < 0.001 ? 0 : 0.8)
            .attr('stroke-dasharray', '2,2');
        }
      }

      // --- Draw Axes ---
      const originX = xScale(0);
      const originY = yScale(0);

      // X Axis
      if (originY >= 0 && originY <= chartHeight) {
        axisGroup.append('line')
          .attr('x1', 0).attr('x2', chartWidth)
          .attr('y1', originY).attr('y2', originY)
          .attr('stroke', axisStroke)
          .attr('stroke-width', 1.5);

        axisGroup.append('path')
          .attr('d', `M${chartWidth - 6},${originY - 4} L${chartWidth},${originY} L${chartWidth - 6},${originY + 4}`)
          .attr('fill', 'none')
          .attr('stroke', axisStroke)
          .attr('stroke-width', 1.5);

        if (showAxisLabels) {
          axisGroup.append('text')
            .attr('x', chartWidth + 10)
            .attr('y', originY + 4)
            .attr('fill', axisTextFill)
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text('x');
        }
      }

      // Y Axis
      if (originX >= 0 && originX <= chartWidth) {
        axisGroup.append('line')
          .attr('x1', originX).attr('x2', originX)
          .attr('y1', 0).attr('y2', chartHeight)
          .attr('stroke', axisStroke)
          .attr('stroke-width', 1.5);

        axisGroup.append('path')
          .attr('d', `M${originX - 4},6 L${originX},0 L${originX + 4},6`)
          .attr('fill', 'none')
          .attr('stroke', axisStroke)
          .attr('stroke-width', 1.5);

        if (showAxisLabels) {
          axisGroup.append('text')
            .attr('x', originX + 10)
            .attr('y', 10)
            .attr('fill', axisTextFill)
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text('y');
        }
      }

      // Axis Ticks & Labels
      if (showAxisLabels) {
        axisGroup.selectAll('.x-tick-label')
          .data(xTicksMajor.filter(d => Math.abs(d) > 0.001))
          .enter().append('text')
          .attr('class', 'x-tick-label')
          .attr('x', d => xScale(d))
          .attr('y', Math.min(Math.max(originY + 16, 16), chartHeight - 6))
          .attr('text-anchor', 'middle')
          .attr('fill', axisTextFill)
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
          .text(d => Number.isInteger(d) ? d : d.toFixed(decimalPrecision));

        axisGroup.selectAll('.y-tick-label')
          .data(yTicksMajor.filter(d => Math.abs(d) > 0.001))
          .enter().append('text')
          .attr('class', 'y-tick-label')
          .attr('x', Math.min(Math.max(originX - 10, 20), chartWidth - 10))
          .attr('y', d => yScale(d) + 3)
          .attr('text-anchor', 'end')
          .attr('fill', axisTextFill)
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
          .text(d => Number.isInteger(d) ? d : d.toFixed(decimalPrecision));
      }

      // --- Plot Glowing Function Curves ---
      functions.filter(f => f.visible).forEach(f => {
        let points: [number, number][] = [];
        const samples = 1200;
        const startX = Math.max(-100, xDomain[0]);
        const endX = Math.min(100, xDomain[1]);

        if (startX < endX) {
          const dx = (endX - startX) / samples;

          for (let i = 0; i <= samples; i++) {
            const x = startX + i * dx;
            const y = evaluateFunction(f.equation, x);
            if (y !== null && !isNaN(y) && isFinite(y) && y >= -100 && y <= 100) {
              points.push([xScale(x), yScale(y)]);
            } else {
              if (points.length > 0) {
                renderPath(points, f.color, f.style, f.strokeWidth);
                points = [];
              }
            }
          }
          if (points.length > 0) {
            renderPath(points, f.color, f.style, f.strokeWidth);
          }
        }

        // Tangent Line
        if (f.showTangent) {
          const x0 = f.tangentPoint;
          const y0 = evaluateFunction(f.equation, x0);
          const m = getDerivative(f.equation, x0);
          if (y0 !== null && m !== null) {
            const tangentLine = (x: number) => m * (x - x0) + y0;
            const tPoints: [number, number][] = [
              [xScale(xDomain[0]), yScale(tangentLine(xDomain[0]))],
              [xScale(xDomain[1]), yScale(tangentLine(xDomain[1]))]
            ];
            graphGroup.append('path')
              .datum(tPoints)
              .attr('fill', 'none')
              .attr('stroke', '#f59e0b')
              .attr('stroke-width', 1.5)
              .attr('stroke-dasharray', '4,4')
              .attr('d', d3.line());
            
            overlayGroup.append('circle')
              .attr('cx', xScale(x0)).attr('cy', yScale(y0))
              .attr('r', 4).attr('fill', '#f59e0b').attr('class', 'glow-amber');
          }
        }

        // Extrema
        if (f.showExtrema) {
          const extrema = findExtrema(f.equation, xDomain);
          extrema.forEach(p => {
            overlayGroup.append('circle')
              .attr('cx', xScale(p.x)).attr('cy', yScale(p.y))
              .attr('r', 4.5)
              .attr('fill', '#a855f7')
              .attr('stroke', '#ffffff')
              .attr('stroke-width', 1.5)
              .attr('class', 'glow-purple');
          });
        }
      });

      // --- Intersections Detection & Glowing Callout Badges ---
      const activeFunctions = functions.filter(f => f.visible);
      if (activeFunctions.length >= 2) {
        const pts = findIntersections(activeFunctions[0].equation, activeFunctions[1].equation, xDomain);
        setIntersections(pts);

        pts.forEach((p, idx) => {
          const cx = xScale(p.x);
          const cy = yScale(p.y);

          if (cx >= 0 && cx <= chartWidth && cy >= 0 && cy <= chartHeight) {
            // Outer glowing purple ring
            overlayGroup.append('circle')
              .attr('cx', cx).attr('cy', cy)
              .attr('r', 7)
              .attr('fill', 'rgba(168, 85, 247, 0.25)')
              .attr('stroke', '#a855f7')
              .attr('stroke-width', 2)
              .attr('class', 'glow-purple');

            // Inner white dot
            overlayGroup.append('circle')
              .attr('cx', cx).attr('cy', cy)
              .attr('r', 3)
              .attr('fill', '#ffffff');

            // Floating dark callout badge (e.g. P1 (-1, 1))
            const labelText = `P${idx + 1} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`;
            const badgeG = overlayGroup.append('g')
              .attr('transform', `translate(${cx + 12}, ${cy - 12})`);

            badgeG.append('rect')
              .attr('x', 0)
              .attr('y', -14)
              .attr('width', labelText.length * 6.8 + 14)
              .attr('height', 22)
              .attr('rx', 6)
              .attr('fill', '#1a1d33')
              .attr('stroke', '#8b5cf6')
              .attr('stroke-width', 1)
              .attr('opacity', 0.95);

            badgeG.append('text')
              .attr('x', 7)
              .attr('y', 0)
              .attr('fill', '#f1f5f9')
              .attr('font-size', '10px')
              .attr('font-family', 'monospace')
              .attr('font-weight', 'bold')
              .text(labelText);
          }
        });
      } else {
        setIntersections([]);
      }

      // --- Render Placed Pins ---
      placedPins.forEach((pin) => {
        const cx = xScale(pin.x);
        const cy = yScale(pin.y);

        if (cx >= 0 && cx <= chartWidth && cy >= 0 && cy <= chartHeight) {
          overlayGroup.append('circle')
            .attr('cx', cx).attr('cy', cy)
            .attr('r', 8)
            .attr('fill', 'rgba(59, 130, 246, 0.35)')
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 2);

          overlayGroup.append('circle')
            .attr('cx', cx).attr('cy', cy)
            .attr('r', 3.5)
            .attr('fill', '#ffffff');

          const labelText = `${pin.label}: (${pin.x.toFixed(2)}, ${pin.y.toFixed(2)})`;
          const badgeG = overlayGroup.append('g')
            .attr('transform', `translate(${cx + 12}, ${cy - 12})`);

          badgeG.append('rect')
            .attr('x', 0)
            .attr('y', -14)
            .attr('width', labelText.length * 6.5 + 14)
            .attr('height', 22)
            .attr('rx', 6)
            .attr('fill', '#0f172a')
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 1)
            .attr('opacity', 0.95);

          badgeG.append('text')
            .attr('x', 7)
            .attr('y', 0)
            .attr('fill', '#38bdf8')
            .attr('font-size', '10px')
            .attr('font-family', 'monospace')
            .attr('font-weight', 'bold')
            .text(labelText);
        }
      });
    };

    const renderPath = (points: [number, number][], color: string, style: 'solid' | 'dashed', width: number) => {
      const line = d3.line()
        .x(d => d[0])
        .y(d => d[1]);

      const glowClass = color === '#3b82f6' ? 'glow-blue' : color === '#ef4444' ? 'glow-red' : 'glow-purple';

      graphGroup.append('path')
        .datum(points)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', width)
        .attr('stroke-dasharray', style === 'dashed' ? '6,6' : 'none')
        .attr('class', glowClass)
        .attr('d', line);
    };

    // --- Zooming ---
    let zoomTimeout: any;
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.06, 60])
      .translateExtent([[xScale(-100), yScale(100)], [xScale(100), yScale(-100)]])
      .on('zoom', (event) => {
        if (isGridLocked) return;
        const currentX = event.transform.rescaleX(xScale);
        const currentY = event.transform.rescaleY(yScale);

        const clampedX = clampBounds(currentX.domain() as [number, number], -100, 100);
        const clampedY = clampBounds(currentY.domain() as [number, number], -100, 100);

        setZoomPercent(spanToZoomPercent(clampedX[1] - clampedX[0]));

        clearTimeout(zoomTimeout);
        zoomTimeout = setTimeout(() => {
          setViewportDomain(clampedX);
          setViewportRange(clampedY);
        }, 80);

        const oldX = xScale;
        const oldY = yScale;
        xScale = d3.scaleLinear().domain(clampedX).range([0, chartWidth]);
        yScale = d3.scaleLinear().domain(clampedY).range([chartHeight, 0]);
        draw();
        xScale = oldX;
        yScale = oldY;
      });

    svg.call(zoom);
    draw();

    // --- Crosshair Tool ---
    const crosshairG = g.append('g')
      .attr('class', 'crosshair-tool')
      .style('display', 'none')
      .style('pointer-events', 'none');

    const xLine = crosshairG.append('line')
      .attr('stroke', '#475569')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    const yLine = crosshairG.append('line')
      .attr('stroke', '#475569')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    const trackerDot = crosshairG.append('circle')
      .attr('r', 4)
      .attr('fill', '#a855f7')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .attr('class', 'glow-purple');

    const tooltipBg = crosshairG.append('rect')
      .attr('fill', '#111425')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 1)
      .attr('rx', 6)
      .attr('opacity', 0.95);

    const tooltipText = crosshairG.append('text')
      .attr('fill', '#ffffff')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold');

    svg.on('pointermove mousemove', (event) => {
      const [mouseX, mouseY] = d3.pointer(event, g.node());

      if (mouseX >= 0 && mouseX <= chartWidth && mouseY >= 0 && mouseY <= chartHeight) {
        const svgElement = svg.node() as SVGSVGElement | null;
        if (!svgElement) return;

        const transform = d3.zoomTransform(svgElement);
        const currentX = transform.rescaleX(xScale);
        const currentY = transform.rescaleY(yScale);

        const xVal = currentX.invert(mouseX);
        const yVal = currentY.invert(mouseY);

        crosshairG.style('display', null);

        xLine
          .attr('x1', mouseX).attr('x2', mouseX)
          .attr('y1', 0).attr('y2', chartHeight);

        yLine
          .attr('x1', 0).attr('x2', chartWidth)
          .attr('y1', mouseY).attr('y2', mouseY);

        trackerDot
          .attr('cx', mouseX).attr('cy', mouseY);

        tooltipText.text(`(${xVal.toFixed(2)}, ${yVal.toFixed(2)})`);

        const textNode = tooltipText.node() as SVGTextElement | null;
        if (textNode) {
          const bbox = textNode.getBBox();
          const padding = 6;
          let tooltipX = mouseX + 12;
          if (tooltipX + bbox.width + padding * 2 > chartWidth) {
            tooltipX = mouseX - bbox.width - padding * 2 - 12;
          }
          let tooltipY = mouseY - 12 - bbox.height;
          if (tooltipY < 0) {
            tooltipY = mouseY + 15;
          }

          tooltipBg
            .attr('x', tooltipX)
            .attr('y', tooltipY)
            .attr('width', bbox.width + padding * 2)
            .attr('height', bbox.height + padding * 2);

          tooltipText
            .attr('x', tooltipX + padding)
            .attr('y', tooltipY + padding + bbox.height - 2);
        }
      } else {
        crosshairG.style('display', 'none');
      }
    });

    svg.on('pointerleave mouseleave', () => {
      crosshairG.style('display', 'none');
    });

    // SVG Canvas Click Handler for Quick Actions
    svg.on('click', (event) => {
      const [mouseX, mouseY] = d3.pointer(event, g.node());
      if (mouseX >= 0 && mouseX <= chartWidth && mouseY >= 0 && mouseY <= chartHeight) {
        const svgElement = svg.node() as SVGSVGElement | null;
        if (!svgElement) return;

        const transform = d3.zoomTransform(svgElement);
        const currentX = transform.rescaleX(xScale);
        const currentY = transform.rescaleY(yScale);

        const xVal = currentX.invert(mouseX);
        const yVal = currentY.invert(mouseY);

        if (activeGraphTool === 'zoomIn') {
          handleZoomAtPoint(xVal, yVal, 1.35);
        } else if (activeGraphTool === 'zoomOut') {
          handleZoomAtPoint(xVal, yVal, 0.75);
        } else if (activeQuickAction === 'point') {
          const activeFn = functions.find(f => f.id === editingFunctionId) || functions.find(f => f.visible);
          const evalY = activeFn ? evaluateFunction(activeFn.equation, xVal) : null;
          const finalY = evalY !== null ? evalY : yVal;

          setPlacedPins(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              x: Math.round(xVal * 100) / 100,
              y: Math.round(finalY * 100) / 100,
              label: `P${prev.length + 1}`
            }
          ]);
        } else if (activeQuickAction === 'tangent') {
          const targetId = editingFunctionId || functions.find(f => f.visible)?.id;
          if (targetId) {
            setFunctions(prev => prev.map(f => f.id === targetId ? {
              ...f,
              showTangent: true,
              tangentPoint: Math.round(xVal * 10) / 10
            } : f));
          }
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      draw();
    });
    resizeObserver.observe(svgRef.current);

    return () => resizeObserver.disconnect();
  }, [functions, viewportDomain, viewportRange, isGridLocked, placedPins, activeQuickAction, editingFunctionId, activeGraphTool, isDarkMode, gridStyle, showGridLines, showAxisLabels, decimalPrecision, angleUnit]);

  // --- Zoom Controls ---
  const handleContinuousZoom = (targetZoomPercent: number) => {
    const safeTargetZoom = Math.max(0, Math.min(100, targetZoomPercent));
    const newSpanX = zoomPercentToSpan(safeTargetZoom);

    const currentCenterX = (viewportDomain[0] + viewportDomain[1]) / 2;
    const currentCenterY = (viewportRange[0] + viewportRange[1]) / 2;
    const currentSpanX = viewportDomain[1] - viewportDomain[0];
    const currentSpanY = viewportRange[1] - viewportRange[0];
    const aspectRatio = currentSpanX > 0 ? currentSpanY / currentSpanX : 10 / 12;

    const newSpanY = newSpanX * aspectRatio;

    const clampedX = clampBounds([currentCenterX - newSpanX / 2, currentCenterX + newSpanX / 2], -100, 100);
    const clampedY = clampBounds([currentCenterY - newSpanY / 2, currentCenterY + newSpanY / 2], -100, 100);

    setViewportDomain(clampedX);
    setViewportRange(clampedY);
    setZoomPercent(Math.round(safeTargetZoom));
  };

  const handleZoomAtPoint = (centerX: number, centerY: number, factor: number) => {
    const currentSpanX = viewportDomain[1] - viewportDomain[0];
    const currentSpanY = viewportRange[1] - viewportRange[0];
    const newSpanX = currentSpanX / factor;
    const newSpanY = currentSpanY / factor;

    const clampedX = clampBounds([centerX - newSpanX / 2, centerX + newSpanX / 2], -100, 100);
    const clampedY = clampBounds([centerY - newSpanY / 2, centerY + newSpanY / 2], -100, 100);

    setViewportDomain(clampedX);
    setViewportRange(clampedY);
    setZoomPercent(spanToZoomPercent(clampedX[1] - clampedX[0]));
  };

  const handleZoom = (factor: number) => {
    const cx = (viewportDomain[0] + viewportDomain[1]) / 2;
    const cy = (viewportRange[0] + viewportRange[1]) / 2;
    handleZoomAtPoint(cx, cy, factor);
  };

  const handleResetZoom = () => {
    setViewportDomain([-6, 6]);
    setViewportRange([-4, 6]);
    setZoomPercent(spanToZoomPercent(12));
    setActiveQuickAction(null);
    setPlacedPins([]);
  };

  // --- Auth Guards ---
  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-[#090b17] flex flex-col items-center justify-center p-4 text-slate-100 select-none">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center p-2.5 shadow-lg shadow-indigo-500/20 mb-4 animate-bounce">
          <img src="icon.svg" alt="Linecraft" className="w-full h-full object-contain" />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
          <Loader2 size={16} className="animate-spin text-indigo-400" />
          <span>Initializing Linecraft Environment...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage onSuccess={() => {}} />;
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans select-none ${isDarkMode ? 'bg-[#090b17] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* --- TOP NAVBAR --- */}
      <header className={`h-16 px-5 flex items-center justify-between shrink-0 z-30 shadow-md transition-colors duration-200 ${
        isDarkMode ? 'bg-[#0f1222] border-b border-slate-800/80 text-slate-100' : 'bg-white border-b border-slate-200 text-slate-800 shadow-sm'
      }`}>
        {/* Brand */}
        <div className="flex items-center gap-3">
          <AppLogo size={22} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
                linecraft
              </h1>
            </div>
            <div className="flex flex-col">
              <p className={`text-[11px] font-medium tracking-wide ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                advanced function visualizer created by ALI AMINI
              </p>
              <a 
                href="mailto:alibertendless999.ko@gmail.com"
                className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold hover:underline transition-colors mt-0.5 ${
                  isDarkMode ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-700'
                }`}
              >
                <Mail size={14} className="shrink-0" />
                <span>alibertendless999.ko@gmail.com</span>
              </a>
            </div>
          </div>
        </div>

        {/* Center Search / Command Input Bar */}
        <form onSubmit={handleCommandSubmit} className="flex-1 max-w-xl mx-8 relative">
          <div className="relative flex items-center">
            <Search size={15} className={`absolute left-3.5 pointer-events-none ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />
            <input 
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Type a function, e.g. sin(x), x^2 + 2x, ln(x)"
              className={`w-full border rounded-xl pl-10 pr-20 py-2 text-xs font-mono outline-none transition-all shadow-inner ${
                isDarkMode 
                  ? 'bg-[#161a2e] border-slate-700/60 focus:border-indigo-500/80 text-slate-100 placeholder-slate-500' 
                  : 'bg-slate-100 border-slate-300 focus:border-indigo-500 text-slate-900 placeholder-slate-400'
              }`}
            />
            <button 
              type="submit"
              className="absolute right-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-1"
            >
              Enter
            </button>
          </div>
        </form>

        {/* Right Top Bar Actions */}
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => {
              const nextMode = !isDarkMode;
              setIsDarkMode(nextMode);
              showToast(nextMode ? "Night Mode Activated" : "Day Mode Activated");
            }}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
            title={isDarkMode ? "Switch to Day Mode" : "Switch to Night Mode"}
          >
            {isDarkMode ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-indigo-600" />}
          </button>

          <button 
            onClick={() => setIsHelpOpen(true)}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
            title="Help & Guides"
          >
            <HelpCircle size={17} />
          </button>

          <button 
            onClick={() => setIsSettingsOpen(true)}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
            title="Settings & Preferences"
          >
            <Settings size={17} />
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={isExporting}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
            >
              <Download size={14} />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              <ChevronRight size={14} className={`transition-transform duration-200 ${exportMenuOpen ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {exportMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className={`absolute right-0 mt-2 w-48 border rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 ${
                    isDarkMode ? 'bg-[#161a2e] border-slate-700/80 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-xl'
                  }`}
                >
                  <button 
                    onClick={exportToPDF} 
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors w-full text-left font-medium ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <FileText size={14} className="text-red-400" />
                    Export as PDF
                  </button>
                  <button 
                    onClick={exportToPNG} 
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors w-full text-left font-medium ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ImageIcon size={14} className="text-blue-400" />
                    Export as PNG
                  </button>
                  <button 
                    onClick={exportToSVG} 
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors w-full text-left font-medium ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Layers size={14} className="text-purple-400" />
                    Export as SVG
                  </button>

                  <div className={`border-t my-1 pt-1.5 px-2 ${isDarkMode ? 'border-slate-700/60' : 'border-slate-200'}`}>
                    <label className={`flex items-center gap-2 text-[11px] cursor-pointer select-none ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <input 
                        type="checkbox"
                        checked={exportHideControls}
                        onChange={(e) => setExportHideControls(e.target.checked)}
                        className="rounded border-slate-400 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Hide toolbars in export</span>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Admin Console Button (for Developer / Admin) */}
          {(userProfile?.role === 'admin' || currentUser?.email?.toLowerCase() === 'alibertendless999.ko@gmail.com') && (
            <button
              onClick={() => setIsAdminPanelOpen(true)}
              className="relative flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              title="Open Admin Console"
            >
              <ShieldCheck size={14} className="text-amber-400" />
              <span className="hidden md:inline">Admin Console</span>
              {unreadAdminCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute -top-1 -right-1" />
              )}
            </button>
          )}

          {/* User Profile & Sign Out Badge */}
          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs ${
            isDarkMode ? 'bg-[#161a2e] border-slate-700/80 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}>
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
              {currentUser?.displayName ? currentUser.displayName.charAt(0) : currentUser?.email ? currentUser.email.charAt(0) : 'U'}
            </div>
            <div className="hidden lg:flex flex-col text-left leading-tight max-w-[120px] truncate">
              <span className="font-semibold text-[11px] truncate">{currentUser?.displayName || 'User'}</span>
              <span className="text-[9px] text-slate-400 truncate">{currentUser?.email}</span>
            </div>
            <button
              onClick={async () => {
                await logOut();
                showToast("Signed out successfully");
              }}
              className="p-1 hover:text-red-400 text-slate-400 transition-colors ml-1"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN BODY CONTAINER --- */}
      <div className="flex-1 flex overflow-hidden">

        {/* --- LEFT NAVIGATION RAIL --- */}
        <nav className={`w-16 border-r flex flex-col items-center py-4 justify-between shrink-0 z-20 transition-colors duration-200 ${
          isDarkMode ? 'bg-[#0c0e1a] border-slate-800/80' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex flex-col items-center gap-2 w-full px-2">
            {[
              { id: 'Graph', label: 'Graph', icon: LineChart },
              { id: 'Analysis', label: 'Analysis', icon: Activity },
              { id: 'Table', label: 'Table', icon: Table },
              { id: 'Intersections', label: 'Intersections', icon: GitCommit },
              { id: 'Transform', label: 'Transform', icon: Sliders },
              { id: 'Examples', label: 'Examples', icon: BookOpen },
              { id: 'Saved', label: 'Saved', icon: Bookmark },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsSidebarOpen(true);
                  }}
                  className={`w-full py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all relative group ${
                    isActive 
                      ? 'bg-gradient-to-br from-indigo-600/30 to-purple-600/20 text-indigo-400 border border-indigo-500/30 shadow-md shadow-indigo-500/10' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  title={tab.label}
                >
                  <Icon size={18} />
                  <span className="text-[9px] font-medium tracking-tight">{tab.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeRailIndicator" 
                      className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-500 rounded-r-full"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Rail User Profile */}
          <div className="flex flex-col items-center gap-3 w-full px-2 pt-4 border-t border-slate-800/60">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-indigo-500/20">
              VA
            </div>
            <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-widest">Pro</span>
          </div>
        </nav>

        {/* --- SECONDARY FUNCTIONS & ANALYSIS SIDEBAR --- */}
        <motion.aside
          initial={{ width: 320 }}
          animate={{ width: isSidebarOpen ? 320 : 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="bg-[#0f1222] border-r border-slate-800/80 overflow-hidden flex flex-col shrink-0 z-10 shadow-xl"
        >
          <div className="w-[320px] p-4 h-full flex flex-col gap-4 overflow-y-auto">

            {/* --- SIDEBAR ACTIVE TAB HEADER --- */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                {activeTab === 'Graph' && <LineChart size={16} className="text-indigo-400" />}
                {activeTab === 'Analysis' && <Activity size={16} className="text-purple-400" />}
                {activeTab === 'Table' && <Table size={16} className="text-blue-400" />}
                {activeTab === 'Intersections' && <GitCommit size={16} className="text-pink-400" />}
                {activeTab === 'Transform' && <Sliders size={16} className="text-amber-400" />}
                {activeTab === 'Examples' && <BookOpen size={16} className="text-emerald-400" />}
                {activeTab === 'Saved' && <Bookmark size={16} className="text-cyan-400" />}
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  {activeTab === 'Graph' && 'Function Equations'}
                  {activeTab === 'Analysis' && 'Calculus Analysis'}
                  {activeTab === 'Table' && 'Values Table'}
                  {activeTab === 'Intersections' && 'Curve Intersections'}
                  {activeTab === 'Transform' && 'Transformations'}
                  {activeTab === 'Examples' && 'Math Examples'}
                  {activeTab === 'Saved' && 'Saved Presets'}
                </h2>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                {activeTab}
              </span>
            </div>

            {/* --- TAB 1: GRAPH (FUNCTIONS LIST) --- */}
            {activeTab === 'Graph' && (
              <>
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold text-slate-400">Active Curves</span>
                    <button 
                      onClick={handleAddFunction}
                      className="flex items-center gap-1 text-[11px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg transition-all active:scale-95"
                    >
                      <Plus size={13} />
                      <span>Add Function</span>
                    </button>
                  </div>

                  {/* Function Cards */}
                  <div className="space-y-3">
                    {functions.map((f, idx) => {
                      const isSelected = editingFunctionId === f.id;
                      return (
                        <div 
                          key={f.id} 
                          onClick={() => setEditingFunctionId(f.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-[#161a2e] border-indigo-500/50 shadow-md shadow-indigo-500/10' 
                              : 'bg-[#121524] border-slate-800/80 hover:border-slate-700/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <input 
                                type="color" 
                                value={f.color}
                                onChange={(e) => updateFunction(f.id, { color: e.target.value })}
                                className="w-4 h-4 rounded-full border-0 cursor-pointer bg-transparent p-0 shrink-0"
                                title="Change Color"
                              />
                              <span className="font-mono text-xs font-bold text-indigo-400 shrink-0">
                                {idx === 0 ? 'f(x)' : idx === 1 ? 'g(x)' : `f${idx + 1}(x)`} =
                              </span>
                              <input 
                                type="text"
                                value={f.equation}
                                onChange={(e) => updateFunction(f.id, { equation: e.target.value })}
                                onFocus={() => setEditingFunctionId(f.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-[#0c0e1a] border border-slate-700/80 focus:border-indigo-500 rounded-lg px-2 py-1 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
                                placeholder="e.g. 2*x^2 + 3"
                              />
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateFunction(f.id, { visible: !f.visible }); }}
                                className={`p-1 rounded hover:bg-slate-800 transition-colors ${f.visible ? 'text-indigo-400' : 'text-slate-600'}`}
                                title="Toggle Visibility"
                              >
                                {f.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                              </button>
                              
                              <button 
                                onClick={(e) => { e.stopPropagation(); removeFunction(f.id); }}
                                className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                title="Delete Function"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {isSelected && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="pt-2.5 mt-2.5 border-t border-slate-800/80 space-y-2.5 text-[11px]"
                            >
                              <div className="space-y-1">
                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Quick Math Palette</span>
                                <div className="grid grid-cols-6 gap-1 font-mono text-[10px]">
                                  {[
                                    { label: 'x', insert: 'x' },
                                    { label: '+', insert: '+' },
                                    { label: '-', insert: '-' },
                                    { label: '*', insert: '*' },
                                    { label: '/', insert: '/' },
                                    { label: 'x²', insert: '^2' },
                                    { label: 'x³', insert: '^3' },
                                    { label: 'xⁿ', insert: '^' },
                                    { label: '√x', insert: 'sqrt(x)' },
                                    { label: '|x|', insert: 'abs(x)' },
                                    { label: 'sin', insert: 'sin(x)' },
                                    { label: 'cos', insert: 'cos(x)' },
                                    { label: 'tan', insert: 'tan(x)' },
                                    { label: 'log', insert: 'log(x)' },
                                    { label: 'ln', insert: 'ln(x)' },
                                    { label: '(', insert: '(' },
                                    { label: ')', insert: ')' },
                                    { label: 'e', insert: 'e' },
                                  ].map((btn) => (
                                    <button
                                      key={btn.label}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        appendSmartInput(btn.insert);
                                      }}
                                      className="bg-[#0c0e1a] hover:bg-indigo-600/30 text-indigo-300 border border-slate-800 hover:border-indigo-500/50 rounded py-1 font-bold transition-all text-center"
                                    >
                                      {btn.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                                <span className="text-slate-400">Style</span>
                                <select 
                                  value={f.style}
                                  onChange={(e) => updateFunction(f.id, { style: e.target.value as any })}
                                  className="bg-[#0c0e1a] border border-slate-700/80 rounded px-2 py-0.5 font-sans text-[11px] text-slate-200"
                                >
                                  <option value="solid">Solid</option>
                                  <option value="dashed">Dashed</option>
                                </select>

                                <span className="text-slate-400 ml-2">Width</span>
                                <input 
                                  type="number"
                                  step="0.5"
                                  min="1"
                                  max="6"
                                  value={f.strokeWidth}
                                  onChange={(e) => updateFunction(f.id, { strokeWidth: parseFloat(e.target.value) || 2.5 })}
                                  className="w-12 bg-[#0c0e1a] border border-slate-700/80 rounded px-1.5 py-0.5 text-slate-200 font-mono text-[11px]"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5 pt-1">
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={f.showTangent}
                                    onChange={(e) => updateFunction(f.id, { showTangent: e.target.checked })}
                                    className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
                                  />
                                  Show tangent line
                                </label>

                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={f.showExtrema}
                                    onChange={(e) => updateFunction(f.id, { showExtrema: e.target.checked })}
                                    className="rounded border-slate-700 bg-slate-900 text-purple-500 focus:ring-0"
                                  />
                                  Show extremum points
                                </label>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="pt-2 border-t border-slate-800/80">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5 flex items-center justify-between">
                    <span>Quick Actions</span>
                    {activeQuickAction && (
                      <span className="text-[9px] text-indigo-400 font-semibold lowercase bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/30">
                        {activeQuickAction} active
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'intersect', label: 'Intersect', icon: GitCommit, color: 'text-purple-400' },
                      { id: 'tangent', label: 'Tangent', icon: Activity, color: 'text-amber-400' },
                      { id: 'point', label: 'Point', icon: Crosshair, color: 'text-blue-400' },
                      { id: 'reset', label: 'Reset', icon: RotateCcw, color: 'text-slate-400' },
                    ].map(action => {
                      const Icon = action.icon;
                      const isActive = activeQuickAction === action.id;
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action.id)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all relative ${
                            isActive 
                              ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-500/20' 
                              : 'bg-[#121524] border-slate-800/80 hover:bg-slate-800/60 text-slate-300 hover:text-white'
                          }`}
                          title={`Activate ${action.label} Quick Action`}
                        >
                          <Icon size={14} className={isActive ? 'text-indigo-300' : action.color} />
                          <span className="text-[9px] font-medium">{action.label}</span>
                          {isActive && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-[#0f1222] animate-pulse" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

            {/* --- TAB 2: ANALYSIS --- */}
            {activeTab === 'Analysis' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Active Function</label>
                  <select 
                    value={editingFunctionId || functions[0]?.id}
                    onChange={(e) => setEditingFunctionId(e.target.value)}
                    className="w-full bg-[#121524] border border-slate-700/80 text-xs text-indigo-300 font-mono rounded-lg p-2 outline-none"
                  >
                    {functions.map((f, i) => (
                      <option key={f.id} value={f.id}>
                        {i === 0 ? 'f(x)' : i === 1 ? 'g(x)' : `f${i+1}(x)`} = {f.equation}
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const activeFn = functions.find(f => f.id === editingFunctionId) || functions[0];
                  if (!activeFn) return <p className="text-xs text-slate-500">No active function selected.</p>;

                  const yInt = evaluateFunction(activeFn.equation, 0);
                  const roots = findRoots(activeFn.equation, [-20, 20]);
                  const extrema = findExtrema(activeFn.equation, [-20, 20]);
                  const evalY = evaluateFunction(activeFn.equation, evalX);
                  const slope = getDerivative(activeFn.equation, evalX);

                  return (
                    <div className="space-y-4 text-xs font-mono">
                      {/* Overview Card */}
                      <div className="bg-[#121524] p-3 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                          <span className="text-indigo-400 font-bold">f(x) = {activeFn.equation}</span>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeFn.color }} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase">Y-Intercept</span>
                            <span className="text-slate-200 font-bold">
                              {yInt !== null ? `(0, ${yInt.toFixed(2)})` : 'Undefined'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase">Roots Found</span>
                            <span className="text-emerald-400 font-bold">{roots.length}</span>
                          </div>
                        </div>
                      </div>

                      {/* Calculated Roots */}
                      <div className="bg-[#121524] p-3 rounded-xl border border-slate-800 space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Calculated Roots (x-intercepts)</span>
                          <span className="text-emerald-400 text-[9px]">{roots.length} found</span>
                        </h4>
                        {roots.length > 0 ? (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {roots.map((r, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-[#0c0e1a] p-2 rounded-lg border border-slate-800 text-[11px]">
                                <span className="text-slate-300">x = {r.toFixed(3)}</span>
                                <button 
                                  onClick={() => {
                                    setViewportDomain([r - 4, r + 4]);
                                    setViewportRange([-3, 3]);
                                    showToast(`Focused on root x = ${r.toFixed(2)}`);
                                  }}
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-sans flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20"
                                >
                                  <Focus size={10} /> Focus
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">No real roots detected in [-20, 20]</p>
                        )}
                      </div>

                      {/* Calculated Extrema */}
                      <div className="bg-[#121524] p-3 rounded-xl border border-slate-800 space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Extrema Points (Min/Max)</h4>
                        {extrema.length > 0 ? (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {extrema.map((ex, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-[#0c0e1a] p-2 rounded-lg border border-slate-800 text-[11px]">
                                <div>
                                  <span className={`text-[9px] uppercase px-1 py-0.5 rounded mr-1.5 ${ex.type === 'min' ? 'bg-amber-500/20 text-amber-300' : 'bg-purple-500/20 text-purple-300'}`}>
                                    {ex.type}
                                  </span>
                                  <span className="text-slate-300">({ex.x.toFixed(2)}, {ex.y.toFixed(2)})</span>
                                </div>
                                <button 
                                  onClick={() => {
                                    setViewportDomain([ex.x - 4, ex.x + 4]);
                                    setViewportRange([ex.y - 4, ex.y + 4]);
                                    showToast(`Focused on ${ex.type} at (${ex.x.toFixed(1)}, ${ex.y.toFixed(1)})`);
                                  }}
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-sans flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20"
                                >
                                  <Focus size={10} /> Focus
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">No local extrema detected in [-20, 20]</p>
                        )}
                      </div>

                      {/* Derivative & Tangent Evaluator */}
                      <div className="bg-[#121524] p-3 rounded-xl border border-slate-800 space-y-2.5">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Derivative & Tangent Inspector</h4>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">x₀ =</span>
                          <input 
                            type="number"
                            step="0.5"
                            value={evalX}
                            onChange={(e) => setEvalX(parseFloat(e.target.value) || 0)}
                            className="w-16 bg-[#0c0e1a] border border-slate-700/80 text-indigo-300 p-1 rounded text-[11px]"
                          />
                          <input 
                            type="range"
                            min="-10"
                            max="10"
                            step="0.1"
                            value={evalX}
                            onChange={(e) => setEvalX(parseFloat(e.target.value))}
                            className="flex-1 accent-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 text-[11px] pt-1 border-t border-slate-800">
                          <div className="flex justify-between text-slate-300">
                            <span>f({evalX.toFixed(1)}) =</span>
                            <span className="text-indigo-400 font-bold">{evalY !== null ? evalY.toFixed(3) : 'Undefined'}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>f'({evalX.toFixed(1)}) slope =</span>
                            <span className="text-amber-400 font-bold">{slope !== null ? slope.toFixed(3) : 'Undefined'}</span>
                          </div>
                          {evalY !== null && slope !== null && (
                            <div className="p-1.5 bg-[#0c0e1a] rounded text-[10px] text-purple-300 text-center font-mono mt-1">
                              Tangent: y = {slope.toFixed(2)}(x - {evalX.toFixed(1)}) + {evalY.toFixed(2)}
                            </div>
                          )}
                        </div>

                        <button 
                          onClick={() => {
                            updateFunction(activeFn.id, { showTangent: true, tangentPoint: evalX });
                            showToast(`Tangent set at x₀ = ${evalX.toFixed(1)}`);
                          }}
                          className="w-full py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-lg text-xs font-sans font-semibold transition-all"
                        >
                          Show Tangent on Graph Canvas
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* --- TAB 3: TABLE --- */}
            {activeTab === 'Table' && (
              <div className="space-y-4">
                <div className="bg-[#121524] p-3 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Table Settings</h3>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="text-[9px] text-slate-500 uppercase block mb-1">X Min</label>
                      <input 
                        type="number"
                        value={tableMinX}
                        onChange={(e) => setTableMinX(parseFloat(e.target.value) || -5)}
                        className="w-full bg-[#0c0e1a] border border-slate-700/80 rounded p-1 text-slate-200 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 uppercase block mb-1">X Max</label>
                      <input 
                        type="number"
                        value={tableMaxX}
                        onChange={(e) => setTableMaxX(parseFloat(e.target.value) || 5)}
                        className="w-full bg-[#0c0e1a] border border-slate-700/80 rounded p-1 text-slate-200 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 uppercase block mb-1">Step (Δx)</label>
                      <input 
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={tableStep}
                        onChange={(e) => setTableStep(parseFloat(e.target.value) || 1)}
                        className="w-full bg-[#0c0e1a] border border-slate-700/80 rounded p-1 text-slate-200 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button 
                      onClick={() => {
                        const visibleFns = functions.filter(f => f.visible);
                        let csv = 'x,' + visibleFns.map((f, i) => i === 0 ? 'f(x)' : i === 1 ? 'g(x)' : `f${i+1}(x)`).join(',') + '\n';
                        const min = Math.min(tableMinX, tableMaxX);
                        const max = Math.max(tableMinX, tableMaxX);
                        const step = Math.max(0.01, Math.abs(tableStep));
                        for (let x = min; x <= max + 1e-9; x += step) {
                          const rx = Number(x.toFixed(4));
                          const row: (number | string)[] = [rx];
                          visibleFns.forEach(f => {
                            const y = evaluateFunction(f.equation, rx);
                            row.push(y !== null ? Number(y.toFixed(4)) : 'NaN');
                          });
                          csv += row.join(',') + '\n';
                        }
                        navigator.clipboard.writeText(csv);
                        showToast('Table copied as CSV');
                      }}
                      className="flex-1 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Copy size={13} /> Copy CSV
                    </button>

                    <button 
                      onClick={() => {
                        setTableMinX(-5);
                        setTableMaxX(5);
                        setTableStep(1);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                      title="Reset Range"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Values Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#121524] max-h-[420px]">
                  <table className="w-full text-xs font-mono border-collapse">
                    <thead>
                      <tr className="bg-[#161a2e] text-slate-400 text-[10px] uppercase border-b border-slate-800 sticky top-0">
                        <th className="p-2 text-left">x</th>
                        {functions.filter(f => f.visible).map((f, i) => (
                          <th key={f.id} className="p-2 text-left" style={{ color: f.color }}>
                            {i === 0 ? 'f(x)' : i === 1 ? 'g(x)' : `f${i+1}(x)`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rows = [];
                        const min = Math.min(tableMinX, tableMaxX);
                        const max = Math.max(tableMinX, tableMaxX);
                        const step = Math.max(0.01, Math.abs(tableStep));
                        const visibleFns = functions.filter(f => f.visible);

                        for (let x = min; x <= max + 1e-9; x += step) {
                          const rx = Number(x.toFixed(3));
                          rows.push(
                            <tr key={rx} className="border-b border-slate-800/40 hover:bg-slate-800/30 text-slate-300">
                              <td className="p-2 font-bold text-slate-400">{rx}</td>
                              {visibleFns.map(f => {
                                const y = evaluateFunction(f.equation, rx);
                                return (
                                  <td key={f.id} className="p-2">
                                    {y !== null ? y.toFixed(3) : <span className="text-red-400">NaN</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        }
                        return rows;
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- TAB 4: INTERSECTIONS --- */}
            {activeTab === 'Intersections' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-[#121524] p-3 rounded-xl border border-slate-800">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">Intersection Finder</h3>
                    <p className="text-[10px] text-slate-400">Finds exact points where curves cross</p>
                  </div>
                  <button 
                    onClick={() => handleQuickAction('intersect')}
                    className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-xs rounded-lg shadow-md hover:brightness-110 active:scale-95 transition-all"
                  >
                    Scan
                  </button>
                </div>

                <div className="space-y-2">
                  {intersections.length > 0 ? (
                    intersections.map((p, idx) => (
                      <div key={idx} className="p-3 bg-[#121524] border border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-400 text-xs font-mono">Point P{idx + 1}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({p.x.toFixed(3)}, {p.y.toFixed(3)})</span>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setViewportDomain([p.x - 3, p.x + 3]);
                              setViewportRange([p.y - 3, p.y + 3]);
                              showToast(`Centered on P${idx + 1}`);
                            }}
                            className="flex-1 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-[11px] font-sans font-medium flex items-center justify-center gap-1"
                          >
                            <Focus size={12} /> Focus Graph
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`);
                              showToast('Coordinates copied');
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-sans"
                            title="Copy coordinates"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-[#121524] border border-slate-800 rounded-xl text-center space-y-2">
                      <GitCommit size={24} className="mx-auto text-slate-600" />
                      <p className="text-xs text-slate-400">No intersections detected in current domain.</p>
                      <p className="text-[10px] text-slate-500">Ensure at least 2 visible functions intersect in [-20, 20].</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- TAB 5: TRANSFORM --- */}
            {activeTab === 'Transform' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target Function</label>
                  <select 
                    value={editingFunctionId || functions[0]?.id}
                    onChange={(e) => setEditingFunctionId(e.target.value)}
                    className="w-full bg-[#121524] border border-slate-700/80 text-xs text-indigo-300 font-mono rounded-lg p-2 outline-none"
                  >
                    {functions.map((f, i) => (
                      <option key={f.id} value={f.id}>
                        {i === 0 ? 'f(x)' : i === 1 ? 'g(x)' : `f${i+1}(x)`} = {f.equation}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-[#121524] p-3 rounded-xl border border-slate-800 space-y-3 text-xs">
                  <div className="p-2 bg-[#0c0e1a] rounded border border-indigo-500/30 text-center font-mono text-indigo-300 text-xs">
                    g(x) = {transformA !== 1 ? `${transformA} * ` : ''}f({transformB !== 1 ? `${transformB}*` : ''}(x {transformC >= 0 ? `- ${transformC}` : `+ ${Math.abs(transformC)}`})) {transformD >= 0 ? `+ ${transformD}` : `- ${Math.abs(transformD)}`}
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Vertical Scale (a)</span>
                        <span className="text-indigo-400 font-mono font-bold">{transformA}</span>
                      </div>
                      <input 
                        type="range" min="-5" max="5" step="0.5"
                        value={transformA} onChange={(e) => setTransformA(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Horizontal Compression (b)</span>
                        <span className="text-indigo-400 font-mono font-bold">{transformB}</span>
                      </div>
                      <input 
                        type="range" min="-5" max="5" step="0.5"
                        value={transformB} onChange={(e) => setTransformB(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Horizontal Shift (c)</span>
                        <span className="text-indigo-400 font-mono font-bold">{transformC}</span>
                      </div>
                      <input 
                        type="range" min="-10" max="10" step="0.5"
                        value={transformC} onChange={(e) => setTransformC(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Vertical Shift (d)</span>
                        <span className="text-indigo-400 font-mono font-bold">{transformD}</span>
                      </div>
                      <input 
                        type="range" min="-10" max="10" step="0.5"
                        value={transformD} onChange={(e) => setTransformD(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800">
                    <button 
                      onClick={() => setTransformA(prev => prev * -1)}
                      className="p-1.5 bg-[#0c0e1a] hover:bg-slate-800 text-slate-300 rounded text-[10px]"
                    >
                      Reflect X-Axis
                    </button>
                    <button 
                      onClick={() => setTransformB(prev => prev * -1)}
                      className="p-1.5 bg-[#0c0e1a] hover:bg-slate-800 text-slate-300 rounded text-[10px]"
                    >
                      Reflect Y-Axis
                    </button>
                    <button 
                      onClick={() => setTransformD(prev => prev + 2)}
                      className="p-1.5 bg-[#0c0e1a] hover:bg-slate-800 text-slate-300 rounded text-[10px]"
                    >
                      Shift Up +2
                    </button>
                    <button 
                      onClick={() => { setTransformA(1); setTransformB(1); setTransformC(0); setTransformD(0); }}
                      className="p-1.5 bg-[#0c0e1a] hover:bg-slate-800 text-slate-300 rounded text-[10px]"
                    >
                      Reset Sliders
                    </button>
                  </div>

                  <button 
                    onClick={() => {
                      const targetFn = functions.find(f => f.id === editingFunctionId) || functions[0];
                      if (targetFn) {
                        let base = targetFn.equation;
                        let innerX = transformC === 0 ? 'x' : transformC > 0 ? `(x - ${transformC})` : `(x + ${Math.abs(transformC)})`;
                        if (transformB !== 1) innerX = `${transformB}*${innerX}`;
                        let expr = base.replace(/\bx\b/g, innerX);
                        if (transformA !== 1) expr = `${transformA} * (${expr})`;
                        if (transformD !== 0) expr = transformD > 0 ? `${expr} + ${transformD}` : `${expr} - ${Math.abs(transformD)}`;
                        
                        updateFunction(targetFn.id, { equation: expr });
                        showToast(`Updated equation: ${expr}`);
                      }
                    }}
                    className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg text-xs shadow-md transition-all active:scale-95"
                  >
                    Apply Transformation to Function
                  </button>
                </div>
              </div>
            )}

            {/* --- TAB 6: EXAMPLES --- */}
            {activeTab === 'Examples' && (
              <div className="space-y-4">
                <p className="text-[11px] text-slate-400">Select a pre-built mathematical curve or preset system to load directly onto the graph canvas.</p>
                
                <div className="space-y-2">
                  {[
                    { label: 'Standard Parabola', eq: 'x^2', category: 'Algebra' },
                    { label: 'Cubic Inflection', eq: 'x^3 - 3*x', category: 'Algebra' },
                    { label: 'Rational Hyperbola', eq: '1/x', category: 'Algebra' },
                    { label: 'Absolute V-Shape', eq: 'abs(x)', category: 'Algebra' },
                    { label: 'Harmonic Sine Wave', eq: 'sin(x)', category: 'Trigonometry' },
                    { label: 'Phase Shifted Wave', eq: '2*sin(2*x - 1)', category: 'Trigonometry' },
                    { label: 'Exponential Growth', eq: 'e^x', category: 'Calculus' },
                    { label: 'Natural Logarithm', eq: 'ln(x)', category: 'Calculus' },
                    { label: 'Gaussian Bell Curve', eq: 'e^(-x^2)', category: 'Statistics' },
                    { label: 'Logistic Sigmoid', eq: '1/(1 + e^(-x))', category: 'Statistics' },
                    { label: 'Damped Oscillator', eq: 'e^(-0.2*x)*cos(3*x)', category: 'Physics' },
                  ].map((ex, i) => (
                    <div key={i} className="p-2.5 bg-[#121524] border border-slate-800/80 hover:border-indigo-500/50 rounded-xl flex items-center justify-between transition-all">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-bold block">{ex.category}</span>
                        <h4 className="text-xs font-bold text-slate-200">{ex.label}</h4>
                        <code className="text-[10px] text-slate-400 font-mono">f(x) = {ex.eq}</code>
                      </div>
                      <button 
                        onClick={() => {
                          const newFn: FunctionConfig = {
                            id: Date.now().toString(),
                            equation: ex.eq,
                            color: COLORS[functions.length % COLORS.length],
                            visible: true,
                            style: 'solid',
                            strokeWidth: 2.5,
                            showDerivative: false,
                            showTangent: false,
                            tangentPoint: 0,
                            showExtrema: true
                          };
                          setFunctions(prev => [...prev, newFn]);
                          setEditingFunctionId(newFn.id);
                          showToast(`Added ${ex.label}`);
                        }}
                        className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold"
                      >
                        Load
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- TAB 7: SAVED PRESETS --- */}
            {activeTab === 'Saved' && (
              <div className="space-y-4">
                <div className="p-3 bg-[#121524] border border-slate-800 rounded-xl space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-200">Save Current Graph Preset</h3>
                  <input 
                    type="text"
                    placeholder="Preset name (e.g. Calculus HW #3)"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="w-full bg-[#0c0e1a] border border-slate-700/80 rounded-lg p-2 text-xs text-slate-100 outline-none"
                  />
                  <button 
                    onClick={() => {
                      if (!newPresetName.trim()) {
                        showToast('Please enter a preset name');
                        return;
                      }
                      const newPreset = {
                        id: Date.now().toString(),
                        name: newPresetName.trim(),
                        funcs: JSON.parse(JSON.stringify(functions))
                      };
                      setSavedPresets(prev => [newPreset, ...prev]);
                      setNewPresetName('');
                      showToast('Graph preset saved!');
                    }}
                    className="w-full py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg text-xs shadow-md transition-all active:scale-95"
                  >
                    Save Preset
                  </button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Saved Presets</h4>
                  {savedPresets.map((preset) => (
                    <div key={preset.id} className="p-3 bg-[#121524] border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-200">{preset.name}</h4>
                        <span className="text-[9px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono">
                          {preset.funcs.length} curves
                        </span>
                      </div>

                      <div className="space-y-0.5 font-mono text-[10px] text-slate-400">
                        {preset.funcs.map((f, i) => (
                          <div key={i} className="truncate">
                            • {f.equation}
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button 
                          onClick={() => {
                            setFunctions(JSON.parse(JSON.stringify(preset.funcs)));
                            showToast(`Loaded "${preset.name}"`);
                          }}
                          className="flex-1 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-xs font-semibold"
                        >
                          Load
                        </button>
                        <button 
                          onClick={() => {
                            setSavedPresets(prev => prev.filter(p => p.id !== preset.id));
                            showToast('Preset deleted');
                          }}
                          className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded text-xs"
                          title="Delete preset"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </motion.aside>

        {/* --- MAIN GRAPH CANVAS AREA --- */}
        <div className="flex-1 relative bg-[#090b17] flex flex-col" ref={containerRef}>
          
          {/* Top Left Sidebar Toggle */}
          <div data-export-hide="true" className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`backdrop-blur-md transition-all border w-8 h-8 rounded-lg flex items-center justify-center shadow-md ${
                isDarkMode 
                  ? 'bg-[#121524]/90 hover:bg-slate-800 text-slate-300 border-slate-700/80' 
                  : 'bg-white/90 hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>

          {/* D3 SVG Canvas */}
          <svg 
            ref={svgRef} 
            className={`w-full h-full touch-none ${
              activeGraphTool === 'pan' ? 'cursor-grab active:cursor-grabbing' :
              activeGraphTool === 'zoomIn' ? 'cursor-zoom-in' :
              activeGraphTool === 'zoomOut' ? 'cursor-zoom-out' :
              'cursor-crosshair'
            }`}
            style={{ backgroundColor: '#090b17' }}
          />

          {/* Toast Banner */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                data-export-hide="true"
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-indigo-950/95 border border-indigo-500/50 text-indigo-100 text-xs font-semibold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2"
              >
                <Sparkles size={14} className="text-indigo-400" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Quick Action Inspectors */}
          <AnimatePresence>
            {activeQuickAction === 'intersect' && (
              <motion.div 
                data-export-hide="true"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-16 left-4 z-30 bg-[#121524]/95 backdrop-blur-md border border-purple-500/50 rounded-xl p-3 shadow-2xl max-w-sm flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                    <GitCommit size={15} />
                    <span>⚡ Intersections Inspector</span>
                  </div>
                  <button onClick={() => setActiveQuickAction(null)} className="text-slate-400 hover:text-white p-1">
                    <X size={14} />
                  </button>
                </div>

                <p className="text-[11px] text-slate-300">
                  {intersections.length > 0 
                    ? `Found ${intersections.length} intersection point${intersections.length > 1 ? 's' : ''} between active functions:`
                    : 'No intersections found between visible functions in this range.'}
                </p>

                {intersections.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {intersections.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setViewportDomain([p.x - 3, p.x + 3]);
                          setViewportRange([p.y - 3, p.y + 3]);
                        }}
                        className="bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-200 px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all active:scale-95"
                        title="Click to jump & center viewport on this point"
                      >
                        <Focus size={12} className="text-purple-400" />
                        <span>P{idx + 1}: ({p.x.toFixed(2)}, {p.y.toFixed(2)})</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px]">
                  <button 
                    onClick={() => setActiveTab('Intersections')} 
                    className="text-purple-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    Open full details in Intersections Tab →
                  </button>
                </div>
              </motion.div>
            )}

            {activeQuickAction === 'tangent' && (
              <motion.div 
                data-export-hide="true"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-16 left-4 z-30 bg-[#121524]/95 backdrop-blur-md border border-amber-500/50 rounded-xl p-3 shadow-2xl max-w-sm flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Activity size={15} />
                    <span>📐 Tangent Line Inspector</span>
                  </div>
                  <button onClick={() => setActiveQuickAction(null)} className="text-slate-400 hover:text-white p-1">
                    <X size={14} />
                  </button>
                </div>

                {(() => {
                  const activeFn = functions.find(f => f.id === editingFunctionId) || functions.find(f => f.visible);
                  if (!activeFn) {
                    return <p className="text-xs text-slate-400">Please select or add a function to view tangents.</p>;
                  }
                  const x0 = activeFn.tangentPoint || 0;
                  const y0 = evaluateFunction(activeFn.equation, x0);
                  const slope = getDerivative(activeFn.equation, x0);

                  return (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between bg-[#181c30] p-2 rounded-lg font-mono">
                        <span className="text-slate-400">Function:</span>
                        <span className="text-amber-300 font-bold">{activeFn.equation}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-300">
                          <span>Tangent Point (x₀): <strong className="text-amber-400 font-mono">{x0.toFixed(1)}</strong></span>
                          <span>Slope (m): <strong className="text-amber-400 font-mono">{slope !== null ? slope.toFixed(2) : '—'}</strong></span>
                        </div>
                        <input 
                          type="range"
                          min="-10"
                          max="10"
                          step="0.1"
                          value={x0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateFunction(activeFn.id, { showTangent: true, tangentPoint: val });
                          }}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        <span className="text-[10px] text-slate-400 shrink-0">Presets:</span>
                        {[-2, -1, 0, 1, 2].map(presetX => (
                          <button
                            key={presetX}
                            onClick={() => updateFunction(activeFn.id, { showTangent: true, tangentPoint: presetX })}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                              x0 === presetX ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            x₀={presetX}
                          </button>
                        ))}
                      </div>

                      {y0 !== null && slope !== null && (
                        <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] font-mono text-amber-200">
                          Tangent Eq: y = {slope.toFixed(2)}x {y0 - slope * x0 >= 0 ? '+' : ''} {(y0 - slope * x0).toFixed(2)}
                        </div>
                      )}

                      <p className="text-[10px] text-slate-400 italic">💡 Tip: Click graph curve to move x₀ instantly.</p>
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {activeQuickAction === 'point' && (
              <motion.div 
                data-export-hide="true"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-16 left-4 z-30 bg-[#121524]/95 backdrop-blur-md border border-blue-500/50 rounded-xl p-3 shadow-2xl max-w-sm flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                    <Crosshair size={15} />
                    <span>📍 Point Inspector & Pins</span>
                  </div>
                  <button onClick={() => setActiveQuickAction(null)} className="text-slate-400 hover:text-white p-1">
                    <X size={14} />
                  </button>
                </div>

                <p className="text-[11px] text-slate-300">
                  Click anywhere on the graph canvas to place permanent coordinate pins.
                </p>

                {placedPins.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {placedPins.map(pin => (
                      <div key={pin.id} className="flex items-center justify-between p-2 rounded-lg bg-[#181c30] border border-slate-700/80 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                          <span className="text-slate-200 font-bold">{pin.label}:</span>
                          <span className="text-blue-300">({pin.x.toFixed(2)}, {pin.y.toFixed(2)})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`(${pin.x.toFixed(2)}, ${pin.y.toFixed(2)})`);
                              showToast(`Copied ${pin.label} coordinates`);
                            }}
                            className="p-1 text-slate-400 hover:text-white"
                            title="Copy Coordinates"
                          >
                            <Copy size={12} />
                          </button>
                          <button 
                            onClick={() => setPlacedPins(prev => prev.filter(p => p.id !== pin.id))}
                            className="p-1 text-slate-400 hover:text-red-400"
                            title="Remove Pin"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg border border-dashed border-slate-700 text-center text-[11px] text-slate-400">
                    No pins dropped yet. Tap on graph canvas to drop a pin!
                  </div>
                )}

                {placedPins.length > 0 && (
                  <button 
                    onClick={() => {
                      setPlacedPins([]);
                      showToast('Cleared all pins');
                    }}
                    className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 size={12} />
                    Clear All Pins ({placedPins.length})
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Right Controls Bar */}
          <div data-export-hide="true" className="absolute top-16 right-4 z-20 flex flex-col items-center gap-1.5 bg-[#121524]/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-2 shadow-2xl">
            {/* Pointer Tool */}
            <button 
              onClick={() => setActiveGraphTool('select')}
              className={`p-1.5 rounded-lg transition-all ${activeGraphTool === 'select' ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'}`}
              title="Pointer / Select Tool (Click to inspect / select)"
            >
              <MousePointer size={15} />
            </button>

            {/* Pan Tool */}
            <button 
              onClick={() => setActiveGraphTool('pan')}
              className={`p-1.5 rounded-lg transition-all ${activeGraphTool === 'pan' ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'}`}
              title="Pan Canvas (Click and drag to move graph)"
            >
              <Hand size={15} />
            </button>

            <div className="w-full h-px bg-slate-800/80 my-0.5" />

            {/* Continuous Vertical Zoom Slider Container */}
            <div className="flex flex-col items-center gap-1.5 py-1">
              {/* Zoom In Button (+ at top) */}
              <button 
                onClick={() => handleContinuousZoom(Math.min(100, zoomPercent + 5))}
                className="text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-slate-800/60 transition-colors"
                title="Zoom In (+)"
              >
                <ZoomIn size={14} />
              </button>

              {/* Vertical Slider Track (Up = Zoom In, Down = Zoom Out) */}
              <div className="h-32 w-8 flex items-center justify-center relative my-0.5">
                <input 
                  type="range"
                  {...({ orient: 'vertical' } as any)}
                  min="0"
                  max="100"
                  step="1"
                  value={Math.max(0, Math.min(100, zoomPercent))}
                  onChange={(e) => handleContinuousZoom(parseFloat(e.target.value))}
                  className="h-28 w-3 accent-indigo-500 bg-slate-800/90 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                  style={{
                    WebkitAppearance: 'slider-vertical',
                    writingMode: 'vertical-lr',
                  }}
                  title={`Continuous Zoom: ${zoomPercent}% (0% to 100%, slide up to zoom in, down to zoom out)`}
                />
              </div>

              {/* Zoom Out Button (- at bottom) */}
              <button 
                onClick={() => handleContinuousZoom(Math.max(0, zoomPercent - 5))}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800/60 transition-colors"
                title="Zoom Out (-)"
              >
                <ZoomOut size={14} />
              </button>

              {/* Zoom Scale Badge */}
              <span className="text-[10px] font-mono font-bold text-indigo-300 bg-indigo-950/90 px-1.5 py-0.5 rounded border border-indigo-500/30 whitespace-nowrap shadow-sm min-w-[40px] text-center mt-0.5">
                {zoomPercent}%
              </span>
            </div>

            <div className="w-full h-px bg-slate-800/80 my-0.5" />

            {/* Reset View Fit */}
            <button 
              onClick={() => {
                setActiveGraphTool('select');
                handleResetZoom();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-colors"
              title="Reset View Fit (100%)"
            >
              <Focus size={15} />
            </button>
          </div>

          {/* Floating Graph Legend (Bottom Right) */}
          <div data-export-hide="true" className="absolute bottom-20 right-4 z-20 bg-[#121524]/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-xl flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
              <span className="font-mono text-slate-200">f(x) = x²</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
              <span className="font-mono text-slate-200">g(x) = x + 2</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
              <span className="font-mono text-slate-400">Intersections</span>
            </div>
          </div>

          {/* Floating Bottom Zoom Status Toolbar */}
          <div data-export-hide="true" className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-[#121524]/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-3">
            <button 
              onClick={() => handleZoom(0.8)} 
              className="p-1 text-slate-400 hover:text-white rounded transition-colors"
            >
              <ZoomOut size={14} />
            </button>
            <span className="font-mono text-xs font-semibold text-slate-200 min-w-[45px] text-center">
              {zoomPercent}%
            </span>
            <button 
              onClick={() => handleZoom(1.25)} 
              className="p-1 text-slate-400 hover:text-white rounded transition-colors"
            >
              <ZoomIn size={14} />
            </button>

            <div className="w-px h-4 bg-slate-800" />

            <button 
              onClick={() => setIsGridLocked(!isGridLocked)}
              className={`p-1 transition-colors ${isGridLocked ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
              title={isGridLocked ? "Unlock Grid Zoom" : "Lock Grid Zoom"}
            >
              {isGridLocked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>

          {/* --- SMART INPUT BOTTOM BAR --- */}
          <div data-export-hide="true" className={`border-t px-4 py-2.5 z-20 flex items-center gap-3 ${
            isDarkMode ? 'bg-[#0e1120] border-slate-800/80' : 'bg-slate-100 border-slate-200'
          }`}>
            <div className={`flex items-center gap-1.5 text-xs font-bold shrink-0 pr-2 border-r ${
              isDarkMode ? 'text-indigo-400 border-slate-800' : 'text-indigo-600 border-slate-300'
            }`}>
              <Sparkles size={14} />
              <span>Smart Input</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
              {[
                'x^2', 'sqrt(x)', 'sin(x)', 'cos(x)', 'tan(x)', 'ln(x)', 'e^x', 'abs(x)', 'pi', '...'
              ].map(snippet => (
                <button
                  key={snippet}
                  onClick={() => appendSmartInput(snippet)}
                  className={`border rounded-lg px-2.5 py-1 text-xs font-mono transition-all active:scale-95 shrink-0 ${
                    isDarkMode 
                      ? 'bg-[#161a2e] hover:bg-slate-800/80 text-slate-300 border-slate-700/60' 
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm'
                  }`}
                >
                  {snippet === 'x^2' ? 'x²' : snippet === 'sqrt(x)' ? '√x' : snippet === 'e^x' ? 'eˣ' : snippet === 'abs(x)' ? '|x|' : snippet === 'pi' ? 'π' : snippet}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* --- HELP & USER GUIDE MODAL --- */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
                isDarkMode ? 'bg-[#0f1222] border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Modal Header */}
              <div className={`p-5 border-b flex items-center justify-between ${
                isDarkMode ? 'border-slate-800 bg-[#14182e]' : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                    <HelpCircle size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Linecraft Help & User Guide</h2>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Master function input, calculus tools, and graph exports
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tabs Navigation */}
              <div className={`flex items-center gap-2 px-5 pt-3 border-b text-xs font-semibold ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}>
                {[
                  { id: 'syntax', label: 'Syntax & Math' },
                  { id: 'tools', label: 'Graph Controls' },
                  { id: 'calculus', label: 'Calculus Tools' },
                  { id: 'export', label: 'PDF Exporting' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setHelpActiveTab(tab.id as any)}
                    className={`pb-2.5 px-3 border-b-2 transition-all ${
                      helpActiveTab === tab.id
                        ? 'border-indigo-500 text-indigo-400 font-bold'
                        : isDarkMode
                          ? 'border-transparent text-slate-400 hover:text-slate-200'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Area */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {helpActiveTab === 'syntax' && (
                  <div className="space-y-4">
                    <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                      Enter mathematical expressions into the top search bar or smart input bar. You can type variables using <code className="text-indigo-400 font-mono">x</code>.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 font-mono">
                      {[
                        { expr: 'x^2 + 2x - 3', desc: 'Polynomials & powers' },
                        { expr: 'sin(x), cos(x), tan(x)', desc: 'Trigonometric functions' },
                        { expr: 'sqrt(x)', desc: 'Square root function' },
                        { expr: 'ln(x) or log(x)', desc: 'Natural & base-10 log' },
                        { expr: 'e^x or exp(x)', desc: 'Exponential functions' },
                        { expr: 'abs(x)', desc: 'Absolute value |x|' },
                        { expr: 'pi, e', desc: 'Constants' },
                        { expr: '(x - 1)*(x + 3)', desc: 'Multiplication & brackets' },
                      ].map((item, i) => (
                        <div key={i} className={`p-2.5 rounded-xl border ${
                          isDarkMode ? 'bg-[#14172a] border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="text-indigo-400 font-bold">{item.expr}</div>
                          <div className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {helpActiveTab === 'tools' && (
                  <div className="space-y-3">
                    <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                      Use interactive controls to explore functions in high resolution:
                    </p>
                    <ul className="space-y-2.5">
                      <li className="flex items-start gap-2.5">
                        <span className="p-1 bg-indigo-500/20 text-indigo-400 rounded mt-0.5"><Sliders size={14} /></span>
                        <div>
                          <strong className="text-slate-200">Vertical Zoom Slider (0% - 100%):</strong> Located on the right edge of the graph. Smoothly scales the view scale from 100x zoom down to full 100% view.
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="p-1 bg-indigo-500/20 text-indigo-400 rounded mt-0.5"><Move size={14} /></span>
                        <div>
                          <strong className="text-slate-200">Pan & Drag:</strong> Select the Pan tool from the right toolbar and click-drag the grid to shift coordinates.
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="p-1 bg-indigo-500/20 text-indigo-400 rounded mt-0.5"><MapPin size={14} /></span>
                        <div>
                          <strong className="text-slate-200">Point Pinning:</strong> Click "Pin Point" and click anywhere on a curve to lock exact coordinates on screen.
                        </div>
                      </li>
                    </ul>
                  </div>
                )}

                {helpActiveTab === 'calculus' && (
                  <div className="space-y-3">
                    <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                      Perform advanced numerical analysis and calculus operations:
                    </p>
                    <ul className="space-y-2">
                      <li className="p-2.5 rounded-xl border bg-indigo-500/5 border-indigo-500/20">
                        <strong className="text-indigo-300">Tangent Lines:</strong> Select "Tangent Line", click on any curve x-value to calculate and plot the exact tangent line equation and slope f'(x).
                      </li>
                      <li className="p-2.5 rounded-xl border bg-purple-500/5 border-purple-500/20">
                        <strong className="text-purple-300">Area Integration:</strong> Define lower (a) and upper (b) bounds to shade the area under the curve and calculate definite integral values.
                      </li>
                      <li className="p-2.5 rounded-xl border bg-blue-500/5 border-blue-500/20">
                        <strong className="text-blue-300">Derivative Curve Overlay:</strong> Toggle f'(x) in the function panel to view the instant slope derivative curve drawn alongside f(x).
                      </li>
                    </ul>
                  </div>
                )}

                {helpActiveTab === 'export' && (
                  <div className="space-y-3">
                    <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                      Export clean, high-resolution graphics for homework, presentations, or research:
                    </p>
                    <div className={`p-3.5 rounded-xl border ${
                      isDarkMode ? 'bg-[#14172a] border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <p className="font-semibold text-indigo-400 mb-1">Graph-Only Clean Export</p>
                      <p>
                        When exporting to PDF, PNG, or SVG, all navigation sidebars, floating toolbars, toast popups, and search inputs are automatically hidden, producing a clean, publication-ready graph output.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className={`p-4 border-t flex justify-end ${
                isDarkMode ? 'border-slate-800 bg-[#14182e]' : 'border-slate-200 bg-slate-50'
              }`}>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all active:scale-95"
                >
                  Got it!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- SETTINGS & PREFERENCES MODAL --- */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
                isDarkMode ? 'bg-[#0f1222] border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Modal Header */}
              <div className={`p-5 border-b flex items-center justify-between ${
                isDarkMode ? 'border-slate-800 bg-[#14182e]' : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Settings & Preferences</h2>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Customize grid rendering, units, theme, and precision
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Settings Form Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                
                {/* Theme Setting */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-700/40">
                  <div>
                    <label className="font-bold text-slate-200 block">Appearance Mode</label>
                    <span className="text-[11px] text-slate-400">Toggle between Day (Light) and Night (Dark) themes</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsDarkMode(!isDarkMode);
                      showToast(!isDarkMode ? "Night Mode Enabled" : "Day Mode Enabled");
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                      isDarkMode 
                        ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' 
                        : 'bg-slate-100 border-slate-300 text-indigo-600 hover:bg-slate-200'
                    }`}
                  >
                    {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                    <span>{isDarkMode ? 'Night Mode' : 'Day Mode'}</span>
                  </button>
                </div>

                {/* Grid Type Setting */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-200 block">Coordinate Grid Style</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'Cartesian', label: 'Cartesian' },
                      { id: 'Polar', label: 'Polar Grid' },
                      { id: 'Isometric', label: 'Isometric' },
                      { id: 'Blank', label: 'Blank' },
                    ].map(styleOption => (
                      <button
                        key={styleOption.id}
                        onClick={() => {
                          setGridStyle(styleOption.id as any);
                          showToast(`Grid set to ${styleOption.label}`);
                        }}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                          gridStyle === styleOption.id
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                            : isDarkMode
                              ? 'bg-[#14172a] border-slate-800 text-slate-300 hover:bg-slate-800'
                              : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {styleOption.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Angle Unit Setting */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-700/40">
                  <div>
                    <label className="font-bold text-slate-200 block">Trigonometric Angle Unit</label>
                    <span className="text-[11px] text-slate-400">Unit for sin(x), cos(x), tan(x) evaluation</span>
                  </div>
                  <div className="flex items-center bg-[#14172a] p-1 rounded-lg border border-slate-700">
                    <button
                      onClick={() => {
                        setAngleUnit('radians');
                        showToast("Angle unit set to Radians");
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                        angleUnit === 'radians' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Radians
                    </button>
                    <button
                      onClick={() => {
                        setAngleUnit('degrees');
                        showToast("Angle unit set to Degrees");
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                        angleUnit === 'degrees' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Degrees
                    </button>
                  </div>
                </div>

                {/* Decimal Precision */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-200">Decimal Precision</label>
                    <span className="font-mono text-indigo-400 font-bold">{decimalPrecision} Decimals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map(precision => (
                      <button
                        key={precision}
                        onClick={() => setDecimalPrecision(precision)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                          decimalPrecision === precision
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : isDarkMode
                              ? 'bg-[#14172a] border-slate-800 text-slate-400 hover:bg-slate-800'
                              : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {precision} Dec
                      </button>
                    ))}
                  </div>
                </div>

                {/* Display Toggles */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-medium text-slate-300">Show Grid Lines</span>
                    <input 
                      type="checkbox"
                      checked={showGridLines}
                      onChange={(e) => setShowGridLines(e.target.checked)}
                      className="rounded border-slate-600 text-indigo-600 focus:ring-0 w-4 h-4"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-medium text-slate-300">Show Axis Ticks & Labels</span>
                    <input 
                      type="checkbox"
                      checked={showAxisLabels}
                      onChange={(e) => setShowAxisLabels(e.target.checked)}
                      className="rounded border-slate-600 text-indigo-600 focus:ring-0 w-4 h-4"
                    />
                  </label>
                </div>

              </div>

              {/* Modal Footer */}
              <div className={`p-4 border-t flex justify-end gap-2 ${
                isDarkMode ? 'border-slate-800 bg-[#14182e]' : 'border-slate-200 bg-slate-50'
              }`}>
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    showToast("Settings Saved Successfully!");
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all active:scale-95"
                >
                  Save & Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Panel Modal */}
      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        isDarkMode={isDarkMode}
        currentUserEmail={currentUser?.email || ''}
      />
    </div>
  );
}
