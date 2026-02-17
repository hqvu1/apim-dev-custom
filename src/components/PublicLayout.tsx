import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";
import Header from "./Header";
import Footer from "./Footer";

/**
 * PublicLayout component
 * 
 * Provides a layout for public pages (without authentication)
 * Includes Header and Footer but no side navigation
 */
const PublicLayout = () => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <Header isPublic />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Outlet />
      </Box>
      <Footer />
    </Box>
  );
};

export default PublicLayout;
