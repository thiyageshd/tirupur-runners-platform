# Tirupur Runners Club — Infrastructure Runbook

> For engineers maintaining or extending the platform.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Bluehost VPS](#2-bluehost-vps)
3. [Environments](#3-environments)
4. [Database (PostgreSQL)](#4-database-postgresql)
5. [Cloudflare DNS](#5-cloudflare-dns)
6. [SSL (Let's Encrypt)](#6-ssl-lets-encrypt)
7. [Email (Resend)](#7-email-resend)
8. [Payments (Razorpay)](#8-payments-razorpay)
9. [CI/CD (GitHub Actions)](#9-cicd-github-actions)
10. [Common Operations](#10-common-operations)
11. [Environment Variables Reference](#11-environment-variables-reference)

---

## 1. Architecture Overview

```
User Browser
     |
     v
Cloudflare (DNS-only / grey cloud)
     |
     v
Bluehost VPS (129.121.87.71) — Ubuntu 24.04
     ├─ Nginx (reverse proxy)
     │   ├─ tirupurrunners.com  -> localhost:8001 (prod backend)
     │   │    ├─ /uploads/  -> /var/www/tirupur-runners-prod/backend/uploads/
     │   │    └─ / (static) -> /var/www/tirupur-runners-prod/frontend/dist/
     │   └─ dev.tirupurrunners.com -> localhost:8000 (dev backend)
     │        ├─ /uploads/  -> /var/www/tirupur-runners-platform/backend/uploads/
     │        └─ / (static) -> /var/www/tirupur-runners-platform/frontend/dist/
     |
     ├─ FastAPI (uvicorn)
     │    ├─ dev instance : port 8000
     │    └─ prod instance: port 8001
     |
     └─ PostgreSQL 16
                ├─ tirupur_runners_dev
                └─ tirupur_runners_prod

External services:
     - Resend (transactional email)
     - Razorpay (payment gateway)
     - GitHub Actions (CI/CD)
```

**Stack**
| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | FastAPI (Python 3.12), async SQLAlchemy |
| Database | PostgreSQL 16 |
| Web server | Nginx 1.24 |
| Process manager | systemd |
| Email | Resend API |
| Payments | Razorpay |

---

## 2. Bluehost VPS

| Property | Value |
|---|---|
| Provider | Bluehost VPS |
| OS | Ubuntu 24.04 |
| IP | `129.121.87.71` |
| SSH user | `root` (or configured sudo user) |
| Python | 3.12.3 |
| PostgreSQL | 16 |
| Nginx | 1.24 |

**SSH access**
```bash
ssh root@129.121.87.71
```

**Key directories**
| Path | Purpose |
|---|---|
| `/var/www/tirupur-runners-platform` | Dev environment repo (branch: `dev`) |
| `/var/www/tirupur-runners-prod` | Prod environment repo (branch: `main`) |
| `/etc/nginx/sites-available/` | Nginx configs |
| `/etc/letsencrypt/` | SSL certificates |

---

## 3. Environments

### Dev — `dev.tirupurrunners.com`

| Property | Value |
|---|---|
| Branch | `dev` |
| Repo path | `/var/www/tirupur-runners-platform` |
| Backend port | `8000` |
| Venv | `/var/www/tirupur-runners-platform/backend/.venv` |
| Systemd service | `tirupur-runners` |
| Database | `tirupur_runners_dev` |
| DB user | `tirupur_dev` |
| Uploads | `/var/www/tirupur-runners-platform/backend/uploads/` |
| Razorpay | Test keys (`rzp_test_...`) |
| Test payment amount | ₹1 (`PAYMENT_TEST_AMOUNT_PAISE=100`) |

### Prod — `tirupurrunners.com`

| Property | Value |
|---|---|
| Branch | `main` |
| Repo path | `/var/www/tirupur-runners-prod` |
| Backend port | `8001` |
| Venv | `/var/www/tirupur-runners-prod/backend/.venv` |
| Systemd service | `tirupur-runners-prod` |
| Database | `tirupur_runners_prod` |
| DB user | `tirupur_prod` |
| Uploads | `/var/www/tirupur-runners-prod/backend/uploads/` |
| Razorpay | Live keys (`rzp_live_...`) |
| Test payment amount | Disabled (`PAYMENT_TEST_AMOUNT_PAISE=0`) |

### Uploads folder structure

Both environments share the same layout under their respective `backend/uploads/`:
```
uploads/
├── aadhar/       ← member Aadhar documents
├── photos/       ← member profile photos
└── receipts/
    ├── 2025/     ← payment receipts by year
    └── 2026/
```

> These folders are git-ignored and must be created manually on the VPS.
> The `receipts/{year}/` subfolder is created automatically on first payment.

---

## 4. Database (PostgreSQL)

**Connect via psql on VPS**
```bash
# Dev
psql -U tirupur_dev -d tirupur_runners_dev

# Prod
psql -U tirupur_prod -d tirupur_runners_prod
```

**Connect via DBeaver (SSH tunnel)**
- SSH Host: `129.121.87.71` | Port: `22` | Auth: Password
- DB Host: `localhost` | Port: `5432`
- Database: `tirupur_runners_dev` or `tirupur_runners_prod`
- Driver property: `sslmode=disable`

**Key tables**
| Table | Purpose |
|---|---|
| `users` | Member accounts + auth |
| `member_profiles` | Bio, photo, blood group, Aadhar, Strava |
| `memberships` | Membership records per year (active/expired/pending) |
| `payments` | Razorpay payment records |
| `site_settings` | Admin-controlled feature flags (show_login, etc.) |

**Membership year convention**
- Year `2025` = Apr 1, 2025 → Mar 31, 2026 (FY 2025–26)
- Year `2026` = Apr 1, 2026 → Mar 31, 2027 (FY 2026–27)

**Pricing**
| Member type | Condition | Fee |
|---|---|---|
| New member | No prior membership or payment | ₹2,000 |
| Renewal | Has expired/active membership OR prior paid payment | ₹1,500 |

---

## 5. Cloudflare DNS

The domain `tirupurrunners.com` uses **Cloudflare for DNS** (free DNS-only plan).
GoDaddy nameservers have been updated to point to Cloudflare.

**Current DNS records**

| Type | Name | Value | Proxy |
|---|---|---|---|
| A | `@` | `129.121.87.71` | DNS only (grey cloud) |
| A | `dev` | `129.121.87.71` | DNS only (grey cloud) |

> **Important**: Keep proxy status as **DNS only (grey cloud)**. Orange cloud (proxied) can conflict with SSL and Nginx.

**Adding a new subdomain**
1. Cloudflare dashboard → your domain → DNS
2. Add record → Type: A, Name: `<subdomain>`, IPv4: `129.121.87.71`, Proxy: DNS only
3. Run Certbot on VPS to issue SSL for the new subdomain

---

## 6. SSL (Let's Encrypt)

SSL certificates are managed by **Certbot** on the VPS.

**Issue/renew certificates**
```bash
# Issue for a new domain
certbot --nginx -d tirupurrunners.com -d www.tirupurrunners.com

# Issue for dev subdomain
certbot --nginx -d dev.tirupurrunners.com

# Auto-renew (runs via cron/systemd timer automatically)
certbot renew --dry-run
```

**Check certificate expiry**
```bash
certbot certificates
```

---

## 7. Email (Resend)

All transactional emails are sent via **[Resend](https://resend.com)** using the Python SDK.

**Emails sent by the platform**
| Trigger | Template |
|---|---|
| Admin approves member | Approval email with login link |
| Admin rejects member | Rejection email |
| Member pays | Membership confirmation with valid-until date |
| OTP login request | 6-digit OTP email |

**From address**: `noreply@tirupurrunners.com`
The domain `tirupurrunners.com` must be verified in the Resend dashboard with the correct DNS records.

**Resend DNS records (add in Cloudflare)**
These are provided by Resend when you add your domain. Typically:
- 1× TXT record for domain verification
- 2× MX + TXT records for DKIM signing

> If no `RESEND_API_KEY` is set (local dev), emails are logged to console instead of sent.

**Where the key is used**
- Dev env: GitHub secret `BLUEHOST_RESEND_API_KEY` (environment: `dev`)
- Prod env: GitHub secret `BLUEHOST_RESEND_API_KEY` (environment: `prod`)
- Written to `backend/.env` on each deploy

---

## 8. Payments (Razorpay)

**Key IDs per environment**
| Environment | Key prefix | Webhook URL |
|---|---|---|
| Dev | `rzp_test_...` | `https://dev.tirupurrunners.com/api/v1/payments/webhook` |
| Prod | `rzp_live_...` | `https://tirupurrunners.com/api/v1/payments/webhook` |

**Razorpay dashboard setup**
1. Create separate API keys for dev and prod in the Razorpay dashboard
2. Under **Webhooks**, add the webhook URL for each environment
3. Set `payment.captured` as the subscribed event
4. Copy the webhook secret → set as `RAZORPAY_WEBHOOK_SECRET` in GitHub secrets

**Test mode (dev)**
Set `PAYMENT_TEST_AMOUNT_PAISE=100` in `.env` to charge ₹1 for all payments instead of the real amount. Set to `0` to disable (use real amounts).

---

## 9. CI/CD (GitHub Actions)

Deployments are triggered automatically on push to the respective branch.

| Branch | Workflow file | Environment | Target |
|---|---|---|---|
| `dev` | `.github/workflows/deploy-bluehost-dev.yml` | `dev` | `tirupur-runners-platform` |
| `main` | `.github/workflows/deploy-bluehost-prod.yml` | `prod` | `tirupur-runners-prod` |

**What each deploy does**
1. SSH into VPS
2. `git fetch` + `git reset --hard origin/<branch>`
3. Write `backend/.env` from GitHub secrets
4. `pip install -r requirements.txt`
5. `npm ci && npm run build` (frontend)
6. `systemctl restart <service>`

**GitHub secrets (Settings → Environments)**

Each environment (`dev`, `prod`) needs these secrets:

| Secret | Description |
|---|---|
| `BLUEHOST_HOST` | VPS IP: `129.121.87.71` |
| `BLUEHOST_USER` | SSH username |
| `BLUEHOST_SSH_KEY` | Private SSH key for VPS access |
| `BLUEHOST_DATABASE_URL` | PostgreSQL connection URL |
| `BLUEHOST_SECRET_KEY` | JWT secret key |
| `BLUEHOST_RAZORPAY_KEY_ID` | Razorpay key ID |
| `BLUEHOST_RAZORPAY_KEY_SECRET` | Razorpay key secret |
| `BLUEHOST_RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret |
| `BLUEHOST_RESEND_API_KEY` | Resend API key |
| `BLUEHOST_GMAIL_USER` | Gmail user (reserved) |
| `BLUEHOST_GMAIL_APP_PASSWORD` | Gmail app password (reserved) |

> Dev and prod environments use separate Razorpay keys. All other secrets can be shared or differ as needed.

---

## 10. Common Operations

### Check service status
```bash
# Dev
systemctl status tirupur-runners

# Prod
systemctl status tirupur-runners-prod
```

### Restart a service
```bash
systemctl restart tirupur-runners        # dev
systemctl restart tirupur-runners-prod   # prod
```

### View live logs
```bash
journalctl -u tirupur-runners -f         # dev
journalctl -u tirupur-runners-prod -f    # prod
```

### View last 100 lines of logs
```bash
journalctl -u tirupur-runners -n 100
```

### Manual deploy (without GitHub Actions)
```bash
# Dev
cd /var/www/tirupur-runners-platform
git fetch origin && git reset --hard origin/dev
cd backend && .venv/bin/pip install -r requirements.txt --quiet
cd ../frontend && npm ci && npm run build
systemctl restart tirupur-runners

# Prod
cd /var/www/tirupur-runners-prod
git fetch origin && git reset --hard origin/main
cd backend && .venv/bin/pip install -r requirements.txt --quiet
cd ../frontend && npm ci && npm run build
systemctl restart tirupur-runners-prod
```

### Run a DB migration manually
```bash
cd /var/www/tirupur-runners-platform/backend
.venv/bin/python scripts/migrate_db.py     # dev

cd /var/www/tirupur-runners-prod/backend
.venv/bin/python scripts/migrate_db.py     # prod
```

### Check Nginx config and reload
```bash
nginx -t && systemctl reload nginx
```

### Add a new member manually
Generate a bcrypt hash for the password (phone number):
```bash
python3 -c "import bcrypt; print(bcrypt.hashpw(b'<phone>', bcrypt.gensalt()).decode())"
```
Then insert into DB via DBeaver using the SQL pattern in `scripts/add_member_template.sql`.

---

## 11. Environment Variables Reference

These are written to `backend/.env` on each deploy by GitHub Actions.

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL async URL | `postgresql+asyncpg://user:pass@localhost/db` |
| `SECRET_KEY` | JWT signing key | Random 32+ char string |
| `RAZORPAY_KEY_ID` | Razorpay public key | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key | — |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature secret | — |
| `RESEND_API_KEY` | Resend API key | `re_...` |
| `GMAIL_USER` | Gmail user (reserved/unused) | — |
| `GMAIL_APP_PASSWORD` | Gmail app password (reserved/unused) | — |
| `FROM_EMAIL` | Email sender address | `noreply@tirupurrunners.com` |
| `FRONTEND_URL` | Used in email links | `https://tirupurrunners.com` |
| `MEDIA_BASE_URL` | Base URL for uploaded files | `https://tirupurrunners.com` |
| `MEMBERSHIP_NEW_AMOUNT_PAISE` | New member fee in paise | `200000` (₹2,000) |
| `MEMBERSHIP_RENEWAL_AMOUNT_PAISE` | Renewal fee in paise | `150000` (₹1,500) |
| `PAYMENT_TEST_AMOUNT_PAISE` | Override charge amount for testing | `100` (₹1), `0` = disabled |
| `PROTECTED_ADMIN_EMAILS` | Comma-separated emails that cannot be deleted | `admin@example.com` |
| `DEBUG` | FastAPI debug mode | `False` |
