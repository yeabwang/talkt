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
 * updates, posts to /api/interviews/[id]/vote, and reverts on failure. Disabled
 * for interviews the caller owns (the API rejects self-votes anyway).
 */
export function VoteControl({
  interviewId,
  upvotes,
  downvotes,
  myVote = 0,
  disabled = false,
  size = "sm",
}: {
  interviewId: string;
  upvotes?: number;
  downvotes?: number;
  myVote?: -1 | 0 | 1;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [state, setState] = React.useState<VoteState>({
    upvotes: upvotes ?? 0,
    downvotes: downvotes ?? 0,
    myVote,
  });
  const [pending, setPending] = React.useState(false);
  // Mirror the latest state into a ref (in an effect, not during render) so the
  // async vote handler can read the pre-click snapshot for optimistic revert.
  // The control is mounted per interview (cards are keyed by id), so it does not
  // need to re-sync from props after mount.
  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const cast = React.useCallback(
    async (direction: 1 | -1) => {
      if (disabled || pending) return;
      const prev = stateRef.current;
      const nextVote: -1 | 0 | 1 = prev.myVote === direction ? 0 : direction;

      // Optimistic: recompute tallies from the delta between prev.myVote and nextVote.
      const up = prev.upvotes - (prev.myVote === 1 ? 1 : 0) + (nextVote === 1 ? 1 : 0);
      const down = prev.downvotes - (prev.myVote === -1 ? 1 : 0) + (nextVote === -1 ? 1 : 0);
      setState({ upvotes: up, downvotes: down, myVote: nextVote });
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
    [disabled, interviewId, pending],
  );

  const iconSize = size === "md" ? 16 : 14;
  const fontSize = size === "md" ? 13 : 12;

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Vote on this interview">
      <VoteButton
        direction="up"
        count={state.upvotes}
        active={state.myVote === 1}
        disabled={disabled}
        iconSize={iconSize}
        fontSize={fontSize}
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
        iconSize={iconSize}
        fontSize={fontSize}
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
  iconSize,
  fontSize,
  onClick,
}: {
  direction: "up" | "down";
  count: number;
  active: boolean;
  disabled: boolean;
  iconSize: number;
  fontSize: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  const up = direction === "up";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${up ? "Upvote" : "Downvote"} (${count})`}
      title={disabled ? "You can't vote on your own interview" : up ? "Upvote" : "Downvote"}
      className="mono flex items-center gap-1"
      style={{
        height: 26,
        padding: "0 8px",
        cursor: disabled ? "default" : "pointer",
        border: "1px solid var(--border)",
        background: active ? "var(--foreground)" : "var(--card)",
        color: active ? "var(--background)" : "var(--muted-foreground)",
        opacity: disabled ? 0.5 : 1,
        fontSize,
        lineHeight: 1,
        transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
      }}
    >
      <Icon name={up ? "chevron-up" : "chevron-down"} size={iconSize} />
      {count}
    </button>
  );
}
