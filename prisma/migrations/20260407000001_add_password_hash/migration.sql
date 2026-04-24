-- Add passwordHash to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;