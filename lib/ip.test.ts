import { describe, expect, it } from "vitest";
import { isValidPublicIp } from "./ip";

describe("isValidPublicIp", () => {
  it("accepts genuine public IPv4 addresses", () => {
    expect(isValidPublicIp("93.184.216.34")).toBe(true);
    expect(isValidPublicIp("8.8.8.8")).toBe(true);
  });

  it("rejects private, loopback and link-local IPv4", () => {
    expect(isValidPublicIp("192.168.1.1")).toBe(false);
    expect(isValidPublicIp("10.0.0.5")).toBe(false);
    expect(isValidPublicIp("172.16.0.1")).toBe(false);
    expect(isValidPublicIp("127.0.0.1")).toBe(false);
    expect(isValidPublicIp("169.254.1.1")).toBe(false);
  });

  it("rejects IPv4-mapped IPv6 loopback (regression for ::ffff:127.0.0.1)", () => {
    expect(isValidPublicIp("::ffff:127.0.0.1")).toBe(false);
    expect(isValidPublicIp("::ffff:192.168.0.1")).toBe(false);
  });

  it("accepts IPv4-mapped IPv6 that wraps a public IPv4", () => {
    expect(isValidPublicIp("::ffff:93.184.216.34")).toBe(true);
  });

  it("rejects IPv6 loopback and unique-local/link-local", () => {
    expect(isValidPublicIp("::1")).toBe(false);
    expect(isValidPublicIp("fe80::1")).toBe(false);
    expect(isValidPublicIp("fd00::1")).toBe(false);
  });

  it("rejects empty and malformed input", () => {
    expect(isValidPublicIp(null)).toBe(false);
    expect(isValidPublicIp("")).toBe(false);
    expect(isValidPublicIp("not-an-ip")).toBe(false);
  });
});
