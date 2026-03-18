import type { AppConfig } from "./types";

const DEFAULT_CONFIG: AppConfig = {
  features: {
    darkMode: {
      enabledTiers: ["free", "pro", "enterprise"],
      description: "Dark mode UI theme",
    },
    exportPdf: {
      enabledTiers: ["pro", "enterprise"],
      description: "Export documents as PDF",
    },
    analytics: {
      enabledTiers: ["enterprise"],
      description: "Advanced analytics dashboard",
    },
    customBranding: {
      enabledTiers: ["pro", "enterpise"],
      description: "Custom logo and colors",
    },
  },
};

let currentConfig: AppConfig = DEFAULT_CONFIG;

export function getConfig(): AppConfig {
  return currentConfig;
}

export function setConfig(config: AppConfig): void {
  currentConfig = config;
}
