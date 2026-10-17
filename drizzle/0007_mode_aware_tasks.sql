ALTER TABLE `tasks` ADD `executionMode` enum('chat','plan','build','build_more') DEFAULT 'build' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `planContent` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `approvedPlan` text;