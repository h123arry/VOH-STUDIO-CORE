ALTER TABLE `tasks` MODIFY COLUMN `status` enum('queued','planning','running','waiting','paused','testing','debugging','completed','failed','cancelled') NOT NULL DEFAULT 'queued';
