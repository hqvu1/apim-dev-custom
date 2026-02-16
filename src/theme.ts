import { createTheme } from "@mui/material/styles";

// Komatsu Global Brand Standards
const brand = {
  gloriaBlue: "#140A9A",
  gloriaBlueHover: "#1C0FBF",
  gloriaBlueDark: "#0F0872",
  iceBlue: "#E8F4F8",
  coolGrey50: "#F8F9FA",
  coolGrey100: "#F2F4F7",
  coolGrey200: "#E5E7EB",
  coolGrey300: "#D1D5DB",
  coolGrey500: "#6B7280",
  coolGrey700: "#374151",
  coolGrey900: "#1F2937"
};

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: brand.gloriaBlue,
      dark: brand.gloriaBlueDark,
      light: brand.gloriaBlueHover
    },
    secondary: {
      main: brand.iceBlue,
      contrastText: brand.gloriaBlue
    },
    background: {
      default: brand.coolGrey50,
      paper: "#ffffff"
    },
    text: {
      primary: brand.coolGrey900,
      secondary: brand.coolGrey700
    }
  },
  typography: {
    fontFamily: "Space Grotesk, IBM Plex Sans, Segoe UI, sans-serif",
    h1: {
      fontWeight: 600,
      letterSpacing: "-0.02em"
    },
    h2: {
      fontWeight: 600,
      letterSpacing: "-0.02em"
    },
    h3: {
      fontWeight: 600
    }
  },
  shape: {
    borderRadius: 14
  }
});
