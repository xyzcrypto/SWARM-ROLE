# XYZ Crypto — Web3 Website

> **Built for the Next Generation of Web3**

A professional, animated crypto website for **XYZ Crypto**, with a research/content
publishing system, user accounts (email + Google), and an admin dashboard to track
signups and publish Web3 research, articles & posts.

![XYZ Crypto](public/logo.jpg)

---

## ✨ Features

- **Animated, premium UI/UX** — gold-on-black brand theme, motion (Framer Motion),
  gradient text, rotating logo medallion, scroll reveals, hover effects.
- **Full landing page** — Hero, About, Products roadmap (Perp DEX, Trading Tools,
  Airdrop Tools, Premium, Web3 Academy & more), Research preview, Ecosystem,
  Community/Social, CTA, Footer.
- **Authentication** — sign up / log in with **email + password** or **Google (Gmail)**.
- **Signup analytics** — admin dashboard shows total signups, weekly growth, login
  method breakdown, full member list, and **CSV export**.
- **Content/“working” section** — publish **Web3 Research, Articles & Posts** from the
  dashboard (Markdown supported). They appear instantly on the Research hub + home page.
- **Social section** — YouTube, X, Telegram, LinkedIn — clickable with brand icons.
- **Ecosystem** — Web3 Academy & TradeKaroVerse community cards (Telegram links).
- **SEO ready** — metadata, Open Graph, Twitter cards, favicon from the logo.

---

## 🧱 Tech stack

| Layer     | Tech |
|-----------|------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling   | Tailwind CSS |
| Animation | Framer Motion |
| Auth      | NextAuth (Auth.js) — Google + Credentials |
| Database  | Prisma ORM — SQLite (dev) / Postgres (prod) |

---

## 🚀 Getting started (local)

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env
#    then edit .env (a working dev default is already provided)

# 3. Create the database
npm run db:push

# 4. (Optional) Seed sample research + an admin user
npm run seed

# 5. Run the dev server
npm run dev
```

Open <http://localhost:3000>.

**Seeded admin login:** `niralekhan321@gmail.com` / `changeme123`
(change this immediately — see Admin access below).

---

## 🔐 Admin access (publish content + view signups)

The **admin** unlocks the `/dashboard` (Publish / Content / Members tabs).

- Set `ADMIN_EMAIL` in `.env` to your email.
- Any account created with that email (via email **or** Google) is automatically an admin.
- Visit `/dashboard` while logged in as that user.

The dashboard lets you:
- **Overview** — total signups, new this week, Google vs email, content count.
- **Publish** — upload Research / Article / Post (Markdown supported).
- **Content** — view & delete published posts.
- **Members** — see everyone who signed up and **export to CSV**.

---

## 🔑 Enable Google (Gmail) login — optional

1. Go to <https://console.cloud.google.com/apis/credentials>.
2. Create an **OAuth client ID** (type: Web application).
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   (and `https://YOUR_DOMAIN/api/auth/callback/google` for production).
4. Put the values in `.env`:
   ```
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   ```

If left empty, the site still works fully with email/password sign-up.

---

## ☁️ Deploy to production (Vercel + Postgres)

SQLite is great for local dev but does not persist on serverless hosts. For
production use a hosted Postgres (Vercel Postgres, Neon, or Supabase):

1. In `prisma/schema.prisma`, change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Set these environment variables on Vercel:
   - `DATABASE_URL` — your Postgres connection string
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your deployed URL (e.g. `https://xyzcrypto.com`)
   - `ADMIN_EMAIL` — your admin email
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional
3. Run the migration once: `npx prisma db push`
4. Deploy. The build runs `prisma generate` automatically.

---

## 🖼️ Swapping logos & images

- **Main XYZ Crypto logo:** `public/logo.jpg` (already added).
- **Web3 Academy logo:** add `public/web3-academy.jpg`.
- **TradeKaroVerse logo:** add `public/tradekaroverse.jpg`.

The Ecosystem section auto-detects these files; until they exist it shows a
branded initials avatar as a fallback. No code change needed.

---

## 🔗 Links configured

- YouTube — <https://youtube.com/@xyzcrypto>
- X — <https://x.com/XYZCryptos>
- Telegram — <https://t.me/X_Y_Z_Crypto>
- LinkedIn — <https://www.linkedin.com/company/xyzcrypto/>
- Web3 Academy — <https://t.me/X_Y_Z_Web3>
- TradeKaroVerse — <https://t.me/TradeKaro_Verse>

Edit them anytime in `src/lib/site.ts`.

---

## 📜 Scripts

| Command            | Description |
|--------------------|-------------|
| `npm run dev`      | Start dev server |
| `npm run build`    | Production build |
| `npm run start`    | Start production server |
| `npm run db:push`  | Sync schema to the database |
| `npm run db:studio`| Open Prisma Studio (visual DB) |
| `npm run seed`     | Seed sample posts + admin user |

---

Built for the Next Generation of Web3 · **v1.0** — more products land in the next update.
