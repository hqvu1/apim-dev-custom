import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import TranslateIcon from "@mui/icons-material/Translate";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";

const Header = ({
  drawerWidth,
  onMenuClick,
  showMenuButton
}: {
  drawerWidth: number;
  onMenuClick: () => void;
  showMenuButton: boolean;
}) => {
  const { t, i18n } = useTranslation();
  const { account } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const displayName = account?.name || "Komatsu User";

  return (
    <AppBar
      position="fixed"
      color="transparent"
      elevation={0}
      sx={{
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(15, 26, 34, 0.08)",
        ml: { lg: `${drawerWidth}px` }
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {showMenuButton && (
            <IconButton onClick={onMenuClick} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
          )}
          <Stack spacing={1}>
            <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: "0.2em" }}>
              Portal
            </Typography>
            <Typography variant="h6">{t("appName")}</Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <Tooltip title="Language">
            <IconButton
              onClick={(event) => setAnchorEl(event.currentTarget)}
              aria-label="Change language"
              size="small"
            >
              <TranslateIcon />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem
              onClick={() => {
                i18n.changeLanguage("en");
                setAnchorEl(null);
              }}
            >
              English
            </MenuItem>
            <MenuItem
              onClick={() => {
                i18n.changeLanguage("ja");
                setAnchorEl(null);
              }}
            >
              Japanese
            </MenuItem>
          </Menu>
          <Box display="flex" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "primary.main" }}>{displayName.charAt(0)}</Avatar>
            <Typography variant="body2" fontWeight={600}>
              {displayName}
            </Typography>
          </Box>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
