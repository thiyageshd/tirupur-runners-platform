# Tirupur Runners Club — Membership Platform

Full-stack web application for club registration, membership management, and annual renewal payments.

- **Website:** https://tirupurrunners.com
- **Dev:** https://dev.tirupurrunners.com
- **Club contact:** tirupurrunners@gmail.com | +91 94882 52599
- **Weekly run:** Every Sunday 5:30 AM at VOC Park, Tirupur

---

## Tech Stack

| Layer     | Technology                       | Notes                              |
|-----------|----------------------------------|------------------------------------|
| Frontend  | React 18 + Vite + Tailwind CSS   | SPA, React Router v6               |
| Backend   | FastAPI (Python 3.11, asyncio)   | REST API, JWT auth                 |
| Database  | PostgreSQL                       | Async SQLAlchemy + asyncpg         |
| Payments  | Razorpay                         | Orders + webhook verification      |
| Email     | Resend API                       | 3,000 emails/month free tier       |
| Hosting   | Hostinger KVM2 VPS (India)       | ₹649/month, migrated from Render   |
| Domain    | tirupurrunners.com               | Managed via GoDaddy                |
| CI/CD     | GitHub Actions                   | SSH deploy on push to dev / main   |

---

## Project Structure

```
tirupur-runners/
├── .github/
│   └── workflows/
│       ├── deploy-hostinger-dev.yml    # Auto-deploy on push to dev branch
│       └── deploy-hostinger-prod.yml   # Auto-deploy on push to main branch
│
├── backend/
│   ├── main.py                         # FastAPI app entrypoint + lifespan
│   ├── requirements.txt
│   ├── .python-version                 # 3.11.9 (pins for bcrypt compatibility)
│   ├── render.yaml                     # Render prod Blueprint (legacy)
│   ├── render-dev.yaml                 # Render dev Blueprint (legacy)
│   └── app/
│       ├── core/
│       │   ├── config.py               # Pydantic settings (reads .env)
│       │   └── security.py             # JWT + bcrypt (no passlib)
│       ├── db/
│       │   └── session.py              # Async engine, normalises DB URL
│       ├── models/
│       │   └── models.py               # ORM: User, Membership, Payment, MemberProfile, SiteSettings
│       ├── schemas/
│       │   └── schemas.py              # Pydantic request/response schemas
│       ├── services/
│       │   ├── user_service.py         # Registration, login, OTP
│       │   ├── membership_service.py   # Membership CRUD + auto-expire logic
│       │   └── payment_service.py      # Razorpay + idempotency
│       ├── api/v1/
│       │   ├── router.py
│       │   └── endpoints/
│       │       ├── auth.py             # /auth/* (register, login, OTP, profile, password)
│       │       ├── memberships.py      # /memberships/*
│       │       ├── payments.py         # /payments/*
│       │       ├── admin.py            # /admin/* (members, approvals, stats, delete)
│       │       └── settings.py         # /settings/* (site flags)
│       └── utils/
│           └── email.py                # Resend API helpers
│
├── frontend/
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── api/
│       │   └── index.js                # Axios client + all API methods
│       ├── store/
│       │   └── authStore.js            # Zustand: user, settings, token
│       ├── components/
│       │   └── layout/
│       │       ├── Navbar.jsx          # Conditional auth buttons
│       │       └── Footer.jsx
│       └── pages/
│           ├── HomePage.jsx
│           ├── RegisterPage.jsx        # 2-step form (account + personal info)
│           ├── LoginPage.jsx           # Password login (OTP tab disabled)
│           ├── DashboardPage.jsx       # Profile, membership, payments, Aadhar
│           ├── ForgotPasswordPage.jsx  # Email OTP → reset password
│           ├── AdminPage.jsx           # Members, Approvals, Inactive, Offline Payments
│           ├── EventsPage.jsx
│           └── StaticPages.jsx
│
├── docs/
│   └── hostinger-setup.md             # Full VPS setup guide
│
└── backend/scripts/
    ├── import_members.py              # Import from Excel
    ├── backfill_profiles.py           # Backfill MemberProfile rows
    ├── reset_passwords.py             # Set all passwords to phone number
    ├── assign_membership_ids.py       # Backfill membership_id column
    ├── migrate_to_render.py           # Local → Render PostgreSQL
    ├── migrate_to_hostinger.py        # Render/local → Hostinger PostgreSQL
    └── migrate_dev_to_prod.py         # Dev → Prod (same platform)
```

