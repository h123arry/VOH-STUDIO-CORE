CREATE TABLE `agent_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`agentKey` varchar(64) NOT NULL,
	`status` enum('running','completed','failed','blocked') NOT NULL,
	`actionSummary` text NOT NULL,
	`modelRoute` varchar(140),
	`modelMetadata` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`name` varchar(100) NOT NULL,
	`capabilityClass` varchar(64) NOT NULL,
	`executorStatus` enum('active','registered','approval_required') NOT NULL,
	`modelRole` varchar(32),
	`safetyScope` varchar(255) NOT NULL,
	`description` text NOT NULL,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agents_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `model_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`name` varchar(100) NOT NULL,
	`status` enum('available','unavailable','configured') NOT NULL,
	`endpoint` varchar(255),
	CONSTRAINT `model_providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `model_providers_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `model_routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` varchar(32) NOT NULL,
	`providerKey` varchar(64) NOT NULL,
	`modelId` varchar(140),
	`fallbackPolicy` varchar(255) NOT NULL,
	CONSTRAINT `model_routes_id` PRIMARY KEY(`id`),
	CONSTRAINT `model_routes_role_unique` UNIQUE(`role`)
);
--> statement-breakpoint
CREATE TABLE `project_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`path` varchar(255) NOT NULL,
	`language` varchar(32),
	`contentHash` varchar(64) NOT NULL,
	`size` int NOT NULL DEFAULT 0,
	`content` text,
	`lastOperation` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`description` text NOT NULL,
	`projectType` varchar(48) NOT NULL DEFAULT 'web_app',
	`lifecycle` enum('active','paused','archived') NOT NULL DEFAULT 'active',
	`workspacePath` varchar(255) NOT NULL,
	`activeTaskId` int,
	`settings` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_errors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`source` varchar(64) NOT NULL,
	`failureClass` varchar(48) NOT NULL,
	`diagnostic` text NOT NULL,
	`retryable` int NOT NULL DEFAULT 0,
	`resolution` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_errors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`actor` varchar(64) NOT NULL,
	`phase` varchar(32) NOT NULL,
	`summary` text NOT NULL,
	`metadata` text,
	`severity` enum('info','success','warning','error') NOT NULL DEFAULT 'info',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`orderIndex` int NOT NULL,
	`phase` varchar(32) NOT NULL,
	`title` varchar(180) NOT NULL,
	`assignedAgent` varchar(64) NOT NULL,
	`status` enum('pending','running','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`inputSummary` text,
	`outputSummary` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `task_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`ownerId` int NOT NULL,
	`objective` text NOT NULL,
	`userRequest` text NOT NULL,
	`status` enum('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`currentPhase` enum('plan','build','run','test','inspect','debug','patch','rebuild','retest','complete','failed') NOT NULL DEFAULT 'plan',
	`viewMode` enum('simple','developer') NOT NULL DEFAULT 'simple',
	`retryCount` int NOT NULL DEFAULT 0,
	`retryLimit` int NOT NULL DEFAULT 3,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`finalSummary` text,
	`failureClass` varchar(48),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tool_calls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`agentKey` varchar(64) NOT NULL,
	`toolName` varchar(100) NOT NULL,
	`arguments` text,
	`permissionScope` varchar(255) NOT NULL,
	`status` enum('started','completed','failed','blocked') NOT NULL,
	`resultSummary` text,
	`exitCode` int,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tool_calls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `verification_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`kind` varchar(32) NOT NULL,
	`command` varchar(255),
	`status` enum('passed','failed','skipped','blocked') NOT NULL,
	`output` text,
	`artifact` varchar(255),
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verification_runs_id` PRIMARY KEY(`id`)
);
