CREATE TABLE `project_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`taskId` int,
	`reason` varchar(160) NOT NULL,
	`snapshotPath` varchar(255) NOT NULL,
	`fileCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`projectId` int NOT NULL,
	`kind` varchar(32) NOT NULL,
	`path` varchar(255) NOT NULL,
	`label` varchar(160) NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `status` enum('queued','planning','running','waiting','testing','debugging','completed','failed','cancelled') NOT NULL DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE `tasks` ADD `priority` int DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `progress` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `activeAgent` varchar(64);