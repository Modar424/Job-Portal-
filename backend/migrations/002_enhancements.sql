-- Account security
ALTER TABLE users
  ADD COLUMN email_verified_at TIMESTAMP NULL,
  ADD COLUMN failed_logins INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN locked_until TIMESTAMP NULL,
  ADD COLUMN last_login_at TIMESTAMP NULL,
  ADD COLUMN password_changed_at TIMESTAMP NULL;

CREATE TABLE auth_tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  type ENUM('password_reset','email_verify') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token_hash (token_hash),
  KEY idx_token_user (user_id, type),
  CONSTRAINT fk_token_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Job enhancements
ALTER TABLE jobs
  ADD COLUMN salary_currency CHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN views INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN expires_at DATETIME NULL,
  ADD KEY idx_jobs_expires (expires_at),
  ADD KEY idx_jobs_featured (featured, created_at);

CREATE TABLE skills (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(30) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_skill_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE job_skills (
  job_id INT UNSIGNED NOT NULL,
  skill_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (job_id, skill_id),
  KEY idx_job_skill_skill (skill_id),
  CONSTRAINT fk_js_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_js_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Hiring workflow
ALTER TABLE applications
  ADD COLUMN rating TINYINT UNSIGNED NULL,
  ADD CONSTRAINT chk_app_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);

CREATE TABLE application_notes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id INT UNSIGNED NOT NULL,
  author_id INT UNSIGNED NULL,
  note VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_note_app (application_id, created_at),
  CONSTRAINT fk_note_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_note_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Moderation
CREATE TABLE job_reports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id INT UNSIGNED NOT NULL,
  reporter_id INT UNSIGNED NOT NULL,
  reason ENUM('spam','scam','discriminatory','inaccurate','other') NOT NULL,
  details VARCHAR(1000) NULL,
  status ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
  resolved_by INT UNSIGNED NULL,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_report_once (job_id, reporter_id),
  KEY idx_report_status (status, created_at),
  CONSTRAINT fk_report_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_user FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_admin FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NULL,
  entity_id INT UNSIGNED NULL,
  meta JSON NULL,
  ip VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_actor (actor_id, created_at),
  KEY idx_audit_action (action, created_at),
  KEY idx_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
