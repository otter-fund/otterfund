# Requirements: Budget — Smart Connected Budgeting

**Defined:** 2026-04-28
**Core Value:** The app does the thinking so the user doesn't have to — surplus flows to goals, spending updates budgets, subscriptions flag themselves, and notifications guide better decisions.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Auto-Calculations

- [ ] **CALC-01**: Account balances computed from transaction history (not manually entered)
- [ ] **CALC-02**: Budget spent/remaining auto-updates when transactions are added or imported
- [ ] **CALC-03**: Monthly surplus calculated from income minus total spending at month-end

### Smart Goals

- [ ] **GOAL-01**: User can assign priority weights to each savings goal (e.g., 60% vacation, 40% emergency)
- [ ] **GOAL-02**: Surplus auto-allocates to goals based on priority weights with smart defaults
- [ ] **GOAL-03**: Goal progress updates automatically as surplus is allocated (user can override)

### Subscription Intelligence

- [ ] **SUBS-01**: Detect and flag subscription price changes between billing cycles
- [ ] **SUBS-02**: Flag subscriptions with no matching transactions in recent months (unused)
- [ ] **SUBS-03**: Subscriptions auto-deduct from their category's budget allocation

### Notifications

- [ ] **NOTF-01**: In-app notification center with notification history and read/unread state
- [ ] **NOTF-02**: Spending pace alerts when budget category hits 80% with days remaining in month
- [ ] **NOTF-03**: Goal milestone notifications at 25%, 50%, 75%, 100% progress
- [ ] **NOTF-04**: AI-powered saving tips based on spending patterns (via Claude)
- [ ] **NOTF-05**: Bill due date reminders triggered before payment due date

### Financial Intelligence

- [ ] **INTL-01**: Cash flow forecast projecting next month from recurring income, subscriptions, and average spending
- [ ] **INTL-02**: AI-suggested budget amounts per category based on actual spending history
- [ ] **INTL-03**: Month-over-month spending trends per category with increase/decrease indicators

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Notifications — Extended

- **NOTF-06**: Email digest for important alerts (overspending, subscription changes)
- **NOTF-07**: Push notifications via service worker

### Automation — Extended

- **AUTO-01**: Recurring transaction auto-creation for predicted upcoming expenses
- **AUTO-02**: Automatic categorization rules learned from user corrections
- **AUTO-03**: Budget auto-adjustment based on seasonal spending patterns

### Integrations

- **INTG-01**: Bank API connection (Plaid) for automatic transaction import
- **INTG-02**: Export financial reports as PDF

## Out of Scope

| Feature | Reason |
|---------|--------|
| Email/push notifications | In-app only for v1; add channels later |
| Bank API integrations | Manual import sufficient; high complexity and cost |
| OAuth login | Email/password works for personal use |
| Mobile app | Web-first approach |
| Multi-currency | Single currency per user is sufficient |
| Shared/family budgets | Single user only |
| Investment tracking | Different product category; keep focused on budgeting |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CALC-01 | Phase 1 | Pending |
| CALC-02 | Phase 1 | Pending |
| CALC-03 | Phase 1 | Pending |
| GOAL-01 | Phase 2 | Pending |
| GOAL-02 | Phase 2 | Pending |
| GOAL-03 | Phase 2 | Pending |
| SUBS-01 | Phase 2 | Pending |
| SUBS-02 | Phase 2 | Pending |
| SUBS-03 | Phase 2 | Pending |
| NOTF-01 | Phase 3 | Pending |
| NOTF-02 | Phase 3 | Pending |
| NOTF-03 | Phase 3 | Pending |
| NOTF-04 | Phase 3 | Pending |
| NOTF-05 | Phase 3 | Pending |
| INTL-01 | Phase 4 | Pending |
| INTL-02 | Phase 4 | Pending |
| INTL-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-04-28*
*Last updated: 2026-04-28 after roadmap creation*