---

## Database Schema

### Users
| Column               | Type         | Notes                                     |
|----------------------|--------------|-------------------------------------------|
| id                   | UUID PK      |                                           |
| full_name            | VARCHAR(200) |                                           |
| email                | VARCHAR(255) | unique, indexed                           |
| phone                | VARCHAR(20)  |                                           |
| age                  | INTEGER      |                                           |
| gender               | VARCHAR(20)  |                                           |
| address              | VARCHAR(500) | nullable                                  |
| emergency_contact    | VARCHAR(200) | mandatory on registration                 |
| emergency_phone      | VARCHAR(20)  | mandatory on registration                 |
| emergency_contact_2  | VARCHAR(200) | nullable                                  |
| emergency_phone_2    | VARCHAR(20)  | nullable                                  |
| account_status       | VARCHAR(20)  | `pending_approval` → `approved` → `rejected` / `inactive` |
| t_shirt_size         | VARCHAR(10)  | nullable, set by admin                    |
| hashed_password      | VARCHAR(255) | bcrypt, nullable (OTP-only accounts)      |
| otp_secret           | VARCHAR(64)  | TOTP secret for OTP login / forgot-password |
| is_admin             | BOOLEAN      |                                           |

### Memberships
| Column        | Type        | Notes                               |
|---------------|-------------|-------------------------------------|
| id            | UUID PK     |                                     |
| user_id       | UUID FK     | → users (CASCADE)                   |
| membership_id | VARCHAR(20) | e.g. `202603TR01`, unique           |
| start_date    | DATE        | Apr 1 of membership year            |
| end_date      | DATE        | Mar 31 of following year            |
| status        | VARCHAR(20) | `pending` → `active` → `expired` → `pending` → user `inactive` |
| year          | INTEGER     | Financial year start (e.g. 2025 = Apr 2025–Mar 2026) |

**Membership lifecycle (auto-sync on admin fetch):**
1. `active` → `expired` when `end_date < today`
2. `expired` → `pending` after 31 May of the end year (grace period for renewal)
3. User `account_status` → `inactive` after 31 Aug of the end year (no active renewal)

### Payments
| Column               | Type         | Notes                        |
|----------------------|--------------|------------------------------|
| razorpay_order_id    | VARCHAR(100) | unique                       |
| razorpay_payment_id  | VARCHAR(100) | filled on success            |
| amount_paise         | INTEGER      | ₹2000 new = 200000           |
| status               | VARCHAR(20)  | `created` / `paid` / `failed`|
| idempotency_key      | VARCHAR(100) | `member:{user_id}:{year}`    |

### MemberProfile
Stores extended runner profile: `blood_group`, `photo_url` (base64, max 500KB), `aadhar_url` (base64, max 2MB), `profession`, `bio`, `strava_link`.

### SiteSettings
Key-value store for site flags:
- `show_login`, `show_register`, `show_join_club` — controlled from Admin → Settings tab

---

## Pricing

| Membership Type  | Amount     |
|------------------|------------|
| New member       | ₹2,000     |
| Annual renewal   | ₹1,500     |

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL running locally

### Backend
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env (see Environment Variables section below)
cp .env.example .env   # or create manually

uvicorn main:app --reload
# API:  http://localhost:8000
# Docs: http://localhost:8000/api/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
# API URL defaults to /api/v1 — proxied via vite.config.js to localhost:8000
```

### Environment Variables (backend `.env`)

```env
# Database
DATABASE_URL=postgresql+asyncpg://thiyagesh@localhost:5432/tirupur_runners

# JWT
SECRET_KEY=your-long-random-secret-here

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Pricing (in paise)
MEMBERSHIP_NEW_AMOUNT_PAISE=200000
MEMBERSHIP_RENEWAL_AMOUNT_PAISE=150000

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@tirupurrunners.com

# Admin
ADMIN_EMAIL=tirupurrunners@gmail.com
PROTECTED_ADMIN_EMAILS=thiyagesh.d@gmail.com

