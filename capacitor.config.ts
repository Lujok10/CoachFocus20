import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.focus20.coach",
  appName: "Focus20",
  webDir: "dist",

  server: {
    hostname: "app.coach-focus20.vercel.app",
    androidScheme: "https",
  },

  plugins: {
    SystemBars: {
      insetsHandling: "disable",
    },
  },
};

export default config;