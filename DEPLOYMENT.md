# Tirupur Runners Club — Bluehost VPS Deployment Guide

## Architecture

| Layer    | Setup                              |
|----------|------------------------------------|
| Server   | Bluehost VPS — Ubuntu 24.04        |
| Backend  | FastAPI + uvicorn (systemd service)|
| Frontend | React (Vite) — served via Nginx    |
| Database | PostgreSQL 16                      |
| Proxy    | Nginx (reverse proxy + static files)|
| SSL      | Let's Encrypt (Certbot)            |

### Environments on Same VPS

| | Dev | Prod |
|---|---|---|
| URL | https://dev.tirupurrunners.com | https://tirupurrunners.com |
| Branch | `dev` | `main` |
| Backend port | `8000` | `8001` |
| Database | `tirupur_runners_dev` | `tirupur_runners_prod` |
| Directory | `/var/www/tirupur-runners-platform` | `/var/www/tirupur-runners-prod` |
| Systemd service | `tirupur-runners` | `tirupur-runners-prod` |

---

## Part 1 — Initial VPS Setup

### 1.1 Connect to VPS
```bash
ssh root@129.121.87.71
```

### 1.2 Update system packages
```bash
apt update && apt upgrade -y
```

### 1.3 Install system dependencies
```bash
apt install -y git nginx postgresql postgresql-contrib python3 python3-venv python3-dev build-essential libpq-dev iptables-persistent certbot python3-certbot-nginx
```

> **Note:** Ubuntu 24.04 ships Python 3.12. Do NOT try to install python3.11 — use python3 (3.12).

---

## Part 2 — PostgreSQL Setup

### 2.1 Start PostgreSQL
```bash
systemctl enable postgresql
systemctl start postgresql
```

### 2.2 Create Dev DB and user
```bash
sudo -u postgres psql
```
```sql
CREATE USER tirupur_dev WITH PASSWORD 'Runners.Tirupur@123';
CREATE DATABASE tirupur_runners_dev OWNER tirupur_dev;
GRANT ALL PRIVILEGES ON DATABASE tirupur_runners_dev TO tirupur_dev;
\q
```

### 2.3 Create Prod DB and user (when setting up prod)
```sql
CREATE USER tirupur_prod WITH PASSWORD '<strong-password>';
CREATE DATABASE tirupur_runners_prod OWNER tirupur_prod;
GRANT ALL PRIVILEGES ON DATABASE tirupur_runners_prod TO tirupur_prod;
\q
```

---

## Part 3 — Clone Repository

### 3.1 Add VPS SSH key to GitHub
```bash
ssh-keygen -t ed25519 -C "bluehost-vps"
cat ~/.ssh/id_ed25519.pub
```
Add the printed key to GitHub → Settings → SSH keys.

### 3.2 Clone repo (Dev)
```bash
mkdir -p /var/www
cd /var/www
git clone git@github.com:thiyageshd/tirupur-runners.git tirupur-runners-platform
cd tirupur-runners-platform
git checkout dev
```

### 3.3 Clone repo (Prod)
```bash
cd /var/www
git clone git@github.com:thiyageshd/tirupur-runners.git tirupur-runners-prod
cd tirupur-runners-prod
git checkout main
```

---

## Part 4 — Backend Setup

### 4.1 Create virtual environment
```bash
cd /var/www/tirupur-runners-platform/backend
python3 -m venv .venv
.venv/bin/python -m ensurepip --upgrade
.venv/bin/pip install --upgrade pip setuptools wheel
.venv/bin/pip install -r requirements.txt
```

> **Python 3.12 fix:** `setuptools==68.2.2` must be the first line in `requirements.txt`.
> This fixes `ModuleNotFoundError: No module named 'pkg_resources'` caused by razorpay SDK.

### 4.2 Create .env file
```bash
nano /var/www/tirupur-runners-platform/backend/.env
```
```env
DATABASE_URL=postgresql+asyncpg://tirupur_dev:Runners.Tirupur%40123@localhost:5432/tirupur_runners_dev
SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_hex(32))">
RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=xxxx
RAZORPAY_WEBHOOK_SECRET=xxxx
GMAIL_USER=tirupurrunnersmarathon@gmail.com
GMAIL_APP_PASSWORD=xxxx
FRONTEND_URL=https://dev.tirupurrunners.com
DEBUG=False
```

> **Important:** If DB password contains `@`, URL-encode it as `%40` in DATABASE_URL.

### 4.3 Create systemd service
```bash
nano /etc/systemd/system/tirupur-runners.service
```
```ini
[Unit]
Description=Tirupur Runners FastAPI Backend (Dev)
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/var/www/tirupur-runners-platform/backend
ExecStart=/var/www/tirupur-runners-platform/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3
EnvironmentFile=/var/www/tirupur-runners-platform/backend/.env

[Install]
WantedBy=multi-user.target
```
```bash
systemctl daemon-reload
systemctl enable tirupur-runners
systemctl start tirupur-runners
systemctl status tirupur-runners
```

