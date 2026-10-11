CREATE TABLE `deployment_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`ownerId` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`environment` enum('development','preview','staging','production') NOT NULL,
	`branch` varchar(160) NOT NULL,
	`status` enum('planned','blocked','running','succeeded','failed') NOT NULL DEFAULT 'planned',
	`preflight` text,
	`externalId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deployment_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_issues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`ownerId` int NOT NULL,
	`kind` enum('bug','feature','improvement','technical_debt','task') NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_issues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_releases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`ownerId` int NOT NULL,
	`version` varchar(64) NOT NULL,
	`notes` text NOT NULL,
	`commitSha` varchar(64),
	`testSummary` text,
	`deploymentSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_releases_id` PRIMARY KEY(`id`)
);
