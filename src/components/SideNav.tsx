import { List, ListItem, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";

const navItems = [
  { key: "nav.home", to: "/", roles: [] },
  { key: "nav.apis", to: "/apis", roles: [] },
  { key: "nav.integrations", to: "/my/integrations", roles: [] },
  { key: "nav.support", to: "/support", roles: [] },
  { key: "nav.news", to: "/news", roles: [] },
  { key: "nav.admin", to: "/admin", roles: ["Admin", "GlobalAdmin"] }
];

const SideNav = () => {
  const { roles } = useAuth();
  const { t } = useTranslation();

  const allowed = (itemRoles: string[]) =>
    itemRoles.length === 0 || itemRoles.some((role) => roles.includes(role));

  return (
    <Stack spacing={3} px={2} py={3}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ letterSpacing: "0.12em" }}>
        {t("sideNav.heading")}
      </Typography>
      <List disablePadding>
        {navItems.filter((item) => allowed(item.roles)).map((item) => (
          <ListItem key={item.to} disablePadding>
            <ListItemButton
              component={NavLink}
              to={item.to}
              sx={{
                borderRadius: 2,
                mb: 1,
                "&.active": {
                  backgroundColor: "rgba(15, 26, 34, 0.1)",
                  fontWeight: 600
                }
              }}
            >
              <ListItemText primary={t(item.key)} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
};

export default SideNav;
