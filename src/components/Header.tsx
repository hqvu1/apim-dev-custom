import {
  AppBar,
  Avatar,
  Box,
  Button,
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
import LoginIcon from "@mui/icons-material/Login";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import useLogout from "../utils/loginUtils/useLogout";
import { initiateLogin } from "../utils/loginUtils/initiateLogin";

const Header = ({
  drawerWidth = 0,
  onMenuClick,
  showMenuButton = false,
  isPublic = false
}: {
  drawerWidth?: number;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
  isPublic?: boolean;
}) => {
  const { t, i18n } = useTranslation();
  const { account } = useAuth();
  const { logout } = useLogout();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userAnchor, setUserAnchor] = useState<null | HTMLElement>(null);

  const isAuthenticated = !!account;
  const displayName = account?.name || "Komatsu User";

  const handleLogin = () => {
    initiateLogin();
  };

  return (
    <AppBar
      position="fixed"
      color="transparent"
      elevation={0}
      sx={{
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(15, 26, 34, 0.08)",
        ml: isPublic ? 0 : { lg: `${drawerWidth}px` }
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {showMenuButton && onMenuClick && (
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
          
          {isAuthenticated ? (
            <>
              <Box display="flex" alignItems="center" gap={1}>
                <IconButton
                  onClick={(event) => setUserAnchor(event.currentTarget)}
                  aria-label="Open user menu"
                  size="small"
                >
                  <Avatar sx={{ bgcolor: "primary.main" }}>{displayName.charAt(0)}</Avatar>
                </IconButton>
                <Typography variant="body2" fontWeight={600}>
                  {displayName}
                </Typography>
              </Box>
              <Menu anchorEl={userAnchor} open={Boolean(userAnchor)} onClose={() => setUserAnchor(null)}>
                <MenuItem
                  onClick={() => {
                    setUserAnchor(null);
                    logout();
                  }}
                >
                  Sign out
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              variant="contained"
              color="primary"
              startIcon={<LoginIcon />}
              onClick={handleLogin}
              aria-label="Login"
            >
              {t("login", "Login")}
            </Button>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
