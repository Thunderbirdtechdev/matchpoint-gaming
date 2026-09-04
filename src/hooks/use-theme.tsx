/**
 * Client request 12.8 — light mode.
 *
 * The theme is a class on <html> (`dark` or `light`) and a string in
 * localStorage. There is no context provider: every consumer reads the same
 * single source of truth — the class actually on the document — so two toggles
 * rendered in different trees can never disagree.
 *
 * ⚠️ THE HARD PART IS THE FIRST PAINT, NOT THE TOGGLE.
 *
 * This app server-renders. The server has no idea which theme this visitor
 * chose, so whatever it emits is a guess, and if React only corrects it after
 * hydration the user watches the page flash the wrong colour. That is fixed by
 * THEME_INIT_SCRIPT below, which runs synchronously in <head> before the
 * browser paints anything.
 */

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "matchpoint-theme";

/**
 * Runs in <head>, before first paint, before React exists.
 *
 * Deliberately tiny and dependency-free — it blocks rendering, so every
 * byte is paid for on every page load.
 *
 * ⚠️ DEFAULTS TO DARK, not to the OS preference. MatchPoint is a dark-first
 * brand and the client asked for light as an *option*; honouring
 * `prefers-color-scheme` here would silently flip every existing player with a
 * light laptop onto a theme they never asked for. To follow the OS instead,
 * replace the fallback with:
 *     matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
 *
 * Wrapped in try/catch because localStorage throws outright in Safari private
 * mode, and an exception here would abort the script and leave <html> with
 * whatever the server guessed.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=="light"&&t!=="dark")t="dark";var e=document.documentElement;e.classList.remove("light","dark");e.classList.add(t);e.style.colorScheme=t;}catch(_){}})();`;

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.classList.remove("light", "dark");
  el.classList.add(theme);
  // Keeps native widgets — scrollbars, date pickers, autofill — in step with
  // the rest of the page. Without it a light page keeps dark form controls.
  el.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode: the choice applies for this session and is not remembered.
    // Failing to persist must not stop the theme from changing.
  }
}

export function useTheme() {
  /*
   * Starts as "dark" on both server and client, then syncs in an effect.
   *
   * Reading the real class during render would be the obvious thing to do and
   * is wrong: the server cannot see it, so the first client render would
   * disagree with the server's HTML and React would throw a hydration
   * mismatch. The document is already correct by then (the init script saw to
   * it) — only this component's state needs catching up, and one frame of a
   * toggle icon being wrong is invisible.
   */
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readTheme());
    setMounted(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme,
    /** False until the effect has run. Use it to avoid asserting a theme too early. */
    mounted,
  };
}
