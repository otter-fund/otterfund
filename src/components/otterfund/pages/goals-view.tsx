"use client";

import { OtterfundGoals } from "@/components/otterfund/pages/goals";
import { useOtterfundChrome } from "@/components/otterfund/chrome-context";
import type { GoalsPlanView } from "@/lib/types";

export function GoalsView({ plan }: { plan: GoalsPlanView }) {
  const { accent, theme, addGoal, editGoal } = useOtterfundChrome();
  return (
    <OtterfundGoals
      plan={plan}
      accent={accent}
      theme={theme}
      onAdd={addGoal}
      onEdit={editGoal}
    />
  );
}
