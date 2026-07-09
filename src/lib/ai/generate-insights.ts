import { anthropic } from "./client";
import { prisma } from "@/lib/db/prisma";
import { okColor } from "@/lib/validate";
import { addUsage, emptyUsage } from "./usage";
import { recordAiUsage } from "@/lib/db/ai-usage";

const INSIGHT_TAGS = ["Spending Pattern", "Alert", "Opportunity", "Trend"];
const FOCUS_TYPES = ["category", "subscription", "goal", "income"];
const DEFAULT_TAG_COLOR = "oklch(60% 0.09 155)";
const DEFAULT_TAG_BG = "oklch(25% 0.06 155)";
const INSIGHTS_MODEL = "claude-sonnet-4-5";

/**
 * Treat model output as untrusted: clamp tag/body, reject non-color styles, and
 * resolve the drill-down focus against entities that actually exist. `known`
 * carries the real category/subscription/goal names so a hallucinated focusKey
 * is dropped rather than producing a broken drill-down. income needs no key.
 */
function sanitizeInsight(
  i: { tag: string; body: string; tagColor: string; tagBg: string; focusType?: string; focusKey?: string },
  known: { categories: Set<string>; subscriptions: Set<string>; goals: Set<string> },
) {
  let focusType: string | null = FOCUS_TYPES.includes(i.focusType ?? "") ? i.focusType! : null;
  let focusKey: string | null = typeof i.focusKey === "string" ? i.focusKey : null;

  if (focusType === "income") {
    focusKey = null;
  } else if (focusType === "category" && !(focusKey && known.categories.has(focusKey))) {
    focusType = focusKey = null;
  } else if (focusType === "subscription" && !(focusKey && known.subscriptions.has(focusKey))) {
    focusType = focusKey = null;
  } else if (focusType === "goal" && !(focusKey && known.goals.has(focusKey))) {
    focusType = focusKey = null;
  }

  return {
    tag: INSIGHT_TAGS.includes(i.tag) ? i.tag : "Spending Pattern",
    body: typeof i.body === "string" ? i.body.slice(0, 500) : "",
    tagColor: okColor(i.tagColor) ? i.tagColor : DEFAULT_TAG_COLOR,
    tagBg: okColor(i.tagBg) ? i.tagBg : DEFAULT_TAG_BG,
    focusType,
    focusKey,
  };
}

