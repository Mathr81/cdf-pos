# Image légère avec pg_dump (doit correspondre à la version majeure de Postgres).
FROM postgres:16-alpine

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Démarre en root le temps de donner /backups à `postgres`, puis lâche les
# droits. `../backups` est un dossier de l'hôte, créé par l'utilisateur du
# VPS : sans ce chown, `postgres` (uid 70) ne peut pas y écrire et aucun dump
# n'est produit, ce qui est arrivé en prod pendant des semaines.
ENTRYPOINT ["sh", "-c", "chown postgres:postgres /backups && exec su-exec postgres /usr/local/bin/backup.sh"]
