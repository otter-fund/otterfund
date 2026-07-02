"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/bulga/emoji-picker";
import { PriorityPicker, toPriorityLevel } from "@/components/bulga/priority-picker";
import { ConfirmButton } from "@/components/bulga/confirm-button";
import { Trash2 } from "lucide-react";
import type { GoalView } from "@/lib/types";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const UPDATE_GOAL = /* GraphQL */ `
  mutation UpdateGoal($id: ID!, $input: GoalUpdateInput!) {
    updateGoal(id: $id, input: $input) { ok }
  }
`;

const DELETE_GOAL = /* GraphQL */ `
  mutation DeleteGoal($id: ID!) {
    deleteGoal(id: $id) { ok }
  }
`;

interface EditGoalModalProps {
  open: boolean;
  goal: GoalView | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditGoalModal({
  open,
  goal,
  onClose,
  onUpdated,
}: EditGoalModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState(2);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    if (goal && open) {
      setName(goal.name);
      setEmoji(goal.emoji || "");
      setTarget(String(goal.target));
      setSaved(String(goal.saved));
      setDeadline(goal.deadlineISO || "");
      setPriority(toPriorityLevel(goal.priority));
      setError("");
    }
  }, [goal, open]);

  const handleSave = () => {
    if (!goal) return;
    if (!name || !target) {
      setError("Name and target are required");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await gqlClient.request(UPDATE_GOAL, {
          id: goal.id,
          input: {
            name,
            emoji: emoji || null,
            target: Number(target),
            saved: Number(saved) || 0,
            priority,
            deadline: deadline || null,
          },
        });
        onClose();
        onUpdated();
      } catch (e) {
        setError(errMessage(e));
      }
    });
  };

  const handleDelete = () => {
    if (!goal) return;
    startTransition(async () => {
      try {
        await gqlClient.request(DELETE_GOAL, { id: goal.id });
        onClose();
        onUpdated();
      } catch {
        setError("Failed to delete");
      }
    });
  };

  if (!goal) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-6 sm:p-9">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-[-0.02em] text-[var(--color-bk-ink)]">Edit Goal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="flex gap-3">
            <div className="w-16">
              <EmojiPicker value={emoji} onChange={setEmoji} />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5">Goal Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vacation Fund"
                className="bk-field"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5">Target Amount</label>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="10000"
                className="bk-field"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5">Already Saved</label>
              <input
                type="number"
                value={saved}
                onChange={(e) => setSaved(e.target.value)}
                placeholder="0"
                className="bk-field"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5">Priority</label>
              <PriorityPicker value={priority} onChange={setPriority} />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--color-bk-faint)] mb-1.5">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="bk-field bk-field-date"
              />
            </div>
          </div>
          <p className="text-[12px] text-[var(--color-bk-muted)]">
            Higher priority claims a bigger share of your monthly savings. Goals of equal priority split it evenly.
          </p>
        </div>
        {error && <p className="text-sm text-[var(--color-bk-clay)] font-medium mt-2">{error}</p>}
        <div className="flex items-center gap-2.5 mt-6">
          <ConfirmButton
            onConfirm={handleDelete}
            icon={Trash2}
            confirmLabel="Are you sure?"
            busyLabel="Deleting…"
            busy={isPending}
            restLabel="Delete goal"
            armedLabel="Confirm delete goal"
          />
          <Button size="sm" onClick={handleSave} disabled={isPending} className="ml-auto">
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
