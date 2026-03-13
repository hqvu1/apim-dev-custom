import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

/**
 * Authenticated application shell.
 *
 * The KomatsuHeader owns all navigation: inline nav buttons on wide
 * viewports, hamburger drawer on narrow ones.
 */
const AppShell = () => {
  return (
    <Box display="flex" flexDirection="column" minHeight="100vh">
      <Header />
      <Box component="main" flex={1} px={{ xs: 2, md: 4 }} py={{ xs: 2, md: 4 }}>
        <Outlet />
      </Box>
      <Footer />
    </Box>
  );
};

export default AppShell;
