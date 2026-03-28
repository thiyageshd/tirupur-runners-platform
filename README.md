# Tirupur Runners Club — Full Stack Registration Platform

## Stack Summary
| Layer      | Technology           | Hosting            | Cost       |
|------------|---------------------|--------------------|------------|
| Frontend   | React + Vite         | Vercel             | Free       |
| Backend    | FastAPI (Python)     | Render             | Free tier  |
| Database   | PostgreSQL           | Neon.tech          | Free tier  |
| Payments   | Razorpay             | SaaS               | % per txn  |
| Email      | SendGrid             | SaaS               | Free tier  |

---

## Project Structure

```
tirupur-runners/
├── backend/
│   ├── main.py                         # FastAPI app entrypoint
│   ├── requirements.txt
│   ├── render.yaml                     # Render deployment config
│   ├── .env.example                    # Copy to .env
│   └── app/
│       ├── core/
│       │   ├── config.py               # Pydantic settings
│       │   └── security.py             # JWT, password hashing
│       ├── db/
│       │   └── session.py              # Async SQLAlchemy engine
│       ├── models/
│       │   └── models.py               # ORM: User, Membership, Payment
│       ├── schemas/
│       │   └── schemas.py              # Pydantic request/response models
│       ├── services/
│       │   ├── user_service.py         # Auth + user business logic
│       │   ├── membership_service.py   # Membership CRUD + status sync
│       │   └── payment_service.py      # Razorpay + idempotency
│       ├── api/v1/
│       │   ├── router.py               # Combines all routers
│       │   └── endpoints/
│       │       ├── auth.py             # /auth/* routes
│       │       ├── memberships.py      # /memberships/* routes
│       │       ├── payments.py         # /payments/* routes
│       │       └── admin.py            # /admin/* routes
│       └── utils/
│           └── email.py               # SendGrid helpers
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── vercel.json
    └── src/
        ├── main.jsx
        ├── App.jsx                     # Routes + ProtectedRoute
        ├── index.css                   # Tailwind + custom classes
        ├── api/
        │   └── index.js               # Axios client + API methods
        ├── store/
        │   └── authStore.js           # Zustand auth state
        ├── components/
        │   ├── layout/
        │   │   ├── Navbar.jsx
        │   │   └── Footer.jsx
        │   └── ui/
        │       ├── FormField.jsx
        │       └── MembershipBadge.jsx
        └── pages/
            ├── HomePage.jsx
            ├── RegisterPage.jsx        # 3-step form + Razorpay
            ├── LoginPage.jsx           # Password + OTP tabs
            ├── DashboardPage.jsx       # Membership status + renew
            ├── AdminPage.jsx           # Member table + CSV + stats
            ├── EventsPage.jsx
            └── StaticPages.jsx         # About + Contact
```

---

## API Reference

### Auth
| Method | Path                  | Auth | Description          |
|--------|-----------------------|------|----------------------|
| POST   | /api/v1/auth/register | -    | Register new user    |
| POST   | /api/v1/auth/login    | -    | Password login       |
| POST   | /api/v1/auth/otp/request | - | Send OTP to email    |
| POST   | /api/v1/auth/otp/verify  | - | Verify OTP → token   |
| GET    | /api/v1/auth/me       | JWT  | Get current user     |

### Memberships
| Method | Path                        | Auth  | Description            |
|--------|-----------------------------|-------|------------------------|
| GET    | /api/v1/memberships/my      | JWT   | Get latest membership  |
| GET    | /api/v1/memberships/my/active | JWT | Get active membership  |

### Payments
| Method | Path                   | Auth  | Description                    |
|--------|------------------------|-------|--------------------------------|
| POST   | /api/v1/payments/order | JWT   | Create Razorpay order          |
| POST   | /api/v1/payments/verify| JWT   | Verify payment + activate      |
| POST   | /api/v1/payments/webhook | -   | Razorpay webhook handler       |

### Admin (requires is_admin=true)
| Method | Path                       | Auth        | Description        |
|--------|----------------------------|-------------|--------------------|
| GET    | /api/v1/admin/members      | Admin JWT   | List all members   |
| GET    | /api/v1/admin/members/export | Admin JWT | Download CSV       |
| GET    | /api/v1/admin/stats        | Admin JWT   | Dashboard stats    |

---

## Deployment Guide — Step by Step

### Step 1: Set up PostgreSQL (Neon.tech — Free)

1. Go to https://neon.tech and create a free account
2. Create a new project: `tirupur-runners`
3. Copy the **connection string** — it looks like:
   ```
   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. For FastAPI (asyncpg), change `postgresql://` → `postgresql+asyncpg://`

### Step 2: Deploy Backend on Render (Free)

1. Push backend folder to a GitHub repo
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo, set root directory to `backend/`
4. Configure:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Python version:** 3.11
5. Add Environment Variables:
   ```
   DATABASE_URL     = postgresql+asyncpg://...  (from Neon)
   SECRET_KEY       = (generate: python -c "import secrets; print(secrets.token_hex(32))")
   RAZORPAY_KEY_ID  = rzp_live_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET = your_secret
   MEMBERSHIP_AMOUNT_PAISE = 50000
   DEBUG            = False
   FRONTEND_URL     = https://your-app.vercel.app
   ```
