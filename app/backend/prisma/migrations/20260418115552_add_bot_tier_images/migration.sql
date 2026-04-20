-- Set preset images on existing auto-generated bot robots.
-- Matches by robot name prefix (more reliable than username prefix since
-- some bots are owned by test_user_* accounts from older seed data).
-- Only updates robots that don't already have a custom image (image_url IS NULL).

UPDATE robots
SET image_url = '/assets/robots/wimpbot_512x512.webp'
WHERE name LIKE 'WimpBot %'
  AND image_url IS NULL;

UPDATE robots
SET image_url = '/assets/robots/averagebot_512x512.webp'
WHERE name LIKE 'AverageBot %'
  AND image_url IS NULL;

UPDATE robots
SET image_url = '/assets/robots/expertbot_512x512.webp'
WHERE name LIKE 'ExpertBot %'
  AND image_url IS NULL;
