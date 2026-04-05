-- Add OAuth columns to users table
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" varchar(255);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" varchar(500);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider" varchar(50) DEFAULT 'credentials';
--> statement-breakpoint
-- Add userId to repos table (nullable for backward compatibility)
ALTER TABLE "repos" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "repos" DROP CONSTRAINT IF EXISTS "repos_url_unique";
--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
