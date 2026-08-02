// The <JsonLd> renderer + a re-export of every pure builder from seo-schema.ts, so
// app code keeps importing all of them from `@/lib/jsonld` while the builders stay
// JSX-free (and unit-testable) in seo-schema.ts.
export * from "@/lib/seo-schema";

// Renders a JSON-LD <script>. The `<` escaping prevents </script> breakout.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
