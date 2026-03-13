import { describe, it, expect, vi, beforeEach } from "vitest";
import { initiateLogin } from "./initiateLogin";

describe("initiateLogin", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset URL
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        href: "http://localhost:3000/",
        origin: "http://localhost:3000",
        pathname: "/",
        hash: "",
        search: ""
      }
    });
    // Mock history.replaceState
    window.history.replaceState = vi.fn();
  });

  it("returns tenantId from localStorage", () => {
    localStorage.setItem("tenantId", "stored-tenant");
    const result = initiateLogin();
    expect(result).toBe("stored-tenant");
  });

  it("extracts tenantId from URL query params and stores it", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        href: "http://localhost:3000/?tenantId=url-tenant&email=test@test.com",
        origin: "http://localhost:3000",
        pathname: "/",
        hash: "",
        search: "?tenantId=url-tenant&email=test@test.com"
      }
    });

    const result = initiateLogin();
    expect(result).toBe("url-tenant");
    expect(localStorage.getItem("tenantId")).toBe("url-tenant");
    expect(localStorage.getItem("email")).toBe("test@test.com");
  });

  it("extracts tenantId from hash params", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        href: "http://localhost:3000/#tenantId=hash-tenant",
        origin: "http://localhost:3000",
        pathname: "/",
        hash: "#tenantId=hash-tenant",
        search: ""
      }
    });

    const result = initiateLogin();
    expect(result).toBe("hash-tenant");
  });

  it("redirects to KPS when no tenantId available", () => {
    const mockAssign = vi.fn();
    const { href: _href, ...locationWithoutHref } = originalLocation;
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...locationWithoutHref,
        origin: "http://localhost:3000",
        pathname: "/",
        hash: "",
        search: "",
        set href(val: string) { mockAssign(val); },
        get href() { return "http://localhost:3000/"; }
      }
    });

    const result = initiateLogin();
    expect(result).toBeNull();
  });

  it("stores email from URL params", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        href: "http://localhost:3000/?tenantId=t1&email=user@example.com",
        origin: "http://localhost:3000",
        pathname: "/",
        hash: "",
        search: "?tenantId=t1&email=user@example.com"
      }
    });

    initiateLogin();
    expect(localStorage.getItem("email")).toBe("user@example.com");
  });
});