---

## Part 5 — Frontend Build & Deploy

### 5.1 Build on local Mac
```bash
cd /Users/thiyagesh/Documents/Code/tirupur-runners/frontend
git checkout dev
npm run build
```

### 5.2 Copy dist to VPS
```bash
scp -r dist root@129.121.87.71:/var/www/tirupur-runners-platform/frontend/
```

---

## Part 6 — Nginx Configuration

### 6.1 Dev server config
```bash
nano /etc/nginx/sites-available/tirupur-runners
```
```nginx
server {
    listen 80;
    server_name dev.tirupurrunners.com;

    root /var/www/tirupur-runners-platform/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 10M;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
```bash
ln -s /etc/nginx/sites-available/tirupur-runners /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### 6.2 Prod server config (when setting up prod)
```bash
nano /etc/nginx/sites-available/tirupur-runners-prod
```
```nginx
server {
    listen 80;
    server_name tirupurrunners.com www.tirupurrunners.com;

    root /var/www/tirupur-runners-prod/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 10M;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
```bash
ln -s /etc/nginx/sites-available/tirupur-runners-prod /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## Part 7 — Firewall (iptables)

```bash
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
apt install iptables-persistent -y
netfilter-persistent save
```

---

## Part 8 — SSL (Let's Encrypt)

### 8.1 DNS records (add at domain registrar)
| Type | Name | Value |
|------|------|-------|
| A | `@` | `129.121.87.71` |
| A | `dev` | `129.121.87.71` |
| A | `www` | `129.121.87.71` |

### 8.2 Issue certificates
```bash
# Dev
certbot --nginx -d dev.tirupurrunners.com

# Prod (when ready)
certbot --nginx -d tirupurrunners.com -d www.tirupurrunners.com
```

Certbot auto-renews via a systemd timer — no manual renewal needed.

---

## Part 9 — Data Migration (Local → VPS)

### 9.1 Dump local DB (on Mac)
```bash
pg_dump -U thiyagesh -d tirupur_runners -F c -f /tmp/tirupur_runners.dump
```

### 9.2 Copy dump to VPS
```bash
scp /tmp/tirupur_runners.dump root@129.121.87.71:/tmp/
```

### 9.3 Stop the app (prevents DB connections during restore)
```bash
systemctl stop tirupur-runners
```

### 9.4 Drop and recreate DB (clean slate)
```bash
sudo -u postgres psql -c "DROP DATABASE tirupur_runners_dev;"
sudo -u postgres psql -c "CREATE DATABASE tirupur_runners_dev OWNER tirupur_dev;"
```

### 9.5 Restore
```bash
sudo -u postgres pg_restore -d tirupur_runners_dev --no-owner --role=tirupur_dev /tmp/tirupur_runners.dump
```

### 9.6 Start the app
```bash
systemctl start tirupur-runners
```

### 9.7 Verify row counts
```bash
sudo -u postgres psql -d tirupur_runners_dev -c "SELECT COUNT(*) FROM users;"
sudo -u postgres psql -d tirupur_runners_dev -c "SELECT COUNT(*) FROM memberships;"
sudo -u postgres psql -d tirupur_runners_dev -c "SELECT COUNT(*) FROM member_profiles;"
```

---

## Part 10 — Deploying Updates

### Backend update
```bash
cd /var/www/tirupur-runners-platform
git pull origin dev
systemctl restart tirupur-runners
```

### Frontend update (build on Mac, copy to VPS)
```bash
# On Mac
cd /Users/thiyagesh/Documents/Code/tirupur-runners/frontend
npm run build
scp -r dist root@129.121.87.71:/var/www/tirupur-runners-platform/frontend/
```

---

## Part 11 — Common Issues & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ModuleNotFoundError: No module named 'pkg_resources'` | Python 3.12 removed setuptools from stdlib | Add `setuptools==68.2.2` as first line in requirements.txt |
| `socket.gaierror: Name or service not known` | `@` in DB password breaks URL parsing | URL-encode `@` as `%40` in DATABASE_URL |
| `relation already exists` on pg_restore | App created tables before restore | Stop app → drop DB → recreate → restore |
| `curl: Failed to connect port 80` | Firewall blocking port | Run iptables rules (Part 7) |
| `E: Unable to locate package python3.11` | Ubuntu 24.04 ships Python 3.12 only | Use `python3` (3.12) — do not install 3.11 |
| `database is being accessed by other users` | App connected during DROP | `systemctl stop tirupur-runners` first |

---

## Useful Commands

```bash
# Check service status
systemctl status tirupur-runners

# View live logs
journalctl -u tirupur-runners -f

# Restart backend
systemctl restart tirupur-runners

# Test Nginx config
nginx -t

# Reload Nginx
systemctl reload nginx

# Renew SSL manually (auto-renews but just in case)
certbot renew

# Check open ports
ss -tlnp
```