6. Deploy. Your API will be at: `https://tirupur-runners-api.onrender.com`

> ⚠️ Render free tier spins down after 15 min inactivity. Upgrade to $7/mo Starter for always-on.

### Step 3: Deploy Frontend on Vercel (Free)

1. Push frontend folder to GitHub
2. Go to https://vercel.com → New Project → Import repo
3. Set root directory to `frontend/`
4. Add Environment Variable:
   ```
   VITE_API_URL = https://tirupur-runners-api.onrender.com/api/v1
   ```
5. Deploy. Vercel auto-detects Vite. Your site: `https://tirupur-runners.vercel.app`
6. Add your custom domain `tirupurrunners.com` in Vercel DNS settings

### Step 4: Configure Razorpay

1. Go to https://dashboard.razorpay.com
2. Create account, complete KYC for Tirupur Runners Club
3. Get API Keys from Settings → API Keys
4. Set up Webhook:
   - URL: `https://tirupur-runners-api.onrender.com/api/v1/payments/webhook`
   - Events: `payment.captured`, `payment.failed`
   - Copy Webhook Secret → add as `RAZORPAY_WEBHOOK_SECRET` env var
5. Test with test keys first (rzp_test_*) before going live

### Step 5: Create First Admin User

After deployment, run this in your Neon SQL console:

```sql
UPDATE users
SET is_admin = true
WHERE email = 'your-admin@email.com';
```

Or add this to a one-time script:
```python
# scripts/make_admin.py
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.models import User
from sqlalchemy import update

async def make_admin(email: str):
    async with AsyncSessionLocal() as db:
        await db.execute(update(User).where(User.email == email).values(is_admin=True))
        await db.commit()
        print(f"Done: {email} is now admin")

asyncio.run(make_admin("admin@tirupurrunners.com"))
```

### Step 6: Set Up Email (Optional but Recommended)

1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Verify your sender domain (`tirupurrunners.com`)
3. Create API Key → add as `SENDGRID_API_KEY` in Render
4. Without this, OTPs are logged to console only

---

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Edit with your values
uvicorn main:app --reload
# API: http://localhost:8000
# Docs: http://localhost:8000/api/docs  (DEBUG=True only)
```

### Frontend
```bash
cd frontend
npm install
# Create .env.local:
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local
npm run dev
# App: http://localhost:5173
```

---

## Idempotency Design

The payment system uses an `idempotency_key` (`member:{user_id}:{year}`) to prevent:
- Duplicate memberships for the same year
- Double-charging on payment retries
- Webhook replay attacks

Flow:
```
POST /payments/order
  → check idempotency_key exists?
     → if paid: return 409
     → if pending: return existing order (user retries payment)
     → if new: create Membership(pending) + Razorpay order + Payment record

POST /payments/verify  (client-side)
  → verify HMAC signature
  → mark payment paid (idempotent — skip if already paid)
  → activate membership

POST /payments/webhook  (server-side fallback)
  → same idempotent activation
  → handles cases where client didn't call /verify
```

---

## Optional Enhancements

### WhatsApp Alerts (via Twilio)
```python
# app/utils/whatsapp.py
from twilio.rest import Client
def send_whatsapp(to: str, message: str):
    client = Client(TWILIO_SID, TWILIO_TOKEN)
    client.messages.create(
        from_='whatsapp:+14155238886',
        to=f'whatsapp:{to}',
        body=message
    )
```

### QR-Based Membership Validation
```python
# Generate QR on payment success
import qrcode, base64, io
def generate_member_qr(user_id: str, membership_id: str) -> str:
    data = f"https://tirupurrunners.com/verify/{user_id}/{membership_id}"
    img = qrcode.make(data)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()
```

### Renewal Reminders (Cron on Render)
```yaml
# Add to render.yaml
  - type: cron
    name: renewal-reminders
    schedule: "0 8 * * 1"  # Every Monday 8am
    buildCommand: pip install -r requirements.txt
    startCommand: python -m app.jobs.send_renewal_reminders
```

---

## Cost Summary (Monthly)

| Service        | Free Tier Limit            | Paid Option         |
|----------------|---------------------------|---------------------|
| Vercel         | Unlimited (hobby)          | $20/mo pro          |
| Render         | 750h/mo (1 service free)   | $7/mo starter       |
| Neon           | 0.5 GB, 10h compute/mo     | $19/mo launch       |
| SendGrid       | 100 emails/day             | $19.95/mo essentials|
| Razorpay       | 2% per transaction         | Negotiable at volume|

**Total for a club with ~500 members: ₹0–₹600/month** (mostly free tier)

---

## Security Checklist

- [x] JWT with expiry (24h)
- [x] Bcrypt password hashing
- [x] HMAC signature verification on payment
- [x] Idempotency keys on payments
- [x] Webhook signature validation
- [x] CORS restricted to frontend domain
- [x] Pydantic input validation on all endpoints
- [x] Admin-only routes guarded separately
- [ ] Rate limiting (add slowapi if needed)
- [ ] HTTPS enforced (automatic via Render + Vercel)
