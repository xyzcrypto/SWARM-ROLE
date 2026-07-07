import { describe, expect, it } from "vitest";
import { orderProviders } from "@/lib/ai/registry";

const both = [
  { id: "groq", enabled: true },
  { id: "gemini", enabled: true },
];

describe("orderProviders", () => {
  it("honors the requested order", () => {
    expect(orderProviders("gemini,groq", both)).toEqual(["gemini", "groq"]);
    expect(orderProviders("groq,gemini", both)).toEqual(["groq", "gemini"]);
  });
  it("filters out disabled providers", () => {
    expect(orderProviders("gemini,groq", [{ id: "groq", enabled: true }, { id: "gemini", enabled: false }])).toEqual(["groq"]);
  });
  it("appends enabled providers not named in the order, de-duplicated", () => {
    expect(orderProviders("gemini", both)).toEqual(["gemini", "groq"]);
    expect(orderProviders("groq,groq", both)).toEqual(["groq", "gemini"]);
  });
  it("falls back to the default order when empty", () => {
    expect(orderProviders("", both)).toEqual(["gemini", "groq"]);
  });
  it("ignores unknown provider ids", () => {
    expect(orderProviders("openai,groq", both)).toEqual(["groq", "gemini"]);
  });
});
