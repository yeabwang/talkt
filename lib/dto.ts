// Maps persisted interviews to the client shape without exposing owner ids or voter identities.

import type { Interview as UiInterview } from "@/components/talkt/data";
import { toLanguageLabel } from "./language";

/** Interview columns and relations required by the DTO mapper. */
export interface InterviewRow {
  id: string;
  ownerId: string | null;
  title: string;
  subtitle: string | null;
  role: string | null;
  topic: string | null;
  difficulty: string | null;
  blurb: string | null;
  minutes: number | null;
  focus: string[];
  type: "template" | "custom";
  visibility: "public" | "private";
  language: string;
  dimensions: unknown;
  questions: unknown;
  voiceConfig: unknown;
  authorName: string | null;
  anonymous: boolean;
  upvotes: number;
  downvotes: number;
  rankScore: number;
  flagged: boolean;
  publishedAt: Date | null;
  owner?: { name: string | null } | null;
  _count?: { attempts: number };
}

/** Per-caller fields supplied by repository reads. */
export interface ViewerContext {
  myVote?: -1 | 0 | 1;
  mine?: boolean;
}

const ICON_BY_CATEGORY: Record<string, string> = {
  engineering: "code",
  product: "target",
  design: "palette",
  business: "trending-up",
  sales: "headphones",
  healthcare: "activity",
  general: "message-square",
};

function iconFor(type: string, category: string): string {
  if (type === "custom") return "sparkles";
  return ICON_BY_CATEGORY[category.trim().toLowerCase()] ?? "message-square";
}

/** Coerce supported question JSON shapes to text. */
function toQuestionTexts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q) => {
      if (typeof q === "string") return q.trim();
      if (q && typeof q === "object" && typeof (q as { text?: unknown }).text === "string") {
        return (q as { text: string }).text.trim();
      }
      return "";
    })
    .filter(Boolean);
}

function toDimensions(raw: unknown): { key: string; label: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (d): d is { key: string; label: string } =>
        Boolean(d) &&
        typeof (d as { key?: unknown }).key === "string" &&
        typeof (d as { label?: unknown }).label === "string",
    )
    .map((d) => ({ key: d.key, label: d.label }));
}

function voiceId(raw: unknown): string {
  if (raw && typeof raw === "object" && typeof (raw as { voiceId?: unknown }).voiceId === "string") {
    return (raw as { voiceId: string }).voiceId;
  }
  return "adi";
}

function sourceLabel(row: InterviewRow): string {
  if (row.type === "template") return "Curated";
  return row.visibility === "public" ? "Community" : "Custom";
}

function authorLabel(row: InterviewRow): string {
  if (row.anonymous) return "Community";
  if (row.authorName) return row.authorName;
  if (row.owner?.name) return row.owner.name;
  return row.type === "template" ? "TalkT" : "You";
}

export function toTemplateDTO(row: InterviewRow, viewer: ViewerContext = {}): UiInterview {
  const category = row.topic?.trim() || (row.type === "custom" ? "Custom" : "General");
  const questions = toQuestionTexts(row.questions);
  const count = questions.length;

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? (row.focus.length ? row.focus.join(" · ") : row.role ?? ""),
    icon: iconFor(row.type, category),
    category,
    difficulty: row.difficulty ?? "All levels",
    count,
    minutes: row.minutes ?? Math.max(15, count * 3),
    author: authorLabel(row),
    source: sourceLabel(row),
    takes: row._count?.attempts ?? 0,
    voice: voiceId(row.voiceConfig),
    blurb: row.blurb ?? "",
    questions,
    custom: row.type === "custom",
    role: row.role ?? undefined,
    language: toLanguageLabel(row.language),
    focus: row.focus,
    dimensions: toDimensions(row.dimensions),
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    myVote: viewer.myVote ?? 0,
    authorName: row.anonymous ? null : row.authorName ?? row.owner?.name ?? null,
    anonymous: row.anonymous,
    mine: viewer.mine ?? false,
    published: row.publishedAt != null,
  };
}

/** Prisma selection that satisfies InterviewRow. */
export const interviewRowSelect = {
  id: true,
  ownerId: true,
  title: true,
  subtitle: true,
  role: true,
  topic: true,
  difficulty: true,
  blurb: true,
  minutes: true,
  focus: true,
  type: true,
  visibility: true,
  language: true,
  dimensions: true,
  questions: true,
  voiceConfig: true,
  authorName: true,
  anonymous: true,
  upvotes: true,
  downvotes: true,
  rankScore: true,
  flagged: true,
  publishedAt: true,
  owner: { select: { name: true } },
  _count: { select: { attempts: true } },
} as const;
