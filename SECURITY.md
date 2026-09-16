# XYZ Crypto — Security & Session Revocation Hardening

This document records the security vulnerability mitigations, defensive hardening measures, and performance optimizations delivered in this release (`session-revocation-and-ratelimits`).

---

## 📑 Table of Contents
1. [Stateless JWT & Per-Device Session Revocation](#1-stateless-jwt--per-device-session-revocation)
   - [1.1 Per-Device Session Identifiers (`sid`)](#11-per-device-session-identifiers-sid)
   - [1.2 Resilience to Transient DB Write Failures](#12-resilience-to-transient-db-write-failures)
   - [1.3 Session Expiration Enforcement & Opportunistic Cleanup](#13-session-expiration-enforcement--opportunistic-cleanup)
   - [1.4 Global Revocation on Password Change](#14-global-revocation-on-password-change)
2. [Database Error Sanitization & Trace IDs](#2-database-error-sanitization--trace-ids)
   - [2.1 Database Password Error Leak Sanitization](#21-database-password-error-leak-sanitization)
   - [2.2 Error Response Correlation `traceId`](#22-error-response-correlation-traceid)
3. [Balanced Rate Limiting (CGNAT & Abuse Prevention)](#3-balanced-rate-limiting-cgnat--abuse-prevention)
   - [3.1 Account Login Protection](#31-account-login-protection)
   - [3.2 CGNAT-Safe IP Login Guard](#32-cgnat-safe-ip-login-guard)
   - [3.3 Multi-Step Password Reset Limiter](#33-multi-step-password-reset-limiter)
   - [3.4 Email OTP Inbox Flooding Protection](#34-email-otp-inbox-flooding-protection)
4. [Atomic OTP Verification & Index Hygiene](#4-atomic-otp-verification--index-hygiene)
   - [4.1 Atomic Issuance Scoped to User](#41-atomic-issuance-scoped-to-user)
   - [4.2 Index Optimization on `VerificationCode.expiresAt`](#42-index-optimization-on-verificationcodeexpiresat)
   - [4.3 Dedicated Expiry Purge Function](#43-dedicated-expiry-purge-function)
5. [Automated Test Verification](#5-automated-test-verification)

---

## 1. Stateless JWT & Per-Device Session Revocation

* **Files:** `src/core/auth/auth.ts`, `src/app/api/auth/password/reset/route.ts`, `src/app/api/profile/password/route.ts`, `prisma/schema.prisma`

### 1.1 Per-Device Session Identifiers (`sid`)
* **Problem:** NextAuth's stateless JWT strategy does not invalidate tokens server-side upon logout. An earlier workaround bumped `User.passwordChangedAt` during `signOut`, which broke the invariant that `passwordChangedAt` is written only upon password reset or change, and caused single-device logouts (e.g. phone) to silently and randomly sign out all other devices (laptop, tablet).
* **Mitigation:**
  1. Each login generates a unique session identifier (`sid`) stored in Prisma's `Session` table and encoded into the NextAuth JWT.
  2. Signing out deletes only the specific device's `sessionToken` row from the database via `signOut` event handler. Other active devices remain signed in.

### 1.2 Resilience to Transient DB Write Failures
* **Problem:** If `prisma.session.create` threw a transient error (e.g., Prisma `P1001: Can't reach database server` or connection pool timeout) during login or legacy token backfill, `sid` was stamped onto the token before confirmation. When NextAuth immediately ran the refresh branch, the missing row caused the lookup to return an empty token `{}` — bouncing users who entered the correct password with no error message.
* **Mitigation:**
  - Token `sid` is stamped conditionally: `if (row) (token as any).sid = sid;`.
  - If a DB write blip occurs, the token gracefully falls back to `passwordChangedAt`-only revocation. The user remains signed in rather than falsely bounced.

### 1.3 Session Expiration Enforcement & Opportunistic Cleanup
* **Problem:** `findUnique({ where: { sessionToken: sid } })` previously lacked an `expires` filter, making the 30-day session lifetime purely decorative. Furthermore, implicit logouts (closing tabs, shutting down devices) never invoke `signOut`, leaking dead rows permanently into the `Session` table.
* **Mitigation:**
  - Enforced expiry in the lookup: `where: { sessionToken: sid, expires: { gt: new Date() } }`. Expired rows immediately fail validation and sign the client out.
  - Added opportunistic cleanup on sign-in and legacy backfill: `prisma.session.deleteMany({ where: { userId, expires: { lt: new Date() } } })`. Dead sessions for that member are automatically swept on their next login without requiring external cron jobs.

### 1.4 Global Revocation on Password Change
* **Implementation:** When a user changes or resets their password, `prisma.session.deleteMany({ where: { userId } })` purges all active session rows, and `User.passwordChangedAt` is updated to the current timestamp. Any JWT minted before this timestamp is invalidated on its next TTL check (`pwdAt < dbPwdAt`), terminating all sessions across all devices simultaneously.

---

## 2. Database Error Sanitization & Trace IDs

* **File:** `src/shared/utils/api.ts`

### 2.1 Database Password Error Leak Sanitization
* **Vulnerability:** Prisma database connection failures can embed raw connection strings (e.g., `postgresql://postgres:SecretPassword@host:5432/...`), potentially leaking database credentials into production server logs or error outputs.
* **Mitigation:** Implemented `sanitizeDbError()` with regular expressions matching percent-encoded and standard credentials, ensuring database passwords are masked to `***` before error serialization.

### 2.2 Error Response Correlation `traceId`
* **Implementation:**
  - Standardized all `500 Internal Server Error` responses to return a generic message accompanied by a unique `traceId` (e.g. `[trace:abc123xyz]`).
  - Allows users and support staff to correlate errors with server-side logs without exposing database schemas, SQL queries, or internal stack traces.

---

## 3. Balanced Rate Limiting (CGNAT & Abuse Prevention)

* **File:** `src/core/ratelimit/ratelimit.ts`

### 3.1 Account Login Protection
* **Limit:** 5 attempts per minute per account/email (`login`).
* **Purpose:** Thwarts credential-stuffing and targeted brute-force attacks against specific member accounts.

### 3.2 CGNAT-Safe IP Login Guard
* **Limit:** 20 attempts per minute per IP (`loginIp`).
* **Purpose:** Protects server CPU from excessive `bcrypt.compare` operations without locking out office networks, universities, or mobile carrier CGNATs (Jio, Airtel) where thousands of legitimate users share a single public IP address.

### 3.3 Multi-Step Password Reset Limiter
* **Limit:** 10 attempts per minute per IP (`password`).
* **Purpose:** Because password resets require two distinct steps (`/start` and `/reset`), each flow consumes 2 tokens. A 10-attempt per-minute window prevents mass automated reset requests while allowing legitimate users and multi-user offices to complete resets without interruption.

### 3.4 Email OTP Inbox Flooding Protection
* **Limit:** 3 attempts per 10 minutes per email (`otpEmail`).
* **Purpose:** Protects member inboxes from mailbombing/flooding without locking users out for hours if an OTP is delayed in transit or mistyped.

---

## 4. Atomic OTP Verification & Index Hygiene

* **Files:** `src/modules/auth/lib/otp.ts`, `src/core/email/otp.ts`, `prisma/schema.prisma`

### 4.1 Atomic Issuance Scoped to User
* **Implementation:**
  - `issueCode` executes within an atomic `prisma.$transaction`:
    ```ts
    await prisma.$transaction([
      prisma.verificationCode.deleteMany({ where: { email, purpose } }),
      prisma.verificationCode.create({ ... }),
    ]);
    ```
  - Scoped strictly to `{ email, purpose }` so that the hot auth path uses the composite index `@@index([email, purpose])` directly, avoiding full table scans or row locking on other users' records.

### 4.2 Index Optimization on `VerificationCode.expiresAt`
* **Problem:** Querying or purging expired verification codes on `expiresAt` required a sequential scan across the entire table because `VerificationCode` only indexed `(email, purpose)`.
* **Mitigation:** Added `@@index([expiresAt])` to `model VerificationCode` in `prisma/schema.prisma`. All `expiresAt` comparisons now utilize an efficient B-tree index scan.

### 4.3 Dedicated Expiry Purge Function
* **Implementation:** Exported `purgeExpiredVerificationCodes()`:
  ```ts
  export async function purgeExpiredVerificationCodes(): Promise<number> {
    const res = await prisma.verificationCode
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => ({ count: 0 }));
    return res.count;
  }
  ```
  Provides a fast, indexed mechanism for background workers to prune stale verification codes without touching the user-facing sign-in path.

---

## 5. Automated Test Verification

All changes in this release are verified through the automated Vitest suite:

```bash
# Verify Auth & Session Revocation Suite
npx vitest run src/lib/__tests__/login-revocation.test.ts src/lib/__tests__/password-change-revokes-sessions.test.ts
# Result: 18 passed (18)

# Verify OTP & Rate Limiting Suite
npx vitest run src/lib/__tests__/otp.test.ts src/lib/__tests__/api-rate-limits.test.ts
# Result: 9 passed (9)

# Verify API Error Sanitization & Trace ID
npx vitest run src/lib/__tests__/api.test.ts
# Result: 9 passed (9)

# Full TypeScript Compilation
npx tsc --noEmit
# Result: Exit code 0, 0 errors
```
