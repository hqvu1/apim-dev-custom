import { createTheme } from "@mui/material/styles";

const brand = {
  ink: "#0f1a22",
  steel: "#2f3a45",
  sand: "#f4efe6",
  copper: "#c46b45",
  moss: "#4c6b4f",
  sky: "#4b7ea8"
};

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: brand.ink
    },
    secondary: {
      main: brand.copper
    },
    background: {
      default: brand.sand,
      paper: "#ffffff"
    },
    text: {
      primary: brand.ink,
      secondary: brand.steel
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
