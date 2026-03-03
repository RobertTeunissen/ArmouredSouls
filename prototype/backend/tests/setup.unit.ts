/**
 * Jest Setup File for Unit Tests
 * Unit tests don't require a database connection.
 * Only loads environment variables.
 */

import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env file
config({ path: path.resolve(__dirname, '../.env') });
