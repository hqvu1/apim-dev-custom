import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();
  return (
    <Box mt={6} py={3} textAlign="center" color="text.secondary">
      <Typography variant="body2">{t("footer.title")}</Typography>
      <Typography variant="caption">{t("footer.powered")}</Typography>
    </Box>
  );
};

export default Footer;
