import { Box, Button, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const { t } = useTranslation();
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={6}>
      <Typography variant="h4">{t("notFound.title")}</Typography>
      <Typography color="text.secondary">{t("notFound.message")}</Typography>
      <Button component={Link} to="/" variant="contained">
        {t("notFound.goHome")}
      </Button>
    </Box>
  );
};

export default NotFound;