export async function generateInsightsForUser(userId: string) {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [user, transactions, subscriptions, goals, accounts] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: threeMonthsAgo } },
        include: { category: true },
        orderBy: { date: "desc" },
      }),
      prisma.subscription.findMany({ where: { userId, isActive: true } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.account.findMany({ where: { userId } }),
    ]);

  if (!user || transactions.length === 0) return [];

  // Build summary for Claude
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);
  const totalSubscriptions = subscriptions.reduce((s, sub) => s + sub.amount, 0);

  const categorySpend = new Map<string, number>();
  const monthlyTotals = new Map<string, { income: number; expenses: number }>();

  for (const tx of transactions) {
    const monthKey = `${tx.date.getFullYear()}-${tx.date.getMonth() + 1}`;
    const entry = monthlyTotals.get(monthKey) || { income: 0, expenses: 0 };

    if (tx.amount > 0) {
      entry.income += tx.amount;
    } else {
      entry.expenses += Math.abs(tx.amount);
      if (tx.category) {
        categorySpend.set(
          tx.category.name,
          (categorySpend.get(tx.category.name) || 0) + Math.abs(tx.amount)
        );
      }
    }
    monthlyTotals.set(monthKey, entry);
  }

  const summary = {
    monthlyIncome: user.monthlyIncome,
    budgetTarget: user.budgetTarget,
    netWorth,
    subscriptionsCost: totalSubscriptions,
    categorySpending: Object.fromEntries(categorySpend),
    monthlyTrend: Object.fromEntries(monthlyTotals),
    goals: goals.map((g) => ({
      name: g.name,
      saved: g.saved,
      target: g.target,
      pctComplete: Math.round((g.saved / g.target) * 100),
    })),
    subscriptions: subscriptions.map((s) => ({ name: s.name, amount: s.amount, cycle: s.cycle })),
  };

  // Today's date, baked into the prompt: the model has no clock of its own, so
  // without this it resolves "this month" / "this year" against its training
  // baseline (the wrong year). The monthlyTrend keys are `YYYY-M`, so anchoring
  // to today lets it read them as recent vs. older correctly.
  const today = new Date();
  const todayLong = today.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const todayIso = today.toISOString().slice(0, 10);

  const response = await anthropic.messages.create({
    model: INSIGHTS_MODEL,
    max_tokens: 2048,
    system: `You are otterfund, a calm, plain-spoken personal finance advisor. From the user's data, write 4-6 insights that are genuinely useful. Each should tell the user something they can act on this week, not just restate a number back to them.

Today is ${todayLong} (${todayIso}). Treat this as the current date; ignore any other assumption about the year or month. The monthlyTrend keys are "YYYY-M"; read them relative to today (the most recent key is the current or latest month), and phrase any "this month" / "this year" / month-over-month framing against today's date.

Insight types:
- "Alert": something to fix now, like overspending in a category, an unused or duplicate subscription, or a goal falling behind.
- "Opportunity": a concrete way to save or get ahead, like trimming a specific category, cancelling a specific subscription, or redirecting the savings toward a named goal.
- "Trend": where things are heading if nothing changes, like savings rate, net worth, or a category climbing month over month.
- "Spending Pattern": a notable habit worth naming.

Rules for every insight (this is what makes them useful, not random):
1. Name a SPECIFIC lever the user controls: an actual category, subscription, or goal from the data (use its real name). Never generic ("your spending") when a specific driver exists.
2. Quantify the impact in dollars: the amount at stake per month, and annualized when it lands harder ("$775/mo, ~$9,300/year").
3. End with ONE concrete next step ("cancel it", "cap dining at $400", "move the $200 to your Emergency Fund").
4. Prioritize by impact: lead with the biggest problem or the biggest saving. Skip trivia.
5. Be encouraging and matter-of-fact. Explain, don't lecture or alarm. Avoid dramatic multipliers like "22x your income". If monthlyIncome looks implausibly small next to spending (bad/partial data), do NOT build insights around income ratios; focus on category- and subscription-level levers instead.
6. No two insights should make the same point. Keep each to 1-2 tight sentences.
7. Never use em-dashes (—) in the insight text. Use commas, colons, or separate sentences instead.

Every insight must also name the ONE data lever it is about, so the app can drill into the real transactions behind it:
- "focusType": one of "category", "subscription", "goal", or "income".
- "focusKey": the EXACT name of that entity as it appears in the data (a categorySpending key, a subscription name, or a goal name). Use null for focusType "income".
Pick the single most central lever. If an insight is about a category (e.g. "Other", "Dining Out"), use focusType "category" with that category's name. Match the name character-for-character, or the drill-down breaks.

Respond with ONLY a valid JSON array, most important first:
[{
  "tag": "Alert",
  "body": "Your insight: specific lever, dollar impact, and one next step.",
  "focusType": "category",
  "focusKey": "Other",
  "tagColor": "oklch(75% 0.1 38)",
  "tagBg": "oklch(22% 0.06 38)"
}, ...]

Tag colors (use exactly these):
- Alert: tagColor "oklch(75% 0.1 38)", tagBg "oklch(22% 0.06 38)"
- Opportunity: tagColor "oklch(75% 0.07 245)", tagBg "oklch(22% 0.06 245)"
- Trend: tagColor "oklch(60% 0.09 155)", tagBg "oklch(25% 0.06 155)"
- Spending Pattern: tagColor "oklch(60% 0.09 155)", tagBg "oklch(25% 0.06 155)"`,
    messages: [
      {
        role: "user",
        content: `Analyze this financial data and generate insights:\n${JSON.stringify(summary)}`,
      },
    ],
  });

  // Record token usage + cost for this generation (best-effort). Runs whether
  // or not parsing below succeeds — the API call was billed either way.
  await recordAiUsage([
    { userId, kind: "insights", model: INSIGHTS_MODEL, usage: addUsage(emptyUsage(), response.usage) },
  ]);

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      tag: string;
      body: string;
      tagColor: string;
      tagBg: string;
      focusType?: string;
      focusKey?: string;
    }[];

    // Entities the drill-down can actually resolve — a focus must match one of
    // these by name or it's dropped in sanitizeInsight (category keys mirror
    // exactly what the model saw in `categorySpending`).
    const known = {
      categories: new Set(categorySpend.keys()),
      subscriptions: new Set(subscriptions.map((s) => s.name)),
      goals: new Set(goals.map((g) => g.name)),
    };

    // Store insights in DB (model output sanitized — body/tag clamped, styles
    // validated — since tagColor/tagBg render into an inline style prop).
    const created = await Promise.all(
      parsed.map((insight) => {
        const s = sanitizeInsight(insight, known);
        return prisma.insight.create({
          data: {
            userId,
            tag: s.tag,
            body: s.body,
            tagColor: s.tagColor,
            tagBg: s.tagBg,
            focusType: s.focusType,
            focusKey: s.focusKey,
          },
        });
      })
    );

    return created.map((i) => ({
      id: i.id,
      tag: i.tag,
      body: i.body,
      tagColor: i.tagColor || "oklch(60% 0.09 155)",
      tagBg: i.tagBg || "oklch(25% 0.06 155)",
      focusType: i.focusType,
      focusKey: i.focusKey,
    }));
  } catch {
    return [];
  }
}
