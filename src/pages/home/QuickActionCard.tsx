/**
 * Quick action card component for primary user actions
 * Provides prominent CTAs for key portal features
 */

import { memo } from "react";
import { Box, Card, CardContent, Button, Typography, alpha, useTheme } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";
import { QuickAction } from "./types";

const QuickActionCard = memo(({ icon, title, description, buttonText, onClick }: QuickAction) => {
  const theme = useTheme();

  return (
    <Card
      component="article"
      sx={{
        height: "100%",
        bgcolor: alpha(theme.palette.primary.main, 0.03),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        transition: "all 0.3s ease",
        "&:hover": {
          bgcolor: alpha(theme.palette.primary.main, 0.06),
          borderColor: theme.palette.primary.main
        }
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box
          sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }}
          aria-hidden="true"
        >
          {icon}
        </Box>
        <Typography variant="h6" component="h3" fontWeight={600} gutterBottom>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }} variant="body2">
          {description}
        </Typography>
        <Button
          variant="contained"
          onClick={onClick}
          endIcon={<ArrowForward />}
          fullWidth
          aria-label={buttonText}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
});

QuickActionCard.displayName = "QuickActionCard";

export default QuickActionCard;
