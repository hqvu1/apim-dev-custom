import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { appConfig } from "./config";
import en from "./i18n/en.json";
import ja from "./i18n/ja.json";

/**
 * i18next configuration.
 *
 * Translations live in `src/i18n/{locale}.json` so they can be maintained
 * independently from code and sent for professional translation.
 *
 * @see docs/ARCHITECTURE_DESIGN.md §10 — Recommended: src/i18n/ JSON files
 */
i18n.use(initReactI18next).init({
  lng: appConfig.defaultLocale,
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    ja: { translation: ja },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
