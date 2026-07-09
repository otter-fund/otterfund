// Renders a JSON-LD structured-data block. Server-safe and client-safe — it's a
// plain <script>. Pass one schema object or an array of them.
//
// JSON.stringify escaping: we neutralize "<" so a "</script>" inside any string
// value can't break out of the script tag (standard JSON-LD hardening).

export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
