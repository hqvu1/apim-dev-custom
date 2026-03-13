import { useState } from "react";
import { Header as KomatsuHeader, type NavigationItem } from "@komatsu-nagm/component-library";
import TranslateIcon from "@mui/icons-material/Translate";
import { IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import useLogout from "../utils/loginUtils/useLogout";
import { appConfig, ROUTES } from "../config";

type HeaderProps = {
  /** When true, renders a simplified header without auth navigation items. */
  isPublic?: boolean;
};

/**
 * Application header — wraps the `Header` component from
 * `@komatsu-nagm/component-library` and wires it up to the
 * portal's auth context, i18n, and routing.
 */
const Header = ({ isPublic = false }: HeaderProps) => {
  const { t, i18n } = useTranslation();
  const { account, roles } = useAuth();
  const { logout } = useLogout();
  const navigate = useNavigate();
  const [langAnchor, setLangAnchor] = useState<null | HTMLElement>(null);

  const displayName = account?.name || "Komatsu User";
  const displayEmail = account?.username || "";
  const initials = displayName
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Build navigation items from ROUTES when authenticated
  const navigation: NavigationItem[] = isPublic
    ? []
    : [
        { label: t("nav.home"), onClick: () => navigate(ROUTES.HOME) },
        { label: t("nav.apis"), onClick: () => navigate(ROUTES.API_CATALOG) },
        { label: t("nav.integrations"), onClick: () => navigate(ROUTES.MY_INTEGRATIONS) },
        { label: t("nav.support"), onClick: () => navigate(ROUTES.SUPPORT) },
        { label: t("nav.news"), onClick: () => navigate(ROUTES.NEWS) },
        ...(roles.includes("Admin") || roles.includes("GlobalAdmin")
          ? [{ label: t("nav.admin"), onClick: () => navigate(ROUTES.ADMIN) }]
          : []),
      ];

  // Standalone language-switcher dropdown
  const languageSwitcher = (
    <>
      <Tooltip title={t("header.language")}>
        <IconButton
          onClick={(e) => setLangAnchor(e.currentTarget)}
          aria-label="Change language"
          size="small"
          sx={{ color: "white" }}
        >
          <TranslateIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={langAnchor}
        open={Boolean(langAnchor)}
        onClose={() => setLangAnchor(null)}
      >
        <MenuItem
          selected={i18n.language === "en"}
          onClick={() => { i18n.changeLanguage("en"); setLangAnchor(null); }}
        >
          {t("header.langEnglish")}
        </MenuItem>
        <MenuItem
          selected={i18n.language === "es"}
          onClick={() => { i18n.changeLanguage("es"); setLangAnchor(null); }}
        >
          {t("header.langSpanish")}
        </MenuItem>
      </Menu>
    </>
  );

  return (
    <KomatsuHeader
      appTitle={appConfig.appName}
      navigation={navigation}
      actions={languageSwitcher}
      userProfile={{
        userEmail: displayEmail,
        userRoles: roles.join(", "),
        userInitials: initials || "K",
        onSignOut: logout,
      }}
    />
  );
};

export default Header;
