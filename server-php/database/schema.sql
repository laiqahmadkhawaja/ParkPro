-- ParkPro Central Server Database Schema (MySQL / SQLite compatible)

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(128) NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'Operator', -- 'Admin', 'Manager', 'Operator'
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_types (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(10) NOT NULL,
    base_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    grace_period_mins INT NOT NULL DEFAULT 10,
    daily_max DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    night_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS parking_sessions (
    id VARCHAR(64) PRIMARY KEY,
    ticket_no VARCHAR(50) NOT NULL UNIQUE,
    plate_number VARCHAR(30) NOT NULL,
    vehicle_type_id VARCHAR(64) NOT NULL,
    entry_time DATETIME NOT NULL,
    exit_time DATETIME NULL,
    operator_entry_id VARCHAR(64) NOT NULL,
    operator_exit_id VARCHAR(64) NULL,
    rate_applied DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    penalty_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'parked', -- 'parked', 'completed', 'lost_ticket'
    qr_signature VARCHAR(255) NOT NULL,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'synced',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_plate (plate_number),
    INDEX idx_status (status),
    INDEX idx_entry (entry_time)
);

CREATE TABLE IF NOT EXISTS shifts (
    id VARCHAR(64) PRIMARY KEY,
    operator_id VARCHAR(64) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NULL,
    starting_float DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_cash_collected DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    expected_cash DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    actual_cash DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discrepancy DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'closed'
    notes TEXT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(64) PRIMARY KEY,
    `value` TEXT NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NULL,
    ip_or_device VARCHAR(100) NULL,
    timestamp DATETIME NOT NULL
);
