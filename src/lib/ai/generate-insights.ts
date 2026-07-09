import { anthropic } from "./client";
import { prisma } from "@/lib/db/prisma";
import { okColor } from "@/lib/validate";

const INSIGHT_TAGS = ["Spending Pattern", "Alert", "Opportunity", "Trend"];
const DEFAULT_TAG_COLOR = "oklch(60% 0.09 155)";
const DEFAULT_TAG_BG = "oklch(25% 0.06 155)";

/** Treat model output as untrusted: clamp tag/body and reject non-color styles. */
function sanitizeInsight(i: { tag: string; body: string; tagColor: string; tagBg: string }) {
  return {
    tag: INSIGHT_TAGS.includes(i.tag) ? i.tag : "Spending Pattern",
    body: typeof i.body === "string" ? i.body.slice(0, 500) : "",
    tagColor: okColor(i.tagColor) ? i.tagColor : DEFAULT_TAG_COLOR,
    tagBg: okColor(i.tagBg) ? i.tagBg : DEFAULT_TAG_BG,
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

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    system: `You are Bulga, a calm, plain-spoken personal finance advisor. From the user's data, write 4-6 insights that are genuinely useful. Each should tell the user something they can act on this week, not just restate a number back to them.

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

Respond with ONLY a valid JSON array, most important first:
[{
  "tag": "Alert",
  "body": "Your insight: specific lever, dollar impact, and one next step.",
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
    }[];

    // Store insights in DB (model output sanitized — body/tag clamped, styles
    // validated — since tagColor/tagBg render into an inline style prop).
    const created = await Promise.all(
      parsed.map((insight) => {
        const s = sanitizeInsight(insight);
        return prisma.insight.create({
          data: {
            userId,
            tag: s.tag,
            body: s.body,
            tagColor: s.tagColor,
            tagBg: s.tagBg,
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
    }));
  } catch {
    return [];
  }
}
