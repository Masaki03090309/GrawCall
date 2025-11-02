-- Cleanup Script: Drop all existing tables before recreating
-- This should be run BEFORE the main migration script

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS ng_reason_logs CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS ng_reasons CASCADE;
DROP TABLE IF EXISTS learning_material_embeddings CASCADE;
DROP TABLE IF EXISTS learning_materials CASCADE;
DROP TABLE IF EXISTS talk_script_hearing_items CASCADE;
DROP TABLE IF EXISTS talk_scripts CASCADE;
DROP TABLE IF EXISTS prompts CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS deactivate_old_versions() CASCADE;

-- Note: Extensions and cron jobs are left intact
