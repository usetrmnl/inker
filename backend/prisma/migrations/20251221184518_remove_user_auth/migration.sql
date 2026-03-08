-- Remove user-related foreign keys and columns
-- This migration removes user authentication system in favor of PIN-based auth

-- 1. Drop foreign key constraints that reference users table
ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "devices_user_id_fkey";
ALTER TABLE "screens" DROP CONSTRAINT IF EXISTS "screens_user_id_fkey";
ALTER TABLE "playlists" DROP CONSTRAINT IF EXISTS "playlists_user_id_fkey";
ALTER TABLE "screen_designs" DROP CONSTRAINT IF EXISTS "screen_designs_user_id_fkey";

-- 2. Drop user_id columns from tables
ALTER TABLE "devices" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "screens" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "playlists" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "screen_designs" DROP COLUMN IF EXISTS "user_id";

-- 3. Drop refresh_tokens table
DROP TABLE IF EXISTS "refresh_tokens";

-- 4. Drop users table
DROP TABLE IF EXISTS "users";