# Frontend URL (used in email links)
FRONTEND_URL=http://localhost:5173
```

> If `RESEND_API_KEY` is empty, emails are logged to console only (dev-safe).

---

## API Reference

### Auth (`/api/v1/auth`)
| Method | Path                  | Auth | Description                       |
|--------|-----------------------|------|-----------------------------------|
| POST   | /register             | —    | Register (creates pending_approval user) |
| POST   | /login                | —    | Password login → JWT              |
| POST   | /forgot-password      | —    | Send OTP to registered email      |
| POST   | /reset-password       | —    | Verify OTP + set new password     |
| POST   | /change-password      | JWT  | Change password (requires current)|
| GET    | /me                   | JWT  | Get current user                  |
| PUT    | /me                   | JWT  | Update profile fields             |
| GET    | /me/profile           | JWT  | Get runner profile                |
| PUT    | /me/profile           | JWT  | Update runner profile             |
| PUT    | /me/photo             | JWT  | Upload profile photo (base64)     |
| PUT    | /me/aadhar            | JWT  | Upload Aadhar (base64, max 2MB)   |

### Memberships (`/api/v1/memberships`)
| Method | Path       | Auth | Description                        |
|--------|------------|------|------------------------------------|
| GET    | /my        | JWT  | Get latest membership              |
| GET    | /my/active | JWT  | Get active membership              |

### Payments (`/api/v1/payments`)
| Method | Path     | Auth | Description                              |
|--------|----------|------|------------------------------------------|
| POST   | /order   | JWT  | Create Razorpay order (new or renewal)   |
| POST   | /verify  | JWT  | Verify payment + activate membership     |
| GET    | /my      | JWT  | Payment history                          |
| POST   | /webhook | —    | Razorpay webhook (HMAC-verified)         |

### Admin (`/api/v1/admin`) — requires `is_admin=true`
| Method | Path                              | Description                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | /members                          | List all members (with status filter)|
| GET    | /members/export                   | Download CSV                         |
| GET    | /stats                            | Dashboard counts                     |
| GET    | /users/pending                    | Users pending admin approval         |
| GET    | /users/inactive                   | Users with inactive account status   |
| PUT    | /users/{id}/approve               | Approve registration + send email    |
| PUT    | /users/{id}/reject                | Reject registration + send email     |
| DELETE | /users/{id}                       | Delete user (PROTECTED_ADMIN only)   |
| PUT    | /users/{id}/toggle-admin          | Grant/revoke admin                   |
| PUT    | /users/{id}/tshirt                | Set t-shirt size                     |
| PUT    | /users/{id}/aadhar                | Replace Aadhar (admin)               |
| PUT    | /memberships/{uuid}/membership-id | Set custom membership ID             |
| POST   | /offline-payments/upload          | Bulk activate via CSV upload         |

---

## Third-Party Service Setup

---

### Razorpay

1. Sign up at https://dashboard.razorpay.com
2. Complete KYC for the club (business / NGO)
3. **API Keys** → Settings → API Keys → Generate Key Pair
   - Test keys: `rzp_test_...` (use for dev)
   - Live keys: `rzp_live_...` (use for prod — requires KYC approval)
4. **Webhook** → Settings → Webhooks → Add New
   - URL: `https://tirupurrunners.com/api/v1/payments/webhook`
   - Events to subscribe: `payment.captured`, `payment.failed`
   - Copy Webhook Secret → set as `RAZORPAY_WEBHOOK_SECRET`
5. Set env vars:
   ```
   RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=...
   ```

> For dev VPS, use test keys. For prod VPS, use live keys.

---

### Resend (Email)

Resend is used for all transactional emails (OTP, approval, rejection, membership confirmation).
Render free tier blocks all SMTP ports — Resend works over HTTPS (port 443).

**Free tier: 3,000 emails/month, 100/day**

#### Setup Steps

1. Sign up at https://resend.com
2. Go to **Domains** → Add Domain → enter `tirupurrunners.com`
3. Resend will show DNS records to add. Add them in **GoDaddy** (see DNS section below):
   - **SPF** — TXT record on `@` (or merge with existing SPF)
   - **DKIM** — TXT record (e.g. `resend._domainkey.tirupurrunners.com`)
   - **DMARC** — TXT record on `_dmarc.tirupurrunners.com` (optional but recommended)
