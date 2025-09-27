#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
   CREATE DATABASE user_service;
   CREATE DATABASE alert_service;
   CREATE DATABASE map_service;
   CREATE DATABASE notification_service;
   CREATE DATABASE admin_service;
EOSQL

for db in user_service alert_service map_service notification_service admin_service; do
  echo "Granting privileges on $db"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<-EOSQL
     CREATE EXTENSION IF NOT EXISTS postgis;
  EOSQL
done
