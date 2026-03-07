-- BudgetGuard Initial Schema
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    email_verified  BOOLEAN DEFAULT FALSE,
    expo_push_token VARCHAR(255),
    notification_preferences JSONB DEFAULT '{
        "push_enabled": true,
        "email_enabled": true,
        "alert_frequency": "twice_daily"
    }'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    device_info     VARCHAR(255),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ============================================================
-- PLAID ITEMS
-- ============================================================
CREATE TABLE plaid_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plaid_item_id   VARCHAR(255) UNIQUE NOT NULL,
    access_token_encrypted BYTEA NOT NULL,
    institution_id  VARCHAR(100),
    institution_name VARCHAR(255),
    consent_expiration TIMESTAMPTZ,
    transaction_cursor VARCHAR(500),
    status          VARCHAR(50) DEFAULT 'active',
    last_synced_at  TIMESTAMPTZ,
    error_code      VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX idx_plaid_items_plaid_item_id ON plaid_items(plaid_item_id);

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plaid_item_id   UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
    plaid_account_id VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    official_name   VARCHAR(255),
    type            VARCHAR(50) NOT NULL,
    subtype         VARCHAR(50),
    mask            VARCHAR(10),
    current_balance DECIMAL(15, 2),
    available_balance DECIMAL(15, 2),
    currency_code   VARCHAR(3) DEFAULT 'USD',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_plaid_item_id ON accounts(plaid_item_id);

-- ============================================================
-- SUBSCRIPTIONS (created before transactions so transactions can reference it)
-- ============================================================
CREATE TABLE subscriptions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    merchant_name       VARCHAR(255) NOT NULL,
    normalized_name     VARCHAR(255) NOT NULL,
    description         VARCHAR(500),
    estimated_amount    DECIMAL(15, 2) NOT NULL,
    currency_code       VARCHAR(3) DEFAULT 'USD',
    frequency           VARCHAR(20) NOT NULL,
    confidence_score    DECIMAL(3, 2) DEFAULT 0.00,
    status              VARCHAR(30) DEFAULT 'detected',
    category            VARCHAR(100),
    cancel_url          VARCHAR(1000),
    cancel_instructions TEXT,
    first_seen_date     DATE NOT NULL,
    last_charge_date    DATE,
    next_expected_date  DATE,
    total_charges       INTEGER DEFAULT 0,
    total_spent         DECIMAL(15, 2) DEFAULT 0.00,
    classified_at       TIMESTAMPTZ,
    detected_at         TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE UNIQUE INDEX idx_subscriptions_normalized ON subscriptions(user_id, normalized_name);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE transactions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plaid_transaction_id VARCHAR(255) UNIQUE,
    amount              DECIMAL(15, 2) NOT NULL,
    date                DATE NOT NULL,
    authorized_date     DATE,
    name                VARCHAR(500) NOT NULL,
    merchant_name       VARCHAR(255),
    personal_finance_category_primary   VARCHAR(100),
    personal_finance_category_detailed  VARCHAR(100),
    pending             BOOLEAN DEFAULT FALSE,
    pending_transaction_id VARCHAR(255),
    payment_channel     VARCHAR(50),
    transaction_type    VARCHAR(50),
    is_recurring        BOOLEAN DEFAULT FALSE,
    subscription_id     UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_merchant ON transactions(merchant_name);
CREATE INDEX idx_transactions_plaid_id ON transactions(plaid_transaction_id);
CREATE INDEX idx_transactions_subscription ON transactions(subscription_id);
CREATE INDEX idx_transactions_user_merchant_date
    ON transactions(user_id, merchant_name, date DESC);

-- ============================================================
-- SAFE LIST
-- ============================================================
CREATE TABLE safe_list (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id     UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    keep_until          DATE,
    keep_reason         VARCHAR(255),
    review_reminder_date DATE,
    reminder_sent       BOOLEAN DEFAULT FALSE,
    added_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subscription_id)
);

CREATE INDEX idx_safe_list_user_id ON safe_list(user_id);
CREATE INDEX idx_safe_list_review ON safe_list(review_reminder_date)
    WHERE reminder_sent = FALSE;

-- ============================================================
-- BUDGETS
-- ============================================================
CREATE TABLE budgets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    category            VARCHAR(100) NOT NULL,
    amount_limit        DECIMAL(15, 2) NOT NULL,
    amount_spent        DECIMAL(15, 2) DEFAULT 0.00,
    period              VARCHAR(20) DEFAULT 'monthly',
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    is_ai_generated     BOOLEAN DEFAULT FALSE,
    ai_reasoning        TEXT,
    ai_confidence       DECIMAL(3, 2),
    user_adjusted       BOOLEAN DEFAULT FALSE,
    alert_at_percent    INTEGER DEFAULT 80,
    alert_sent          BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_user_active ON budgets(user_id, is_active)
    WHERE is_active = TRUE;
CREATE INDEX idx_budgets_period ON budgets(user_id, period_start, period_end);

-- ============================================================
-- BUDGET GENERATIONS
-- ============================================================
CREATE TABLE budget_generations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_period_start DATE NOT NULL,
    analysis_period_end   DATE NOT NULL,
    total_transactions_analyzed INTEGER,
    total_spending_analyzed DECIMAL(15, 2),
    claude_model_used   VARCHAR(100),
    claude_prompt_tokens INTEGER,
    claude_output_tokens INTEGER,
    raw_response        JSONB,
    budgets_created     INTEGER,
    status              VARCHAR(30) DEFAULT 'completed',
    error_message       TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budget_gen_user ON budget_generations(user_id);

-- ============================================================
-- SPENDING SUGGESTIONS
-- ============================================================
CREATE TABLE spending_suggestions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                VARCHAR(20) NOT NULL,
    category            VARCHAR(100) NOT NULL,
    title               VARCHAR(255) NOT NULL,
    description         TEXT NOT NULL,
    current_amount      DECIMAL(15, 2) NOT NULL,
    suggested_amount    DECIMAL(15, 2) NOT NULL,
    savings_amount      DECIMAL(15, 2) NOT NULL,
    projected_annual_savings DECIMAL(15, 2) NOT NULL,
    confidence          DECIMAL(3, 2) DEFAULT 0.00,
    related_subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    status              VARCHAR(20) DEFAULT 'pending',
    accepted_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spending_suggestions_user ON spending_suggestions(user_id);
CREATE INDEX idx_spending_suggestions_status ON spending_suggestions(user_id, status);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                VARCHAR(50) NOT NULL,
    title               VARCHAR(255) NOT NULL,
    body                TEXT NOT NULL,
    channels_sent       JSONB DEFAULT '[]'::jsonb,
    push_sent_at        TIMESTAMPTZ,
    email_sent_at       TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    dismissed_at        TIMESTAMPTZ,
    action_url          VARCHAR(500),
    related_entity_type VARCHAR(50),
    related_entity_id   UUID,
    alert_repeat_count  INTEGER DEFAULT 0,
    next_alert_at       TIMESTAMPTZ,
    alert_resolved      BOOLEAN DEFAULT FALSE,
    metadata            JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at)
    WHERE read_at IS NULL;
CREATE INDEX idx_notifications_pending_alerts ON notifications(next_alert_at)
    WHERE alert_resolved = FALSE AND next_alert_at IS NOT NULL;

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       UUID,
    details         JSONB,
    ip_address      INET,
    user_agent      VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
