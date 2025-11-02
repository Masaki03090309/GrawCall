-- Zoom Phone Feedback System Database Schema
-- Version: 1.0.1 (Fixed RLS policy order)
-- Created: 2025-01-15

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ======================
-- STEP 1: Create all tables WITHOUT RLS policies
-- ======================

-- 1. users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'director', 'user')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 2. projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slack_webhook_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_name ON projects(name);

-- 3. project_members table
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('director', 'user')),
  zoom_user_id VARCHAR(255),
  phone_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_zoom ON project_members(zoom_user_id);
CREATE INDEX idx_project_members_phone ON project_members(phone_number);

-- 4. prompts table
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  prompt_type VARCHAR(50) NOT NULL CHECK (prompt_type IN ('connected', 'reception')),
  content TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES users(id),
  change_comment TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, prompt_type, version)
);

CREATE INDEX idx_prompts_project ON prompts(project_id);
CREATE INDEX idx_prompts_active ON prompts(project_id, prompt_type, is_active);

-- 5. talk_scripts table
CREATE TABLE talk_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  opening_script TEXT,
  proposal_script TEXT,
  closing_script TEXT,
  created_by UUID REFERENCES users(id),
  change_comment TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, version)
);

CREATE INDEX idx_talk_scripts_project ON talk_scripts(project_id);
CREATE INDEX idx_talk_scripts_active ON talk_scripts(project_id, is_active);

-- 6. talk_script_hearing_items table
CREATE TABLE talk_script_hearing_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  talk_script_id UUID REFERENCES talk_scripts(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  item_script TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  display_order INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_talk_script_hearing_items_script ON talk_script_hearing_items(talk_script_id);
CREATE INDEX idx_talk_script_hearing_items_order ON talk_script_hearing_items(talk_script_id, display_order);

CREATE UNIQUE INDEX idx_talk_script_hearing_items_default
ON talk_script_hearing_items(talk_script_id)
WHERE is_default = TRUE;

-- 7. learning_materials table
CREATE TABLE learning_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  material_type VARCHAR(50) NOT NULL CHECK (material_type IN ('detail', 'case_study')),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('pdf', 'csv')),
  file_url TEXT NOT NULL,
  file_size_mb DECIMAL(10, 2),
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_learning_materials_project ON learning_materials(project_id);
CREATE INDEX idx_learning_materials_type ON learning_materials(project_id, material_type);

-- 8. learning_material_embeddings table
CREATE TABLE learning_material_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID REFERENCES learning_materials(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_learning_material_embeddings_material ON learning_material_embeddings(material_id);

-- pgvector index for cosine similarity search
CREATE INDEX idx_learning_material_embeddings_vector
ON learning_material_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 9. ng_reasons table
CREATE TABLE ng_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  reason_name VARCHAR(255) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ng_reasons_project ON ng_reasons(project_id);

-- 10. calls table
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES users(id),

  -- Zoom info
  zoom_call_id VARCHAR(255) UNIQUE NOT NULL,
  zoom_recording_id VARCHAR(255) UNIQUE NOT NULL,

  -- Call info
  direction VARCHAR(50) CHECK (direction IN ('inbound', 'outbound')),
  caller_number VARCHAR(50),
  callee_number VARCHAR(50),
  duration_seconds INT,
  call_time TIMESTAMP,

  -- File URLs
  audio_url TEXT,
  transcript_url TEXT,

  -- Status detection
  status VARCHAR(50) CHECK (status IN ('connected', 'reception', 'no_conversation')),
  status_confidence DECIMAL(5, 2),

  -- Feedback
  feedback_text TEXT,
  prompt_version_id UUID REFERENCES prompts(id),

  -- Talk script analysis
  talk_script_version_id UUID REFERENCES talk_scripts(id),
  overall_match_rate DECIMAL(5, 2),
  phase_match_rates JSONB,
  hearing_item_coverage JSONB,

  -- AI judgments
  appointment_gained BOOLEAN,
  appointment_confirmed BOOLEAN DEFAULT FALSE,
  valid_lead BOOLEAN,
  valid_lead_confirmed BOOLEAN DEFAULT FALSE,
  ng_reason_id UUID REFERENCES ng_reasons(id),

  -- Emotion analysis
  emotion_analysis_url TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calls_project ON calls(project_id);
CREATE INDEX idx_calls_user ON calls(user_id);
CREATE INDEX idx_calls_time ON calls(call_time);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_zoom_call ON calls(zoom_call_id);
CREATE INDEX idx_calls_zoom_recording ON calls(zoom_recording_id);
CREATE INDEX idx_calls_list_search ON calls(project_id, call_time DESC, status);
CREATE INDEX idx_calls_kpi ON calls(project_id, call_time, status, appointment_confirmed, valid_lead_confirmed);

-- 11. ng_reason_logs table
CREATE TABLE ng_reason_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  ng_reason_id UUID REFERENCES ng_reasons(id),

  -- Store info for when call is deleted
  call_date TIMESTAMP NOT NULL,
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES users(id),
  customer_phone VARCHAR(50),

  ai_confidence DECIMAL(5, 2),
  evidence_text TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ng_reason_logs_call ON ng_reason_logs(call_id);
CREATE INDEX idx_ng_reason_logs_reason ON ng_reason_logs(ng_reason_id);
CREATE INDEX idx_ng_reason_logs_project ON ng_reason_logs(project_id);
CREATE INDEX idx_ng_reason_logs_date ON ng_reason_logs(call_date);
CREATE INDEX idx_ng_reason_logs_trend ON ng_reason_logs(project_id, call_date DESC, ng_reason_id);

-- ======================
-- STEP 2: Enable RLS and create policies (AFTER all tables exist)
-- ======================

-- users table RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own"
ON users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "users_owner_all"
ON users FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- projects table RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select"
ON projects FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM project_members
    WHERE project_id = projects.id
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "projects_owner_manage"
ON projects FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- project_members table RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members_select"
ON project_members FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'director'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "project_members_director_manage"
ON project_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'director'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- prompts table RLS
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompts_select"
ON prompts FOR SELECT
USING (
  project_id IS NULL
  OR
  auth.uid() IN (
    SELECT user_id FROM project_members
    WHERE project_id = prompts.project_id
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "prompts_manage"
ON prompts FOR ALL
USING (
  (project_id IS NULL AND EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  ))
  OR
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = prompts.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'director'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- talk_scripts table RLS
ALTER TABLE talk_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talk_scripts_select"
ON talk_scripts FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM project_members
    WHERE project_id = talk_scripts.project_id
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "talk_scripts_manage"
ON talk_scripts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = talk_scripts.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'director'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- talk_script_hearing_items table RLS
ALTER TABLE talk_script_hearing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hearing_items_select"
ON talk_script_hearing_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM talk_scripts ts
    WHERE ts.id = talk_script_hearing_items.talk_script_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members
          WHERE project_id = ts.project_id
        )
        OR
        EXISTS (
          SELECT 1 FROM users
          WHERE id = auth.uid() AND role = 'owner'
        )
      )
  )
);

