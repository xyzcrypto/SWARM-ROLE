import { describe, expect, it } from "vitest";
import { personJsonLd } from "@/lib/jsonld";

describe("Person schema for a public profile", () => {
  const base = { username: "satoshi" };

  it("uses the display name, falling back to the handle", () => {
    expect(personJsonLd({ ...base, name: "Satoshi" }).name).toBe("Satoshi");
    expect(personJsonLd(base).name).toBe("@satoshi");
  });

  it("always carries an absolute profile url", () => {
    expect(personJsonLd(base).url).toMatch(/\/u\/satoshi$/);
  });

  // The site-wide rule is that member emails are never exposed publicly.
  it("never emits an email", () => {
    expect(JSON.stringify(personJsonLd({ ...base, name: "S", bio: "hi" }))).not.toMatch(/email/i);
  });

  it("builds sameAs from handles, normalising a leading @", () => {
    const out: any = personJsonLd({ ...base, twitter: "@sat", github: "sat" });
    expect(out.sameAs).toContain("https://x.com/sat");
    expect(out.sameAs).toContain("https://github.com/sat");
  });

  // A bare handle or "example.com" is not a URL; emitting it would make the
  // whole node invalid rather than merely incomplete.
  it("drops a website that is not an absolute URL", () => {
    expect((personJsonLd({ ...base, website: "example.com" }) as any).sameAs).toBeUndefined();
    expect((personJsonLd({ ...base, website: "https://example.com" }) as any).sameAs).toEqual([
      "https://example.com",
    ]);
  });

  it("omits sameAs entirely when there is nothing to link", () => {
    expect((personJsonLd(base) as any).sameAs).toBeUndefined();
  });
});
