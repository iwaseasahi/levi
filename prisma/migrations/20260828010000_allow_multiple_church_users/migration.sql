DROP INDEX "church_memberships_church_uk";

CREATE INDEX "church_memberships_church_created_idx"
  ON "church_memberships"("church_id", "created_at", "id");
