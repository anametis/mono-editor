ALTER TABLE "Post" DROP CONSTRAINT "Post_publishedRevisionId_fkey";
DROP INDEX "Post_publishedRevisionId_key";
CREATE UNIQUE INDEX "Post_publishedRevisionId_id_key" ON "Post" ("publishedRevisionId", "id");