4. Click **Verify** in Resend dashboard — takes a few minutes after DNS propagates
5. Go to **API Keys** → Create API Key (full access)
6. Set env var: `RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx`
7. All emails are sent as `noreply@tirupurrunners.com`

> Resend domain verification is required once. After that, all environments (dev, prod) can use the same API key or separate keys.

---

### Gmail (Reference Only)

- Gmail account: `tirupurrunners@gmail.com`
- Gmail SMTP is **not used** for transactional email — Render and most cloud hosts block outbound SMTP ports (25, 465, 587)
- Gmail credentials (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) are kept in config for future use or local SMTP testing
- All production email goes through Resend

---

## Deployment

### Current Architecture

```
GitHub (main branch)
    ↓ push
GitHub Actions
    ↓ SSH
Hostinger KVM2 VPS (India, prod)
    ├── Nginx (port 80/443)
    │   ├── /            → /var/www/tirupur-runners   (React build)
    │   └── /api/        → proxy → uvicorn :8000
    └── uvicorn (systemd) → FastAPI backend
         └── PostgreSQL (local, port 5432)
```

---

### Option A: Hostinger VPS (Current / New Setup)

See full guide: `docs/hostinger-setup.md`

**GitHub Actions Secrets required:**

| Secret                  | Value                                  |
|-------------------------|----------------------------------------|
| `HOSTINGER_DEV_HOST`    | Dev VPS IP                             |
| `HOSTINGER_DEV_USER`    | SSH username (e.g. `deploy`)           |
| `HOSTINGER_DEV_SSH_KEY` | Private SSH key content for dev VPS    |
| `HOSTINGER_PROD_HOST`   | Prod VPS IP                            |
| `HOSTINGER_PROD_USER`   | SSH username                           |
| `HOSTINGER_PROD_SSH_KEY`| Private SSH key content for prod VPS   |

**Workflow:**
- Push to `dev` → `.github/workflows/deploy-hostinger-dev.yml` → deploys to dev VPS
- Push to `main` → `.github/workflows/deploy-hostinger-prod.yml` → deploys to prod VPS

**DNS — GoDaddy (for Hostinger):**

| Type  | Name  | Value            | TTL  |
|-------|-------|------------------|------|
| A     | @     | `<PROD_VPS_IP>`  | 600  |
| A     | www   | `<PROD_VPS_IP>`  | 600  |
| A     | dev   | `<DEV_VPS_IP>`   | 600  |

Steps in GoDaddy:
1. Log in → My Products → DNS → tirupurrunners.com
2. Delete any existing A records for `@`, `www`, `dev`
3. Add the A records above
4. Wait 5–30 minutes for propagation
5. After DNS is live, run Certbot on VPS: `sudo certbot --nginx -d tirupurrunners.com -d www.tirupurrunners.com`

---

### Option B: Render (Legacy / Old Setup)

Render was used before migrating to Hostinger. Blueprint files are kept for reference.

- `render.yaml` — prod Blueprint (backend: `tirupur-runners-api`, frontend: `tirupur-runners-web`)
- `render-dev.yaml` — dev Blueprint (services: `tirupur-runners-api-dev`, `tirupur-runners-web-dev`)

**GitHub Actions Secrets for Render:**

| Secret                         | Value                      |
|--------------------------------|----------------------------|
| `RENDER_BACKEND_DEPLOY_HOOK_PROD`  | Render deploy hook URL |
| `RENDER_FRONTEND_DEPLOY_HOOK_PROD` | Render deploy hook URL |
| `RENDER_BACKEND_DEPLOY_HOOK_DEV`   | Render deploy hook URL |
| `RENDER_FRONTEND_DEPLOY_HOOK_DEV`  | Render deploy hook URL |

**DNS — GoDaddy (for Render):**

Render provides a CNAME target for custom domains (shown in Dashboard → Custom Domain).

| Type  | Name  | Value                                    | TTL  |
|-------|-------|------------------------------------------|------|
| CNAME | www   | `tirupur-runners-web.onrender.com`       | 600  |
| CNAME | dev   | `tirupur-runners-web-dev.onrender.com`   | 600  |

