// src/pages/Landing.tsx
import * as React from "react";
import {
  Accordion, AccordionDetails, AccordionSummary,
  Box, Button, Card, CardContent, Chip, Container, Divider, Grid,
  IconButton, Stack, Tab, Tabs, Typography, useTheme, useMediaQuery,
} from "@mui/material";
import {
  AutoAwesome as AIIcon,
  CalendarMonth as CalendarIcon,
  Group as GroupIcon,
  AccessTime as ClockIcon,
  Rule as RuleIcon,
  WorkHistory as OpenShiftIcon,
  BeachAccess as TimeOffIcon,
  Analytics as AnalyticsIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowIcon,
  PlayCircleFilled as PlayIcon,
  ExpandMore as ExpandMoreIcon,
  Star as StarIcon,
  TrendingDown as TrendingDownIcon,
  AccessAlarm as AlarmIcon,
  Psychology as PsychologyIcon,
  Shield as ShieldIcon,
  Smartphone as PhoneIcon,
  Notifications as NotifIcon,
  TableChart as TableChartIcon,
  Close as CloseIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAL       = "#4db6ac";
const TEAL_DARK  = "#00897b";
const TEAL_MID   = "#26a69a";
const DARK_BG    = "#070d0e";
const DARK_CARD  = "#0e1a1c";
const DARK_CARD2 = "#132022";

const HERO_IMAGE    = "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80";
const FEATURE_IMG_1 = "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=900&q=80";
const FEATURE_IMG_2 = "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80";
const FEATURE_IMG_3 = "https://images.unsplash.com/photo-1504439468489-c8920d796a29?auto=format&fit=crop&w=900&q=80";
const TEAM_IMAGE    = "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=900&q=80";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavBar({ mobileMenuOpen, setMobileMenuOpen }: { mobileMenuOpen: boolean; setMobileMenuOpen: (v: boolean) => void }) {
  const [scrolled, setScrolled] = React.useState(false);
  const { user } = useAuth();
  const hasToken = !!localStorage.getItem("statera:accessToken");
  const isLoggedIn = !!(user || hasToken);
  const dashboardPath = (user?.systemRole ?? "") === "Staff" ? "/portal" : "/app";
  React.useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const navLinks = [
    { label: "Features",     id: "features"      },
    { label: "How It Works", id: "how-it-works"  },
    { label: "Testimonials", id: "testimonials"  },
    { label: "Pricing",      id: "pricing"       },
    { label: "FAQ",          id: "faq"           },
  ];

  return (
    <Box sx={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1200,
      transition: "all 0.3s",
      background: scrolled
        ? "rgba(7,13,14,0.96)"
        : "linear-gradient(90deg, rgba(0,40,50,0.98) 0%, rgba(0,60,80,0.95) 100%)",
      backdropFilter: "blur(16px)",
      borderBottom: scrolled ? "1px solid rgba(0,137,123,0.2)" : "1px solid transparent",
      boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.4)" : "none",
    }}>
      <Container maxWidth="xl">
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: { xs: 1, md: 1.5 }, px: { xs: 0, md: 1 } }}>

          {/* Logo */}
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ cursor: "pointer" }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <Box sx={{
              width: 38, height: 38, borderRadius: 2, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg, rgba(0,137,123,0.4) 0%, rgba(0,137,123,0.2) 100%)",
              border: "1px solid rgba(77,182,172,0.5)",
              boxShadow: "0 0 16px rgba(0,137,123,0.3)",
            }}>
              <Typography sx={{ fontSize: 18, fontWeight: 900, color: TEAL, lineHeight: 1, letterSpacing: -1 }}>S</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: -0.5, lineHeight: 1.1 }}>Statera AI</Typography>
              <Typography sx={{ fontSize: 9, color: TEAL, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>Healthcare</Typography>
            </Box>
          </Stack>

          {/* Desktop nav */}
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: "none", md: "flex" } }}>
            {navLinks.map(n => (
              <Button key={n.id} onClick={() => scrollTo(n.id)} sx={{
                color: "rgba(255,255,255,0.7)", fontSize: 13.5, fontWeight: 500,
                textTransform: "none", px: 1.5, py: 0.75,
                "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.06)" },
              }}>
                {n.label}
              </Button>
            ))}
          </Stack>

          {/* CTA buttons */}
          <Stack direction="row" spacing={1} alignItems="center">
            {isLoggedIn ? (
              <Button component={RouterLink} to={dashboardPath} variant="contained" sx={{
                bgcolor: TEAL_DARK, color: "#fff", fontWeight: 700, fontSize: 13,
                textTransform: "none", px: 2.5, py: 0.9, borderRadius: 1.5,
                display: { xs: "none", sm: "flex" },
                boxShadow: "0 0 16px rgba(0,137,123,0.4)",
                "&:hover": { bgcolor: "#00796b", boxShadow: "0 0 24px rgba(0,137,123,0.6)" },
              }}>
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button component={RouterLink} to="/login" sx={{
                  color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 600,
                  textTransform: "none", display: { xs: "none", sm: "flex" },
                  "&:hover": { color: "#fff" },
                }}>
                  Sign In
                </Button>
                <Button component={RouterLink} to="/signup" variant="contained" sx={{
                  bgcolor: TEAL_DARK, color: "#fff", fontWeight: 700, fontSize: 13,
                  textTransform: "none", px: 2.5, py: 0.9, borderRadius: 1.5,
                  display: { xs: "none", sm: "flex" },
                  boxShadow: "0 0 16px rgba(0,137,123,0.4)",
                  "&:hover": { bgcolor: "#00796b", boxShadow: "0 0 24px rgba(0,137,123,0.6)" },
                }}>
                  Get Started Free
                </Button>
              </>
            )}
            <IconButton size="small" sx={{ color: "rgba(255,255,255,0.7)", display: { xs: "flex", md: "none" } }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </IconButton>
          </Stack>
        </Stack>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <Box sx={{ pb: 2.5, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {navLinks.map(n => (
              <Button key={n.id} fullWidth onClick={() => { scrollTo(n.id); setMobileMenuOpen(false); }} sx={{
                color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: 500,
                textTransform: "none", justifyContent: "flex-start", py: 1.25, px: 2,
              }}>
                {n.label}
              </Button>
            ))}
            <Box sx={{ px: 2, pt: 1.5, borderTop: "1px solid rgba(255,255,255,0.05)", mt: 1 }}>
              {isLoggedIn ? (
                <Button component={RouterLink} to={dashboardPath} fullWidth variant="contained" onClick={() => setMobileMenuOpen(false)} sx={{
                  bgcolor: TEAL_DARK, color: "#fff", fontWeight: 700, textTransform: "none", borderRadius: 1.5, py: 1.25,
                  "&:hover": { bgcolor: "#00796b" },
                }}>
                  Go to Dashboard
                </Button>
              ) : (
                <Stack direction="row" spacing={1.5}>
                  <Button component={RouterLink} to="/login" fullWidth variant="outlined" onClick={() => setMobileMenuOpen(false)} sx={{
                    borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)", fontWeight: 600,
                    textTransform: "none", borderRadius: 1.5, py: 1.25,
                    "&:hover": { borderColor: TEAL, color: TEAL },
                  }}>
                    Sign In
                  </Button>
                  <Button component={RouterLink} to="/signup" fullWidth variant="contained" onClick={() => setMobileMenuOpen(false)} sx={{
                    bgcolor: TEAL_DARK, color: "#fff", fontWeight: 700, textTransform: "none", borderRadius: 1.5, py: 1.25,
                    "&:hover": { bgcolor: "#00796b" },
                  }}>
                    Get Started
                  </Button>
                </Stack>
              )}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
}

// ─── Video Modal ──────────────────────────────────────────────────────────────

function VideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <Box onClick={onClose} sx={{
      position: "fixed", inset: 0, zIndex: 1500,
      bgcolor: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(8px)",
    }}>
      <Box onClick={e => e.stopPropagation()} sx={{ width: { xs: "95vw", md: "80vw" }, maxWidth: 900, position: "relative" }}>
        <IconButton onClick={onClose} sx={{
          position: "absolute", top: -44, right: 0, color: "rgba(255,255,255,0.7)",
          "&:hover": { color: "#fff" },
        }}>
          <CloseIcon />
        </IconButton>
        {/* Browser chrome */}
        <Box sx={{ borderRadius: "12px 12px 0 0", bgcolor: "#1e2d2f", px: 2, py: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#ff5f57" }} />
          <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#ffbd2e" }} />
          <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#28c840" }} />
          <Box sx={{ flex: 1, mx: 2, bgcolor: "rgba(255,255,255,0.07)", borderRadius: 1, px: 1.5, py: 0.25, textAlign: "center" }}>
            <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>statera.ai/app/scheduler</Typography>
          </Box>
        </Box>
        {/* Embed */}
        <Box sx={{ position: "relative", paddingTop: "56.25%", bgcolor: "#070d0e", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
          <iframe
            src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=0"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            allow="autoplay; encrypted-media"
            allowFullScreen
            title="Statera AI Demo"
          />
        </Box>
      </Box>
    </Box>
  );
}

// ─── Mock Dashboard Screenshot ─────────────────────────────────────────────────

function DashboardMock() {
  return (
    <Box sx={{
      borderRadius: 2, overflow: "hidden",
      border: "1px solid rgba(77,182,172,0.25)",
      boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,137,123,0.15)",
      bgcolor: DARK_CARD,
    }}>
      {/* Browser bar */}
      <Box sx={{ bgcolor: "#1a2f32", px: 1.5, py: 0.75, display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#ff5f57" }} />
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#ffbd2e" }} />
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#28c840" }} />
        <Box sx={{ flex: 1, mx: 1.5, bgcolor: "rgba(255,255,255,0.06)", borderRadius: 1, px: 1, py: 0.2, textAlign: "center" }}>
          <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>statera.ai/app/assignments</Typography>
        </Box>
      </Box>
      {/* Content */}
      <Box sx={{ p: 1.5 }}>
        {/* Stats row */}
        <Stack direction="row" flexWrap="wrap" sx={{ mb: 1, gap: 1 }}>
          {[
            { label: "On Duty", value: "18", color: TEAL },
            { label: "Open Shifts", value: "4", color: "#f57c00" },
            { label: "Time Off", value: "2", color: "#7c4dff" },
            { label: "Coverage", value: "94%", color: "#2e7d32" },
          ].map(s => (
            <Box key={s.label} sx={{ flex: "1 1 40%", minWidth: 0, bgcolor: "rgba(255,255,255,0.04)", borderRadius: 1.5, p: 1, border: "1px solid rgba(255,255,255,0.06)" }}>
              <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.45)", mb: 0.25 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</Typography>
            </Box>
          ))}
        </Stack>

        {/* Schedule grid mock */}
        <Box sx={{ bgcolor: "rgba(255,255,255,0.025)", borderRadius: 1.5, p: 1, border: "1px solid rgba(255,255,255,0.04)" }}>
          {/* Days header */}
          <Stack direction="row" spacing={0.5} sx={{ mb: 0.75 }}>
            <Box sx={{ width: 50 }} />
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
              <Box key={d} sx={{ flex: 1, textAlign: "center" }}>
                <Typography sx={{ fontSize: 8, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{d}</Typography>
              </Box>
            ))}
          </Stack>
          {/* Staff rows */}
          {[
            { name: "J. Smith RN", shifts: [1,1,0,1,1,0,0], color: "#4db6ac" },
            { name: "M. Jones LPN", shifts: [0,1,1,0,1,1,0], color: "#81c784" },
            { name: "R. Davis CNA", shifts: [1,0,1,1,0,0,1], color: "#7986cb" },
            { name: "T. Wilson RN", shifts: [1,1,1,0,0,1,0], color: "#4db6ac" },
          ].map((staff, i) => (
            <Stack key={i} direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
              <Box sx={{ width: 50, flexShrink: 0 }}>
                <Typography sx={{ fontSize: 7.5, color: "rgba(255,255,255,0.55)", lineHeight: 1 }} noWrap>{staff.name}</Typography>
              </Box>
              {staff.shifts.map((active, j) => (
                <Box key={j} sx={{
                  flex: 1, height: 18, borderRadius: 0.75,
                  bgcolor: active ? `${staff.color}22` : "rgba(255,255,255,0.03)",
                  border: active ? `1px solid ${staff.color}44` : "1px solid rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {active ? <Typography sx={{ fontSize: 6.5, color: staff.color, fontWeight: 700 }}>7–15</Typography> : null}
                </Box>
              ))}
            </Stack>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// ─── Testimonial Card ──────────────────────────────────────────────────────────

function TestimonialCard({ quote, name, title, avatar }: { quote: string; name: string; title: string; avatar: string }) {
  return (
    <Card sx={{
      height: "100%", bgcolor: DARK_CARD,
      border: "1px solid rgba(77,182,172,0.12)",
      borderRadius: 3,
      transition: "border-color 0.2s, transform 0.2s",
      "&:hover": { borderColor: "rgba(77,182,172,0.35)", transform: "translateY(-4px)" },
    }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={0.5} sx={{ mb: 2 }}>
          {Array(5).fill(0).map((_, i) => <StarIcon key={i} sx={{ fontSize: 16, color: "#f9a825" }} />)}
        </Stack>
        <Typography sx={{ color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 1.7, mb: 2.5, fontStyle: "italic" }}>
          "{quote}"
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            component="img"
            src={avatar}
            alt={name}
            sx={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(77,182,172,0.3)" }}
          />
          <Box>
            <Typography sx={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{name}</Typography>
            <Typography sx={{ color: TEAL, fontSize: 12 }}>{title}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── Pricing Card ─────────────────────────────────────────────────────────────

function PricingCard({ plan, price, desc, features, highlight }: {
  plan: string; price: string; desc: string; features: string[]; highlight?: boolean;
}) {
  return (
    <Card sx={{
      height: "100%",
      bgcolor: highlight ? "rgba(0,137,123,0.12)" : DARK_CARD,
      border: highlight ? `2px solid ${TEAL_DARK}` : "1px solid rgba(255,255,255,0.07)",
      borderRadius: 3,
      position: "relative",
      transition: "transform 0.2s",
      "&:hover": { transform: "translateY(-4px)" },
    }}>
      {highlight && (
        <Chip label="Most Popular" size="small" sx={{
          position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
          bgcolor: TEAL_DARK, color: "#fff", fontWeight: 700, fontSize: 11,
        }} />
      )}
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: highlight ? TEAL : "rgba(255,255,255,0.9)", mb: 0.5 }}>{plan}</Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: 13, mb: 2.5 }}>{desc}</Typography>
        <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ mb: 2.5 }}>
          <Typography variant="h3" fontWeight={900} sx={{ color: "#fff", lineHeight: 1 }}>{price}</Typography>
          {price !== "Custom" && <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: 13, mb: 0.75 }}>/mo per facility</Typography>}
        </Stack>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.07)", mb: 2.5 }} />
        <Stack spacing={1.25}>
          {features.map(f => (
            <Stack key={f} direction="row" spacing={1} alignItems="flex-start">
              <CheckIcon sx={{ fontSize: 16, color: TEAL, mt: 0.2, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{f}</Typography>
            </Stack>
          ))}
        </Stack>
        <Button component={RouterLink} to="/signup" fullWidth variant={highlight ? "contained" : "outlined"} sx={{
          mt: 3, py: 1.25, fontWeight: 700, textTransform: "none", borderRadius: 2,
          ...(highlight
            ? { bgcolor: TEAL_DARK, color: "#fff", "&:hover": { bgcolor: "#00796b" } }
            : { borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)", "&:hover": { borderColor: TEAL, color: TEAL } }),
        }}>
          Get Started
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────

export default function Landing() {
  const { user } = useAuth();
  const hasToken = !!localStorage.getItem("statera:accessToken");
  const isLoggedIn = !!(user || hasToken);
  const dashboardPath = (user?.systemRole ?? "") === "Staff" ? "/portal" : "/app";
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [videoOpen, setVideoOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [faqOpen, setFaqOpen] = React.useState<string | false>(false);
  const [featureTab, setFeatureTab] = React.useState(0);

  const FEATURES_TAB = [
    {
      label: "AI Scheduler",
      icon: <AIIcon />,
      title: "Scheduling That Practically Runs Itself",
      desc: "Our AI analyzes staff credentials, availability, facility needs, and compliance rules to generate optimized shift suggestions in seconds. Review and approve in one click — or let bulk-accept do it for the whole week.",
      bullets: [
        "Suggests best-fit staff for every shift",
        "Respects availability windows and time-off",
        "Handles multi-day date ranges at once",
        "Parallel suggestions — no waiting",
      ],
      img: FEATURE_IMG_1,
    },
    {
      label: "Open Shifts",
      icon: <OpenShiftIcon />,
      title: "Let Your Team Fill Coverage Gaps",
      desc: "Post open shifts to a self-service marketplace. Staff browse and claim shifts that match their role and availability directly from their mobile portal. Approvals create assignments instantly.",
      bullets: [
        "Role + availability auto-filtering",
        "Staff request and withdraw freely",
        "Admin one-click approve/deny",
        "Auto-creates assignment on approval",
      ],
      img: FEATURE_IMG_2,
    },
    {
      label: "Time Clock",
      icon: <ClockIcon />,
      title: "Web-Based Punch Clock for Any Device",
      desc: "Staff clock in and out from their phone or tablet — no app download needed. Track lunch breaks, request corrections, and let admins review, adjust, and approve entries before payroll.",
      bullets: [
        "Clock in/out with lunch tracking",
        "Correction request workflow",
        "Admin approve or adjust entries",
        "Export to CSV, Excel, Gusto, QuickBooks",
      ],
      img: FEATURE_IMG_3,
    },
    {
      label: "Compliance",
      icon: <RuleIcon />,
      title: "Rules That Enforce Themselves",
      desc: "Configure overtime caps, minimum rest periods, max consecutive days, and license requirements per facility. Every assignment and suggestion runs through the rules engine automatically.",
      bullets: [
        "Max weekly hours & overtime caps",
        "Minimum rest between shifts",
        "Max consecutive days worked",
        "License / credential requirements",
      ],
      img: TEAM_IMAGE,
    },
  ];

  const STATS = [
    { value: "80%", label: "Reduction in scheduling time", icon: <AlarmIcon sx={{ fontSize: 28, color: TEAL }} /> },
    { value: "< 5 min", label: "To generate a full week's schedule", icon: <AIIcon sx={{ fontSize: 28, color: TEAL }} /> },
    { value: "100%", label: "Rule compliance on every shift", icon: <ShieldIcon sx={{ fontSize: 28, color: TEAL }} /> },
    { value: "0", label: "App downloads needed for staff", icon: <PhoneIcon sx={{ fontSize: 28, color: TEAL }} /> },
  ];

  const TESTIMONIALS = [
    {
      quote: "We cut our weekly scheduling time from 6 hours to under 30 minutes. The AI suggestions are surprisingly accurate — it already knows which nurses prefer which shifts.",
      name: "Sarah M.",
      title: "Director of Nursing, Regional Medical Center",
      avatar: "https://i.pravatar.cc/80?img=47",
    },
    {
      quote: "The open shifts marketplace changed everything. Our part-time staff can now self-schedule around their availability, and we fill gaps faster than ever.",
      name: "James T.",
      title: "Operations Manager, Long-Term Care Facility",
      avatar: "https://i.pravatar.cc/80?img=52",
    },
    {
      quote: "Having compliance rules built right into the scheduler means I never worry about overtime violations or credential mismatches. It just works.",
      name: "Dr. Patricia L.",
      title: "Chief Nursing Officer, Urgent Care Network",
      avatar: "https://i.pravatar.cc/80?img=33",
    },
  ];

  const PRICING_PLANS = [
    {
      plan: "Starter",
      price: "$149",
      desc: "Perfect for single-facility clinics and small practices.",
      features: [
        "Up to 50 staff members",
        "AI Scheduler (single facility)",
        "Assignments & Open Shifts",
        "Time Off management",
        "Time Clock + CSV export",
        "Staff self-service portal",
        "Email support",
      ],
    },
    {
      plan: "Professional",
      price: "$299",
      desc: "For growing facilities that need full automation.",
      features: [
        "Up to 200 staff members",
        "Unlimited facilities",
        "Full AI Scheduler with bulk accept",
        "Open Shifts Marketplace",
        "Compliance Rules engine",
        "Coverage & Demand Analytics",
        "Gusto + QuickBooks integration",
        "Priority support",
      ],
      highlight: true,
    },
    {
      plan: "Enterprise",
      price: "Custom",
      desc: "Multi-site healthcare networks with advanced needs.",
      features: [
        "Unlimited staff & facilities",
        "Custom compliance rule sets",
        "SSO / Active Directory integration",
        "Dedicated account manager",
        "SLA-backed uptime guarantee",
        "Custom API access",
        "On-site onboarding & training",
      ],
    },
  ];

  const FAQS = [
    {
      q: "How does the AI Scheduler work?",
      a: "Statera's AI analyzes each staff member's availability windows, credentials (RN, LPN, CNA, etc.), time-off records, and facility-specific rules. It then ranks available staff for each open shift and presents the top suggestions. You can accept the best match or pick from alternatives. The system learns from your scheduling patterns over time.",
    },
    {
      q: "Do staff need to download an app?",
      a: "No. The staff portal is a fully responsive web application accessible from any smartphone, tablet, or computer browser. Staff can clock in/out, view their schedule, request time off, and claim open shifts without installing anything.",
    },
    {
      q: "Can I set up custom compliance rules?",
      a: "Yes. Statera supports configurable rules per facility including maximum weekly hours, overtime thresholds, minimum rest time between shifts, maximum consecutive days worked, and credential/license requirements per unit or role.",
    },
    {
      q: "How do the Gusto and QuickBooks integrations work?",
      a: "Once you connect your Gusto or QuickBooks account in Facility Settings → Integrations (OAuth-based), you can export approved time clock entries directly to your payroll provider in one click. Each staff member is mapped to their employee ID in the provider.",
    },
    {
      q: "Can I manage multiple facilities from one account?",
      a: "Yes. Owner accounts can manage unlimited facilities, each with their own staff, units, rules, and settings. Facility Admins are scoped to specific facilities they are assigned to.",
    },
    {
      q: "Is my data secure?",
      a: "All data is encrypted in transit (TLS 1.3) and at rest. Access tokens are stored securely and role-based access control ensures each user sees only what they're authorized to see. We follow healthcare data security best practices.",
    },
  ];

  const ALL_FEATURES = [
    { icon: <AIIcon sx={{ fontSize: 24, color: TEAL }} />, title: "AI-Powered Scheduler", desc: "Generate a week's worth of optimized shift assignments in under 5 minutes." },
    { icon: <GroupIcon sx={{ fontSize: 24, color: TEAL }} />, title: "Staff Directory", desc: "Centralized profiles with credentials, availability, and full schedule history." },
    { icon: <CalendarIcon sx={{ fontSize: 24, color: TEAL }} />, title: "Visual Schedule Grid", desc: "Weekly and date-range calendar views. Click any cell to create or edit an assignment." },
    { icon: <OpenShiftIcon sx={{ fontSize: 24, color: TEAL }} />, title: "Open Shift Marketplace", desc: "Staff browse and claim available shifts filtered by their own role and availability." },
    { icon: <TimeOffIcon sx={{ fontSize: 24, color: TEAL }} />, title: "Time Off Management", desc: "Request, approve, or assign off days with a full audit trail and calendar view." },
    { icon: <ClockIcon sx={{ fontSize: 24, color: TEAL }} />, title: "Time Clock & Timesheets", desc: "Web-based punch clock with lunch tracking, corrections, and payroll export." },
    { icon: <RuleIcon sx={{ fontSize: 24, color: TEAL }} />, title: "Compliance Rules Engine", desc: "Overtime caps, rest minimums, max consecutive days, and license requirements." },
    { icon: <AnalyticsIcon sx={{ fontSize: 24, color: TEAL }} />, title: "Coverage Analytics", desc: "Heat-map views comparing actual staffing vs demand templates — spot gaps instantly." },
    { icon: <PsychologyIcon sx={{ fontSize: 24, color: TEAL }} />, title: "AI Chat Assistant", desc: "Ask questions about your schedule, staff, or compliance in plain English." },
    { icon: <NotifIcon sx={{ fontSize: 24, color: TEAL }} />, title: "Real-Time Notifications", desc: "Instant alerts for shift approvals, time-off requests, and coverage alerts." },
    { icon: <TableChartIcon sx={{ fontSize: 24, color: TEAL }} />, title: "Demand Templates", desc: "Define ideal staffing patterns per unit and day — let Statera fill the gaps." },
    { icon: <PhoneIcon sx={{ fontSize: 24, color: TEAL }} />, title: "Mobile-First Staff Portal", desc: "Fully responsive portal for staff — no app download, works on any device." },
  ];

  return (
    <Box sx={{ bgcolor: DARK_BG, minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <NavBar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      <VideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />

      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <Box sx={{
        pt: { xs: 12, md: 14 }, pb: { xs: 8, md: 12 },
        position: "relative", overflow: "hidden",
        background: "linear-gradient(160deg, rgba(0,40,50,1) 0%, rgba(0,20,30,1) 50%, rgba(0,30,40,1) 100%)",
      }}>
        {/* Background image */}
        <Box sx={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `url(${HERO_IMAGE})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: 0.07,
        }} />
        {/* Gradient overlays */}
        <Box sx={{ position: "absolute", top: "20%", left: "50%", transform: "translate(-50%,-50%)", width: "80vw", height: "60vh", background: "radial-gradient(ellipse, rgba(0,137,123,0.15) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 120, background: `linear-gradient(to bottom, transparent, ${DARK_BG})`, zIndex: 1 }} />

        <Container maxWidth="xl" sx={{ position: "relative", zIndex: 2 }}>
          <Grid container spacing={{ xs: 3, md: 6 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Chip
                label="AI-Powered Healthcare Workforce Management"
                icon={<AIIcon sx={{ fontSize: "13px !important", color: `${TEAL} !important` }} />}
                sx={{
                  mb: 3, bgcolor: "rgba(0,137,123,0.12)", color: TEAL,
                  border: "1px solid rgba(0,137,123,0.35)", fontWeight: 600, fontSize: 11,
                  height: "auto", "& .MuiChip-label": { whiteSpace: "normal", lineHeight: 1.5, py: 0.75 },
                }}
              />
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: "2.25rem", md: "3rem", lg: "3.5rem" },
                  fontWeight: 900, lineHeight: 1.1, mb: 2.5,
                  background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.75) 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  letterSpacing: -1,
                }}
              >
                The Smarter Way to{" "}
                <Box component="span" sx={{
                  background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_MID} 100%)`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  Schedule
                </Box>{" "}
                Healthcare Staff
              </Typography>
              <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, mb: 4, maxWidth: 520 }}>
                Statera AI automates shift scheduling, manages time off, enforces compliance rules,
                and gives your staff a self-service portal — all in one intelligent platform built for healthcare.
              </Typography>

              {/* CTA buttons */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 4 }}>
                <Button
                  component={RouterLink} to="/signup" variant="contained" size="large"
                  endIcon={<ArrowIcon />}
                  sx={{
                    bgcolor: TEAL_DARK, color: "#fff", px: 4, py: 1.75, fontSize: 15, fontWeight: 700,
                    borderRadius: 2, textTransform: "none",
                    boxShadow: "0 0 24px rgba(0,137,123,0.5)",
                    "&:hover": { bgcolor: "#00796b", boxShadow: "0 0 36px rgba(0,137,123,0.7)" },
                  }}
                >
                  Start Free Trial
                </Button>
                <Button
                  size="large" startIcon={<PlayIcon />}
                  onClick={() => setVideoOpen(true)}
                  sx={{
                    color: "rgba(255,255,255,0.85)", borderColor: "rgba(255,255,255,0.2)",
                    border: "1px solid", px: 3.5, py: 1.75, fontSize: 15, fontWeight: 600,
                    borderRadius: 2, textTransform: "none",
                    "&:hover": { borderColor: TEAL, color: TEAL, bgcolor: "rgba(0,137,123,0.06)" },
                  }}
                >
                  Watch Demo
                </Button>
              </Stack>

              {/* Trust indicators */}
              <Stack direction="row" spacing={3} flexWrap="wrap" gap={1.5}>
                {["No credit card required", "14-day free trial", "Cancel anytime"].map(t => (
                  <Stack key={t} direction="row" spacing={0.75} alignItems="center">
                    <CheckIcon sx={{ fontSize: 15, color: TEAL }} />
                    <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{t}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>

            {/* Hero visual */}
            <Grid item xs={12} md={6}>
              <Box sx={{ position: "relative" }}>
                {/* Glow */}
                <Box sx={{ position: "absolute", inset: -40, background: "radial-gradient(ellipse, rgba(0,137,123,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
                <DashboardMock />
                {/* Floating badges */}
                <Box sx={{
                  display: { xs: "none", md: "block" },
                  position: "absolute", bottom: -18, left: -18,
                  bgcolor: DARK_CARD2, border: "1px solid rgba(77,182,172,0.25)", borderRadius: 2,
                  px: 2, py: 1.25,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#4caf50", boxShadow: "0 0 6px #4caf50" }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>18 staff on shift today</Typography>
                  </Stack>
                </Box>
                <Box sx={{
                  display: { xs: "none", md: "block" },
                  position: "absolute", top: -18, right: -18,
                  bgcolor: DARK_CARD2, border: "1px solid rgba(0,137,123,0.25)", borderRadius: 2,
                  px: 2, py: 1.25,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AIIcon sx={{ fontSize: 16, color: TEAL }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>AI generated schedule</Typography>
                  </Stack>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          LOGO / TRUST BAR
      ══════════════════════════════════════════════════════════════ */}
      <Box sx={{ py: 4, borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", bgcolor: "rgba(255,255,255,0.015)" }}>
        <Container maxWidth="lg">
          <Typography sx={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", mb: 3 }}>
            Trusted by healthcare facilities nationwide
          </Typography>
          <Stack direction="row" spacing={0} flexWrap="wrap" justifyContent="center" alignItems="center" gap={{ xs: 2.5, md: 4 }}>
            {[
              "Regional Medical Center",
              "Sunrise Long-Term Care",
              "Metro Urgent Care Network",
              "Valley Health System",
              "Northside Clinic Group",
            ].map(org => (
              <Typography key={org} sx={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.18)", letterSpacing: 0.5 }}>
                {org}
              </Typography>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          PROBLEM SECTION
      ══════════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: DARK_BG }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 7 }}>
            <Chip label="The Problem" sx={{ mb: 2, bgcolor: "rgba(239,83,80,0.12)", color: "#ef5350", border: "1px solid rgba(239,83,80,0.3)", fontWeight: 600, fontSize: 11 }} />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
              Healthcare scheduling is <Box component="span" sx={{ color: "#ef5350" }}>broken</Box>
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.55)", maxWidth: 560, mx: "auto", fontSize: 16 }}>
              Most facilities still rely on spreadsheets, phone calls, and tribal knowledge — creating costly errors, staff burnout, and compliance risk.
            </Typography>
          </Box>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            {[
              { icon: "⏱️", title: "Hours Wasted Weekly", desc: "Schedulers spend 6–10 hours per week manually building and adjusting schedules, tracking availability, and handling last-minute changes.", color: "#ef5350" },
              { icon: "⚠️", title: "Compliance Violations", desc: "Overtime breaches, missed rest periods, and unqualified staff assignments go unnoticed until they become legal or patient safety issues.", color: "#f57c00" },
              { icon: "😩", title: "Staff Dissatisfaction", desc: "Scheduling that ignores preferences and availability leads to burnout, higher turnover, and difficulty attracting quality healthcare workers.", color: "#7c4dff" },
            ].map(p => (
              <Grid item xs={12} md={4} key={p.title}>
                <Box sx={{
                  p: 3, borderRadius: 3,
                  bgcolor: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                  height: "100%",
                }}>
                  <Typography sx={{ fontSize: 32, mb: 1.5 }}>{p.icon}</Typography>
                  <Typography fontWeight={700} sx={{ mb: 1, color: p.color, fontSize: 16 }}>{p.title}</Typography>
                  <Typography sx={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.7 }}>{p.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          STATS
      ══════════════════════════════════════════════════════════════ */}
      <Box sx={{
        py: { xs: 6, md: 8 },
        background: `linear-gradient(135deg, rgba(0,137,123,0.1) 0%, rgba(0,137,123,0.04) 100%)`,
        borderTop: "1px solid rgba(0,137,123,0.15)",
        borderBottom: "1px solid rgba(0,137,123,0.15)",
      }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            {STATS.map(s => (
              <Grid item xs={6} md={3} key={s.label}>
                <Box sx={{ textAlign: "center" }}>
                  <Box sx={{ display: "inline-flex", mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: "rgba(0,137,123,0.12)", border: "1px solid rgba(0,137,123,0.2)" }}>
                    {s.icon}
                  </Box>
                  <Typography variant="h3" fontWeight={900} sx={{ color: TEAL, mb: 0.5, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>{s.value}</Typography>
                  <Typography sx={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.5 }}>{s.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          FEATURES TABS (deep dive)
      ══════════════════════════════════════════════════════════════ */}
      <Box id="features" sx={{ py: { xs: 8, md: 12 }, scrollMarginTop: 80 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 6 }}>
            <Chip label="Core Features" sx={{ mb: 2, bgcolor: "rgba(0,137,123,0.12)", color: TEAL, border: "1px solid rgba(0,137,123,0.3)", fontWeight: 600, fontSize: 11 }} />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
              Everything in one platform
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.55)", maxWidth: 540, mx: "auto" }}>
              No more juggling spreadsheets, group texts, and paper sign-in sheets. Statera brings every piece of workforce management together.
            </Typography>
          </Box>

          <Tabs
            value={featureTab} onChange={(_, v) => setFeatureTab(v)}
            variant={isMobile ? "scrollable" : "fullWidth"}
            scrollButtons={isMobile ? "auto" : false}
            sx={{
              mb: 4, borderBottom: "1px solid rgba(255,255,255,0.07)",
              "& .MuiTab-root": { color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "none", fontSize: 13.5 },
              "& .Mui-selected": { color: TEAL },
              "& .MuiTabs-indicator": { bgcolor: TEAL },
            }}
          >
            {FEATURES_TAB.map(f => (
              <Tab key={f.label} label={f.label} icon={React.cloneElement(f.icon as React.ReactElement, { sx: { fontSize: 18 } })} iconPosition="start" />
            ))}
          </Tabs>

          {FEATURES_TAB.map((f, i) => featureTab === i && (
            <Grid key={i} container spacing={{ xs: 3, md: 6 }} alignItems="center">
              <Grid item xs={12} md={5}>
                <Typography variant="h4" fontWeight={800} sx={{ mb: 2.5, lineHeight: 1.2 }}>{f.title}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.75, mb: 3, fontSize: 15 }}>{f.desc}</Typography>
                <Stack spacing={1.5}>
                  {f.bullets.map(b => (
                    <Stack key={b} direction="row" spacing={1.5} alignItems="center">
                      <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: "rgba(0,137,123,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <CheckIcon sx={{ fontSize: 15, color: TEAL }} />
                      </Box>
                      <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>{b}</Typography>
                    </Stack>
                  ))}
                </Stack>
                <Button component={RouterLink} to="/signup" variant="contained" sx={{
                  mt: 4, bgcolor: TEAL_DARK, color: "#fff", px: 3.5, py: 1.25, fontWeight: 700,
                  textTransform: "none", borderRadius: 2,
                  "&:hover": { bgcolor: "#00796b" },
                }}>
                  Try It Free
                </Button>
              </Grid>
              <Grid item xs={12} md={7}>
                <Box sx={{
                  borderRadius: 3, overflow: "hidden",
                  border: "1px solid rgba(77,182,172,0.2)",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 30px rgba(0,137,123,0.1)",
                }}>
                  <Box
                    component="img"
                    src={f.img}
                    alt={f.label}
                    sx={{ width: "100%", display: "block", objectFit: "cover", maxHeight: { xs: 220, md: 380 } }}
                    onError={(e: any) => { e.target.style.display = "none"; }}
                  />
                </Box>
              </Grid>
            </Grid>
          ))}
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          VIDEO SECTION
      ══════════════════════════════════════════════════════════════ */}
      <Box sx={{
        py: { xs: 8, md: 12 },
        background: "linear-gradient(160deg, rgba(0,30,40,1) 0%, rgba(0,50,60,0.6) 50%, rgba(0,30,40,1) 100%)",
        position: "relative", overflow: "hidden",
      }}>
        <Box sx={{ position: "absolute", inset: 0, backgroundImage: `url(${FEATURE_IMG_2})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.05 }} />
        <Container maxWidth="md" sx={{ position: "relative", textAlign: "center" }}>
          <Chip label="Product Demo" sx={{ mb: 3, bgcolor: "rgba(0,137,123,0.12)", color: TEAL, border: "1px solid rgba(0,137,123,0.3)", fontWeight: 600, fontSize: 11 }} />
          <Typography variant="h3" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
            See Statera AI in action
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.55)", mb: 5, fontSize: 16 }}>
            Watch how a scheduling manager builds an entire week's schedule in under 5 minutes using the AI Scheduler.
          </Typography>

          {/* Video thumbnail */}
          <Box
            onClick={() => setVideoOpen(true)}
            sx={{
              position: "relative", borderRadius: 3, overflow: "hidden", cursor: "pointer",
              border: "1px solid rgba(77,182,172,0.25)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,137,123,0.2)",
              "&:hover .play-overlay": { bgcolor: "rgba(0,0,0,0.5)" },
              "&:hover .play-btn": { transform: "scale(1.1)", color: TEAL },
            }}
          >
            {/* Browser chrome */}
            <Box sx={{ bgcolor: "#1a2f32", px: 1.5, py: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#ff5f57" }} />
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#ffbd2e" }} />
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#28c840" }} />
              <Box sx={{ flex: 1, mx: 2, bgcolor: "rgba(255,255,255,0.06)", borderRadius: 1, px: 1, py: 0.25, textAlign: "center" }}>
                <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>statera.ai — AI Scheduler Demo</Typography>
              </Box>
            </Box>
            {/* Thumbnail */}
            <Box
              component="img"
              src={FEATURE_IMG_1}
              alt="Statera AI Demo"
              sx={{ width: "100%", display: "block", objectFit: "cover", maxHeight: 420, filter: "brightness(0.6)" }}
            />
            {/* Play overlay */}
            <Box className="play-overlay" sx={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              bgcolor: "rgba(0,0,0,0.35)", transition: "0.2s",
            }}>
              <PlayIcon className="play-btn" sx={{ fontSize: 72, color: "#fff", transition: "0.2s", mb: 1.5, filter: "drop-shadow(0 0 16px rgba(0,137,123,0.8))" }} />
              <Typography fontWeight={700} sx={{ color: "#fff", fontSize: 15 }}>Watch 3-minute demo</Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          FULL FEATURES GRID
      ══════════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: DARK_BG }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 7 }}>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
              Every tool your facility needs
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.5)", maxWidth: 520, mx: "auto" }}>
              Purpose-built for healthcare — not adapted from generic project management software.
            </Typography>
          </Box>
          <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
            {ALL_FEATURES.map(f => (
              <Grid item xs={6} sm={6} md={4} lg={3} key={f.title}>
                <Box sx={{
                  p: { xs: 1.75, md: 2.5 }, borderRadius: 2.5, height: "100%",
                  bgcolor: DARK_CARD, border: "1px solid rgba(255,255,255,0.06)",
                  transition: "border-color 0.2s, transform 0.2s",
                  "&:hover": { borderColor: "rgba(77,182,172,0.3)", transform: "translateY(-2px)" },
                }}>
                  <Box sx={{ width: { xs: 36, md: 44 }, height: { xs: 36, md: 44 }, borderRadius: 2, mb: 1.5, bgcolor: "rgba(0,137,123,0.1)", border: "1px solid rgba(0,137,123,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {f.icon}
                  </Box>
                  <Typography fontWeight={700} sx={{ mb: 0.5, fontSize: { xs: 12.5, md: 14 }, color: "#fff", lineHeight: 1.3 }}>{f.title}</Typography>
                  <Typography sx={{ fontSize: { xs: 11.5, md: 12.5 }, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, display: { xs: "none", sm: "block" } }}>{f.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════════════ */}
      <Box id="how-it-works" sx={{
        py: { xs: 8, md: 12 },
        background: "linear-gradient(160deg, rgba(0,137,123,0.06) 0%, rgba(0,137,123,0.02) 100%)",
        borderTop: "1px solid rgba(0,137,123,0.1)",
        scrollMarginTop: 80,
      }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 8 }}>
            <Chip label="Getting Started" sx={{ mb: 2, bgcolor: "rgba(0,137,123,0.12)", color: TEAL, border: "1px solid rgba(0,137,123,0.3)", fontWeight: 600, fontSize: 11 }} />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
              Up and running in 15 minutes
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.55)", maxWidth: 500, mx: "auto" }}>
              No IT team required. No lengthy implementation. Just sign up and start scheduling.
            </Typography>
          </Box>

          <Grid container spacing={{ xs: 2.5, md: 4 }}>
            {[
              {
                step: "01",
                title: "Set Up Your Facility",
                desc: "Create your facility profile, add units (e.g., ICU, Med-Surg), and configure scheduling rules like overtime limits and required credentials. Takes about 10 minutes.",
                img: FEATURE_IMG_3,
                bullets: ["Add staff with credentials & availability", "Configure units and shift types", "Set compliance rules (OT, rest, consecutive days)"],
              },
              {
                step: "02",
                title: "Generate Schedules with AI",
                desc: "Pick a date range, press 'Run AI Scheduler,' and instantly see optimized shift suggestions ranked by fit. Accept all at once or review each one individually.",
                img: FEATURE_IMG_1,
                bullets: ["Select date range and days of week", "AI suggests best staff per shift", "Accept individually or bulk-accept the week"],
              },
              {
                step: "03",
                title: "Staff Self-Serve from Their Phones",
                desc: "Staff get a web-based portal they can access from any device. They view their schedule, request time off, clock in/out, and claim open shifts — all without calling you.",
                img: FEATURE_IMG_2,
                bullets: ["View personal schedule & assignments", "Clock in/out with lunch tracking", "Request time off & claim open shifts"],
              },
            ].map((step, i) => (
              <Grid item xs={12} md={4} key={i}>
                <Box sx={{
                  p: 0, borderRadius: 3, overflow: "hidden",
                  bgcolor: DARK_CARD, border: "1px solid rgba(255,255,255,0.07)",
                  height: "100%", display: "flex", flexDirection: "column",
                }}>
                  <Box sx={{ position: "relative", height: { xs: 160, md: 200 }, overflow: "hidden" }}>
                    <Box
                      component="img"
                      src={step.img}
                      alt={step.title}
                      sx={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.5)" }}
                    />
                    <Box sx={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 30%, ${DARK_CARD})` }} />
                    <Box sx={{
                      position: "absolute", top: 16, left: 16,
                      width: 44, height: 44, borderRadius: 2,
                      bgcolor: "rgba(0,137,123,0.2)", border: "1px solid rgba(0,137,123,0.4)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 900, color: TEAL }}>{step.step}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ p: 3, flex: 1 }}>
                    <Typography fontWeight={800} sx={{ mb: 1.5, fontSize: 17 }}>{step.title}</Typography>
                    <Typography sx={{ color: "rgba(255,255,255,0.55)", fontSize: 13.5, lineHeight: 1.7, mb: 2.5 }}>{step.desc}</Typography>
                    <Stack spacing={1}>
                      {step.bullets.map(b => (
                        <Stack key={b} direction="row" spacing={1} alignItems="flex-start">
                          <CheckIcon sx={{ fontSize: 14, color: TEAL, mt: 0.3, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)" }}>{b}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════════ */}
      <Box id="testimonials" sx={{ py: { xs: 8, md: 12 }, bgcolor: DARK_BG, scrollMarginTop: 80 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 7 }}>
            <Chip label="Testimonials" sx={{ mb: 2, bgcolor: "rgba(249,168,37,0.1)", color: "#f9a825", border: "1px solid rgba(249,168,37,0.3)", fontWeight: 600, fontSize: 11 }} />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
              Loved by healthcare teams
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.5)", maxWidth: 500, mx: "auto" }}>
              From small clinics to multi-site health networks — real results from real schedulers.
            </Typography>
          </Box>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            {TESTIMONIALS.map((t, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <TestimonialCard {...t} />
              </Grid>
            ))}
          </Grid>

          {/* Image strip */}
          <Box sx={{
            mt: 6, borderRadius: 3, overflow: "hidden",
            height: { xs: 160, md: 220 }, position: "relative",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <Box
              component="img"
              src={TEAM_IMAGE}
              alt="Healthcare team"
              sx={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.45)" }}
            />
            <Box sx={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
              px: 2, textAlign: "center",
              background: "linear-gradient(135deg, rgba(0,137,123,0.2) 0%, rgba(0,0,0,0.3) 100%)",
            }}>
              <Typography fontWeight={900} sx={{ color: "#fff", mb: 1, textShadow: "0 2px 16px rgba(0,0,0,0.8)", fontSize: { xs: "1.15rem", md: "1.5rem" } }}>
                Built for real healthcare teams
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: { xs: 13, md: 15 } }}>
                Not adapted from generic scheduling software
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════════════════════════ */}
      <Box id="pricing" sx={{
        py: { xs: 8, md: 12 },
        background: "linear-gradient(160deg, rgba(0,30,40,1) 0%, rgba(0,20,30,0.8) 100%)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        scrollMarginTop: 80,
      }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", mb: 7 }}>
            <Chip label="Pricing" sx={{ mb: 2, bgcolor: "rgba(0,137,123,0.12)", color: TEAL, border: "1px solid rgba(0,137,123,0.3)", fontWeight: 600, fontSize: 11 }} />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
              Simple, transparent pricing
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.5)", maxWidth: 480, mx: "auto" }}>
              Start free for 14 days. No credit card required. Cancel anytime.
            </Typography>
          </Box>
          <Grid container spacing={{ xs: 2.5, md: 3 }} alignItems="stretch">
            {PRICING_PLANS.map((plan, i) => (
              <Grid item xs={12} sm={6} md={4} key={i} sx={{ display: "flex" }}>
                <PricingCard {...plan} />
              </Grid>
            ))}
          </Grid>
          <Box sx={{ mt: 4, textAlign: "center" }}>
            <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              All plans include 14-day free trial · No setup fees · Prices in USD
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════════════════════════ */}
      <Box id="faq" sx={{ py: { xs: 8, md: 12 }, bgcolor: DARK_BG, scrollMarginTop: 80 }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: "center", mb: 7 }}>
            <Chip label="FAQ" sx={{ mb: 2, bgcolor: "rgba(0,137,123,0.12)", color: TEAL, border: "1px solid rgba(0,137,123,0.3)", fontWeight: 600, fontSize: 11 }} />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2, fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
              Frequently asked questions
            </Typography>
          </Box>
          <Stack spacing={1.5}>
            {FAQS.map((f, i) => (
              <Accordion
                key={i}
                expanded={faqOpen === String(i)}
                onChange={(_, ex) => setFaqOpen(ex ? String(i) : false)}
                disableGutters
                elevation={0}
                sx={{
                  bgcolor: DARK_CARD, border: "1px solid",
                  borderColor: faqOpen === String(i) ? "rgba(77,182,172,0.3)" : "rgba(255,255,255,0.06)",
                  borderRadius: "12px !important",
                  "&:before": { display: "none" },
                  overflow: "hidden",
                  transition: "border-color 0.2s",
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ color: faqOpen === String(i) ? TEAL : "rgba(255,255,255,0.4)" }} />}
                  sx={{ px: 3, py: 0.5 }}
                >
                  <Typography fontWeight={600} sx={{ fontSize: 14.5, color: faqOpen === String(i) ? TEAL : "rgba(255,255,255,0.85)" }}>
                    {f.q}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pb: 2.5 }}>
                  <Typography sx={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.75, fontSize: 14 }}>{f.a}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════════════ */}
      <Box sx={{
        py: { xs: 10, md: 16 }, textAlign: "center", position: "relative", overflow: "hidden",
        background: "linear-gradient(135deg, rgba(0,55,70,0.95) 0%, rgba(0,80,100,0.85) 50%, rgba(0,55,70,0.95) 100%)",
        borderTop: "1px solid rgba(0,137,123,0.2)",
      }}>
        <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "80vw", height: "60vh", background: "radial-gradient(ellipse, rgba(0,137,123,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
        <Container maxWidth="md" sx={{ position: "relative" }}>
          <Typography variant="h2" fontWeight={900} sx={{
            mb: 2.5, fontSize: { xs: "2rem", md: "2.75rem" }, lineHeight: 1.15,
            background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Ready to transform your scheduling?
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.6)", mb: 5, fontSize: { xs: 16, md: 18 }, maxWidth: 560, mx: "auto", lineHeight: 1.7 }}>
            Join healthcare facilities that have cut scheduling time by 80%, eliminated coverage gaps, and given staff the flexibility they deserve.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            <Button
              component={RouterLink} to="/signup" variant="contained" size="large"
              endIcon={<ArrowIcon />}
              sx={{
                bgcolor: TEAL_DARK, color: "#fff", px: 5, py: 2, fontSize: 16, fontWeight: 700,
                borderRadius: 2, textTransform: "none",
                boxShadow: "0 0 32px rgba(0,137,123,0.6)",
                "&:hover": { bgcolor: "#00796b", boxShadow: "0 0 48px rgba(0,137,123,0.8)" },
              }}
            >
              Start Free Trial
            </Button>
            <Button
              onClick={() => setVideoOpen(true)} size="large" startIcon={<PlayIcon />}
              sx={{
                color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.2)",
                px: 4, py: 2, fontSize: 16, fontWeight: 600,
                borderRadius: 2, textTransform: "none",
                "&:hover": { borderColor: TEAL, color: TEAL, bgcolor: "rgba(0,137,123,0.06)" },
              }}
            >
              Watch Demo First
            </Button>
          </Stack>
          <Typography sx={{ mt: 3, color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
            No credit card &bull; Full access &bull; Cancel anytime
          </Typography>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════ */}
      <Box sx={{ bgcolor: "#040a0b", borderTop: "1px solid rgba(255,255,255,0.04)", py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 6 }}>
            {/* Brand */}
            <Grid item xs={12} md={4}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: "rgba(0,137,123,0.2)", border: "1px solid rgba(77,182,172,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: TEAL }}>S</Typography>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: -0.5 }}>Statera AI</Typography>
              </Stack>
              <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 13.5, lineHeight: 1.75, maxWidth: 300, mb: 3 }}>
                AI-powered workforce management built specifically for healthcare facilities. Schedule smarter, stay compliant, empower your staff.
              </Typography>
              <Chip label="Healthcare Scheduling Platform" size="small" sx={{ bgcolor: "rgba(0,137,123,0.1)", color: TEAL, border: "1px solid rgba(0,137,123,0.2)", fontSize: 11 }} />
            </Grid>

            {/* Product */}
            <Grid item xs={6} sm={4} md={2} sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 2, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>Product</Typography>
              <Stack spacing={1.25}>
                {["AI Scheduler", "Assignments", "Open Shifts", "Time Off", "Time Clock", "Coverage Analytics"].map(l => (
                  <Typography key={l} component={RouterLink} to="/login" sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.45)", textDecoration: "none", "&:hover": { color: TEAL } }}>{l}</Typography>
                ))}
              </Stack>
            </Grid>

            {/* Use Cases */}
            <Grid item xs={6} sm={4} md={3} sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 2, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>Use Cases</Typography>
              <Stack spacing={1.25}>
                {["Hospital Staffing", "Long-Term Care", "Urgent Care Centers", "Home Health Agencies", "Specialty Clinics", "Multi-Site Networks"].map(l => (
                  <Typography key={l} sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.45)" }}>{l}</Typography>
                ))}
              </Stack>
            </Grid>

            {/* Company */}
            <Grid item xs={12} sm={4} md={3}>
              <Typography sx={{ fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 2, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>Company</Typography>
              <Stack spacing={1.25} sx={{ mb: 3 }}>
                {["About Us", "Contact Sales", "Privacy Policy", "Terms of Service", "Security"].map(l => (
                  <Typography key={l} sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.45)", cursor: "pointer", "&:hover": { color: TEAL } }}>{l}</Typography>
                ))}
              </Stack>
              <Button component={RouterLink} to="/login" variant="outlined" fullWidth sx={{
                borderColor: "rgba(0,137,123,0.4)", color: TEAL, fontWeight: 700,
                textTransform: "none", borderRadius: 2,
                "&:hover": { borderColor: TEAL, bgcolor: "rgba(0,137,123,0.08)" },
              }}>
                Sign In to App
              </Button>
            </Grid>
          </Grid>

          <Divider sx={{ my: 5, borderColor: "rgba(255,255,255,0.04)" }} />

          <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" spacing={2}>
            <Typography sx={{ color: "rgba(255,255,255,0.25)", fontSize: 12.5 }}>
              © {new Date().getFullYear()} Statera AI. All rights reserved. Built for healthcare workforce management.
            </Typography>
            <Stack direction="row" spacing={3}>
              {["Privacy", "Terms", "Security", "HIPAA"].map(l => (
                <Typography key={l} sx={{ fontSize: 12, color: "rgba(255,255,255,0.25)", cursor: "pointer", "&:hover": { color: TEAL } }}>{l}</Typography>
              ))}
            </Stack>
          </Stack>
        </Container>
      </Box>

    </Box>
  );
}
