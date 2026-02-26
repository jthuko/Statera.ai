import { createTheme, type Theme } from "@mui/material/styles";

export function createAppTheme(mode: "dark" | "light"): Theme {
  const isDark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: { main: isDark ? "#004d4d" : "#00695c" },
      secondary: { main: "#9CA3AF" },
      background: isDark
        ? { default: "#0b1416", paper: "#0f1719" }
        : { default: "#f0f4f5", paper: "#ffffff" },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            border: isDark
              ? "1px solid rgba(255,255,255,.06)"
              : "1px solid rgba(0,0,0,.08)",
          },
        },
      },
    },
    typography: {
      fontFamily:
        "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    },
  });
}

// Default dark theme kept for any direct imports
export const theme = createAppTheme("dark");
