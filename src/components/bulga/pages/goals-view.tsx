"use client";

import { BulgaGoals } from "@/components/bulga/pages/goals";
import { useBulgaChrome } from "@/components/bulga/chrome-context";
import type { GoalsPlanView } from "@/lib/types";

export function GoalsView({ plan }: { plan: GoalsPlanView }) {
  const { accent, theme, addGoal, editGoal } = useBulgaChrome();
  return (
    <BulgaGoals
      plan={plan}
      accent={accent}
      theme={theme}
      onAdd={addGoal}
      onEdit={editGoal}
    />
  );
}
