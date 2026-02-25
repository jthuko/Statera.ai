import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import { createAppTheme } from "./theme";
import { queryClient } from "./queryClient";
import { AuthProvider } from "./auth/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ColorModeProvider, useColorMode } from "./context/ColorModeContext";
import App from "./App";

function ThemedApp() {
  const { mode } = useColorMode();
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ColorModeProvider>
      <ThemedApp />
    </ColorModeProvider>
  </React.StrictMode>
);
