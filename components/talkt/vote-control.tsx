"use client";

import * as React from "react";

import { Icon } from "@/components/talkt/primitives";

interface VoteState {
  upvotes: number;
  downvotes: number;
  myVote: -1 | 0 | 1;
}

/**
 * Reddit-style up/down vote control with transparent counts. Optimistically
 * updates on click (flips immediately), posts to /api/interviews/[id]/vote, and
 * reverts on failure. Active up turns green, active down turns red. Disabled for
 * interviews the caller owns (the API rejects self-votes anyway).
 *
 * Mounted per interview (cards/detail are keyed by id), so it seeds from props
 * once and does not re-sync afterwards.
 */
export function VoteControl({
  interviewId,
  upvotes,
  downvotes,
  myVote = 0,
  disabled = false,
  size = "sm",
  orientation = "horizontal",
}: {
  interviewId: string;
  upvotes?: number;
  downvotes?: number;
  myVote?: -1 | 0 | 1;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  orientation?: "horizontal" | "vertical";
}) {
  const [state, setState] = React.useState<VoteState>({
    upvotes: upvotes ?? 0,
    downvotes: downvotes ?? 0,
    myVote,
  });
  const [pending, setPending] = React.useState(false);

  const cast = React.useCallback(
    async (direction: 1 | -1) => {
      if (disabled || pending) return;
      const prev = state;
      const nextVote: -1 | 0 | 1 = prev.myVote === direction ? 0 : direction;

      // Optimistic: shift tallies by the delta between the old and new vote.
      // Clamp at 0 — if the seeded myVote/count ever desync (e.g. a prior vote
      // POST failed mid-flight), clearing a vote must not render a negative count.
      const next: VoteState = {
        upvotes: Math.max(0, prev.upvotes - (prev.myVote === 1 ? 1 : 0) + (nextVote === 1 ? 1 : 0)),
        downvotes: Math.max(0, prev.downvotes - (prev.myVote === -1 ? 1 : 0) + (nextVote === -1 ? 1 : 0)),
        myVote: nextVote,
      };
      setState(next);
      setPending(true);

      try {
        const res = await fetch(`/api/interviews/${interviewId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: nextVote }),
        });
        if (!res.ok) throw new Error(`vote failed (${res.status})`);
        const data = (await res.json()) as VoteState;
        setState({ upvotes: data.upvotes, downvotes: data.downvotes, myVote: data.myVote });
      } catch {
        setState(prev); // revert
      } finally {
        setPending(false);
      }
    },
    [disabled, pending, state, interviewId],
  );

  const dims = size === "lg" ? { icon: 22, font: 15, pad: 12 } : size === "md" ? { icon: 18, font: 13, pad: 9 } : { icon: 14, font: 12, pad: 7 };
  const vertical = orientation === "vertical";

  return (
    <div
      className="flex items-center"
      role="group"
      aria-label="Vote on this interview"
      style={{ flexDirection: vertical ? "column" : "row", gap: vertical ? 0 : 6, border: vertical ? "1px solid var(--border)" : undefined, background: vertical ? "var(--border)" : undefined }}
    >
      <VoteButton
        direction="up"
        count={state.upvotes}
        active={state.myVote === 1}
        disabled={disabled}
        vertical={vertical}
        dims={dims}
        onClick={(e) => {
          e.stopPropagation();
          void cast(1);
        }}
      />
      <VoteButton
        direction="down"
        count={state.downvotes}
        active={state.myVote === -1}
        disabled={disabled}
        vertical={vertical}
        dims={dims}
        onClick={(e) => {
          e.stopPropagation();
          void cast(-1);
        }}
      />
    </div>
  );
}

function VoteButton({
  direction,
  count,
  active,
  disabled,
  vertical,
  dims,
  onClick,
}: {
  direction: "up" | "down";
  count: number;
  active: boolean;
  disabled: boolean;
  vertical: boolean;
  dims: { icon: number; font: number; pad: number };
  onClick: (e: React.MouseEvent) => void;
}) {
  const up = direction === "up";
  const activeColor = up ? "var(--success)" : "var(--error)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${up ? "Upvote" : "Downvote"} (${count})`}
      title={disabled ? "You can't vote on your own interview" : up ? "Upvote" : "Downvote"}
      className="mono flex items-center justify-center"
      style={{
        flexDirection: vertical ? "column" : "row",
        gap: vertical ? 3 : 5,
        width: vertical ? "100%" : undefined,
        padding: vertical ? `${dims.pad}px 14px` : `0 ${dims.pad + 1}px`,
        height: vertical ? undefined : dims.icon + 12,
        cursor: disabled ? "default" : "pointer",
        border: vertical ? "none" : "1px solid var(--border)",
        background: active ? activeColor : "var(--card)",
        color: active ? "#fff" : "var(--muted-foreground)",
        opacity: disabled ? 0.5 : 1,
        fontSize: dims.font,
        fontWeight: 600,
        lineHeight: 1,
        transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
      }}
    >
      <Icon name={up ? "chevron-up" : "chevron-down"} size={dims.icon} stroke={2.25} />
      {count}
    </button>
  );
}
