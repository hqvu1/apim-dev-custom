import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const defaultLocale = import.meta.env.VITE_DEFAULT_LOCALE || "en";

i18n.use(initReactI18next).init({
  lng: defaultLocale,
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        appName: "Komatsu API Marketplace",
        nav: {
          home: "Home",
          apis: "API Catalog",
          integrations: "My Integrations",
          support: "Support",
          news: "News",
          admin: "Admin"
        }
      }
    },
    ja: {
      translation: {
        appName: "Komatsu API Marketplace",
        nav: {
          home: "Home",
          apis: "API Catalog",
          integrations: "My Integrations",
          support: "Support",
          news: "News",
          admin: "Admin"
        }
      }
    }
  },
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
