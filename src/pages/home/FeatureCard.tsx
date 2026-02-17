/**
 * Feature card component for displaying platform capabilities
 * Memoized for performance optimization
 */

import { memo } from "react";
import { Card, CardContent, Box, Typography, alpha, useTheme } from "@mui/material";
import { Feature } from "./types";

interface FeatureCardProps extends Feature {
  index: number;
}

const FeatureCard = memo(({ icon, title, description, index }: FeatureCardProps) => {
  const theme = useTheme();

  return (
    <Card
      component="article"
      aria-labelledby={`feature-title-${index}`}
      sx={{
        height: "100%",
        transition: "all 0.3s ease",
        "&:hover": {
          transform: "translateY(-8px)",
          boxShadow: 4
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box
          sx={{
            color: theme.palette.primary.main,
            mb: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 70,
            height: 70,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.08)
          }}
          aria-hidden="true"
        >
          {icon}
        </Box>
        <Typography id={`feature-title-${index}`} variant="h6" component="h3" fontWeight={600} gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
});

FeatureCard.displayName = "FeatureCard";

export default FeatureCard;
