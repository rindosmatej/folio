CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE,name TEXT NOT NULL,role TEXT NOT NULL);
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE subjects(id TEXT PRIMARY KEY,title TEXT,description TEXT,theme TEXT,cover TEXT,visible INTEGER,pos INTEGER,version INTEGER DEFAULT 1);
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE tasks(id TEXT PRIMARY KEY,sid TEXT REFERENCES subjects(id),body TEXT,published INTEGER,pos INTEGER,version INTEGER DEFAULT 1);
--> statement-breakpoint
CREATE TABLE files(id TEXT PRIMARY KEY,sid TEXT REFERENCES subjects(id),name TEXT,type TEXT,size INTEGER);
--> statement-breakpoint
CREATE TABLE quizzes(id TEXT PRIMARY KEY,sid TEXT REFERENCES subjects(id),author TEXT REFERENCES users(id),body TEXT,version INTEGER DEFAULT 1);
--> statement-breakpoint
CREATE TABLE shares(qid TEXT REFERENCES quizzes(id),sid TEXT REFERENCES subjects(id),PRIMARY KEY(qid,sid));
--> statement-breakpoint
CREATE TABLE runs(id TEXT PRIMARY KEY,pin TEXT,owner TEXT REFERENCES users(id),sid TEXT REFERENCES subjects(id),qid TEXT REFERENCES quizzes(id),task TEXT,request TEXT,body TEXT,phase TEXT,idx INTEGER,deadline INTEGER,remaining INTEGER,version INTEGER,started INTEGER,ended INTEGER,early INTEGER DEFAULT 0,UNIQUE(owner,request));
--> statement-breakpoint
CREATE UNIQUE INDEX active_pin ON runs(pin) WHERE ended IS NULL;
--> statement-breakpoint
CREATE TABLE players(id TEXT PRIMARY KEY,run TEXT REFERENCES runs(id),name TEXT,normalized TEXT,token TEXT UNIQUE,joined INTEGER,UNIQUE(run,normalized));
--> statement-breakpoint
CREATE TABLE answers(player TEXT REFERENCES players(id),idx INTEGER,value TEXT,points INTEGER,at INTEGER,PRIMARY KEY(player,idx));
--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE runs ADD COLUMN volume REAL NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TABLE migrations(name TEXT PRIMARY KEY);
--> statement-breakpoint
CREATE TABLE revision(id INTEGER PRIMARY KEY,v INTEGER NOT NULL CHECK(v>=0));
