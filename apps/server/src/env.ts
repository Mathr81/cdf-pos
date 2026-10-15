import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

/**
 * Secret partagé, avec une valeur de confort en dev.
 *
 * En production, cette valeur est refusée, comme une valeur vide : elle est
 * écrite dans `.env.example` et le README d'un dépôt public. Un secret
 * connu de tous ne protège rien, et compose transmet une variable absente du
 * `.env` comme une chaîne vide, ce qui ouvrirait l'accès à un code vide.
 */
export function readSecret(
  name: string,
  devDefault: string,
  source: NodeJS.ProcessEnv = process.env,
): string {
  const value = source[name];
  if (source.NODE_ENV !== "production") return value || devDefault;
  if (!value || value === devDefault) {
    throw new Error(
      `${name} est vide ou vaut la valeur d'exemple publique : choisis une valeur propre dans .env.`,
    );
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required("DATABASE_URL"),
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),
  /**
   * Dossier des images produit. En conteneur c'est un volume Docker dédié
   * (`mediadata`), en dev local un dossier ignoré par git. Aucun binaire ne
   * transite jamais par la base ni par le journal d'événements.
   */
  mediaDir: process.env.MEDIA_DIR ?? "./.media",
  appAccessCode: readSecret("APP_ACCESS_CODE", "fete2026"),
  adminPin: readSecret("ADMIN_PIN", "1234"),
  backup: {
    sheetsEnabled: (process.env.BACKUP_SHEETS_ENABLED ?? "false") === "true",
    sheetsId: process.env.BACKUP_SHEETS_ID ?? "",
    googleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "",
  },
};
