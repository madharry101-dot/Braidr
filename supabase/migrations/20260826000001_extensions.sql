-- Braidr — extensions required by the rest of the schema.
-- pgcrypto: gen_random_uuid() for all primary keys.
create extension if not exists pgcrypto;
