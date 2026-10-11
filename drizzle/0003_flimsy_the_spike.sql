CREATE TABLE `quality_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`projectId` int NOT NULL,
	`functionality` int NOT NULL,
	`design` int NOT NULL,
	`performance` int NOT NULL,
	`security` int NOT NULL,
	`reliability` int NOT NULL,
	`accessibility` int NOT NULL,
	`testCoverage` int NOT NULL,
	`codeQuality` int NOT NULL,
	`responsiveness` int NOT NULL,
	`total` int NOT NULL,
	`threshold` int NOT NULL DEFAULT 75,
	`recommendations` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quality_scores_id` PRIMARY KEY(`id`)
);