> Render does not support root (`@`) CNAME. Use a DNS flattening provider or point `@` via an A record to Render's IP (use `ping tirupur-runners-web.onrender.com` to get it — note: not stable, may change).

Steps:
1. Render dashboard → your web service → Settings → Custom Domains → Add
2. Enter `tirupurrunners.com` and `www.tirupurrunners.com`
3. Add the CNAME records in GoDaddy as shown above
4. Render auto-provisions SSL via Let's Encrypt once DNS verifies

**Render Environment Variables** (set manually in dashboard — not synced from yaml):

```
DATABASE_URL         (internal Render PostgreSQL URL)
SECRET_KEY
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
RESEND_API_KEY
FROM_EMAIL           noreply@tirupurrunners.com
FRONTEND_URL         https://tirupurrunners.com
ADMIN_EMAIL          tirupurrunners@gmail.com
PROTECTED_ADMIN_EMAILS  thiyagesh.d@gmail.com
```

---

## Data Migration

### Render → Hostinger (or any PostgreSQL)

```bash
cd backend

# Dry run first (no data written)
SOURCE_DB_URL="postgresql://user:pass@dpg-xxx.render.com/tirupur_runners?ssl=require" \
TARGET_DB_URL="postgresql://tirupur_runners:pass@<VPS_IP>:5432/tirupur_runners" \
python scripts/migrate_to_hostinger.py --dry-run

# Live migration
SOURCE_DB_URL="..." TARGET_DB_URL="..." \
python scripts/migrate_to_hostinger.py
```

Copies: `users`, `memberships`, `member_profiles`, `site_settings`
Skips: `payments` (Razorpay data stays on Razorpay dashboard)
Creates: All tables including `payments` (empty — new payments will fill it)
Idempotent: Safe to re-run — duplicate rows are skipped via `ON CONFLICT DO NOTHING`

---

## First Admin User

After deployment and migration, grant admin access via SQL:

```sql
UPDATE users SET is_admin = true WHERE email = 'thiyagesh.d@gmail.com';
```

Or using psql on the VPS:
```bash
sudo -u postgres psql -d tirupur_runners -c "UPDATE users SET is_admin = true WHERE email = 'thiyagesh.d@gmail.com';"
```

---

## Payment Flow

```
User clicks "Pay ₹2,000"
    ↓
POST /payments/order
    → check idempotency_key (member:{user_id}:{year})
    → if paid: return 409 (already paid)
    → if pending: return existing order (retry)
    → if new: create Membership(pending) + Razorpay order + Payment(created)

Razorpay checkout opens in browser
    ↓ success
POST /payments/verify  (client-side HMAC check)
    → verify razorpay_signature
    → mark Payment(paid)
    → activate Membership(active) + assign membership_id (e.g. 202603TR01)
    → send confirmation email

POST /payments/webhook  (server-side fallback — runs even if client closed browser)
    → same idempotent activation
```

---

## Security

- JWT (24h expiry), bcrypt password hashing (no passlib — raw bcrypt 4.1.3)
- HMAC signature verification on all Razorpay webhooks
- Idempotency keys prevent duplicate payments
- CORS restricted to frontend domain
- Pydantic validation on all inputs
- Admin routes gated by `is_admin=true`
- User delete gated by `PROTECTED_ADMIN_EMAILS` (backend 403 + frontend hidden)
- OTP: 6-digit TOTP, 5-minute window, strict expiry (`valid_window=0`)

---

## Cost Summary

| Service         | Plan                       | Cost          |
|-----------------|----------------------------|---------------|
| Hostinger KVM2  | 2 vCPU, 8GB RAM, 100GB NVMe| ~₹649/month   |
| Hostinger KVM2  | Dev VPS (same plan)        | ~₹649/month   |
| Razorpay        | 2% per transaction         | ~₹40 per ₹2000 txn |
| Resend          | Free tier (3,000 emails/mo)| ₹0/month      |
| GoDaddy domain  | tirupurrunners.com renewal | ~₹800/year    |

**Total: ~₹1,300–1,400/month** (two VPS + payment fees)
