import { builder } from "./builder";

// Side-effect imports: each module registers its object refs and query/mutation
// fields on the shared builder. They must run before builder.toSchema().
import "./types/views";
import "./types/results";
import "./resolvers/dashboard";
import "./resolvers/transactions";
import "./resolvers/goals";
import "./resolvers/accounts";
import "./resolvers/subscriptions";
import "./resolvers/investments";
import "./resolvers/categories";
import "./resolvers/allocations";
import "./resolvers/recurring";
import "./resolvers/insights";
import "./resolvers/advisor";
import "./resolvers/settings";
import "./resolvers/plaid";
import "./resolvers/imports";
import "./resolvers/onboarding";
import "./resolvers/billing";
import "./resolvers/messaging";

export const schema = builder.toSchema();
