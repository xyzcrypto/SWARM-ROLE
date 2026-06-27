import { describe, it, expect } from "vitest";
import { organizationJsonLd, faqJsonLd, articleJsonLd } from "@/lib/seo-schema";
import { FAQ } from "@/lib/faq";

describe("organizationJsonLd", () => {
  it("emits a valid Organization with brand-entity signals", () => {
    const o = organizationJsonLd() as Record<string, any>;
    expect(o["@type"]).toBe("Organization");
    expect(o.foundingDate).toBe("2019");
    expect(o.logo["@type"]).toBe("ImageObject");
    expect(o.logo.width).toBe(640);
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
    expect(a.publisher.logo.width).toBe(640);
  });
});
