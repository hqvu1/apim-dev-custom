import { Box, Typography } from "@mui/material";

const Footer = () => {
  return (
    <Box mt={6} py={3} textAlign="center" color="text.secondary">
      <Typography variant="body2">Komatsu API Marketplace Portal</Typography>
      <Typography variant="caption">Powered by Komatsu NA APIM customization on Azure</Typography>
    </Box>
  );
};

export default Footer;
