import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

let mockServer: FastifyInstance | null = null;
let mockPort = 0;

export async function startMockKiteServer(): Promise<{ url: string; port: number }> {
  const app = Fastify({ logger: false });

  // POST /session/token
  app.post('/session/token', async () => {
    return {
      status: 'success',
      data: {
        user_type: 'individual',
        email: 'test@example.com',
        user_name: 'Test User',
        user_shortname: 'TU',
        broker: 'ZERODHA',
        exchanges: ['NSE', 'BSE', 'NFO', 'CDS', 'MCX'],
        products: ['CNC', 'NRML', 'MIS', 'MTF'],
        order_types: ['MARKET', 'LIMIT', 'SL', 'SL-M'],
        avatar_url: null,
        user_id: 'AB1234',
        api_key: 'test_api_key',
        access_token: 'test_access_token',
        public_token: 'test_public_token',
        enctoken: 'test_enctoken',
        refresh_token: 'test_refresh_token',
        silo: '',
        login_time: '2026-01-01 09:00:00',
        meta: { demat_consent: 'consent' },
      },
    };
  });

  // DELETE /session/token
  app.delete('/session/token', async () => {
    return { status: 'success', data: true };
  });

  // GET /user/profile
  app.get('/user/profile', async () => {
    return {
      status: 'success',
      data: {
        user_id: 'AB1234',
        user_type: 'individual',
        email: 'test@example.com',
        user_name: 'Test User',
        user_shortname: 'TU',
        broker: 'ZERODHA',
        exchanges: ['NSE', 'BSE', 'NFO'],
        products: ['CNC', 'NRML', 'MIS'],
        order_types: ['MARKET', 'LIMIT', 'SL', 'SL-M'],
        avatar_url: null,
        meta: { demat_consent: 'consent' },
      },
    };
  });

  // GET /quote/ltp
  app.get('/quote/ltp', async (request) => {
    const query = request.query as Record<string, string | string[]>;
    const instruments = Array.isArray(query.i) ? query.i : query.i ? [query.i] : [];
    const data: Record<string, { instrument_token: number; last_price: number }> = {};

    for (const inst of instruments) {
      const price = getMockPrice(inst);
      data[inst] = { instrument_token: 0, last_price: price };
    }

    return { status: 'success', data };
  });

  // GET /quote
  app.get('/quote', async (request) => {
    const query = request.query as Record<string, string | string[]>;
    const instruments = Array.isArray(query.i) ? query.i : query.i ? [query.i] : [];
    const data: Record<string, Record<string, unknown>> = {};

    for (const inst of instruments) {
      const price = getMockPrice(inst);
      data[inst] = {
        instrument_token: 0,
        timestamp: '2026-01-01 09:30:00',
        last_trade_time: '2026-01-01 09:30:00',
        last_price: price,
        last_quantity: 100,
        buy_quantity: 10000,
        sell_quantity: 10000,
        volume: 500000,
        average_price: price,
        oi: 0,
        oi_day_high: 0,
        oi_day_low: 0,
        net_change: 0,
        lower_circuit_limit: price * 0.8,
        upper_circuit_limit: price * 1.2,
        ohlc: { open: price, high: price * 1.02, low: price * 0.98, close: price },
        depth: {
          buy: [{ price: price - 0.05, quantity: 100, orders: 5 }],
          sell: [{ price: price + 0.05, quantity: 100, orders: 5 }],
        },
      };
    }

    return { status: 'success', data };
  });

  // GET /quote/ohlc
  app.get('/quote/ohlc', async (request) => {
    const query = request.query as Record<string, string | string[]>;
    const instruments = Array.isArray(query.i) ? query.i : query.i ? [query.i] : [];
    const data: Record<string, Record<string, unknown>> = {};

    for (const inst of instruments) {
      const price = getMockPrice(inst);
      data[inst] = {
        instrument_token: 0,
        last_price: price,
        ohlc: { open: price, high: price * 1.02, low: price * 0.98, close: price },
      };
    }

    return { status: 'success', data };
  });

  // GET /instruments
  app.get('/instruments', async (_request, reply) => {
    reply.header('Content-Type', 'text/csv');
    return 'instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange\n408065,1594,INFY,INFOSYS,1500.0,,0,0.05,1,EQ,NSE,NSE\n';
  });

  // GET /instruments/:exchange
  app.get('/instruments/:exchange', async (_request, reply) => {
    reply.header('Content-Type', 'text/csv');
    return 'instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange\n408065,1594,INFY,INFOSYS,1500.0,,0,0.05,1,EQ,NSE,NSE\n';
  });

  // POST /margins/orders
  app.post('/margins/orders', async () => {
    return {
      status: 'success',
      data: [{ type: 'equity', tradingsymbol: 'INFY', exchange: 'NSE', span: 0, exposure: 0, option_premium: 0, additional: 0, bo: 0, cash: 15000, var: 0, pnl: { realised: 0, unrealised: 0 }, total: 15000 }],
    };
  });

  // POST /margins/basket
  app.post('/margins/basket', async () => {
    return {
      status: 'success',
      data: { initial: { tradingsymbol: 'INFY', exchange: 'NSE', total: 15000 }, final: { tradingsymbol: 'INFY', exchange: 'NSE', total: 15000 }, orders: [] },
    };
  });

  // POST /charges/orders
  app.post('/charges/orders', async () => {
    return {
      status: 'success',
      data: [{ total_charges: 15.5, gst: { igst: 2.79, cgst: 0, sgst: 0, total: 2.79 } }],
    };
  });

  // GET /mf/instruments
  app.get('/mf/instruments', async (_request, reply) => {
    reply.header('Content-Type', 'text/csv');
    return 'tradingsymbol,amc,name,purchase_allowed,redemption_allowed,minimum_purchase_amount,purchase_amount_multiplier,minimum_additional_purchase_amount,minimum_redemption_quantity,redemption_quantity_multiplier,dividend_type,scheme_type,plan,settlement_type,last_price,last_price_date\nINF209K01YY2,AXIS,Axis Liquid Fund,1,1,5000,1,1000,0.001,0.001,growth,open,regular,T1,2500.00,2026-01-01\n';
  });

  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  mockServer = app;
  mockPort = port;

  return { url: `http://127.0.0.1:${port}`, port };
}

export async function stopMockKiteServer(): Promise<void> {
  if (mockServer) {
    await mockServer.close();
    mockServer = null;
  }
}

export function getMockServerUrl(): string {
  return `http://127.0.0.1:${mockPort}`;
}

function getMockPrice(instrument: string): number {
  const prices: Record<string, number> = {
    'NSE:INFY': 1500.0,
    'NSE:RELIANCE': 2500.0,
    'NSE:TCS': 3500.0,
    'NSE:HDFCBANK': 1600.0,
    'BSE:INFY': 1500.0,
  };
  return prices[instrument] ?? 1000.0;
}
