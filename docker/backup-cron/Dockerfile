# Image légère avec pg_dump (doit correspondre à la version majeure de Postgres).
FROM postgres:16-alpine

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Tourne en tant qu'utilisateur non-root fourni par l'image.
USER postgres
ENTRYPOINT ["/usr/local/bin/backup.sh"]
