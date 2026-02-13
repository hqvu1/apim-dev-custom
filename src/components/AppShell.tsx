import { Box, Drawer, Toolbar, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import SideNav from "./SideNav";
import Footer from "./Footer";

const drawerWidth = 260;

const AppShell = () => {
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  return (
    <Box display="flex" minHeight="100vh">
      <Header
        drawerWidth={drawerWidth}
        onMenuClick={handleDrawerToggle}
        showMenuButton={!isLgUp}
      />
      <Drawer
        variant={isLgUp ? "permanent" : "temporary"}
        open={isLgUp ? true : mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            borderRight: "none",
            background: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(12px)"
          }
        }}
      >
        <Toolbar />
        <SideNav />
      </Drawer>
      <Box component="main" flex={1} px={{ xs: 2, md: 4 }} py={{ xs: 2, md: 4 }}>
        <Toolbar />
        <Outlet />
        <Footer />
      </Box>
    </Box>
  );
};

export default AppShell;
