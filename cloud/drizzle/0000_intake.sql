CREATE TABLE submissions (
 id TEXT PRIMARY KEY NOT NULL,
 token_hash TEXT NOT NULL,
 client_hash TEXT NOT NULL,
 payload TEXT NOT NULL,
 files TEXT NOT NULL,
 total_bytes INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'uploading',
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 reason TEXT NOT NULL DEFAULT '',
 review_json TEXT,
 github_issue INTEGER,
 request_hash TEXT NOT NULL
 ,lease_until INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX submissions_status_created ON submissions(status, created_at);
--> statement-breakpoint
CREATE TABLE parts (
 submission_id TEXT NOT NULL,
 file_id INTEGER NOT NULL,
 part_number INTEGER NOT NULL,
 size INTEGER NOT NULL,
 digest TEXT NOT NULL,
 PRIMARY KEY (submission_id, file_id, part_number)
);
--> statement-breakpoint
CREATE TABLE challenges (
 nonce TEXT PRIMARY KEY NOT NULL,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE quotas (
 bucket TEXT PRIMARY KEY NOT NULL,
 used INTEGER NOT NULL DEFAULT 0,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 submission_id TEXT NOT NULL,
 action TEXT NOT NULL,
 actor TEXT NOT NULL,
 reason TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
