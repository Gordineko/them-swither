// shared/hooks/useTheme.js
import { useEffect, useState } from "react";

export function useTheme(defaultTheme = "light") {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    const saved = localStorage.getItem("theme") || defaultTheme;
    setTheme(saved);
    document.documentElement.setAttribute(
      "data-theme",
      saved === "dark" ? "dark" : ""
    );
  }, [defaultTheme]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute(
      "data-theme",
      theme === "dark" ? "dark" : ""
    );
  }, [theme]);

  const toggle = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  return { theme, setTheme, toggle };
}
