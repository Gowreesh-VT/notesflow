CREATE TABLE "push_delivery" (
	"endpoint" text NOT NULL,
	"key" text NOT NULL,
	"item_id" text NOT NULL,
	"sent_at" bigint NOT NULL,
	CONSTRAINT "push_delivery_endpoint_key_pk" PRIMARY KEY("endpoint","key")
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"time_zone" text NOT NULL,
	"default_reminder_time" text NOT NULL,
	"quiet_start" text,
	"quiet_end" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_delivery" ADD CONSTRAINT "push_delivery_endpoint_push_subscription_endpoint_fk" FOREIGN KEY ("endpoint") REFERENCES "public"."push_subscription"("endpoint") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_delivery_sent_idx" ON "push_delivery" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "push_subscription_user_idx" ON "push_subscription" USING btree ("user_id");