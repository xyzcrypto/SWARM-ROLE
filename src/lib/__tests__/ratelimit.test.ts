import { describe, it, expect } from "vitest";
import { clientIp } from "@/lib/ratelimit";

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/x", { headers });
}

describe("clientIp", () => {
  it("uses the first IP in x-forwarded-for", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("trims whitespace around the forwarded IP", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "  9.9.9.9 " }))).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip when no x-forwarded-for", () => {
    expect(clientIp(reqWith({ "x-real-ip": "10.0.0.1" }))).toBe("10.0.0.1");
  });

  it("falls back to 'anon' when no client IP headers are present", () => {
    expect(clientIp(reqWith({}))).toBe("anon");
  });
});
