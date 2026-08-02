# Infrastructure

The local infrastructure is orchestrated by the root `docker-compose.yml`.
PostgreSQL data is stored in the named `postgres_data` volume. Schema changes
are versioned in `apps/backend/alembic/versions`; the backend container applies
pending migrations before it starts serving traffic.

No production credentials or cloud resources are stored in this directory.
