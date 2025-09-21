import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#004d4d" },   // deep teal
    secondary: { main: "#9CA3AF" }, // metallic gray
    background: { default: "#0b1416", paper: "#0f1719" },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiPaper: { styleOverrides: { root: { border: "1px solid rgba(255,255,255,.06)" } } },
  },
  typography: {
    fontFamily:
      "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
});
