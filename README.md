# otterfund

A minimalist personal budgeting app — import bank statements, let AI categorize spending, and track budgets and goals.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Prisma 7** + SQLite (`better-sqlite3` adapter)
- **NextAuth** (credentials)
- **Anthropic SDK** — statement parsing, categorization, insights
- **Tailwind CSS 4** + shadcn

## Getting started

```bash
npm install            # installs deps + generates the Prisma client
npm run db:push        # creates prisma/dev.db from the schema
npm run dev            # http://localhost:3000
```

Create a `.env` in the project root:

```bash
AUTH_SECRET="<random-string>"
NEXTAUTH_SECRET="<same-random-string>"
DATABASE_URL="file:./prisma/dev.db"
ANTHROPIC_API_KEY="sk-ant-..."   # optional — only for AI features
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run db:push` | Sync the Prisma schema to SQLite |
| `npm run db:studio` | Open Prisma Studio |
