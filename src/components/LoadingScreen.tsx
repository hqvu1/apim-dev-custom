import { Box, CircularProgress, Typography } from "@mui/material";

const LoadingScreen = ({ message }: { message?: string }) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="60vh"
      gap={2}
    >
      <CircularProgress />
      <Typography color="text.secondary">{message || "Loading..."}</Typography>
    </Box>
  );
};

export default LoadingScreen;
