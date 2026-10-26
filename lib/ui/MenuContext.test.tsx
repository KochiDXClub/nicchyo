import { renderHook, act } from "@testing-library/react";
import { MenuProvider, useMenu } from "./MenuContext";
import { expect, test, describe } from "vitest";

describe("MenuContext", () => {
  test("useMenu should throw an error if used outside of MenuProvider", () => {
    // Suppress console.error for the expected error
    const originalError = console.error;
    console.error = () => {};

    expect(() => renderHook(() => useMenu())).toThrow("useMenu must be used within MenuProvider");

    console.error = originalError;
  });

  test("should provide default state and toggle functions", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MenuProvider>{children}</MenuProvider>
    );

    const { result } = renderHook(() => useMenu(), { wrapper });

    expect(result.current.isMenuOpen).toBe(false);

    act(() => {
      result.current.openMenu();
    });
    expect(result.current.isMenuOpen).toBe(true);

    act(() => {
      result.current.closeMenu();
    });
    expect(result.current.isMenuOpen).toBe(false);

    act(() => {
      result.current.toggleMenu();
    });
    expect(result.current.isMenuOpen).toBe(true);

    act(() => {
      result.current.toggleMenu();
    });
    expect(result.current.isMenuOpen).toBe(false);
  });
});

describe("rememberMenuReopen", () => {
  test("目印があると、マウント時にメニューを開き、目印は消す", () => {
    sessionStorage.setItem("nicchyo-reopen-menu", "1");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MenuProvider>{children}</MenuProvider>
    );
    const { result } = renderHook(() => useMenu(), { wrapper });
    expect(result.current.isMenuOpen).toBe(true);
    expect(sessionStorage.getItem("nicchyo-reopen-menu")).toBeNull();
  });
});
