// Renders a JSON-LD structured-data block. Server-safe and client-safe — it's a
// plain <script>. Pass one schema object or an array of them.
//
// Multiple nodes are wrapped in a single `@graph` object with ONE top-level
// `@context`, rather than emitted as a bare array. A bare top-level array has no
// `@context`, which crashes consumers (some browsers / SEO tools / crawlers) that
// read `parsed["@context"].toLowerCase()` — and it's the non-canonical way to
// express a graph anyway. `@graph` is Google's recommended multi-entity form.
//
// JSON.stringify escaping: we neutralize "<" so a "</script>" inside any string
// value can't break out of the script tag (standard JSON-LD hardening).

const SCHEMA_CONTEXT = "https://schema.org";

/** Drop a node's own `@context` (redundant once it lives under a graph context). */
function stripContext(node: object): object {
  if (!node || typeof node !== "object") return node;
  const rest = { ...(node as Record<string, unknown>) };
  delete rest["@context"];
  return rest;
}

export function JsonLd({ data }: { data: object | object[] }) {
  const payload = Array.isArray(data)
    ? { "@context": SCHEMA_CONTEXT, "@graph": data.map(stripContext) }
    : data;
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
