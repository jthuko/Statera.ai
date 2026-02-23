// src/components/AppHelpAssistant.tsx
// Searchable help documentation loaded from the database
import { useEffect, useMemo, useState } from "react";
import {
  Box, CircularProgress, Chip, Dialog, DialogContent, DialogTitle, Divider,
  IconButton, InputAdornment, List, ListItemButton, ListItemText,
  Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { listHelpArticles, type HelpArticleDto } from "../api/help";

// ── Category colours ──────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  "Scheduler":           "#0288d1",
  "Staff":               "#388e3c",
  "Time Off":            "#f57c00",
  "Time Clock":          "#7b1fa2",
  "Assignments":         "#c62828",
  "Coverage":            "#00838f",
  "Constraints & Rules": "#4527a0",
  "Demand Templates":    "#1565c0",
  "Facilities":          "#2e7d32",
  "Units":               "#6d4c41",
  "Chat":                "#00695c",
  "Staff Portal":        "#0277bd",
};

function categoryColor(cat: string) {
  return CATEGORY_COLOR[cat] ?? "#607d8b";
}

// ── Article content view ──────────────────────────────────────────────────────

function ArticleView({ article, onBack }: { article: HelpArticleDto; onBack: () => void }) {
  const color = categoryColor(article.category);
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <IconButton size="small" onClick={onBack}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Chip
          label={article.category}
          size="small"
          sx={{ bgcolor: color, color: "white", fontWeight: 600 }}
        />
      </Box>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {article.title}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ overflowY: "auto", flexGrow: 1 }}>
        {article.sections.map((sec, i) => (
          <Box key={i} sx={{ mb: 2 }}>
            {sec.heading && (
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                {sec.heading}
              </Typography>
            )}
            <Typography
              variant="body2"
              sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "text.secondary" }}
            >
              {sec.body}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AppHelpAssistant() {
  const [open, setOpen] = useState(false);
  const [articles, setArticles] = useState<HelpArticleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HelpArticleDto | null>(null);

  // Load articles when dialog opens (cached after first load)
  useEffect(() => {
    if (!open || articles.length > 0) return;
    setLoading(true);
    listHelpArticles()
      .then(setArticles)
      .catch(() => {/* silently ignore — dialog will show empty state */})
      .finally(() => setLoading(false));
  }, [open, articles.length]);

  // Filter articles by search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        a.sections.some(
          (s) =>
            s.body.toLowerCase().includes(q) ||
            (s.heading?.toLowerCase().includes(q) ?? false)
        )
    );
  }, [articles, query]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, HelpArticleDto[]>();
    for (const a of filtered) {
      const arr = map.get(a.category) ?? [];
      arr.push(a);
      map.set(a.category, arr);
    }
    return map;
  }, [filtered]);

  function handleOpen() {
    setOpen(true);
    setSelected(null);
    setQuery("");
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <Tooltip title="Help & Documentation">
        <IconButton color="inherit" onClick={handleOpen} sx={{ ml: 0.5 }} aria-label="Open Help">
          <HelpOutlineIcon />
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            height: "78vh",
            maxHeight: 700,
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
          },
        }}
      >
        {/* Header */}
        <DialogTitle
          sx={{
            py: 1.5, px: 2,
            background: "linear-gradient(90deg, rgba(0,77,77,.8), rgba(0,122,153,.6))",
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <HelpOutlineIcon fontSize="small" />
          <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
            Help &amp; Documentation
          </Typography>
          <IconButton size="small" onClick={handleClose} sx={{ color: "inherit" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        {/* Search bar — only shown on list view */}
        {!selected && (
          <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search topics…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        )}

        <Divider />

        {/* Content */}
        <DialogContent sx={{ px: 2, py: 1.5, flexGrow: 1, overflowY: "auto" }}>
          {selected ? (
            <ArticleView article={selected} onBack={() => setSelected(null)} />
          ) : loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : articles.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
              No help articles found.
            </Typography>
          ) : (
            <>
              {filtered.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
                  No articles match "{query}".
                </Typography>
              )}
              {[...grouped.entries()].map(([category, categoryArticles]) => (
                <Box key={category} sx={{ mb: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Box
                      sx={{
                        width: 10, height: 10, borderRadius: "50%",
                        bgcolor: categoryColor(category), flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                      sx={{ textTransform: "uppercase", letterSpacing: 0.8 }}
                    >
                      {category}
                    </Typography>
                  </Stack>
                  <List dense disablePadding sx={{ pl: 2.5 }}>
                    {categoryArticles.map((a) => (
                      <ListItemButton
                        key={a.id}
                        onClick={() => setSelected(a)}
                        sx={{ borderRadius: 1, py: 0.5 }}
                      >
                        <ListItemText
                          primary={a.title}
                          primaryTypographyProps={{ variant: "body2" }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Box>
              ))}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
