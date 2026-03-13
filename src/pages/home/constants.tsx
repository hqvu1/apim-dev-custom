/**
 * Constants and configuration for Home page
 */

import {
  ApiOutlined,
  IntegrationInstructionsOutlined,
  SecurityOutlined,
  SpeedOutlined,
  CodeOutlined,
  SupportAgentOutlined
} from "@mui/icons-material";

export interface FeatureKey {
  icon: React.ReactNode;
  titleKey: string;
  descriptionKey: string;
}

/**
 * Feature highlights showcasing platform capabilities (i18n keys)
 */
export const PLATFORM_FEATURES: FeatureKey[] = [
  {
    icon: <ApiOutlined sx={{ fontSize: 40 }} />,
    titleKey: "home.features.apiCatalog.title",
    descriptionKey: "home.features.apiCatalog.description"
  },
  {
    icon: <SecurityOutlined sx={{ fontSize: 40 }} />,
    titleKey: "home.features.security.title",
    descriptionKey: "home.features.security.description"
  },
  {
    icon: <SpeedOutlined sx={{ fontSize: 40 }} />,
    titleKey: "home.features.performance.title",
    descriptionKey: "home.features.performance.description"
  },
  {
    icon: <IntegrationInstructionsOutlined sx={{ fontSize: 40 }} />,
    titleKey: "home.features.integration.title",
    descriptionKey: "home.features.integration.description"
  },
  {
    icon: <CodeOutlined sx={{ fontSize: 40 }} />,
    titleKey: "home.features.devTools.title",
    descriptionKey: "home.features.devTools.description"
  },
  {
    icon: <SupportAgentOutlined sx={{ fontSize: 40 }} />,
    titleKey: "home.features.support.title",
    descriptionKey: "home.features.support.description"
  }
];

/**
 * Default statistics for the platform
 */
export const DEFAULT_STATS = {
  availableApis: "42",
  activeUsers: "1,247",
  apiCallsToday: "2.4M",
  uptime: "99.9%"
} as const;
