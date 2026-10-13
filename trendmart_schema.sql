SET SQL_SAFE_UPDATES = 0;

CREATE DATABASE trendmart_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE trendmart_db;

-- ── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE Users (
  user_id       INT          AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,        -- bcrypt hash ONLY, never plain text
  full_name     VARCHAR(100) NOT NULL,
  role          ENUM('Admin','Staff') NOT NULL DEFAULT 'Staff',
  email         VARCHAR(100) UNIQUE,
  phone         VARCHAR(20),
  mfa_secret    VARCHAR(64)  NULL,            -- TOTP secret for MFA (nullable = MFA not yet set up)
  mfa_enabled   TINYINT(1)   NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  last_login    DATETIME     NULL,
  -- POPIA: record when personal data was last modified for retention tracking
  data_modified_at DATETIME  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Indexes: username is already indexed via UNIQUE constraint
-- email is already indexed via UNIQUE constraint

-- ── STORES ──────────────────────────────────────────────────────────────────
CREATE TABLE Stores (
  store_id     INT          AUTO_INCREMENT PRIMARY KEY,
  store_name   VARCHAR(100) NOT NULL,
  location     VARCHAR(150) NOT NULL,
  manager_name VARCHAR(100) NOT NULL,
  phone        VARCHAR(20),
  email        VARCHAR(100),
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  opened_date  DATE         NOT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- DESCRIBE Stores;
-- ── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE Users (
  user_id       INT          AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,        -- bcrypt hash ONLY, never plain text
  full_name     VARCHAR(100) NOT NULL,
  role          ENUM('Admin','Staff') NOT NULL DEFAULT 'Staff',
  email         VARCHAR(100) UNIQUE,
  phone         VARCHAR(20),
  mfa_secret    VARCHAR(64)  NULL,            -- TOTP secret for MFA (nullable = MFA not yet set up)
  mfa_enabled   TINYINT(1)   NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  last_login    DATETIME     NULL,
  -- POPIA: record when personal data was last modified for retention tracking
  data_modified_at DATETIME  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Indexes: username is already indexed via UNIQUE constraint
-- email is already indexed via UNIQUE constraint

-- ── STORES ──────────────────────────────────────────────────────────────────
CREATE TABLE Stores (
  store_id     INT          AUTO_INCREMENT PRIMARY KEY,
  store_name   VARCHAR(100) NOT NULL,
  location     VARCHAR(150) NOT NULL,
  manager_name VARCHAR(100) NOT NULL,
  phone        VARCHAR(20),
  email        VARCHAR(100),
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  opened_date  DATE         NOT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── PRODUCTS ────────────────────────────────────────────────────────────────
CREATE TABLE Products (
  product_id      INT           AUTO_INCREMENT PRIMARY KEY,
  product_name    VARCHAR(150)  NOT NULL,
  category        VARCHAR(50)   NOT NULL,
  price           DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock_level     INT           NOT NULL DEFAULT 0 CHECK (stock_level >= 0),
  min_stock_level INT           NOT NULL DEFAULT 10,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      ON UPDATE CURRENT_TIMESTAMP
);
-- Index: category (used in report GROUP BY and filter queries)
CREATE INDEX idx_products_category ON Products(category);
-- Index: is_active (almost every product query filters active products)
CREATE INDEX idx_products_active ON Products(is_active);

-- ── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE Users (
  user_id       INT          AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,        -- bcrypt hash ONLY, never plain text
  full_name     VARCHAR(100) NOT NULL,
  role          ENUM('Admin','Staff') NOT NULL DEFAULT 'Staff',
  email         VARCHAR(100) UNIQUE,
  phone         VARCHAR(20),
  mfa_secret    VARCHAR(64)  NULL,            -- TOTP secret for MFA (nullable = MFA not yet set up)
  mfa_enabled   TINYINT(1)   NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  last_login    DATETIME     NULL,
  -- POPIA: record when personal data was last modified for retention tracking
  data_modified_at DATETIME  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Indexes: username is already indexed via UNIQUE constraint
-- email is already indexed via UNIQUE constraint

-- ── STORES ──────────────────────────────────────────────────────────────────
CREATE TABLE Stores (
  store_id     INT          AUTO_INCREMENT PRIMARY KEY,
  store_name   VARCHAR(100) NOT NULL,
  location     VARCHAR(150) NOT NULL,
  manager_name VARCHAR(100) NOT NULL,
  phone        VARCHAR(20),
  email        VARCHAR(100),
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  opened_date  DATE         NOT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── PRODUCTS ────────────────────────────────────────────────────────────────
CREATE TABLE Products (
  product_id      INT           AUTO_INCREMENT PRIMARY KEY,
  product_name    VARCHAR(150)  NOT NULL,
  category        VARCHAR(50)   NOT NULL,
  price           DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock_level     INT           NOT NULL DEFAULT 0 CHECK (stock_level >= 0),
  min_stock_level INT           NOT NULL DEFAULT 10,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      ON UPDATE CURRENT_TIMESTAMP
);
-- Index: category (used in report GROUP BY and filter queries)
CREATE INDEX idx_products_category ON Products(category);
-- Index: is_active (almost every product query filters active products)
CREATE INDEX idx_products_active ON Products(is_active);

-- ── SALE TRANSACTIONS ────────────────────────────────────────────────────────
CREATE TABLE SaleTransactions (
  transaction_id   INT           AUTO_INCREMENT PRIMARY KEY,
  user_id          INT           NOT NULL,
  store_id         INT           NOT NULL,
  transaction_date DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount     DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
  status           ENUM('Completed','Cancelled') NOT NULL DEFAULT 'Completed',
  notes            TEXT,
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES Users(user_id)  ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (store_id) REFERENCES Stores(store_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Index: transaction_date (used in every date-range report query — critical)
CREATE INDEX idx_st_date ON SaleTransactions(transaction_date);
-- Index: store_id (used in store performance reports)
CREATE INDEX idx_st_store ON SaleTransactions(store_id);
-- Index: user_id (used to filter transactions by staff member)
CREATE INDEX idx_st_user ON SaleTransactions(user_id);
-- Index: status (filter for Completed transactions in reports)
CREATE INDEX idx_st_status ON SaleTransactions(status);
-- Composite index: store + date (most common report query pattern)
CREATE INDEX idx_st_store_date ON SaleTransactions(store_id, transaction_date);

-- ── SALE ITEMS ───────────────────────────────────────────────────────────────
CREATE TABLE SaleItems (
  item_id        INT           AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT           NOT NULL,
  product_id     INT           NOT NULL,
  quantity       INT           NOT NULL CHECK (quantity > 0),
  unit_price     DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal       DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES SaleTransactions(transaction_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (product_id) REFERENCES Products(product_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Index: product_id (used in best-seller report GROUP BY queries)
CREATE INDEX idx_si_product ON SaleItems(product_id);
-- Index: transaction_id already indexed via FK constraint in InnoDB

-- ── POPIA: AUDIT LOG TABLE ───────────────────────────────────────────────────
-- Tracks who accessed or modified personal data — required by POPIA Section 22
CREATE TABLE AuditLog (
  log_id      INT          AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NULL,           -- NULL if unauthenticated attempt
  action      VARCHAR(100) NOT NULL,       -- e.g. 'LOGIN_SUCCESS', 'DATA_EXPORT', 'DELETE_USER'
  target_type VARCHAR(50),                 -- e.g. 'User', 'Product', 'SaleTransaction'
  target_id   INT,                         -- ID of the affected record
  ip_address  VARCHAR(45),                 -- IPv4 or IPv6
  user_agent  VARCHAR(255),
  result      ENUM('SUCCESS','FAILURE','BLOCKED') NOT NULL,
  logged_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_user ON AuditLog(user_id);
CREATE INDEX idx_audit_date ON AuditLog(logged_at);
CREATE INDEX idx_audit_action ON AuditLog(action);

ALTER TABLE Users
  ADD COLUMN assigned_store_id INT NULL,
  ADD CONSTRAINT fk_users_store FOREIGN KEY (assigned_store_id)
    REFERENCES Stores(store_id) ON DELETE SET NULL ON UPDATE CASCADE;
-- NULL for Admins (they are not tied to one store); required in practice for Staff.
CREATE INDEX idx_users_store ON Users(assigned_store_id);

-- Store first, since Users references it via assigned_store_id
INSERT INTO Stores (store_name, location, manager_name, phone, email, opened_date)
VALUES ('TrendMart Kimberley', 'Kimberley, Northern Cape', 'Thabo Molefe', '0531234567', 'kimberley@trendmart.co.za', '2024-01-15');

-- Admin — no assigned_store_id (Admins aren't tied to one store)
INSERT INTO Users (username, password_hash, full_name, role, email, assigned_store_id)
VALUES ('admin', 'PASTE_ADMIN_HASH_HERE', 'System Admin', 'Admin', 'admin@trendmart.co.za', NULL);

-- Staff — tied to store_id 1 (adjust if AUTO_INCREMENT gave the store a different ID)
INSERT INTO Users (username, password_hash, full_name, role, email, assigned_store_id)
VALUES ('staff', ' $2b$12$rvJaU1XunC16NGcZ9o1lAu7oMEvYUntvGiFlcDbg4hMpxOVVSfV1q', 'Jane Staff', 'Staff', 'staff@trendmart.co.za', 1);

UPDATE Users
SET password_hash = '$2b$12$B7suTZxKV5QmOiJEOTn.Y.RGE3tlyzO09JRa3C8RqF1qeIhwqNRI2'
WHERE username = 'admin';

SELECT user_id, username, password_hash FROM Users WHERE username = 'staff';

-- Products — needed for ST-06, ST-07, ST-13 etc.
INSERT INTO Products (product_name, category, price, stock_level, min_stock_level)
VALUES
  ('Wireless Mouse', 'Electronics', 249.99, 50, 10),
  ('Cotton T-Shirt', 'Clothing', 149.99, 100, 20);
  
  SELECT * FROM Stores;
  
  SELECT * FROM Products;
  
SELECT username, mfa_enabled, LEFT(password_hash, 15) AS hash_preview
FROM Users WHERE username IN ('admin', 'staff');

SELECT password_hash FROM Users WHERE username = 'staff';

-- $2b$12$cEumfXTopMaTXJecRXJkweqQZs.Epy5oF/OKmtvv0ANfa/jklaZn6
UPDATE Users
SET password_hash = '$2b$12$cEumfXTopMaTXJecRXJkweqQZs.Epy5oF/OKmtvv0ANfa/jklaZn6'
WHERE username = 'admin';

UPDATE Users SET password_hash = '$2b$12$tT.glIxbffErWJhAoJE1iO5sQlRv6.fY3EzhyIXF2ZCw2KBARm5KC' WHERE username = 'admin';

UPDATE Users SET password_hash = '$2b$12$gPqQyr90c4fatbwPsJcrJ.saH4ZneEBtva/oa.eO3sKfW8S0ifxp.' WHERE username = 'staff';

SELECT product_id, product_name, is_active FROM Products WHERE product_name = 'Wireless Mouse';

UPDATE Products SET is_active = 1 WHERE product_name = 'Wireless Mouse';

USE trendmart_db; 

UPDATE Products SET is_active = 1 WHERE product_name = 'Wireless Mouse';

SELECT si.transaction_id, si.quantity, si.unit_price, st.transaction_date, st.status
FROM SaleItems si
JOIN SaleTransactions st ON st.transaction_id = si.transaction_id
JOIN Products p ON p.product_id = si.product_id
WHERE p.product_name = 'Wireless Mouse';

SET @staff_id  = (SELECT user_id FROM Users WHERE username = 'staff');
SET @admin_id  = (SELECT user_id FROM Users WHERE username = 'admin');
SET @store_id  = (SELECT store_id FROM Stores WHERE store_name = 'TrendMart Kimberley');
SET @shirt_id  = (SELECT product_id FROM Products WHERE product_name = 'Cotton T-Shirt');
SET @mouse_id  = (SELECT product_id FROM Products WHERE product_name = 'Wireless Mouse');
SET @shirt_price = (SELECT price FROM Products WHERE product_id = @shirt_id);
SET @mouse_price = (SELECT price FROM Products WHERE product_id = @mouse_id);

-- Day -28
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@staff_id, @store_id, DATE_SUB(NOW(), INTERVAL 28 DAY), @shirt_price * 3, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @shirt_id, 3, @shirt_price);

-- Day -24
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@admin_id, @store_id, DATE_SUB(NOW(), INTERVAL 24 DAY), @mouse_price * 2, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @mouse_id, 2, @mouse_price);

-- Day -21
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@staff_id, @store_id, DATE_SUB(NOW(), INTERVAL 21 DAY), @shirt_price * 1, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @shirt_id, 1, @shirt_price);

-- Day -18
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@admin_id, @store_id, DATE_SUB(NOW(), INTERVAL 18 DAY), @mouse_price * 4, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @mouse_id, 4, @mouse_price);

-- Day -15
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@staff_id, @store_id, DATE_SUB(NOW(), INTERVAL 15 DAY), @shirt_price * 2, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @shirt_id, 2, @shirt_price);

-- Day -13
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@admin_id, @store_id, DATE_SUB(NOW(), INTERVAL 13 DAY), @mouse_price * 1, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @mouse_id, 1, @mouse_price);

-- Day -11
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@staff_id, @store_id, DATE_SUB(NOW(), INTERVAL 11 DAY), @shirt_price * 5, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @shirt_id, 5, @shirt_price);

-- Day -9
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@admin_id, @store_id, DATE_SUB(NOW(), INTERVAL 9 DAY), @mouse_price * 2, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @mouse_id, 2, @mouse_price);

-- Day -7
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@staff_id, @store_id, DATE_SUB(NOW(), INTERVAL 7 DAY), @shirt_price * 3, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @shirt_id, 3, @shirt_price);

-- Day -5
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@admin_id, @store_id, DATE_SUB(NOW(), INTERVAL 5 DAY), @mouse_price * 3, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @mouse_id, 3, @mouse_price);

-- Day -3
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@staff_id, @store_id, DATE_SUB(NOW(), INTERVAL 3 DAY), @shirt_price * 4, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @shirt_id, 4, @shirt_price);

-- Day -1
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
VALUES (@admin_id, @store_id, DATE_SUB(NOW(), INTERVAL 1 DAY), @mouse_price * 1, 'Completed');
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (@tid, @mouse_id, 1, @mouse_price);

-- ── New Stores ──────────────────────────────────────────────────────────────
INSERT INTO Stores (store_name, location, manager_name, phone, email, opened_date) VALUES
('TrendMart Upington', 'Upington, Northern Cape', 'Naledi Mokoena', '0541234567', 'upington@trendmart.co.za', '2024-03-10'),
('TrendMart Bloemfontein', 'Bloemfontein, Free State', 'Pieter Botha', '0511234567', 'bloemfontein@trendmart.co.za', '2024-05-22'),
('TrendMart Polokwane', 'Polokwane, Limpopo', 'Rethabile Mahlangu', '0151234567', 'polokwane@trendmart.co.za', '2024-07-08');

-- ── New Staff — reuses your existing 'staff' user's password_hash, since it's
-- already a valid bcrypt hash of 'staff123'; a hash doesn't need to be
-- unique per row, only valid for the password it was derived from. ─────────
SET @staff_hash = (SELECT password_hash FROM Users WHERE username = 'staff');
SET @upington_id     = (SELECT store_id FROM Stores WHERE store_name = 'TrendMart Upington');
SET @bloemfontein_id = (SELECT store_id FROM Stores WHERE store_name = 'TrendMart Bloemfontein');

INSERT INTO Users (username, password_hash, full_name, role, email, assigned_store_id) VALUES
('staff2', @staff_hash, 'Naledi Mokoena Jr', 'Staff', 'staff2@trendmart.co.za', @upington_id),
('staff3', @staff_hash, 'Pieter Botha Jr', 'Staff', 'staff3@trendmart.co.za', @bloemfontein_id);
-- Both log in with password: staff123

-- ── New Products ─────────────────────────────────────────────────────────────
INSERT INTO Products (product_name, category, price, stock_level, min_stock_level) VALUES
('Samsung Galaxy A35', 'Electronics', 6999.00, 40, 10),
('Sony WH-1000XM5 Headphones', 'Electronics', 7499.00, 25, 8),
('Nike Air Max 270', 'Footwear', 2499.00, 70, 15),
('Adidas Ultraboost 23', 'Footwear', 3299.00, 55, 15),
('Dyson V12 Vacuum', 'Home Appliances', 12999.00, 10, 5),
('Kenwood Chef Stand Mixer', 'Home Appliances', 8499.00, 12, 5);

-- ── Bulk Transactions Across All Stores/Products/30 Days ─────────────────────
SET @admin_id = (SELECT user_id FROM Users WHERE username = 'admin');
SET @staff_id = (SELECT user_id FROM Users WHERE username = 'staff');
SET @staff2_id = (SELECT user_id FROM Users WHERE username = 'staff2');
SET @staff3_id = (SELECT user_id FROM Users WHERE username = 'staff3');
SET @kimberley_id = (SELECT store_id FROM Stores WHERE store_name = 'TrendMart Kimberley');
SET @polokwane_id = (SELECT store_id FROM Stores WHERE store_name = 'TrendMart Polokwane');

-- Repeat this pattern for a spread of (user, store, product, day, qty) combos.
-- Each block: one transaction + one matching line item.
INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
SELECT @staff2_id, @upington_id, DATE_SUB(NOW(), INTERVAL 26 DAY), p.price * 2, 'Completed'
FROM Products p WHERE p.product_name = 'Samsung Galaxy A35';
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price)
SELECT @tid, product_id, 2, price FROM Products WHERE product_name = 'Samsung Galaxy A35';

INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
SELECT @staff3_id, @bloemfontein_id, DATE_SUB(NOW(), INTERVAL 22 DAY), p.price * 1, 'Completed'
FROM Products p WHERE p.product_name = 'Nike Air Max 270';
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price)
SELECT @tid, product_id, 1, price FROM Products WHERE product_name = 'Nike Air Max 270';

INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
SELECT @admin_id, @polokwane_id, DATE_SUB(NOW(), INTERVAL 19 DAY), p.price * 1, 'Completed'
FROM Products p WHERE p.product_name = 'Dyson V12 Vacuum';
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price)
SELECT @tid, product_id, 1, price FROM Products WHERE product_name = 'Dyson V12 Vacuum';

INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
SELECT @staff2_id, @upington_id, DATE_SUB(NOW(), INTERVAL 16 DAY), p.price * 3, 'Completed'
FROM Products p WHERE p.product_name = 'Adidas Ultraboost 23';
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price)
SELECT @tid, product_id, 3, price FROM Products WHERE product_name = 'Adidas Ultraboost 23';

INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
SELECT @staff3_id, @bloemfontein_id, DATE_SUB(NOW(), INTERVAL 12 DAY), p.price * 1, 'Completed'
FROM Products p WHERE p.product_name = 'Sony WH-1000XM5 Headphones';
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price)
SELECT @tid, product_id, 1, price FROM Products WHERE product_name = 'Sony WH-1000XM5 Headphones';

INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
SELECT @staff_id, @kimberley_id, DATE_SUB(NOW(), INTERVAL 9 DAY), p.price * 2, 'Completed'
FROM Products p WHERE p.product_name = 'Kenwood Chef Stand Mixer';
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price)
SELECT @tid, product_id, 2, price FROM Products WHERE product_name = 'Kenwood Chef Stand Mixer';

INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
SELECT @admin_id, @polokwane_id, DATE_SUB(NOW(), INTERVAL 6 DAY), p.price * 2, 'Completed'
FROM Products p WHERE p.product_name = 'Samsung Galaxy A35';
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price)
SELECT @tid, product_id, 2, price FROM Products WHERE product_name = 'Samsung Galaxy A35';

INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
SELECT @staff2_id, @upington_id, DATE_SUB(NOW(), INTERVAL 4 DAY), p.price * 1, 'Completed'
FROM Products p WHERE p.product_name = 'Nike Air Max 270';
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price)
SELECT @tid, product_id, 1, price FROM Products WHERE product_name = 'Nike Air Max 270';

INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
SELECT @staff3_id, @bloemfontein_id, DATE_SUB(NOW(), INTERVAL 2 DAY), p.price * 4, 'Completed'
FROM Products p WHERE p.product_name = 'Adidas Ultraboost 23';
SET @tid = LAST_INSERT_ID();
INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price)
SELECT @tid, product_id, 4, price FROM Products WHERE product_name = 'Adidas Ultraboost 23';

SELECT product_id, product_name, is_active, stock_level FROM Products WHERE product_id IN (1, 2);

USE trendmart_db;

-- Step 1: widen the enum so both old and new values are valid simultaneously
ALTER TABLE Users MODIFY COLUMN role ENUM('Admin','Manager','Staff','SystemAdmin') NOT NULL DEFAULT 'Staff';

-- Step 2: migrate existing data
UPDATE Users SET role = 'Manager' WHERE role = 'Admin';
SET SQL_SAFE_UPDATES = 0;
UPDATE Users SET role = 'Manager' WHERE role = 'Admin';
SET SQL_SAFE_UPDATES = 1;

SELECT user_id, username, role FROM Users;

-- Step 3: narrow the enum to its final, correct set
ALTER TABLE Users MODIFY COLUMN role ENUM('SystemAdmin','Manager','Staff') NOT NULL DEFAULT 'Staff';

INSERT INTO Users (username, password_hash, full_name, role, email, assigned_store_id)
VALUES ('sysadmin', '$2b$12$KueZAe1mb/Kg8lGg2kCAIOYENdsI8FsA8MkKQGx2WkSdZqRifn0ga', 'System Administrator', 'SystemAdmin', 'sysadmin@trendmart.co.za', NULL);