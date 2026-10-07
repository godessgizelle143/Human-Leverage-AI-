-- HKE hardening, phase 2: remove the temporary client write access to
-- projects.content and projects.updated_at that 20261004120000_hke_foundation
-- kept for the pre-HKE step routes.
--
-- Apply only after the HKE application code is live in production. The HKE
-- code saves step sections through hke_save_project_section, so it does not
-- need these column grants. After this migration, clients may update only
-- projects.title and projects.archived_at.

revoke update (content, updated_at) on public.projects from authenticated;
