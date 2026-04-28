# Roadmap: Budget — Smart Connected Budgeting

## Overview

The existing app stores and displays financial data. This roadmap transforms it into a system that computes, connects, and acts. Phase 1 wires transactions into live calculations so balances, budgets, and surplus are always accurate. Phase 2 makes goals and subscriptions intelligent using that data. Phase 3 surfaces everything as actionable notifications. Phase 4 adds financial intelligence — forecasting and AI-suggested budgets — as a final enhancement layer.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Connected Data Engine** - Wire transactions into live balance, budget, and surplus calculations
- [ ] **Phase 2: Smart Goals and Subscriptions** - Auto-allocate surplus to goals; flag subscription changes and unused services
- [ ] **Phase 3: Notification Center** - Surface spend pace, goal milestones, subscription warnings, and bill reminders in-app
- [ ] **Phase 4: Financial Intelligence** - Cash flow forecast, AI-suggested budgets, and month-over-month spending trends

## Phase Details

### Phase 1: Connected Data Engine
**Goal**: Every number in the app is computed from real transaction data — balances are never stale, budgets update on import, and monthly surplus is always available
**Depends on**: Nothing (first phase)
**Requirements**: CALC-01, CALC-02, CALC-03
**Success Criteria** (what must be TRUE):
  1. Account balance shown on the dashboard matches the sum of that account's transactions (not the manually-entered value)
  2. Budget spent/remaining updates immediately when a transaction is added or a CSV/PDF import completes
  3. A monthly surplus figure is available at month-end, derived from income minus total spending for that month
  4. Existing user data is preserved — no balances or budget figures are corrupted by the schema/logic change
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Computation layer: calculate balances, budget spent, and surplus from transactions
- [ ] 01-02-PLAN.md — Integration: wire computed values into API routes and dashboard display

### Phase 2: Smart Goals and Subscriptions
**Goal**: Surplus flows to savings goals automatically and subscriptions flag their own problems without user effort
**Depends on**: Phase 1
**Requirements**: GOAL-01, GOAL-02, GOAL-03, SUBS-01, SUBS-02, SUBS-03
**Success Criteria** (what must be TRUE):
  1. User can assign a priority weight to each savings goal (e.g., 60% vacation, 40% emergency fund)
  2. When month-end surplus is detected, it splits across goals according to priority weights with no manual action required
  3. User can view the auto-allocated amount per goal and override it before it is applied
  4. A subscription that increases in price between billing cycles is flagged visibly in the subscriptions tab
  5. A subscription with no matching transactions in the past 60 days is flagged as potentially unused
  6. Subscription amounts auto-deduct from their linked category's monthly budget
**Plans**: TBD

### Phase 3: Notification Center
**Goal**: Users see timely, actionable alerts inside the app — no checking required
**Depends on**: Phase 2
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05
**Success Criteria** (what must be TRUE):
  1. A notification center is accessible from the dashboard showing all alerts with read/unread state and full history
  2. When a budget category reaches 80% spend with days remaining in the month, a spending pace alert appears in the notification center
  3. When a goal hits 25%, 50%, 75%, or 100% of its target, a milestone notification appears
  4. Subscription price-change and inactivity flags from Phase 2 also appear as notifications
  5. A bill due date reminder appears in the notification center before the bill's due date
  6. AI-generated saving tips (via Claude) based on recent spending patterns appear in the notification center
**Plans**: TBD

### Phase 4: Financial Intelligence
**Goal**: Users can see where their finances are heading, not just where they have been
**Depends on**: Phase 1
**Requirements**: INTL-01, INTL-02, INTL-03
**Success Criteria** (what must be TRUE):
  1. A cash flow forecast for next month is visible, projecting recurring income minus subscriptions and average category spending
  2. The app suggests a budget amount for each category based on the user's actual spending history; user can accept or dismiss
  3. Each spending category shows a month-over-month trend indicator (up/down/flat) with percentage change
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Connected Data Engine | 0/2 | Planning complete | - |
| 2. Smart Goals and Subscriptions | 0/TBD | Not started | - |
| 3. Notification Center | 0/TBD | Not started | - |
| 4. Financial Intelligence | 0/TBD | Not started | - |
