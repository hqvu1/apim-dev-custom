import { List, ListItem, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { ROUTES } from "../config";

const SideNav = () => {
  const { roles } = useAuth();
  const { t } = useTranslation();

  const navItems = [
    { label: t("nav.home"), to: ROUTES.HOME, roles: [] as string[] },
    { label: t("nav.apis"), to: ROUTES.API_CATALOG, roles: [] as string[] },
    { label: t("nav.integrations"), to: ROUTES.MY_INTEGRATIONS, roles: [] as string[] },
    { label: t("nav.support"), to: ROUTES.SUPPORT, roles: [] as string[] },
    { label: t("nav.news"), to: ROUTES.NEWS, roles: [] as string[] },
    { label: t("nav.admin"), to: ROUTES.ADMIN, roles: ["Admin", "GlobalAdmin"] },
  ];

  const allowed = (itemRoles: string[]) =>
    itemRoles.length === 0 || itemRoles.some((role) => roles.includes(role));

  return (
    <Stack spacing={3} px={2} py={3}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ letterSpacing: "0.12em" }}>
        NAVIGATION
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
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
};

export default SideNav;
