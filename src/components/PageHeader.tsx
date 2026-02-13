import { Box, Typography } from "@mui/material";

const PageHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => {
  return (
    <Box mb={3}>
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>
      {subtitle && (
        <Typography color="text.secondary" maxWidth={640}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
};

export default PageHeader;
