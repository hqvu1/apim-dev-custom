/**
 * Hero section component for the landing page
 * Displays main value proposition and primary CTAs
 */

import { memo } from "react";
import { Box, Button, Container, Grid, Stack, Typography, alpha, useTheme } from "@mui/material";
import { ApiOutlined, ArrowForward } from "@mui/icons-material";

interface HeroSectionProps {
  onExploreClick: () => void;
  onGetStartedClick: () => void;
}

const HeroSection = memo(({ onExploreClick, onGetStartedClick }: HeroSectionProps) => {
  const theme = useTheme();

  return (
    <Box
      component="section"
      aria-label="Hero section"
      sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        color: "white",
        py: { xs: 6, md: 10 },
        px: 3,
        mb: 6,
        borderRadius: 2,
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          background: `radial-gradient(circle at 30% 50%, ${alpha(theme.palette.secondary.main, 0.2)} 0%, transparent 50%)`,
          pointerEvents: "none"
        }
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={7}>
            <Typography
              variant="overline"
              component="p"
              sx={{
                color: theme.palette.secondary.main,
                fontWeight: 600,
                letterSpacing: "0.15em",
                mb: 2,
                display: "block"
              }}
            >
              KOMATSU API PORTAL
            </Typography>
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontWeight: 700,
                mb: 3,
                fontSize: { xs: "2rem", md: "3rem" }
              }}
            >
              Build the Future with Komatsu APIs
            </Typography>
            <Typography
              variant="h6"
              component="p"
              sx={{
                mb: 4,
                opacity: 0.95,
                fontWeight: 400,
                lineHeight: 1.6
              }}
            >
              Access secure, enterprise-grade APIs to power your digital transformation.
              Streamline integrations, enhance productivity, and unlock new possibilities.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                variant="contained"
                size="large"
                onClick={onExploreClick}
                endIcon={<ArrowForward />}
                aria-label="Explore available APIs"
                sx={{
                  bgcolor: "white",
                  color: theme.palette.primary.main,
                  "&:hover": {
                    bgcolor: alpha("#ffffff", 0.9)
                  },
                  px: 4,
                  py: 1.5
                }}
              >
                Explore APIs
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={onGetStartedClick}
                aria-label="Get started with API registration"
                sx={{
                  borderColor: "white",
                  color: "white",
                  "&:hover": {
                    borderColor: "white",
                    bgcolor: alpha("#ffffff", 0.1)
                  },
                  px: 4,
                  py: 1.5
                }}
              >
                Get Started
              </Button>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5} sx={{ display: { xs: "none", md: "block" } }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%"
              }}
              aria-hidden="true"
            >
              <ApiOutlined sx={{ fontSize: 200, opacity: 0.2 }} />
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
});

HeroSection.displayName = "HeroSection";

export default HeroSection;
