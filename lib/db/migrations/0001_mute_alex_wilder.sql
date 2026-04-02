CREATE TABLE "repo_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"file_path" varchar(1000) NOT NULL,
	"content" text NOT NULL,
	"language" varchar(100)
);
--> statement-breakpoint
ALTER TABLE "commit_chunks" ADD COLUMN "diff" text;--> statement-breakpoint
ALTER TABLE "repo_files" ADD CONSTRAINT "repo_files_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repo_files_repo_idx" ON "repo_files" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "repo_files_path_idx" ON "repo_files" USING btree ("repo_id","file_path");