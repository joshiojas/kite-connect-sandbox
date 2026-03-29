# Lightsail Deployment Guide

Deploy the Kite Connect Sandbox in **proxy mode** on an AWS Lightsail instance with a static IP for Zerodha's IP whitelisting requirement.

## Architecture

```
Internet (HTTPS:443) --> Nginx (SSL termination) --> Fastify app (HTTP:8000) --> api.kite.trade
                         kite-api.mecadelle.live      localhost only             orders forwarded
                         Lightsail + Static IP          Docker container
```

- **Nginx** runs on the host, terminates SSL with Let's Encrypt, proxies to `localhost:8000`
- **Fastify app** runs in Docker in proxy mode, forwards all order API calls to Kite
- **Static IP** from Lightsail is registered with Zerodha for whitelisting

## Prerequisites

- AWS Lightsail instance: **$7/month** plan (1 GB RAM, 1 vCPU, Ubuntu 24.04, ap-south-1)
- Domain: `kite-api.mecadelle.live` (Route53 A record pointing to Lightsail static IP)

## Step-by-Step Setup

### 1. Create Lightsail Instance

- Region: `ap-south-1` (Mumbai)
- OS: Ubuntu 24.04 LTS
- Plan: $7/month (1 GB RAM, 1 vCPU)

### 2. Attach Static IP

In Lightsail console → Networking → Create static IP → Attach to instance.

### 3. Open Firewall Ports

In instance networking tab, add rules:
- **22** (SSH) — already open by default
- **80** (HTTP) — needed for Let's Encrypt ACME challenge
- **443** (HTTPS) — production traffic

### 4. Configure DNS

Add Route53 A record:
```
kite-api.mecadelle.live → <Lightsail static IP>
```

### 5. SSH and Run Setup

SSH into the instance and run the `setup.sh` script (maintained separately) which installs:
- Docker + Docker Compose
- Nginx
- Certbot (Let's Encrypt)
- systemd service for the proxy

### 6. Clone and Configure

```bash
cd /opt
sudo git clone <repo-url> kite-connect-sandbox
cd kite-connect-sandbox/deploy/lightsail

# Create .env from template
cp ../../.env.example .env
```

Edit `.env`:
```bash
SANDBOX_MODE=proxy
KITE_BASE_URL=https://api.kite.trade
KITE_WS_URL=wss://ws.kite.trade
KITE_UPSTREAM_TIMEOUT=10000
LOG_FILE_PATH=/data/logs/kite-proxy.log
```

### 7. Start the Proxy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 8. Enable HTTPS

```bash
sudo certbot --nginx -d kite-api.mecadelle.live
```

Certbot's systemd timer handles automatic renewal (certificates are valid for 90 days).

### 9. Verify

```bash
curl https://kite-api.mecadelle.live/health
```

Expected response:
```json
{"status":"success","data":{"status":"ok","mode":"proxy","uptime_seconds":42,"upstream":{"url":"https://api.kite.trade","reachable":true}}}
```

### 10. Register Static IP with Zerodha

Go to [developers.kite.trade](https://developers.kite.trade) and add the Lightsail static IP to your app's allowed IPs.

## Nginx Configuration

Installed on the host by `setup.sh` (not managed by this repo):

```nginx
server {
    listen 443 ssl;
    server_name kite-api.mecadelle.live;

    ssl_certificate /etc/letsencrypt/live/kite-api.mecadelle.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kite-api.mecadelle.live/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 30s;
    }
}
```

## Logs

Structured JSONL logs are written to `./logs/kite-proxy.log` on the host (mounted as a Docker volume).

View logs:
```bash
# Via Docker
docker logs kite-proxy

# Via log file
tail -f logs/kite-proxy.log | jq .

# Filter order forwards
grep ORDER_FORWARDED logs/kite-proxy.log | jq .
```

Log rotation should be configured on the host via `logrotate` (handled by `setup.sh`).

## Monitoring

The `/health` endpoint returns mode, uptime, and upstream connectivity. Use this for CloudWatch alarms or external uptime monitoring.

The proxy also runs an internal health check every 5 minutes and logs the result.
