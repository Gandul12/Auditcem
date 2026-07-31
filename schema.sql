-- Audit Crucible Tracker schema for PostgreSQL / Neon
-- Drizzle source of truth: src/db/schema.ts

CREATE TABLE IF NOT EXISTS audit_items (
  id serial PRIMARY KEY,
  area text NOT NULL DEFAULT 'Cutting',
  domain text NOT NULL,
  deskripsi text NOT NULL,
  prioritas text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS audit_items_area_domain_sort_unique
  ON audit_items (area, domain, sort_order);

CREATE TABLE IF NOT EXISTS audit_cycles (
  area text NOT NULL DEFAULT 'Cutting',
  domain text NOT NULL,
  cycle_month text NOT NULL DEFAULT 'AUG',
  status text NOT NULL DEFAULT 'pending',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (area, domain, cycle_month)
);

CREATE TABLE IF NOT EXISTS audit_findings (
  id serial PRIMARY KEY,
  tanggal date NOT NULL,
  area text NOT NULL DEFAULT 'Cutting',
  domain text NOT NULL,
  auditor text NOT NULL,
  hasil text NOT NULL,
  root_cause text NOT NULL DEFAULT '',
  action_plan text NOT NULL DEFAULT '',
  lesson_learned text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_execution_plans (
  id serial PRIMARY KEY,
  area text NOT NULL DEFAULT 'Cutting',
  week_number integer NOT NULL,
  day_of_week integer NOT NULL,
  day_label text NOT NULL,
  domain text,
  activity_type text NOT NULL DEFAULT 'AUDIT',
  focus text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planned',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS weekly_execution_plans_area_week_day_unique
  ON weekly_execution_plans (area, week_number, day_of_week);

CREATE TABLE IF NOT EXISTS audit_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
