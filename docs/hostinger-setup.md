# Hostinger VPS — Setup & Deployment Guide

> Tirupur Runners Club — FastAPI backend + React frontend on Hostinger KVM2 (Ubuntu 22.04)

---

## 1. VPS Purchase

- Plan: **KVM2** (2 vCPU, 8 GB RAM, 100 GB NVMe) — ~₹649/mo
- Region: **India** (Mumbai)
- OS: **Ubuntu 22.04 LTS**
- Buy **2 VPS** — one for dev, one for prod

---

## 2. Initial Server Setup (run on each VPS)

SSH into VPS as root:
```bash
ssh root@<VPS_IP>
```

### 2a. System updates
```bash
apt update && apt upgrade -y
apt install -y git curl wget unzip nginx certbot python3-certbot-nginx \
               python3.11 python3.11-venv python3.11-dev build-essential \
               libpq-dev postgresql postgresql-contrib nodejs npm
```

### 2b. Create a deploy user (don't run everything as root)
```bash
adduser deploy
usermod -aG sudo deploy
# Add your SSH public key
mkdir -p /home/deploy/.ssh
echo "<your-public-key>" >> /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

### 2c. Allow deploy user to restart services without password
```bash
visudo
# Add this line at the end:
deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart tirupur-runners-backend, /bin/systemctl restart tirupur-runners-backend-dev, /bin/systemctl is-active tirupur-runners-backend, /bin/systemctl is-active tirupur-runners-backend-dev, /bin/cp -r * /var/www/tirupur-runners/, /bin/cp -r * /var/www/tirupur-runners-dev/, /bin/mkdir -p /var/www/tirupur-runners, /bin/mkdir -p /var/www/tirupur-runners-dev
```

---

## 3. PostgreSQL Setup

### 3a. Create DB and user (run as postgres user)
```bash
sudo -u postgres psql
```
```sql
-- For PROD VPS:
CREATE USER tirupur_runners WITH PASSWORD 'your_strong_password_here';
CREATE DATABASE tirupur_runners OWNER tirupur_runners;
GRANT ALL PRIVILEGES ON DATABASE tirupur_runners TO tirupur_runners;
\q

-- For DEV VPS (same but different password):
CREATE USER tirupur_runners WITH PASSWORD 'your_dev_password_here';
CREATE DATABASE tirupur_runners OWNER tirupur_runners;
GRANT ALL PRIVILEGES ON DATABASE tirupur_runners TO tirupur_runners;
\q
```

### 3b. Allow local connections (already default for localhost)
```bash
# Check /etc/postgresql/14/main/pg_hba.conf has:
# local  all  all  md5
# host   all  all  127.0.0.1/32  md5
```

---

## 4. Application Setup

### 4a. Clone repository
```bash
su - deploy
mkdir -p /opt/tirupur-runners
cd /opt/tirupur-runners
git clone https://github.com/<your-org>/tirupur-runners.git .
# For dev VPS, checkout dev branch:
git checkout dev
```

### 4b. Set up Python virtual environment
```bash
cd /opt/tirupur-runners/backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

### 4c. Create backend .env file
```bash
nano /opt/tirupur-runners/backend/.env
```
Paste (fill in your values):
```env
# Database — local PostgreSQL on this VPS
DATABASE_URL=postgresql+asyncpg://tirupur_runners:your_password@localhost:5432/tirupur_runners

# JWT
SECRET_KEY=generate-a-long-random-string-here

# Razorpay (use TEST keys for dev, LIVE keys for prod)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Resend email
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@tirupurrunners.com

# Frontend URL (used in approval emails)
# Dev:  http://<DEV_VPS_IP> or https://dev.tirupurrunners.com
# Prod: https://tirupurrunners.com
FRONTEND_URL=https://tirupurrunners.com

# Admin
ADMIN_EMAIL=tirupurrunners@gmail.com
PROTECTED_ADMIN_EMAILS=thiyagesh.d@gmail.com
```
```bash
chmod 600 /opt/tirupur-runners/backend/.env
```

### 4d. Set up Node.js and build frontend
```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Build frontend
cd /opt/tirupur-runners/frontend
npm ci
npm run build

# Copy to Nginx web root
# Prod:
sudo mkdir -p /var/www/tirupur-runners
sudo cp -r dist/. /var/www/tirupur-runners/

# Dev:
sudo mkdir -p /var/www/tirupur-runners-dev
sudo cp -r dist/. /var/www/tirupur-runners-dev/
```

---

## 5. Systemd Service

