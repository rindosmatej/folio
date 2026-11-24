CREATE TABLE feedback_forms(id TEXT PRIMARY KEY, sid TEXT NOT NULL REFERENCES subjects(id), owner TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, questions TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', share TEXT NOT NULL UNIQUE, responses INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE feedback_counts(form TEXT NOT NULL REFERENCES feedback_forms(id), question TEXT NOT NULL, answer TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY(form,question,answer));
--> statement-breakpoint
CREATE TABLE feedback_receipts(form TEXT NOT NULL REFERENCES feedback_forms(id), digest TEXT NOT NULL, PRIMARY KEY(form,digest));
