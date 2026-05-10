const requiredEnvVars = [
  "DATABASE_URL",
  "API_PORT",
  "CLIENT_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "TOKEN_ENCRYPTION_KEY",
] as const;

export function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY;

  if (!tokenKey || tokenKey.length < 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be at least 32 characters.");
  }

  return {
    databaseUrl: process.env.DATABASE_URL!,
    apiPort: Number(process.env.API_PORT ?? 8787),
    clientUrl: process.env.CLIENT_URL!,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI!,
  };
}