-- learning_materials table RLS
ALTER TABLE learning_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learning_materials_select"
ON learning_materials FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM project_members
    WHERE project_id = learning_materials.project_id
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "learning_materials_manage"
ON learning_materials FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = learning_materials.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'director'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- learning_material_embeddings table RLS
ALTER TABLE learning_material_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "embeddings_select"
ON learning_material_embeddings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM learning_materials lm
    INNER JOIN project_members pm ON pm.project_id = lm.project_id
    WHERE lm.id = learning_material_embeddings.material_id
      AND (pm.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'
      ))
  )
);

-- ng_reasons table RLS
ALTER TABLE ng_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ng_reasons_select"
ON ng_reasons FOR SELECT
USING (
  project_id IS NULL
  OR
  auth.uid() IN (
    SELECT user_id FROM project_members
    WHERE project_id = ng_reasons.project_id
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "ng_reasons_owner_manage"
ON ng_reasons FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- calls table RLS
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_select"
ON calls FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = calls.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'director'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "calls_update_own"
ON calls FOR UPDATE
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = calls.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'director'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- ng_reason_logs table RLS
ALTER TABLE ng_reason_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ng_reason_logs_select"
ON ng_reason_logs FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = ng_reason_logs.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'director'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- ======================
-- STEP 3: Triggers and Functions
-- ======================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update_updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calls_updated_at
BEFORE UPDATE ON calls
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to deactivate old versions
CREATE OR REPLACE FUNCTION deactivate_old_versions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    -- For prompts
    IF TG_TABLE_NAME = 'prompts' THEN
      UPDATE prompts
      SET is_active = FALSE
      WHERE project_id = NEW.project_id
        AND prompt_type = NEW.prompt_type
        AND id != NEW.id
        AND is_active = TRUE;
    END IF;

    -- For talk_scripts
    IF TG_TABLE_NAME = 'talk_scripts' THEN
      UPDATE talk_scripts
      SET is_active = FALSE
      WHERE project_id = NEW.project_id
        AND id != NEW.id
        AND is_active = TRUE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply deactivate_old_versions trigger
CREATE TRIGGER deactivate_old_prompts
BEFORE INSERT ON prompts
FOR EACH ROW EXECUTE FUNCTION deactivate_old_versions();

CREATE TRIGGER deactivate_old_talk_scripts
BEFORE INSERT ON talk_scripts
FOR EACH ROW EXECUTE FUNCTION deactivate_old_versions();

-- ======================
-- STEP 4: Data retention (Cron job)
-- ======================

-- Delete calls older than 6 months (runs daily at 2 AM)
SELECT cron.schedule(
  'delete-old-calls',
  '0 2 * * *',
  $$
    DELETE FROM calls
    WHERE call_time < NOW() - INTERVAL '6 months';
  $$
);

-- ======================
-- Table comments
-- ======================

COMMENT ON TABLE users IS 'System users with role-based access control';
COMMENT ON TABLE projects IS 'Projects for organizing calls and team members';
COMMENT ON TABLE project_members IS 'Project membership and roles';
COMMENT ON TABLE prompts IS 'Feedback generation prompts with version control';
COMMENT ON TABLE talk_scripts IS 'Talk scripts for call script matching analysis';
COMMENT ON TABLE talk_script_hearing_items IS 'Hearing items within talk scripts';
COMMENT ON TABLE learning_materials IS 'Learning materials for RAG search';
COMMENT ON TABLE learning_material_embeddings IS 'Vector embeddings for RAG search (pgvector)';
COMMENT ON TABLE calls IS 'Call recordings with AI analysis results';
COMMENT ON TABLE ng_reasons IS 'NG reason classification master data';
COMMENT ON TABLE ng_reason_logs IS 'Permanent NG reason logs (survives call deletion)';
