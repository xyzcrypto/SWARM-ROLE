-- XYZ Crypto Academy (/academy): curriculum (categories, lessons, question
-- bank), quiz attempts and answers, the idempotent XP ledger, progress,
-- achievements, admin config, live quizzes, certificates, period closes and
-- leaderboard rank snapshots.
--
-- Idempotent throughout (IF NOT EXISTS / DO-blocks): `scripts/db-push.mjs`
-- retries on a production deploy and `db push` may already have created these.
-- Additive only: new tables; User is referenced, not altered. The starter
-- curriculum is NOT seeded here; the app seeds it on first use (ensureSeeded).
CREATE TABLE IF NOT EXISTS "AcademyCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'BookOpen',
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademyCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyModule" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "minutes" INTEGER NOT NULL DEFAULT 5,
    "objectives" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "concepts" JSONB NOT NULL,
    "example" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademyModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyQuestion" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "moduleId" TEXT,
    "difficulty" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answer" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademyQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyProfile" (
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "quizzes" INTEGER NOT NULL DEFAULT 0,
    "answered" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDay" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademyProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "AcademyXp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyXp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "categoryId" TEXT,
    "moduleId" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'mixed',
    "questionIds" TEXT[],
    "shuffles" JSONB NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revealed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "periodKey" TEXT,
    "challengeOf" TEXT,
    "fiftyUsed" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "score" INTEGER NOT NULL DEFAULT 0,
    "xpScore" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "bestRun" INTEGER NOT NULL DEFAULT 0,
    "run" INTEGER NOT NULL DEFAULT 0,
    "timeMs" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AcademyAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "choice" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "ms" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "fresh" BOOLEAN NOT NULL DEFAULT true,
    "assisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyProgress" (
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyProgress_pkey" PRIMARY KEY ("userId","moduleId")
);

CREATE TABLE IF NOT EXISTS "AcademyAchievement" (
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyAchievement_pkey" PRIMARY KEY ("userId","code")
);

CREATE TABLE IF NOT EXISTS "AcademyConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademyConfig_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "AcademyLive" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "questionIds" TEXT[],
    "questionSec" INTEGER NOT NULL DEFAULT 20,
    "revealSec" INTEGER NOT NULL DEFAULT 7,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedMs" INTEGER NOT NULL DEFAULT 0,
    "endedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademyLive_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyLiveParticipant" (
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "totalMs" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,

    CONSTRAINT "AcademyLiveParticipant_pkey" PRIMARY KEY ("liveId","userId")
);

CREATE TABLE IF NOT EXISTS "AcademyLiveAnswer" (
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "choice" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "ms" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyLiveAnswer_pkey" PRIMARY KEY ("liveId","userId","index")
);

CREATE TABLE IF NOT EXISTS "AcademyCertificate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "template" TEXT NOT NULL DEFAULT 'gold',

    CONSTRAINT "AcademyCertificate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademyPeriodClose" (
    "key" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "winners" JSONB NOT NULL,

    CONSTRAINT "AcademyPeriodClose_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "AcademyBoardSnap" (
    "key" TEXT NOT NULL,
    "ranks" JSONB NOT NULL,
    "prevRanks" JSONB NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyBoardSnap_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcademyCategory_slug_key" ON "AcademyCategory"("slug");

CREATE INDEX IF NOT EXISTS "AcademyCategory_published_order_idx" ON "AcademyCategory"("published", "order");

CREATE INDEX IF NOT EXISTS "AcademyModule_categoryId_order_idx" ON "AcademyModule"("categoryId", "order");

CREATE UNIQUE INDEX IF NOT EXISTS "AcademyModule_categoryId_slug_key" ON "AcademyModule"("categoryId", "slug");

CREATE INDEX IF NOT EXISTS "AcademyQuestion_categoryId_difficulty_active_idx" ON "AcademyQuestion"("categoryId", "difficulty", "active");

CREATE INDEX IF NOT EXISTS "AcademyQuestion_moduleId_idx" ON "AcademyQuestion"("moduleId");

CREATE INDEX IF NOT EXISTS "AcademyQuestion_active_difficulty_idx" ON "AcademyQuestion"("active", "difficulty");

CREATE INDEX IF NOT EXISTS "AcademyProfile_xp_idx" ON "AcademyProfile"("xp");

CREATE UNIQUE INDEX IF NOT EXISTS "AcademyXp_key_key" ON "AcademyXp"("key");

CREATE INDEX IF NOT EXISTS "AcademyXp_createdAt_userId_idx" ON "AcademyXp"("createdAt", "userId");

CREATE INDEX IF NOT EXISTS "AcademyXp_userId_createdAt_idx" ON "AcademyXp"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "AcademyAttempt_userId_startedAt_idx" ON "AcademyAttempt"("userId", "startedAt");

CREATE INDEX IF NOT EXISTS "AcademyAttempt_status_finishedAt_idx" ON "AcademyAttempt"("status", "finishedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "AcademyAttempt_userId_mode_periodKey_key" ON "AcademyAttempt"("userId", "mode", "periodKey");

CREATE INDEX IF NOT EXISTS "AcademyAnswer_userId_questionId_createdAt_idx" ON "AcademyAnswer"("userId", "questionId", "createdAt");

CREATE INDEX IF NOT EXISTS "AcademyAnswer_createdAt_idx" ON "AcademyAnswer"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "AcademyAnswer_attemptId_index_key" ON "AcademyAnswer"("attemptId", "index");

CREATE INDEX IF NOT EXISTS "AcademyAchievement_earnedAt_idx" ON "AcademyAchievement"("earnedAt");

CREATE INDEX IF NOT EXISTS "AcademyLive_status_scheduledAt_idx" ON "AcademyLive"("status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "AcademyLiveParticipant_liveId_score_idx" ON "AcademyLiveParticipant"("liveId", "score");

CREATE UNIQUE INDEX IF NOT EXISTS "AcademyCertificate_code_key" ON "AcademyCertificate"("code");

CREATE INDEX IF NOT EXISTS "AcademyCertificate_kind_periodKey_rank_idx" ON "AcademyCertificate"("kind", "periodKey", "rank");

CREATE INDEX IF NOT EXISTS "AcademyCertificate_userId_issuedAt_idx" ON "AcademyCertificate"("userId", "issuedAt");

CREATE INDEX IF NOT EXISTS "AcademyCertificate_status_issuedAt_idx" ON "AcademyCertificate"("status", "issuedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "AcademyCertificate_kind_periodKey_userId_key" ON "AcademyCertificate"("kind", "periodKey", "userId");

DO $$ BEGIN
  ALTER TABLE "AcademyModule" ADD CONSTRAINT "AcademyModule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AcademyCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyQuestion" ADD CONSTRAINT "AcademyQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AcademyCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyQuestion" ADD CONSTRAINT "AcademyQuestion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "AcademyModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyProfile" ADD CONSTRAINT "AcademyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyXp" ADD CONSTRAINT "AcademyXp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyAttempt" ADD CONSTRAINT "AcademyAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyAnswer" ADD CONSTRAINT "AcademyAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AcademyAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyProgress" ADD CONSTRAINT "AcademyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyProgress" ADD CONSTRAINT "AcademyProgress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "AcademyModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyAchievement" ADD CONSTRAINT "AcademyAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyLiveParticipant" ADD CONSTRAINT "AcademyLiveParticipant_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "AcademyLive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyLiveParticipant" ADD CONSTRAINT "AcademyLiveParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyLiveAnswer" ADD CONSTRAINT "AcademyLiveAnswer_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "AcademyLive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcademyCertificate" ADD CONSTRAINT "AcademyCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
