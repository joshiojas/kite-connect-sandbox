-- User portfolios (created on first request per api_key)
CREATE TABLE IF NOT EXISTS portfolios (
    api_key TEXT PRIMARY KEY,
    initial_capital REAL NOT NULL,
    available_cash REAL NOT NULL,
    used_margin REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    api_key TEXT NOT NULL,
    exchange_order_id TEXT,
    parent_order_id TEXT,
    variety TEXT NOT NULL,
    exchange TEXT NOT NULL,
    tradingsymbol TEXT NOT NULL,
    instrument_token INTEGER DEFAULT 0,
    transaction_type TEXT NOT NULL,
    order_type TEXT NOT NULL,
    product TEXT NOT NULL,
    validity TEXT NOT NULL DEFAULT 'DAY',
    validity_ttl INTEGER DEFAULT 0,
    price REAL DEFAULT 0,
    trigger_price REAL DEFAULT 0,
    quantity INTEGER NOT NULL,
    disclosed_quantity INTEGER DEFAULT 0,
    filled_quantity INTEGER DEFAULT 0,
    pending_quantity INTEGER NOT NULL,
    cancelled_quantity INTEGER DEFAULT 0,
    average_price REAL DEFAULT 0,
    status TEXT NOT NULL,
    status_message TEXT,
    status_message_raw TEXT,
    tag TEXT,
    tags TEXT DEFAULT '[]',
    meta TEXT DEFAULT '{}',
    guid TEXT,
    placed_by TEXT,
    order_timestamp TEXT,
    exchange_timestamp TEXT,
    exchange_update_timestamp TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (api_key) REFERENCES portfolios(api_key)
);

CREATE INDEX IF NOT EXISTS idx_orders_api_key ON orders(api_key);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(api_key, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(api_key, created_at);

-- Order history (status transitions for GET /orders/:order_id)
CREATE TABLE IF NOT EXISTS order_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    api_key TEXT NOT NULL,
    status TEXT NOT NULL,
    status_message TEXT,
    timestamp TEXT NOT NULL,
    order_snapshot TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id);

-- Trades (fills)
CREATE TABLE IF NOT EXISTS trades (
    trade_id TEXT PRIMARY KEY,
    api_key TEXT NOT NULL,
    order_id TEXT NOT NULL,
    exchange TEXT NOT NULL,
    tradingsymbol TEXT NOT NULL,
    instrument_token INTEGER DEFAULT 0,
    product TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    average_price REAL NOT NULL,
    fill_timestamp TEXT NOT NULL,
    order_timestamp TEXT,
    exchange_timestamp TEXT,
    exchange_order_id TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_trades_api_key ON trades(api_key);
CREATE INDEX IF NOT EXISTS idx_trades_order_id ON trades(order_id);

-- Holdings (CNC positions carried overnight / delivered)
CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT NOT NULL,
    tradingsymbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    instrument_token INTEGER DEFAULT 0,
    isin TEXT DEFAULT '',
    product TEXT NOT NULL DEFAULT 'CNC',
    quantity INTEGER NOT NULL DEFAULT 0,
    t1_quantity INTEGER NOT NULL DEFAULT 0,
    realised_quantity INTEGER NOT NULL DEFAULT 0,
    authorised_quantity INTEGER DEFAULT 0,
    authorised_date TEXT,
    opening_quantity INTEGER NOT NULL DEFAULT 0,
    used_quantity INTEGER NOT NULL DEFAULT 0,
    short_quantity INTEGER NOT NULL DEFAULT 0,
    collateral_quantity INTEGER NOT NULL DEFAULT 0,
    collateral_type TEXT DEFAULT '',
    average_price REAL NOT NULL DEFAULT 0,
    last_price REAL DEFAULT 0,
    close_price REAL DEFAULT 0,
    pnl REAL DEFAULT 0,
    day_change REAL DEFAULT 0,
    day_change_percentage REAL DEFAULT 0,
    discrepancy INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(api_key, tradingsymbol, exchange),
    FOREIGN KEY (api_key) REFERENCES portfolios(api_key)
);

