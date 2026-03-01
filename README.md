# VibeGrid Marketplace

A production-ready full-stack Next.js 14 App Router crypto trading, investment, and marketplace platform.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (custom dark fintech theme)
- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **Charts**: Chart.js + react-chartjs-2
- **Payments**: Razorpay (structure ready, keys via env vars)
- **Icons**: Custom inline SVG components

---

## 🚀 How to Run

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.local.example .env.local
```
Then fill in your values (see below).

### 3. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Build for production
```bash
npm run build
npm start
```

---

## 📁 Folder Structure

```
/app
  /auth
    /login          → Email + Google login page
    /signup         → 2-step role-selection signup
    /callback       → OAuth callback handler (Google)
  /dashboard
    /layout.tsx     → Dashboard shell (sidebar + navbar)
    /page.tsx       → Role-based redirect
    /investor       → Investor dashboard + charts
    /seller         → Seller dashboard + product management
    /trader         → Trader dashboard + crypto market table
    /wallet         → Wallet management + Razorpay AddFunds
    /settings       → Account settings
  /api
    /razorpay
      /create-order → Creates Razorpay payment order (server-side)
      /webhook      → Handles Razorpay webhook + wallet update

/components
  Sidebar.tsx       → Role-aware left navigation
  Navbar.tsx        → Top bar with wallet balance + signout
  StatCard.tsx      → KPI metric card
  Charts.tsx        → Line/Bar/Doughnut Chart.js wrappers
  Modal.tsx         → Accessible modal dialog

/lib
  supabaseClient.ts → Browser-side Supabase client
  supabaseServer.ts → Server-side Supabase client (SSR)

/types
  index.ts          → All TypeScript interfaces (mirrors DB schema)

/utils
  auth.ts           → Auth helpers (signIn, signUp, Google OAuth, signOut)
  formatters.ts     → Currency, date, number formatters
  cn.ts             → Class name utility

middleware.ts       → Auth protection + session refresh
```

---

## 🔑 Environment Variables

| Variable | Where to get it | Where used |
|----------|----------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Webhook only |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Dashboard → API Keys | Frontend checkout |
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → API Keys | create-order route |
| `RAZORPAY_SECRET` | Razorpay Dashboard → API Keys | webhook verification |
| `NEXT_PUBLIC_SITE_URL` | Your deployment URL | OAuth redirect |

---

## 🔐 Supabase Setup

### 1. Where to paste Supabase keys
→ `.env.local` file (copy from `.env.local.example`)

### 2. Required tables
Create these tables in Supabase SQL Editor:

```sql
-- profiles: user metadata + role + wallet
create table profiles (
  id uuid primary key references auth.users(id),
  username text not null,
  role text not null check (role in ('investor', 'seller', 'trader')),
  wallet_balance_usd numeric default 0,
  created_at timestamptz default now()
);

-- crypto_asset: tradable crypto assets
create table crypto_asset (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  name text not null,
  current_price_usd numeric not null,
  market_cap numeric,
  volume_24h numeric,
  created_at timestamptz default now()
);

-- portfolio: user crypto holdings
create table portfolio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  crypto_id uuid references crypto_asset(id),
  quantity numeric not null,
  average_buy_price numeric not null,
  created_at timestamptz default now()
);

-- trades: buy/sell transaction log
create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  crypto_id uuid references crypto_asset(id),
  trade_type text check (trade_type in ('buy', 'sell')),
  quantity numeric not null,
  price_at_trade numeric not null,
  total_value numeric not null,
  created_at timestamptz default now()
);

-- wallet_transaction: all wallet movements
create table wallet_transaction (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  type text check (type in ('credit', 'debit')),
  amount_usd numeric not null,
  crypto_symbol text,
  created_at timestamptz default now()
);

-- projects: investment opportunities
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  expected_roi numeric,
  risk_level text check (risk_level in ('low', 'medium', 'high')),
  duration_days integer,
  funding_goal numeric,
  funded_amount numeric default 0,
  created_at timestamptz default now()
);

-- investments: user → project links
create table investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  project_id uuid references projects(id),
  amount numeric not null,
  created_at timestamptz default now()
);

-- products: seller marketplace listings
create table products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references profiles(id),
  title text not null,
  description text,
  price_usd numeric not null,
  quantity integer not null,
  created_at timestamptz default now()
);

-- orders: product purchases
create table orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references profiles(id),
  product_id uuid references products(id),
  quantity integer not null,
  total_amount numeric not null,
  created_at timestamptz default now()
);
```

### 3. Enable Row Level Security (RLS)
Enable RLS on all tables and add policies so users can only read/write their own data.

### 4. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs → Credentials
2. Create OAuth 2.0 Client ID
3. Add `http://localhost:3000/auth/callback` to Authorized Redirect URIs
4. In Supabase Dashboard → Authentication → Providers → Google → paste Client ID & Secret

---

## 💳 Razorpay Setup

### Where to paste Razorpay keys
→ `.env.local` file

### Flow
1. User clicks "Add Funds" → `/api/razorpay/create-order` creates order
2. Razorpay checkout opens in browser
3. User completes payment
4. Razorpay fires webhook to `/api/razorpay/webhook`
5. Webhook verifies HMAC signature → updates `wallet_balance_usd`

### Webhook URL (for Razorpay Dashboard)
```
https://your-domain.com/api/razorpay/webhook
```

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| Background | `#1E1E1E` |
| Card | `#2C2C2C` |
| Accent Green | `#3FAF7F` |
| Accent Blue | `#4A90E2` |
| Border | `#3A3A3A` |
| Border Radius | `16px` |

---

## 🔒 Security Notes

- Wallet balance is **never** modified from the frontend
- Razorpay `RAZORPAY_SECRET` is **only** used in the webhook route (server-side)
- Supabase `SUPABASE_SERVICE_ROLE_KEY` is **only** used in the webhook route
- All routes protected by middleware + Supabase RLS
- OAuth token exchange happens server-side in `/auth/callback/route.ts`
