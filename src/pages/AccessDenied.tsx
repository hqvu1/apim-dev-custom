import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

const AccessDenied = () => {
  const { t } = useTranslation();
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={6}>
      <Typography variant="h4">{t("accessDenied.title")}</Typography>
      <Typography color="text.secondary">{t("accessDenied.message")}</Typography>
    </Box>
  );
};

export default AccessDenied;
