// `env.ts` exige DATABASE_URL au chargement. Les routes testées ici ne
// touchent pas la base : on fournit une valeur syntaxiquement valide pour
// que le module se charge, aucune connexion n'est ouverte.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.APP_ACCESS_CODE ??= "code-de-test";
process.env.ADMIN_PIN ??= "4321";
