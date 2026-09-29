-- Proposed MySQL 8 schema. Apply on the server after reviewing operational rules.
CREATE TABLE delivery_integrations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_app VARCHAR(64) NOT NULL UNIQUE,
  secret_hash VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE delivery_partners (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  available BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE delivery_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_app VARCHAR(64) NOT NULL,
  external_order_id VARCHAR(120) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  tracking_token_hash CHAR(64) NOT NULL UNIQUE,
  partner_id BIGINT UNSIGNED NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'created',
  recipient_name VARCHAR(120) NOT NULL,
  recipient_phone VARCHAR(20) NOT NULL,
  address_json JSON NOT NULL,
  items_json JSON NOT NULL,
  collection_amount_paise INT UNSIGNED NOT NULL DEFAULT 0,
  instructions TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_delivery_external (source_app, external_order_id),
  INDEX idx_delivery_queue (status, created_at),
  INDEX idx_delivery_partner (partner_id, status),
  CONSTRAINT fk_delivery_partner FOREIGN KEY (partner_id) REFERENCES delivery_partners(id)
);

CREATE TABLE delivery_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL,
  actor_type VARCHAR(24) NOT NULL,
  actor_id VARCHAR(120) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_delivery_event_order (order_id, created_at),
  CONSTRAINT fk_delivery_event_order FOREIGN KEY (order_id) REFERENCES delivery_orders(id)
);
