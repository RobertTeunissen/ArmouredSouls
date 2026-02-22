-- Migration: Rename income_generator to merchandising_hub
-- This migration renames the facility type from 'income_generator' to 'merchandising_hub'
-- and updates the facility economics

-- Update facility_type in facilities table
UPDATE facilities 
SET facility_type = 'merchandising_hub' 
WHERE facility_type = 'income_generator';

-- Note: This migration should be run manually or via a migration script
-- The facility costs and benefits are updated in the application code (facilities.ts)
