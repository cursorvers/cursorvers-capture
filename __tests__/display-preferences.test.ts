/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TEXT_SIZE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  applyTextSizePreference,
  applyThemePreference,
  getStoredTextSizePreference,
  getStoredThemePreference,
  resolveTheme,
  setStoredTextSizePreference,
  setStoredThemePreference,
} from "@/app/lib/display-preferences";

describe("display-preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-preference");
    document.documentElement.removeAttribute("data-text-size");
    document.head.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("defaults to dark theme and standard text size", () => {
    expect(getStoredThemePreference()).toBe("dark");
    expect(getStoredTextSizePreference()).toBe("standard");
  });

  it("ignores invalid stored preferences", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, "huge");

    expect(getStoredThemePreference()).toBe("dark");
    expect(getStoredTextSizePreference()).toBe("standard");
  });

  it("resolves system theme from media preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("applies theme class and theme-color meta", () => {
    const resolved = applyThemePreference("light");

    expect(resolved).toBe("light");
    expect(document.documentElement.classList.contains("theme-light")).toBe(
      true,
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.themePreference).toBe("light");
    expect(
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.content,
    ).toBe("#f6f7fb");

    applyThemePreference("dark");

    expect(
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.content,
    ).toBe("#0b0d12");
  });

  it("persists theme preference", () => {
    setStoredThemePreference("system");

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(document.documentElement.dataset.themePreference).toBe("system");
  });

  it("applies and persists text size as html font-size", () => {
    expect(applyTextSizePreference("large")).toBe("112.5%");
    expect(document.documentElement.style.fontSize).toBe("112.5%");
    expect(document.documentElement.dataset.textSize).toBe("large");

    setStoredTextSizePreference("xlarge");

    expect(localStorage.getItem(TEXT_SIZE_STORAGE_KEY)).toBe("xlarge");
    expect(document.documentElement.style.fontSize).toBe("125%");
  });
});
