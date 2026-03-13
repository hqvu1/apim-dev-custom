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
import { useTranslation } from "react-i18next";

import { usePortalApi, unwrapArray } from "../../api/client";
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
  const { t } = useTranslation();

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
      title: t("home.quickActions.browse.title"),
      description: t("home.quickActions.browse.description"),
      buttonText: t("home.quickActions.browse.button"),
      onClick: handleExploreApis
    },
    {
      icon: <IntegrationInstructionsOutlined />,
      title: t("home.quickActions.integrations.title"),
      description: t("home.quickActions.integrations.description"),
      buttonText: t("home.quickActions.integrations.button"),
      onClick: handleManageIntegrations
    },
    {
      icon: <SupportAgentOutlined />,
      title: t("home.quickActions.support.title"),
      description: t("home.quickActions.support.description"),
      buttonText: t("home.quickActions.support.button"),
      onClick: handleGetSupport
    }
  ], [handleExploreApis, handleManageIntegrations, handleGetSupport, t]);

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

        const newsItems = unwrapArray<{ title: string }>(newsResult.data);
        if (newsItems) {
          setNews(newsItems.map((item) => item.title));
        }

        const highlightItems = unwrapArray<ApiSummary>(highlightsResult.data);
        if (highlightItems) {
          setHighlights(highlightItems);
        }

        if (statsResult.data) {
          setStats(statsResult.data);
        }

        if (newsResult.error || highlightsResult.error) {
          toast.notify(t("home.toast.localData"), "info");
        }
      } catch (error) {
        console.error("Failed to load home page data:", error);
        toast.notify(t("home.toast.loadFailed"), "warning");
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
            <StatCard label={t("home.stats.availableApis")} value={stats ? String(stats.availableApis) : "—"} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard label={t("home.stats.products")} value={stats ? String(stats.products) : "—"} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard label={t("home.stats.subscriptions")} value={stats ? String(stats.subscriptions) : "—"} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard label={t("home.stats.uptime")} value={stats?.uptime || "—"} />
          </Grid>
        </Grid>
      </Box>

      {/* Features Section */}
      <Box component="section" aria-labelledby="features-heading" sx={{ mb: 6 }}>
        <Typography id="features-heading" variant="h4" component="h2" fontWeight={600} textAlign="center" mb={1}>
          {t("home.features.heading")}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          textAlign="center"
          mb={5}
          sx={{ maxWidth: 700, mx: "auto" }}
        >
          {t("home.features.subheading")}
        </Typography>
        <Grid container spacing={3}>
          {PLATFORM_FEATURES.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={feature.titleKey}>
              <FeatureCard icon={feature.icon} title={t(feature.titleKey)} description={t(feature.descriptionKey)} index={index} />
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
                  {t("home.featuredApis.heading")}
                </Typography>
              </Stack>
              <Stack spacing={2} role="list">
                {loading && (
                  <Typography color="text.secondary" role="status" aria-live="polite">
                    {t("home.featuredApis.loading")}
                  </Typography>
                )}
                {!loading && highlights.length === 0 && (
                  <Typography color="text.secondary" variant="body2" sx={{ py: 2, textAlign: "center" }}>
                    {t("home.featuredApis.empty")}
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
                              {api.description || t("apis.noDescription")}
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
                            {t("common.details")}
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
                {t("home.featuredApis.viewAll")}
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
                {t("home.news.heading")}
              </Typography>
              <Stack spacing={2} mt={3} role="list">
                {news.length === 0 && (
                  <Box sx={{ textAlign: "center", py: 4 }} role="status">
                    <Typography color="text.secondary" variant="body2">
                      {t("home.news.empty")}
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
                {t("home.news.viewAll")}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions Section */}
      <Box component="section" aria-labelledby="quick-actions-heading" sx={{ mb: 4 }}>
        <Typography id="quick-actions-heading" variant="h4" component="h2" fontWeight={600} textAlign="center" mb={5}>
          {t("home.quickActions.heading")}
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
