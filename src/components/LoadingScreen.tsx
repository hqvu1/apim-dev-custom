import { Box, CircularProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

const LoadingScreen = ({ message }: { message?: string }) => {
  const { t } = useTranslation();
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
      <Typography color="text.secondary">{message || t("loading.default")}</Typography>
    </Box>
  );
};

export default LoadingScreen;
