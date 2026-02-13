import { Box, Button, Typography } from "@mui/material";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={6}>
      <Typography variant="h4">Page not found</Typography>
      <Typography color="text.secondary">The page you are looking for is not available.</Typography>
      <Button component={Link} to="/" variant="contained">
        Go home
      </Button>
    </Box>
  );
};

export default NotFound;
