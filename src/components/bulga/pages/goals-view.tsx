"use client";

import { BulgaGoals } from "@/components/bulga/pages/goals";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import type { GoalView } from "@/lib/types";

export function GoalsView({ goals, currency }: { goals: GoalView[]; currency: string }) {
  const { accent, theme, addGoal, editGoal } = useBulgaChrome();
  return (
    <BulgaGoals
      goals={goals}
      currency={currency}
      accent={accent}
      theme={theme}
      onAdd={addGoal}
      onEdit={editGoal}
    />
  );
}
