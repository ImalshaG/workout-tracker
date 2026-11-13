ALTER TABLE `exercises` ADD `duration_seconds` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_exercises` ADD `duration_seconds` integer;--> statement-breakpoint
ALTER TABLE `workouts` ADD `rest_seconds` integer DEFAULT 10 NOT NULL;