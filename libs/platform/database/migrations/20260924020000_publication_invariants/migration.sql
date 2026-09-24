-- Only one working revision may exist for a post. Published history remains immutable.
CREATE UNIQUE INDEX "Revision_one_working_per_post" ON "Revision" ("postId") WHERE "status" <> 'PUBLISHED';
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_approval_required" CHECK (
  "status" NOT IN ('APPROVED', 'SCHEDULED', 'PUBLISHED') OR ("approvedAt" IS NOT NULL AND "approvedBy" IS NOT NULL)
);
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_schedule_required" CHECK (
  "status" <> 'SCHEDULED' OR "scheduledAt" IS NOT NULL
);
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_publication_required" CHECK (
  "status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL
);
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_id_post_unique" UNIQUE ("id", "postId");
ALTER TABLE "Post" ADD CONSTRAINT "Post_published_revision_belongs_to_post" FOREIGN KEY ("publishedRevisionId", "id") REFERENCES "Revision" ("id", "postId");
