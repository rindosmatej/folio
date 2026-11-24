CREATE TABLE areas(id TEXT PRIMARY KEY, sid TEXT NOT NULL REFERENCES subjects(id), title TEXT NOT NULL, icon TEXT NOT NULL, pos INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE task_areas(task TEXT PRIMARY KEY REFERENCES tasks(id), area TEXT NOT NULL REFERENCES areas(id), created_order INTEGER NOT NULL UNIQUE);
--> statement-breakpoint
CREATE TABLE subject_icons(sid TEXT PRIMARY KEY REFERENCES subjects(id), icon TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX tasks_by_area ON task_areas(area,created_order);
