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
import { Feature } from "./types";

/**
 * Feature highlights showcasing platform capabilities
 */
export const PLATFORM_FEATURES: Feature[] = [
  {
    icon: <ApiOutlined sx={{ fontSize: 40 }} />,
    title: "Comprehensive API Catalog",
    description: "Access a wide range of enterprise APIs with detailed documentation and interactive testing capabilities."
  },
  {
    icon: <SecurityOutlined sx={{ fontSize: 40 }} />,
    title: "Enterprise-Grade Security",
    description: "Role-based access control, OAuth 2.0 authentication, and secure API key management."
  },
  {
    icon: <SpeedOutlined sx={{ fontSize: 40 }} />,
    title: "High Performance",
    description: "Low-latency APIs with Azure infrastructure, SLA guarantees, and real-time monitoring."
  },
  {
    icon: <IntegrationInstructionsOutlined sx={{ fontSize: 40 }} />,
    title: "Easy Integration",
    description: "SDKs, code samples, and step-by-step guides to accelerate your integration journey."
  },
  {
    icon: <CodeOutlined sx={{ fontSize: 40 }} />,
    title: "Developer Tools",
    description: "Interactive API explorer, sandbox environments, and comprehensive testing utilities."
  },
  {
    icon: <SupportAgentOutlined sx={{ fontSize: 40 }} />,
    title: "24/7 Support",
    description: "Expert technical support team ready to assist with integration challenges and questions."
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
