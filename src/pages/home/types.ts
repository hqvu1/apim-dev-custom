/**
 * Type definitions for Home page components
 */

export interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export interface QuickAction {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
}

export interface HomeStats {
  availableApis: string;
  activeUsers: string;
  apiCallsToday: string;
  uptime: string;
}
