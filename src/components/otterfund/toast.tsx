"use client";

// otterfund — toasts. Transient, non-blocking status messages (e.g. "scan
// started", "scan complete") shown top-right, in the design-system surface-card
// grammar. State + the notify() trigger live in the shell (otterfund-chrome) and
// are exposed via the chrome context; this file is just the visual + types.

import { X, Info, Check, TriangleAlert, RefreshCw } from "lucide-react";
import type { OtterfundTheme } from "@/components/otterfund/theme";

export type ToastTone = "info" | "success" | "error" | "progress";

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
  /** Toasts sharing a key replace each other (e.g. "scanning…" → "scan done"). */
  key?: string;
}

/** What callers pass to notify() — id is assigned by the shell. */
export type ToastInput = Omit<Toast, "id"> & { duration?: number };

const ICON: Record<ToastTone, typeof Info> = {
  info: Info,
  success: Check,
  error: TriangleAlert,
  progress: RefreshCw,
};

export function ToastViewport({
  toasts,
  onDismiss,
  theme,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  theme: OtterfundTheme;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: 74,
        right: 20,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: "calc(100vw - 40px)",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const Icon = ICON[t.tone];
        const tint = t.tone === "error" ? theme.clay : theme.accentDeep;
        const bg = t.tone === "error" ? theme.clayTint : theme.accentTint;
        return (
          <div
            key={t.id}
            role="status"
            className="of-enter"
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "flex-start",
              gap: 11,
              width: 340,
              maxWidth: "100%",
              padding: "13px 14px",
              borderRadius: 16,
              background: "var(--color-of-surface)",
              border: "1px solid var(--color-of-line)",
              boxShadow: "0 12px 32px oklch(20% 0.02 80 / 0.16)",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                display: "flex",
                height: 30,
                width: 30,
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 9,
                background: bg,
                color: tint,
              }}
            >
              <Icon size={16} strokeWidth={2.3} className={t.tone === "progress" ? "of-spin" : undefined} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-of-ink)", letterSpacing: "-0.01em" }}>
                {t.title}
              </div>
              {t.message && (
                <div style={{ fontSize: 12.5, color: "var(--color-of-muted)", marginTop: 2, lineHeight: 1.4 }}>
                  {t.message}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              style={{
                flexShrink: 0,
                display: "flex",
                padding: 3,
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--color-of-faint)",
                borderRadius: 6,
              }}
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
