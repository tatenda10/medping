-- AlterTable
ALTER TABLE `medications` ADD COLUMN `reason_for_treatment` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `medications` ADD COLUMN `schedule_pattern` VARCHAR(191) NULL DEFAULT 'daily';

-- AlterTable
ALTER TABLE `medications` ADD COLUMN `schedule_pattern_data` JSON NULL;

-- AlterTable
ALTER TABLE `medications` ADD COLUMN `injection_site_data` JSON NULL;

