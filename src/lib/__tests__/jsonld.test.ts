import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { organizationJsonLd, faqJsonLd, articleJsonLd } from "@/lib/seo-schema";
import { JsonLd } from "@/lib/jsonld";
import { FAQ } from "@/lib/faq";

describe("<JsonLd> escapes its payload", () => {
  // This component writes attacker-influenceable data (a post title, an author
  // name, an FAQ answer) into `dangerouslySetInnerHTML` inside a <script>. An
  // HTML parser ends a <script> at the first literal "</script>", ANYWHERE -
  // including inside a JSON string - so a title of `</script><img onerror=...>`
  // would break out of the block and execute. JSON.stringify does NOT escape
  // "<"; the `.replace(/</g, "\\u003c")` is the only thing standing there.
  //
  // It had no test until the file was moved (see the shim-direction change that
  // added this). Moving XSS-prevention logic with no cover is how the cover
  // never gets written, so it is written here.
  // `createElement` rather than JSX: vitest.config.ts only discovers
  // `src/**/*.test.ts`, so renaming this file to .tsx would make the whole suite
  // silently vanish from the run - the same vacuous-check shape as #256.
  const render = (data: Record<string, unknown>) => renderToStaticMarkup(createElement(JsonLd, { data }));

  it("renders no literal </script> even when the payload contains one", () => {
    const html = render({ title: "</script><img src=x onerror=alert(1)>" });
    expect(html).not.toContain("</script><img");
    // The one legitimate </script> is the closing tag of the element itself.
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it("escapes every '<', not just the one in </script>", () => {
    const html = render({ a: "<b>", b: "x < y" });
    const body = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"));
    expect(body).not.toContain("<");
    expect(body).toContain("\\u003c");
  });

  it("still emits payload that parses back to the original object", () => {
    // The escaping must be reversible - < is valid JSON for "<", so a
    // consumer (Google's parser) sees exactly what was passed in.
    const data = { "@type": "Thing", name: "a < b </script>" };
    const html = render(data);
    const body = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"));
    expect(JSON.parse(body)).toEqual(data);
  });
});

describe("organizationJsonLd", () => {
  it("emits a valid Organization with brand-entity signals", () => {
    const o = organizationJsonLd() as Record<string, any>;
    expect(o["@type"]).toBe("Organization");
    expect(o.foundingDate).toBe("2019");
    expect(o.logo["@type"]).toBe("ImageObject");
    // 640 -> 512: the site logo became the 3D coin, which ships at 512x512.
    // This assertion is doing its job - a declared dimension that does not match
    // the actual file is exactly the kind of thing Google's structured-data
    // validator flags, so it should fail when the asset is swapped.
    expect(o.logo.width).toBe(512);
    expect(Array.isArray(o.sameAs) && o.sameAs.length).toBeGreaterThanOrEqual(4);
  });
});

describe("faqJsonLd", () => {
  it("maps Q&As into a FAQPage with Question/Answer nodes", () => {
    const f = faqJsonLd(FAQ) as Record<string, any>;
    expect(f["@type"]).toBe("FAQPage");
    expect(f.mainEntity).toHaveLength(FAQ.length);
    expect(f.mainEntity[0]["@type"]).toBe("Question");
    expect(f.mainEntity[0].name).toBe(FAQ[0].q);
    expect(f.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
  });
});

describe("articleJsonLd", () => {
  it("uses a Person author + a sized publisher logo", () => {
    const a = articleJsonLd({
      title: "T",
      excerpt: "E",
      slug: "s",
      cover: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { name: "Alice" },
    }) as Record<string, any>;
    expect(a["@type"]).toBe("BlogPosting");
    expect(a.author["@type"]).toBe("Person");
    expect(a.publisher.logo.width).toBe(512); // see the Organization test above
  });
});
