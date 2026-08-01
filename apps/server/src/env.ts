import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required("DATABASE_URL"),
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),
  appAccessCode: required("APP_ACCESS_CODE", "fete2026"),
  adminPin: required("ADMIN_PIN", "1234"),
  jwtSecret: required("JWT_SECRET", "dev-insecure-secret"),
  backup: {
    sheetsEnabled: (process.env.BACKUP_SHEETS_ENABLED ?? "false") === "true",
    sheetsId: process.env.BACKUP_SHEETS_ID ?? "",
    googleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "",
  },
};
