import { List, ListItem, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const navItems = [
  { label: "Home", to: "/", roles: [] },
  { label: "API Catalog", to: "/apis", roles: [] },
  { label: "My Integrations", to: "/my/integrations", roles: [] },
  { label: "Support", to: "/support", roles: [] },
  { label: "News", to: "/news", roles: [] },
  { label: "Admin", to: "/admin", roles: ["Admin", "GlobalAdmin"] }
];

const SideNav = () => {
  const { roles } = useAuth();

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
