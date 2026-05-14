/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useOnlineStatus } from "@/app/lib/network";

function setOnlineFlag(value: boolean): void {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get() {
      return value;
    },
  });
}

describe("useOnlineStatus (R1 Resilience Layer 2 2026-05-14)", () => {
  let restoreOnline: boolean;
  beforeEach(() => {
    restoreOnline = navigator.onLine;
  });
  afterEach(() => {
    setOnlineFlag(restoreOnline);
    vi.restoreAllMocks();
  });

  it("returns true when navigator.onLine is true at mount", () => {
    setOnlineFlag(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("returns false when navigator.onLine is false at mount", () => {
    setOnlineFlag(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("flips to false on offline event", () => {
    setOnlineFlag(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    act(() => {
      setOnlineFlag(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
  });

  it("flips to true on online event", () => {
    setOnlineFlag(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
    act(() => {
      setOnlineFlag(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("removes listeners on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();
    const events = removeSpy.mock.calls.map((call) => call[0]);
    expect(events).toContain("online");
    expect(events).toContain("offline");
  });

  it("treats navigator.onLine === undefined as online (conservative default)", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get() {
        return undefined as unknown as boolean;
      },
    });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });
});
