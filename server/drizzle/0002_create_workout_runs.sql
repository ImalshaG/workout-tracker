CREATE TABLE `workout_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workout_id` integer,
	`workout_name` text NOT NULL,
	`exercises` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `workout_runs_completed_at_idx` ON `workout_runs` (`completed_at`);--> statement-breakpoint
CREATE INDEX `workout_runs_workout_idx` ON `workout_runs` (`workout_id`);