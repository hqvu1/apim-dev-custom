import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";
import Header from "./Header";
import Footer from "./Footer";

/**
 * PublicLayout component
 *
 * Provides a layout for public pages (without authentication).
 * Uses the library Header in "public" mode (no navigation or user menu).
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
      <Header />
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
