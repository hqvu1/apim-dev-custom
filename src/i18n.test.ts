import { describe, it, expect } from "vitest";

// Import i18n to trigger initialization
import "./i18n";
import i18n from "i18next";

describe("i18n", () => {
  it("initializes i18next", () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it("has English as a language", () => {
    expect(i18n.hasResourceBundle("en", "translation")).toBe(true);
  });

  it("has Spanish as a language", () => {
    expect(i18n.hasResourceBundle("es", "translation")).toBe(true);
  });

  it("translates a known key in English", () => {
    i18n.changeLanguage("en");
    const translated = i18n.t("appTitle");
    expect(translated).toBeTruthy();
    expect(typeof translated).toBe("string");
  });
});
