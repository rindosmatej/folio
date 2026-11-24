CREATE TABLE retention_policy(id INTEGER PRIMARY KEY, games INTEGER, comments INTEGER, version INTEGER NOT NULL);
--> statement-breakpoint
ALTER TABLE feedback_forms ADD COLUMN closed_at INTEGER;
--> statement-breakpoint
ALTER TABLE feedback_forms ADD COLUMN comments_removed INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE feedback_forms SET closed_at=CAST(strftime('%s','now') AS INTEGER)*1000 WHERE status='closed';
