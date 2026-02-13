import { Box, Typography } from "@mui/material";

const AccessDenied = () => {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={6}>
      <Typography variant="h4">Access denied</Typography>
      <Typography color="text.secondary">You do not have permission to view this page.</Typography>
    </Box>
  );
};

export default AccessDenied;
