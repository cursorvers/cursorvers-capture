export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";
export type TextSizePreference = "standard" | "large" | "xlarge";

export const THEME_STORAGE_KEY = "cursorvers_theme";
export const TEXT_SIZE_STORAGE_KEY = "cursorvers_text_size";

const DARK_THEME_COLOR = "#0b0d12";
const LIGHT_THEME_COLOR = "#f6f7fb";

const TEXT_SIZE_SCALE: Record<TextSizePreference, string> = {
  standard: "100%",
  large: "120%",
  xlarge: "140%",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

export function isTextSizePreference(
  value: unknown,
): value is TextSizePreference {
  return value === "standard" || value === "large" || value === "xlarge";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : "dark";
}

export function getStoredTextSizePreference(): TextSizePreference {
  if (typeof window === "undefined") return "standard";
  const stored = window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
  return isTextSizePreference(stored) ? stored : "standard";
}

export function getSystemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function applyThemePreference(
  preference: ThemePreference,
  systemPrefersDark = getSystemPrefersDark(),
): ResolvedTheme {
  const resolved = resolveTheme(preference, systemPrefersDark);
  if (typeof document === "undefined") return resolved;

  const root = document.documentElement;
  root.classList.remove("theme-dark", "theme-light");
  root.classList.add(`theme-${resolved}`);
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;

  const themeColor = resolved === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = themeColor;
  return resolved;
}

export function setStoredThemePreference(
  preference: ThemePreference,
): ResolvedTheme {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  }
  return applyThemePreference(preference);
}

export function applyTextSizePreference(
  preference: TextSizePreference,
): string {
  const scale = TEXT_SIZE_SCALE[preference] ?? TEXT_SIZE_SCALE.standard;
  if (typeof document !== "undefined") {
    document.documentElement.style.fontSize = scale;
    document.documentElement.dataset.textSize = preference;
  }
  return scale;
}

export function setStoredTextSizePreference(
  preference: TextSizePreference,
): string {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, preference);
  }
  return applyTextSizePreference(preference);
}
