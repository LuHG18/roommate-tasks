-- Fix household_members table structure
-- Remove the redundant id field and use user_id + household_id as composite primary key

-- First, drop the existing primary key constraint
ALTER TABLE household_members DROP CONSTRAINT household_members_pkey;

-- Drop the id column
ALTER TABLE household_members DROP COLUMN id;

-- Add composite primary key using user_id and household_id
ALTER TABLE household_members ADD CONSTRAINT household_members_pkey PRIMARY KEY (user_id, household_id);

-- Add unique constraint to prevent duplicate memberships
ALTER TABLE household_members ADD CONSTRAINT household_members_unique UNIQUE (user_id, household_id);

-- Update any indexes if needed
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON household_members(household_id);
