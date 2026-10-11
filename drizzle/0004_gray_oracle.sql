CREATE TABLE `task_instructions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`taskId` int NOT NULL,
	`ownerId` int NOT NULL,
	`instruction` text NOT NULL,
	`status` enum('queued','processing','completed','cancelled') NOT NULL DEFAULT 'queued',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `task_instructions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `status` enum('queued','planning','running','waiting','paused','testing','debugging','completed','failed','cancelled') NOT NULL DEFAULT 'queued';