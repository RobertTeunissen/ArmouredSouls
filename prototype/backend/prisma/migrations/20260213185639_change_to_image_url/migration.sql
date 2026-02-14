-- Change robot appearance system to use imageUrl instead of frameId/paintJob
-- This allows selecting from available images only

-- Add new imageUrl column (nullable - null means no image selected)
ALTER TABLE robots ADD COLUMN image_url VARCHAR(255);

-- Set existing robots to null (they'll use the default icon)
UPDATE robots SET image_url = NULL;

-- Note: We keep frameId and paintJob for now for backwards compatibility
-- but they won't be used in the new system
