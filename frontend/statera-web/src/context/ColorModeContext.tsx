// src/context/ColorModeContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";

type ColorMode = "dark" | "light";

interface ColorModeContextValue {
  mode: ColorMode;
  toggleMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextValue>({
  mode: "dark",
  toggleMode: () => {},
});

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(() => {
    return (localStorage.getItem("statera-color-mode") as ColorMode) ?? "dark";
  });

  useEffect(() => {
    localStorage.setItem("statera-color-mode", mode);
  }, [mode]);

  const toggleMode = () => setMode(m => (m === "dark" ? "light" : "dark"));

  return (
    <ColorModeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  return useContext(ColorModeContext);
}
