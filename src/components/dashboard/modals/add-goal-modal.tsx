"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/bulga/emoji-picker";
import { PriorityPicker } from "@/components/bulga/priority-picker";
import { gqlClient, errMessage } from "@/lib/graphql/client";

const CREATE_GOAL = /* GraphQL */ `
  mutation CreateGoal($input: GoalCreateInput!) {
    createGoal(input: $input) { ok }
  }
`;

export function AddGoalModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState(2);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!name || !target) {
      setError("Name and target are required");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await gqlClient.request(CREATE_GOAL, {
          input: {
            name,
            emoji: emoji || undefined,
            target: Number(target),
            saved: Number(saved) || 0,
            priority,
            deadline: deadline || undefined,
          },
        });
        setName("");
        setEmoji("");
        setTarget("");
        setSaved("");
        setDeadline("");
        setPriority(2);
        onAdded();
      } catch (e) {
        setError(errMessage(e));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-6 sm:p-9">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-bk-ink)]">New Goal</DialogTitle>
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
        <div className="flex gap-3 mt-7">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending} className="flex-[2]">
            {isPending ? "Creating..." : "Create Goal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
