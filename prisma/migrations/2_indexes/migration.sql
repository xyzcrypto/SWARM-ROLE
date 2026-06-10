-- Performance indexes for hot query paths.
-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Post_published_category_createdAt_idx" ON "Post"("published", "category", "createdAt");
