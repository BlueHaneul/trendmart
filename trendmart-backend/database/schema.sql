-- TrendMart database schema (final release)
-- Creates every table, constraint and index. It does not create the database itself:
-- scripts/setup-database.js does that, then runs this file and loads the demo data.
-- To use it by hand in MySQL Workbench: create and select an empty database, then run this file.

-- ── STORES ────────────────────────────────────────────────────────────────────
CREATE TABLE Stores (
  store_id     INT          AUTO_INCREMENT PRIMARY KEY,
  store_name   VARCHAR(100) NOT NULL,
  location     VARCHAR(150) NOT NULL,
  manager_name VARCHAR(100) NOT NULL,
  phone        VARCHAR(20),
  email        VARCHAR(100),
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,   -- stores are deactivated, never deleted
  opened_date  DATE         NOT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── USERS ─────────────────────────────────────────────────────────────────────
CREATE TABLE Users (
  user_id               INT          AUTO_INCREMENT PRIMARY KEY,
  username              VARCHAR(50)  NOT NULL UNIQUE,
  password_hash         VARCHAR(255) NOT NULL,                  -- bcrypt hash only, never plain text
  full_name             VARCHAR(100) NOT NULL,
  role                  ENUM('SystemAdmin','Manager','Staff') NOT NULL DEFAULT 'Staff',
  email                 VARCHAR(100) UNIQUE,
  phone                 VARCHAR(20),
  assigned_store_id     INT          NULL,                      -- Sales Staff are tied to one store
  mfa_secret            VARCHAR(64)  NULL,                      -- TOTP secret, NULL until MFA is set up
  mfa_enabled           TINYINT(1)   NOT NULL DEFAULT 0,
  is_active             TINYINT(1)   NOT NULL DEFAULT 1,        -- users are deactivated, never deleted
  failed_login_attempts INT          NOT NULL DEFAULT 0,        -- FR-01 lockout counter
  locked_until          DATETIME     NULL,                      -- FR-01 lockout expiry
  created_at            DATETIME     DEFAULT CURRENT_TIMESTAMP,
  last_login            DATETIME     NULL,
  data_modified_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_store FOREIGN KEY (assigned_store_id)
    REFERENCES Stores(store_id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX idx_users_store ON Users(assigned_store_id);

-- ── PRODUCTS ──────────────────────────────────────────────────────────────────
CREATE TABLE Products (
  product_id      INT           AUTO_INCREMENT PRIMARY KEY,
  product_name    VARCHAR(150)  NOT NULL,
  category        VARCHAR(50)   NOT NULL,
  price           DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock_level     INT           NOT NULL DEFAULT 0 CHECK (stock_level >= 0),   -- stock can never go negative
  min_stock_level INT           NOT NULL DEFAULT 10,                           -- low-stock threshold
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_products_category ON Products(category);
CREATE INDEX idx_products_active   ON Products(is_active);

-- ── SALE TRANSACTIONS ─────────────────────────────────────────────────────────
CREATE TABLE SaleTransactions (
  transaction_id   INT           AUTO_INCREMENT PRIMARY KEY,
  user_id          INT           NOT NULL,
  store_id         INT           NOT NULL,
  transaction_date DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount     DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
  status           ENUM('Completed','Cancelled') NOT NULL DEFAULT 'Completed',
  notes            TEXT,
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES Users(user_id)   ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (store_id) REFERENCES Stores(store_id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX idx_st_date       ON SaleTransactions(transaction_date);
CREATE INDEX idx_st_store      ON SaleTransactions(store_id);
CREATE INDEX idx_st_user       ON SaleTransactions(user_id);
CREATE INDEX idx_st_status     ON SaleTransactions(status);
CREATE INDEX idx_st_store_date ON SaleTransactions(store_id, transaction_date);   -- store and date report queries

-- ── SALE ITEMS ────────────────────────────────────────────────────────────────
CREATE TABLE SaleItems (
  item_id        INT           AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT           NOT NULL,
  product_id     INT           NOT NULL,
  quantity       INT           NOT NULL CHECK (quantity > 0),
  unit_price     DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal       DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES SaleTransactions(transaction_id) ON DELETE CASCADE  ON UPDATE CASCADE,
  FOREIGN KEY (product_id)     REFERENCES Products(product_id)             ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX idx_si_product ON SaleItems(product_id);

-- ── AUDIT LOG (POPIA) ─────────────────────────────────────────────────────────
CREATE TABLE AuditLog (
  log_id      INT          AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NULL,            -- NULL for an unauthenticated attempt
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   INT,
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(255),
  result      ENUM('SUCCESS','FAILURE','BLOCKED') NOT NULL,
  logged_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_user   ON AuditLog(user_id);
CREATE INDEX idx_audit_date   ON AuditLog(logged_at);
CREATE INDEX idx_audit_action ON AuditLog(action);