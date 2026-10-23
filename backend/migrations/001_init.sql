CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role ENUM('seeker','employer','admin') NOT NULL,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE seeker_profiles (
  user_id INT UNSIGNED NOT NULL,
  headline VARCHAR(150) NULL,
  phone VARCHAR(40) NULL,
  location VARCHAR(150) NULL,
  bio TEXT NULL,
  skills VARCHAR(500) NULL,
  resume_file VARCHAR(100) NULL,
  resume_name VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE companies (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  website VARCHAR(255) NULL,
  location VARCHAR(150) NULL,
  industry VARCHAR(100) NULL,
  size VARCHAR(50) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_company_owner (owner_id),
  KEY idx_company_name (name),
  CONSTRAINT fk_company_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE jobs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT NOT NULL,
  location VARCHAR(150) NOT NULL,
  salary_min INT UNSIGNED NULL,
  salary_max INT UNSIGNED NULL,
  employment_type ENUM('full_time','part_time','contract','internship','remote') NOT NULL,
  experience_level ENUM('entry','mid','senior','lead') NOT NULL,
  status ENUM('draft','active','closed') NOT NULL DEFAULT 'draft',
  moderation ENUM('approved','removed') NOT NULL DEFAULT 'approved',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_jobs_listing (status, moderation, created_at),
  KEY idx_jobs_company (company_id, status),
  KEY idx_jobs_category (category_id),
  KEY idx_jobs_filters (employment_type, experience_level),
  KEY idx_jobs_location (location),
  FULLTEXT KEY ft_jobs_text (title, description),
  CONSTRAINT fk_job_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_job_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT chk_salary CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE applications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id INT UNSIGNED NOT NULL,
  seeker_id INT UNSIGNED NOT NULL,
  cover_letter TEXT NULL,
  resume_file VARCHAR(100) NOT NULL,
  resume_name VARCHAR(255) NOT NULL,
  status ENUM('pending','under_review','shortlisted','interview','accepted','rejected','withdrawn') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_application_once (job_id, seeker_id),
  KEY idx_app_seeker (seeker_id, created_at),
  KEY idx_app_job_status (job_id, status),
  CONSTRAINT fk_app_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_seeker FOREIGN KEY (seeker_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE application_events (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id INT UNSIGNED NOT NULL,
  from_status VARCHAR(20) NULL,
  to_status VARCHAR(20) NOT NULL,
  actor_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_app (application_id, created_at),
  CONSTRAINT fk_event_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE saved_jobs (
  user_id INT UNSIGNED NOT NULL,
  job_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, job_id),
  KEY idx_saved_job (job_id),
  CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  message VARCHAR(500) NOT NULL,
  link VARCHAR(255) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO categories (name) VALUES
 ('Software Engineering'),('Design'),('Marketing'),('Sales'),('Finance'),
 ('Customer Support'),('Human Resources'),('Data & Analytics'),('Operations'),('Healthcare');
