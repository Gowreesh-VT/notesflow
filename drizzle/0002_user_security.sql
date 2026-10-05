CREATE TABLE "user_security" (
	"user_id" text PRIMARY KEY NOT NULL,
	"sessions_valid_after" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_security" ADD CONSTRAINT "user_security_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;