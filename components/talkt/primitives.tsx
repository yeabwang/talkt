"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  ArrowRight,
  BarChart3,
  Briefcase,
  Calendar,
  Captions,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code,
  Edit,
  FileText,
  Filter,
  Grid2X2,
  Headphones,
  Info,
  Layers,
  LayoutGrid,
  List,
  LoaderCircle,
  LogOut,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Moon,
  MoreVertical,
  Palette,
  Pause,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Target,
  ThumbsUp,
  TrendingUp,
  User,
  Video,
  VideoOff,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  mic: Mic,
  "mic-off": MicOff,
  video: Video,
  "video-off": VideoOff,
  phone: Phone,
  "more-vertical": MoreVertical,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "chevron-left": ChevronLeft,
  "arrow-right": ArrowRight,
  "arrow-left": ArrowLeft,
  plus: Plus,
  check: Check,
  x: X,
  sparkles: Sparkles,
  grid: Grid2X2,
  layout: LayoutGrid,
  list: List,
  loader: LoaderCircle,
  clock: Calendar,
  user: User,
  "log-out": LogOut,
  settings: Settings,
  sun: Sun,
  moon: Moon,
  captions: Captions,
  search: Search,
  filter: Filter,
  calendar: Calendar,
  "trending-up": TrendingUp,
  "message-square": MessageSquare,
  briefcase: Briefcase,
  code: Code,
  palette: Palette,
  target: Target,
  repeat: Repeat,
  headphones: Headphones,
  volume: Volume2,
  play: Play,
  pause: Pause,
  activity: Activity,
  "bar-chart": BarChart3,
  "file-text": FileText,
  edit: Edit,
  send: Send,
  maximize: Maximize2,
  shield: Shield,
  info: Info,
  "alert-triangle": AlertTriangle,
  refresh: RefreshCw,
  layers: Layers,
  "thumbs-up": ThumbsUp,
  award: Award,
};

export function PixelT({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  const grid = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];
  const gap = 0.12;

  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" style={{ display: "block" }}>
      {grid.flatMap((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <rect
              key={`${x}-${y}`}
              x={x + gap}
              y={y + gap}
              width={1 - gap * 2}
              height={1 - gap * 2}
              fill={color}
            />
          ) : null
        )
      )}
    </svg>
  );
}

export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2" style={{ lineHeight: 1 }}>
      <PixelT size={size} />
      <span style={{ fontSize: size * 0.92, fontWeight: 600, letterSpacing: "-0.02em" }}>TalkT</span>
    </span>
  );
}

export function Icon({
  name,
  size = 20,
  stroke = 1.75,
  className,
  style,
}: {
  name: string;
  size?: number;
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Component = ICONS[name];
  if (!Component) return null;
  return (
    <Component
      className={className}
      size={size}
      strokeWidth={stroke}
      aria-hidden="true"
      style={{ flexShrink: 0, ...style }}
    />
  );
}

export function TalkTButton({
  variant = "secondary",
  size,
  icon,
  iconRight,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "lg";
  icon?: string;
  iconRight?: string;
}) {
  return (
    <button className={cn("btn", `btn-${variant}`, size && `btn-${size}`, className)} {...props}>
      {icon ? <Icon name={icon} size={size === "sm" ? 15 : 17} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={size === "sm" ? 15 : 17} /> : null}
    </button>
  );
}

export function Avatar({ name = "You", size = 40, src }: { name?: string; size?: number; src?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: "var(--radius-full)",
          objectFit: "cover",
          border: "1px solid var(--border)",
          flexShrink: 0,
        }}
      />
    );
  }

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "var(--radius-full)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: "var(--foreground)",
        fontWeight: 500,
        fontSize: size * 0.38,
        flexShrink: 0,
        fontFamily: "var(--font-mono)",
      }}
    >
      {initials}
    </div>
  );
}

