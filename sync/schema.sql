-- Reference schema for the next backend step; this file is not applied by Vite.
-- Electric replicates these rows through authenticated, project-scoped proxies.
CREATE TABLE diggy_projects (
  id uuid PRIMARY KEY,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Receipts make retries idempotent and distinguish HTTP success from an
-- observed Electric echo. Insert a receipt in the same transaction as the edit.
CREATE TABLE diggy_mutations (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES diggy_projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 1),
  command jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, revision)
);
CREATE INDEX diggy_mutations_project_idx ON diggy_mutations(project_id, revision);
