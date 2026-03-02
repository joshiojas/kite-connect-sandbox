# Kite Connect Sandbox

A fully open-source, Dockerized mock server that replicates the entire [Kite Connect v3 API](https://kite.trade/docs/connect/v3/) surface. It acts as a transparent proxy: **market data requests are forwarded to the real Kite Connect API**, while **order placement and portfolio management are intercepted and simulated locally** with a virtual paper-trading portfolio.

Point your existing Kite Connect client library at `http://localhost:8000` and paper-trade with real market data — zero code changes to your trading bot.

## Quick Start

### With Docker (recommended)

```bash
docker compose up
```

The sandbox will be available at `http://localhost:8000`.

### Without Docker

```bash
npm install
npm run build
npm start
```

### Development

```bash
npm install
npm run dev     # watch mode with hot reload
npm test        # run all tests
```

## How It Works

The sandbox sits between your trading bot and the real Kite Connect API:

```
Your Bot → Kite Sandbox (localhost:8000) → Kite Connect API (api.kite.trade)
                ↓
         Local SQLite DB
      (orders, holdings, positions)
```

- **Market data** (quotes, OHLC, LTP, instruments, historical) → **proxied** to real Kite API
- **Orders, portfolio, GTT, alerts** → **simulated locally** with a virtual paper-trading portfolio
- **WebSocket ticks** → **proxied** transparently (binary pass-through)
- **Session endpoints** → **proxied** to Kite for authentication

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_PORT` | `8000` | Server port |
| `SANDBOX_LOG_LEVEL` | `info` | Log level (trace, debug, info, warn, error, silent) |
| `SANDBOX_INITIAL_CAPITAL` | `1000000` | Starting paper-trading capital (INR) |
| `SANDBOX_PERSISTENCE` | `sqlite` | `sqlite` for persistent or `memory` for in-memory |
| `SANDBOX_DB_PATH` | `/data/sandbox.db` | SQLite database file path |
| `SANDBOX_RESET_ON_RESTART` | `false` | Reset portfolio on container restart |
| `KITE_BASE_URL` | `https://api.kite.trade` | Upstream Kite API base URL |
| `KITE_WS_URL` | `wss://ws.kite.trade` | Upstream Kite WebSocket URL |
| `KITE_UPSTREAM_TIMEOUT` | `10000` | Upstream request timeout (ms) |

### Config File

Additional settings in `config/default.json`:

```json
{
  "orderEngine": {
    "defaultSlippage": 0.0,
    "slippageModel": "percentage",
    "autoFillLimitOrders": true,
    "rejectAfterMarketHours": false
  },
  "rateLimits": {
    "enabled": true,
    "quote": 1,
    "historical": 3,
    "orders": 10
  }
}
```

## API Compatibility

### Proxied Endpoints (Real Market Data)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/session/token` | Auth + portfolio init |
| POST | `/session/refresh_token` | Passthrough |
| DELETE | `/session/token` | Passthrough |
| GET | `/user/profile` | Passthrough |
| GET | `/quote`, `/quote/ohlc`, `/quote/ltp` | Real-time quotes |
| GET | `/instruments`, `/instruments/:exchange` | CSV instrument lists |
| GET | `/instruments/historical/:token/:interval` | Historical candles |
| POST | `/margins/orders`, `/margins/basket` | Real margin data |
| POST | `/charges/orders` | Real charges data |
| GET | `/mf/instruments` | MF instrument CSV |
| WS | `/?api_key=X&access_token=Y` | Binary tick proxy |

### Sandboxed Endpoints (Simulated Locally)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/user/margins`, `/user/margins/:segment` | Virtual capital |
| POST | `/orders/:variety` | Place simulated order |
| PUT | `/orders/:variety/:order_id` | Modify pending order |
| DELETE | `/orders/:variety/:order_id` | Cancel order |
| GET | `/orders`, `/orders/:id`, `/orders/:id/trades` | Query orders |
| GET | `/trades` | Query trades |
| GET | `/portfolio/holdings` | Virtual holdings |
| GET | `/portfolio/positions` | Virtual positions |
| PUT | `/portfolio/positions` | Convert product type |
| POST/GET/PUT/DELETE | `/gtt/triggers` | GTT CRUD |
| POST/GET/PUT/DELETE | `/alerts` | Alert CRUD |
| POST/GET/DELETE | `/mf/orders`, `/mf/sips` | MF simulation |
| GET | `/mf/holdings` | Virtual MF holdings |
| POST | `/connect/basket` | Basket order simulation |

### Sandbox Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sandbox/dashboard` | Portfolio summary with P&L |
| POST | `/sandbox/reset?api_key=X` | Reset portfolio to initial capital |
| POST | `/sandbox/settle` | Simulate end-of-day settlement |
| GET | `/health` | Health check |

## Order Fill Simulation

- **MARKET orders**: Fetches LTP from upstream Kite API, applies configurable slippage, fills immediately
- **LIMIT orders**: Fills at limit price if `autoFillLimitOrders` is enabled (default: true)
- **SL/SL-M orders**: Set to TRIGGER PENDING status; auto-fills if `autoFillLimitOrders` is true
- **AMO orders**: Set to AMO REQ RECEIVED status (not auto-filled)

### Slippage Models

- `none`: No slippage (default)
- `percentage`: `price * (1 ± slippage)` for BUY/SELL
- `fixed`: `price ± fixedSlippage`

## Using with Kite Client Libraries

### Python (pykiteconnect)

```python
from kiteconnect import KiteConnect

kite = KiteConnect(api_key="your_api_key")
kite.root = "http://localhost:8000"  # Point to sandbox
kite.set_access_token("your_access_token")

# Use exactly as normal
quote = kite.ltp("NSE:INFY")
order_id = kite.place_order(
    variety=kite.VARIETY_REGULAR,
    exchange=kite.EXCHANGE_NSE,
    tradingsymbol="INFY",
    transaction_type=kite.TRANSACTION_TYPE_BUY,
    quantity=10,
    order_type=kite.ORDER_TYPE_MARKET,
    product=kite.PRODUCT_CNC
)
```

### JavaScript (kiteconnectjs)

```javascript
const KiteConnect = require("kiteconnect").KiteConnect;

const kite = new KiteConnect({ api_key: "your_api_key" });
kite.setAccessToken("your_access_token");

// Override the root URL
kite._root = "http://localhost:8000";

const ltp = await kite.getLTP(["NSE:INFY"]);
```

## Response Format

All sandbox responses use the exact Kite Connect envelope format:

```json
// Success
{ "status": "success", "data": { ... } }

// Error
{ "status": "error", "message": "...", "error_type": "InputException" }
```

All responses include the header `X-Kite-Sandbox: true` for programmatic detection.

## Development

### Running Tests

```bash
npm test                    # All tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # End-to-end tests
npm run test:coverage       # With coverage report
```

### Project Structure

```
src/
├── index.ts                # Entrypoint
├── config.ts               # Config loader
├── server.ts               # Fastify app factory
├── db/                     # SQLite database layer
├── middleware/              # Auth, rate limiting, logging
├── proxy/                  # HTTP + WebSocket proxy to Kite
├── portfolio/              # Order engine, portfolio manager, margin/P&L
├── routes/                 # All API route handlers
├── types/                  # TypeScript type definitions
└── utils/                  # Response envelope, ID gen, timestamps
```

### Type Checking

```bash
npm run typecheck
```

## Limitations

- SL/SL-M orders don't monitor live ticks for trigger activation (they auto-fill or stay in TRIGGER PENDING)
- Margin calculation is simplified (percentage-based, not real SPAN)
- No real Kite login flow (session endpoints are proxied as-is)
- Binary WebSocket tick data is passed through without parsing
- No frontend UI (API-only server)
- EOD settlement must be triggered manually via `POST /sandbox/settle`

## License

MIT
