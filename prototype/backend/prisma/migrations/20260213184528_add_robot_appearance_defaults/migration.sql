-- Add default values for robot appearance fields if they don't exist
-- This ensures all existing robots have valid appearance data

-- Update any NULL paintJob values to 'red' (default colorway)
UPDATE robots 
SET paint_job = 'red' 
WHERE paint_job IS NULL;

-- Ensure frameId is set (default to 1 if somehow NULL)
UPDATE robots 
SET frame_id = 1 
WHERE frame_id IS NULL;
