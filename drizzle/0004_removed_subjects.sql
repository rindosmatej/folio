CREATE TABLE removed_subjects(id TEXT PRIMARY KEY REFERENCES subjects(id));
--> statement-breakpoint
CREATE TABLE removed_run_sources(run TEXT PRIMARY KEY REFERENCES runs(id));
