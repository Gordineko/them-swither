import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "ua", // используем украинский как fallback
    supportedLngs: ["ua", "ru"],
    ns: ["common"],
    defaultNS: "common",
    debug: process.env.NODE_ENV === "development",
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    detection: {
      order: ["cookie", "localStorage"],
      caches: ["cookie"],
      lookupCookie: "i18next",
      lookupLocalStorage: "i18nextLng",
    },
  });

export default i18n;