export function AgentAvatar({ size = 40, active = false }: { size?: number; active?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "var(--radius-full)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? "var(--foreground)" : "var(--surface-2)",
        color: active ? "var(--background)" : "var(--foreground)",
        border: `1px solid ${active ? "var(--foreground)" : "var(--border)"}`,
        transition: "all var(--dur-base) var(--ease-out)",
        flexShrink: 0,
      }}
    >
      <PixelT size={size * 0.52} />
    </div>
  );
}

export function Waveform({
  active = false,
  bars = 28,
  height = 40,
  color = "var(--foreground)",
  thin = false,
}: {
  active?: boolean;
  bars?: number;
  height?: number;
  color?: string;
  thin?: boolean;
}) {
  const seeds = React.useMemo(
    () =>
      Array.from({ length: bars }, (_, index) => ({
        dur: 480 + ((index * 53) % 520),
        delay: (index * 37) % 420,
        base: 0.18 + ((index * 7) % 10) / 22,
      })),
    [bars]
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: thin ? 2 : 3, height }}>
      {seeds.map((seed, index) => (
        <span
          key={index}
          style={{
            width: thin ? 2 : 3,
            height: active ? "100%" : Math.max(3, seed.base * height * 0.4),
            background: color,
            borderRadius: 0,
            transformOrigin: "center",
            animation: active
              ? `wave-${index % 6} ${seed.dur}ms var(--ease-out) ${seed.delay}ms infinite alternate`
              : "none",
            opacity: active ? 1 : 0.4,
            transition: "height var(--dur-base) var(--ease-out), opacity var(--dur-base)",
          }}
        />
      ))}
    </div>
  );
}

export function scoreClass(value: number) {
  return value >= 78 ? "score-good" : value >= 62 ? "score-mid" : "score-low";
}

export function scoreColorVar(value: number) {
  return value >= 78 ? "var(--success)" : value >= 62 ? "var(--warn)" : "var(--error)";
}

export function ScoreRing({ value, size = 132, stroke = 3, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [shown, setShown] = React.useState(0);

  React.useEffect(() => {
    let frame = 0;
    let start = 0;
    const duration = 900;
    const step = (time: number) => {
      if (!start) start = time;
      const progress = Math.min(1, (time - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={scoreColorVar(value)}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
          strokeLinecap="butt"
          style={{ transition: "stroke-dashoffset 80ms linear" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span className="stat-value" style={{ fontSize: size * 0.34, color: scoreColorVar(value) }}>
          {shown}
        </span>
        {label ? (
          <span className="mono-label" style={{ marginTop: 4, fontSize: 9.5 }}>
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ScoreBar({ value, animate = true }: { value: number; animate?: boolean }) {
  const [width, setWidth] = React.useState(animate ? 0 : value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setWidth(value), 80);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div style={{ height: 4, background: "var(--border)", width: "100%" }}>
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: scoreColorVar(value),
          transition: "width 900ms var(--ease-out)",
        }}
      />
    </div>
  );
}

export function SectionHeader({ num, label, right }: { num?: string; label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
      {num ? (
        <span className="mono" style={{ color: "var(--dimmed)", fontSize: 12 }}>
          {num}
        </span>
      ) : null}
      <span className="mono-label">{label}</span>
      <div className="grow" style={{ height: 1, background: "var(--border)" }} />
      {right}
    </div>
  );
}

export function StatusDot({ color = "var(--success)", pulse = false, size = 7 }: { color?: string; pulse?: boolean; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        flexShrink: 0,
        animation: pulse ? "pulse-dot 1.4s ease-in-out infinite" : "none",
      }}
    />
  );
}

export function categoryIcon(category: string) {
  return (
    {
      Engineering: "code",
      Product: "target",
      General: "message-square",
      Healthcare: "activity",
      Business: "trending-up",
      Sales: "headphones",
      Design: "palette",
      Custom: "sparkles",
    }[category] ?? "briefcase"
  );
}