-- Positions (intraday + carry-forward)
CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT NOT NULL,
    tradingsymbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    instrument_token INTEGER DEFAULT 0,
    product TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    overnight_quantity INTEGER NOT NULL DEFAULT 0,
    multiplier INTEGER NOT NULL DEFAULT 1,
    average_price REAL NOT NULL DEFAULT 0,
    close_price REAL DEFAULT 0,
    last_price REAL DEFAULT 0,
    value REAL DEFAULT 0,
    pnl REAL DEFAULT 0,
    m2m REAL DEFAULT 0,
    unrealised REAL DEFAULT 0,
    realised REAL DEFAULT 0,
    buy_quantity INTEGER DEFAULT 0,
    buy_price REAL DEFAULT 0,
    buy_value REAL DEFAULT 0,
    buy_m2m REAL DEFAULT 0,
    sell_quantity INTEGER DEFAULT 0,
    sell_price REAL DEFAULT 0,
    sell_value REAL DEFAULT 0,
    sell_m2m REAL DEFAULT 0,
    day_buy_quantity INTEGER DEFAULT 0,
    day_buy_price REAL DEFAULT 0,
    day_buy_value REAL DEFAULT 0,
    day_sell_quantity INTEGER DEFAULT 0,
    day_sell_price REAL DEFAULT 0,
    day_sell_value REAL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(api_key, tradingsymbol, exchange, product),
    FOREIGN KEY (api_key) REFERENCES portfolios(api_key)
);

-- GTT Orders
CREATE TABLE IF NOT EXISTS gtt_orders (
    trigger_id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    condition TEXT NOT NULL,
    orders TEXT NOT NULL,
    meta TEXT,
    expiry_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (api_key) REFERENCES portfolios(api_key)
);

CREATE INDEX IF NOT EXISTS idx_gtt_api_key ON gtt_orders(api_key);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    uuid TEXT PRIMARY KEY,
    api_key TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    condition TEXT NOT NULL,
    basket TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (api_key) REFERENCES portfolios(api_key)
);

CREATE INDEX IF NOT EXISTS idx_alerts_api_key ON alerts(api_key);

-- MF Orders
CREATE TABLE IF NOT EXISTS mf_orders (
    order_id TEXT PRIMARY KEY,
    api_key TEXT NOT NULL,
    exchange_order_id TEXT,
    tradingsymbol TEXT NOT NULL,
    status TEXT NOT NULL,
    status_message TEXT DEFAULT '',
    folio TEXT,
    fund TEXT DEFAULT '',
    order_timestamp TEXT,
    exchange_timestamp TEXT,
    settlement_id TEXT,
    transaction_type TEXT NOT NULL,
    variety TEXT DEFAULT 'regular',
    purchase_type TEXT DEFAULT 'fresh',
    quantity REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    last_price REAL DEFAULT 0,
    average_price REAL DEFAULT 0,
    placed_by TEXT,
    tag TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (api_key) REFERENCES portfolios(api_key)
);

-- MF SIPs
CREATE TABLE IF NOT EXISTS mf_sips (
    sip_id TEXT PRIMARY KEY,
    api_key TEXT NOT NULL,
    tradingsymbol TEXT NOT NULL,
    fund TEXT DEFAULT '',
    dividend_type TEXT DEFAULT 'growth',
    transaction_type TEXT NOT NULL DEFAULT 'BUY',
    status TEXT NOT NULL DEFAULT 'active',
    sip_type TEXT DEFAULT 'normal',
    instalments INTEGER DEFAULT 0,
    frequency TEXT DEFAULT 'monthly',
    instalment_amount REAL DEFAULT 0,
    instalment_day INTEGER DEFAULT 1,
    completed_instalments INTEGER DEFAULT 0,
    pending_instalments INTEGER DEFAULT 0,
    created TEXT NOT NULL,
    last_instalment TEXT,
    next_instalment TEXT,
    step_up TEXT DEFAULT '{}',
    tag TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (api_key) REFERENCES portfolios(api_key)
);

-- MF Holdings
CREATE TABLE IF NOT EXISTS mf_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT NOT NULL,
    folio TEXT DEFAULT '',
    fund TEXT DEFAULT '',
    tradingsymbol TEXT NOT NULL,
    average_price REAL DEFAULT 0,
    last_price REAL DEFAULT 0,
    last_price_date TEXT,
    pnl REAL DEFAULT 0,
    quantity REAL DEFAULT 0,
    pledge_quantity REAL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(api_key, tradingsymbol, folio),
    FOREIGN KEY (api_key) REFERENCES portfolios(api_key)
);
