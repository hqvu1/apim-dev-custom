/**
 * Home page - Main landing page for the Komatsu API Portal
 * 
 * Best Practices Implemented:
 * - Component modularization: Split into smaller, reusable components
 * - Performance optimization: Memoized components, useCallback for handlers
 * - Type safety: Comprehensive TypeScript interfaces
 * - Accessibility: Semantic HTML, ARIA labels, proper heading hierarchy
 * - Code organization: Constants extracted, clear separation of concerns
 * - Error handling: Graceful degradation for API failures
 * - Responsive design: Mobile-first approach with responsive breakpoints
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
  alpha,
  useTheme
} from "@mui/material";
import {
  ApiOutlined,
  IntegrationInstructionsOutlined,
  SupportAgentOutlined,
  ArrowForward,
  TrendingUp
} from "@mui/icons-material";

import { usePortalApi } from "../../api/client";
import { ApiSummary } from "../../api/types";
import StatCard from "../../components/StatCard";
import { useToast } from "../../components/useToast";

import HeroSection from "./HeroSection";
import FeatureCard from "./FeatureCard";
import QuickActionCard from "./QuickActionCard";
import { PLATFORM_FEATURES } from "./constants";
import { QuickAction } from "./types";

/**
 * Main Home component
 */
const Home = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { get } = usePortalApi();
  const toast = useToast();

  // State management
  const [highlights, setHighlights] = useState<ApiSummary[]>([]);
  const [news, setNews] = useState<string[]>([]);
  const [stats, setStats] = useState<{ availableApis: number; products: number; subscriptions: number; users: number; uptime: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Navigation handlers - memoized to prevent unnecessary re-renders
  const handleExploreApis = useCallback(() => {
    navigate("/apis");
  }, [navigate]);

  const handleGetStarted = useCallback(() => {
    navigate("/register");
  }, [navigate]);

  const handleManageIntegrations = useCallback(() => {
    navigate("/my/integrations");
  }, [navigate]);

  const handleGetSupport = useCallback(() => {
    navigate("/support");
  }, [navigate]);

  const handleViewNews = useCallback(() => {
    navigate("/news");
  }, [navigate]);

  const handleViewApiDetails = useCallback((apiId: string) => {
    navigate(`/apis/${apiId}`);
  }, [navigate]);

  // Quick actions configuration - memoized to prevent recreation
  const quickActions = useMemo<QuickAction[]>(() => [
    {
      icon: <ApiOutlined />,
      title: "Browse API Catalog",
      description: "Explore our comprehensive catalog of APIs with detailed documentation and specifications.",
      buttonText: "Browse APIs",
      onClick: handleExploreApis
    },
    {
      icon: <IntegrationInstructionsOutlined />,
      title: "My Integrations",
      description: "Manage your API subscriptions, keys, quotas, and monitor usage across all environments.",
      buttonText: "Manage Integrations",
      onClick: handleManageIntegrations
    },
    {
      icon: <SupportAgentOutlined />,
      title: "Get Support",
      description: "Submit support tickets, browse FAQs, and get help from our expert technical team.",
      buttonText: "Get Help",
      onClick: handleGetSupport
    }
  ], [handleExploreApis, handleManageIntegrations, handleGetSupport]);

  // Load data on mount
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const [newsResult, highlightsResult, statsResult] = await Promise.all([
          get<{ title: string }[]>("/news"),
          get<ApiSummary[]>("/apis/highlights"),
          get<{ availableApis: number; products: number; subscriptions: number; users: number; uptime: string }>("/stats")
        ]);

        if (newsResult.data) {
          setNews(newsResult.data.map((item) => item.title));
        }

        if (highlightsResult.data) {
          setHighlights(highlightsResult.data);
        }

        if (statsResult.data) {
          setStats(statsResult.data);
        }

        if (newsResult.error || highlightsResult.error) {
          toast.notify("Using local highlight data until the portal API is ready.", "info");
        }
      } catch (error) {
        console.error("Failed to load home page data:", error);
        toast.notify("Failed to load some data. Using cached content.", "warning");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [get, toast]);

  return (
    <Box component="main">
      {/* Hero Section */}
      <HeroSection onExploreClick={handleExploreApis} onGetStartedClick={handleGetStarted} />

      {/* Statistics Section */}
      <Box component="section" aria-label="Platform statistics" sx={{ mb: 6 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard label="Available APIs" value={stats ? String(stats.availableApis) : "—"} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard label="Products" value={stats ? String(stats.products) : "—"} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard label="Subscriptions" value={stats ? String(stats.subscriptions) : "—"} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard label="Uptime" value={stats?.uptime || "—"} />
          </Grid>
        </Grid>
      </Box>

      {/* Features Section */}
      <Box component="section" aria-labelledby="features-heading" sx={{ mb: 6 }}>
        <Typography id="features-heading" variant="h4" component="h2" fontWeight={600} textAlign="center" mb={1}>
          Why Choose Komatsu API Portal
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          textAlign="center"
          mb={5}
          sx={{ maxWidth: 700, mx: "auto" }}
        >
          Everything you need to integrate, innovate, and scale your applications with confidence
        </Typography>
        <Grid container spacing={3}>
          {PLATFORM_FEATURES.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={feature.title}>
              <FeatureCard {...feature} index={index} />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Featured APIs and News Section */}
      <Grid container spacing={3} mb={6}>
        <Grid item xs={12} lg={8}>
          <Card component="section" aria-labelledby="featured-apis-heading" sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                <TrendingUp color="primary" aria-hidden="true" />
                <Typography id="featured-apis-heading" variant="h5" component="h2" fontWeight={600}>
                  Featured APIs
                </Typography>
              </Stack>
              <Stack spacing={2} role="list">
                {loading && (
                  <Typography color="text.secondary" role="status" aria-live="polite">
                    Loading highlights...
                  </Typography>
                )}
                {!loading && highlights.length === 0 && (
                  <Typography color="text.secondary" variant="body2" sx={{ py: 2, textAlign: "center" }}>
                    No featured APIs available yet.
                  </Typography>
                )}
                {!loading &&
                  highlights.map((api) => (
                    <Card
                      key={api.id}
                      variant="outlined"
                      role="listitem"
                      sx={{
                        transition: "all 0.2s ease",
                        "&:hover": {
                          borderColor: theme.palette.primary.main,
                          bgcolor: alpha(theme.palette.primary.main, 0.02)
                        }
                      }}
                    >
                      <CardContent>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                          <Box flex={1}>
                            <Typography fontWeight={600} variant="h6" component="h3" gutterBottom>
                              {api.name}
                            </Typography>
                            <Typography color="text.secondary" variant="body2">
                              {api.description || "No description available."}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Chip
                              label={api.status}
                              size="small"
                              color={api.status === "Production" ? "success" : "default"}
                            />
                            <Chip label={api.plan} size="small" variant="outlined" />
                          </Stack>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleViewApiDetails(api.id)}
                            endIcon={<ArrowForward />}
                            aria-label={`View details for ${api.name}`}
                          >
                            Details
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
              </Stack>
              <Button
                fullWidth
                variant="text"
                onClick={handleExploreApis}
                sx={{ mt: 3 }}
                endIcon={<ArrowForward />}
                aria-label="View all available APIs"
              >
                View All APIs
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Card
            component="section"
            aria-labelledby="news-heading"
            sx={{ height: "100%", bgcolor: alpha(theme.palette.secondary.main, 0.3) }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography id="news-heading" variant="h5" component="h2" fontWeight={600} gutterBottom>
                What's New
              </Typography>
              <Stack spacing={2} mt={3} role="list">
                {news.length === 0 && (
                  <Box sx={{ textAlign: "center", py: 4 }} role="status">
                    <Typography color="text.secondary" variant="body2">
                      No announcements yet. Check back soon for updates!
                    </Typography>
                  </Box>
                )}
                {news.map((item) => (
                  <Card key={item} variant="outlined" role="listitem">
                    <CardContent>
                      <Typography variant="body2" fontWeight={500}>
                        {item}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleViewNews}
                sx={{ mt: 3 }}
                aria-label="View all news and announcements"
              >
                View All News
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions Section */}
      <Box component="section" aria-labelledby="quick-actions-heading" sx={{ mb: 4 }}>
        <Typography id="quick-actions-heading" variant="h4" component="h2" fontWeight={600} textAlign="center" mb={5}>
          Quick Actions
        </Typography>
        <Grid container spacing={3}>
          {quickActions.map((action) => (
            <Grid item xs={12} md={4} key={action.title}>
              <QuickActionCard {...action} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};

export default Home;