### For PROD VPS — `/etc/systemd/system/tirupur-runners-backend.service`
```bash
sudo nano /etc/systemd/system/tirupur-runners-backend.service
```
```ini
[Unit]
Description=Tirupur Runners FastAPI Backend
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/tirupur-runners/backend
EnvironmentFile=/opt/tirupur-runners/backend/.env
ExecStart=/opt/tirupur-runners/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### For DEV VPS — `/etc/systemd/system/tirupur-runners-backend-dev.service`
Same file content but change `ExecStart` port to `8001` (or keep 8000 if it's a dedicated dev VPS).

```bash
sudo systemctl daemon-reload
sudo systemctl enable tirupur-runners-backend
sudo systemctl start tirupur-runners-backend
sudo systemctl status tirupur-runners-backend
```

---

## 6. Nginx Configuration

### For PROD — `/etc/nginx/sites-available/tirupur-runners`
```bash
sudo nano /etc/nginx/sites-available/tirupur-runners
```
```nginx
server {
    listen 80;
    server_name tirupurrunners.com www.tirupurrunners.com;

    root /var/www/tirupur-runners;
    index index.html;

    # React Router — serve index.html for all frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 10M;
    }
}
```

### For DEV — `/etc/nginx/sites-available/tirupur-runners-dev`
Same but with `server_name dev.tirupurrunners.com` and root `/var/www/tirupur-runners-dev`.

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/tirupur-runners /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. SSL Certificate (HTTPS)

```bash
# Prod
sudo certbot --nginx -d tirupurrunners.com -d www.tirupurrunners.com

# Dev
sudo certbot --nginx -d dev.tirupurrunners.com

# Auto-renewal (already set up by certbot, verify with):
sudo certbot renew --dry-run
```

---

## 8. DNS Setup (in Hostinger hPanel or your domain registrar)

| Type | Name            | Value         |
|------|-----------------|---------------|
| A    | @               | `<PROD_VPS_IP>` |
| A    | www             | `<PROD_VPS_IP>` |
| A    | dev             | `<DEV_VPS_IP>`  |

Wait 5–15 minutes for DNS propagation.

---

## 9. Data Migration (Render → Hostinger)

Run from your local machine or from the VPS (install asyncpg locally with `pip install asyncpg`):

```bash
cd backend

# From Render dev DB → Hostinger dev VPS
SOURCE_DB_URL="postgresql://user:pass@dpg-xxx.render.com/tirupur_runners_dev?ssl=require" \
TARGET_DB_URL="postgresql://tirupur_runners:your_dev_password@<DEV_VPS_IP>:5432/tirupur_runners" \
python scripts/migrate_to_hostinger.py

# From Render prod DB (or local) → Hostinger prod VPS
SOURCE_DB_URL="postgresql://thiyagesh@localhost:5432/tirupur_runners" \
TARGET_DB_URL="postgresql://tirupur_runners:your_prod_password@<PROD_VPS_IP>:5432/tirupur_runners" \
python scripts/migrate_to_hostinger.py
```

> Note: PostgreSQL on Hostinger VPS does NOT require SSL for local connections (localhost).
> It DOES require SSL if connecting remotely (from your laptop to VPS IP directly).
> To connect remotely, allow port 5432 in firewall: `sudo ufw allow from <YOUR_IP> to any port 5432`

---

## 10. GitHub Actions Secrets to Add

Go to GitHub → repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret Name               | Value                                 |
|---------------------------|---------------------------------------|
| `HOSTINGER_DEV_HOST`      | Dev VPS IP address                    |
| `HOSTINGER_DEV_USER`      | `deploy`                              |
| `HOSTINGER_DEV_SSH_KEY`   | Private SSH key for deploy user (dev) |
| `HOSTINGER_PROD_HOST`     | Prod VPS IP address                   |
| `HOSTINGER_PROD_USER`     | `deploy`                              |
| `HOSTINGER_PROD_SSH_KEY`  | Private SSH key for deploy user (prod)|

### Generate SSH key pair (run on your laptop):
```bash
# For dev VPS
ssh-keygen -t ed25519 -C "github-actions-dev" -f ~/.ssh/hostinger_dev

# For prod VPS
ssh-keygen -t ed25519 -C "github-actions-prod" -f ~/.ssh/hostinger_prod
```
- Add the **public key** (`~/.ssh/hostinger_dev.pub`) to `/home/deploy/.ssh/authorized_keys` on the VPS
- Add the **private key** (`~/.ssh/hostinger_dev`) content as the GitHub Actions secret

---

## 11. Verify Deployment

```bash
# Check backend is running
curl https://tirupurrunners.com/api/v1/health

# Check frontend loads
curl -I https://tirupurrunners.com

# Check systemd logs
sudo journalctl -u tirupur-runners-backend -f

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## 12. Summary of Workflow After Setup

1. Push code to `dev` branch → GitHub Action triggers → SSH into dev VPS → pull + build + restart
2. Push code to `main` branch → GitHub Action triggers → SSH into prod VPS → pull + build + restart
3. No Render dependency — fully self-hosted on Hostinger VPS
