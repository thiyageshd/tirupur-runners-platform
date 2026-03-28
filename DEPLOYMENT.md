# Tirupur Runners Club — Deployment Guide

## Architecture Summary
| Layer      | Service       | Cost         |
|------------|---------------|--------------|
| Frontend   | Vercel        | Free         |
| Backend    | Render        | Free (spins down) / $7/mo (always-on) |
| Database   | Neon.tech     | Free (0.5GB) |
| Payments   | Razorpay      | 2% per txn   |
| Email      | SendGrid      | Free (100/day)|

---

## Step 1 — Database (Neon.tech)

1. Go to https://neon.tech and sign up (free)
2. Create a new project: `tirupur-runners`
3. Copy the **Connection string** — looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. For FastAPI's asyncpg driver, change `postgresql://` to `postgresql+asyncpg://`

Your final DATABASE_URL:
```
postgresql+asyncpg://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb
```

---

## Step 2 — Razorpay Setup

1. Go to https://dashboard.razorpay.com and sign up
2. Complete KYC for your club (use club registration docs)
3. Go to Settings → API Keys → Generate Key
4. Note down: `Key ID` (rzp_live_xxx) and `Key Secret`
5. Set up Webhooks:
   - URL: `https://your-api.onrender.com/api/v1/payments/webhook`
   - Events: `payment.captured`, `payment.failed`
   - Copy the Webhook Secret

For testing, use `rzp_test_xxx` keys — no real money charged.

---

## Step 3 — Backend on Render

1. Push your backend code to GitHub:
   ```bash
   cd tirupur-runners/backend
   git init && git add . && git commit -m "Initial backend"
   git remote add origin https://github.com/YOUR_USERNAME/tirupur-runners-api
   git push -u origin main
   ```

2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

5. Add Environment Variables (in Render dashboard):
   ```
   DATABASE_URL=postgresql+asyncpg://...your neon url...
   SECRET_KEY=<run: python -c "import secrets; print(secrets.token_hex(32))">
   RAZORPAY_KEY_ID=rzp_live_xxx
   RAZORPAY_KEY_SECRET=your_secret
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   MEMBERSHIP_AMOUNT_PAISE=50000
   DEBUG=False
   FRONTEND_URL=https://tirupurrunners.vercel.app
   ```

6. Deploy — Render will give you a URL like `https://tirupur-runners-api.onrender.com`

7. Visit `https://tirupur-runners-api.onrender.com/health` — should return `{"status":"ok"}`

> Note: Free tier sleeps after 15min inactivity. Upgrade to $7/mo Starter for always-on.

---

## Step 4 — Frontend on Vercel

1. Push frontend code to GitHub:
   ```bash
   cd tirupur-runners/frontend
   git init && git add . && git commit -m "Initial frontend"
   git remote add origin https://github.com/YOUR_USERNAME/tirupur-runners-frontend
   git push -u origin main
   ```

2. Go to https://vercel.com → New Project → Import your repo
3. Framework: **Vite**
4. Add Environment Variable:
   ```
   VITE_API_URL=https://tirupur-runners-api.onrender.com/api/v1
   ```
5. Deploy — Vercel gives you `https://tirupurrunners.vercel.app`

6. Update your backend's `FRONTEND_URL` on Render to match.

---

## Step 5 — Create Admin User

After first deploy, run this against your Neon DB using the Neon SQL editor:

```sql
-- First, register via the app normally, then promote to admin:
UPDATE users SET is_admin = true WHERE email = 'admin@tirupurrunners.com';
```

Or use Neon's web SQL editor directly at https://console.neon.tech

---

## Step 6 — Custom Domain (Optional)

**Vercel**: Go to Project → Settings → Domains → Add `tirupurrunners.com`
Then update your DNS at your domain registrar:
```
CNAME www → cname.vercel-dns.com
A     @   → 76.76.21.21
```

---

## Step 7 — Email (SendGrid — Optional but Recommended)

1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Create an API Key with "Mail Send" permission
3. Verify your sender domain/email
4. Add to Render env vars:
   ```
   SENDGRID_API_KEY=SG.xxxxxxxxxxxx
   FROM_EMAIL=noreply@tirupurrunners.com
   ```

---

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # fill in values
uvicorn main:app --reload
# API docs: http://localhost:8000/api/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

---

## Database Migrations (Alembic)

For production schema changes — don't rely on auto-create:

```bash
cd backend
alembic init alembic
# Edit alembic/env.py to point to your models + DATABASE_URL
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

---

## Monitoring (Free Options)

- **Render logs**: Built-in log streaming in dashboard
- **Uptime**: https://uptimerobot.com (free, pings your /health endpoint)
- **DB**: Neon dashboard shows query stats

---

## Cost Summary (Monthly)

| Service   | Free Tier               | Paid (recommended)      |
|-----------|-------------------------|-------------------------|
| Render    | Free (sleeps)           | $7/mo (always-on)       |
| Neon      | 0.5GB free              | $19/mo (10GB)           |
| Vercel    | Free forever            | —                       |
| SendGrid  | 100 emails/day free     | $20/mo (50k emails)     |
| Razorpay  | 2% per transaction      | —                       |

**Minimum viable cost: ₹0/month** (free tiers)
**Recommended: ~$7/month** (Render always-on = ~₹600/month)
