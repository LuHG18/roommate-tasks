-- Household Invitations Schema Setup
-- This ensures the household_invitations table is properly configured

-- 1. Create the household_invitations table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS household_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  invitee_email text NOT NULL,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Primary key
  CONSTRAINT household_invitations_pkey PRIMARY KEY (id),
  
  -- Foreign key constraints
  CONSTRAINT fk_household_invitations_household_id 
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  CONSTRAINT fk_household_invitations_inviter_id 
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Check constraint for status
  CONSTRAINT chk_household_invitations_status 
    CHECK (status IN ('pending', 'accepted', 'declined'))
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_household_invitations_invitee_email 
  ON household_invitations(invitee_email);

CREATE INDEX IF NOT EXISTS idx_household_invitations_status 
  ON household_invitations(status);

CREATE INDEX IF NOT EXISTS idx_household_invitations_household_id 
  ON household_invitations(household_id);

CREATE INDEX IF NOT EXISTS idx_household_invitations_inviter_id 
  ON household_invitations(inviter_id);

-- 3. Create a unique constraint to prevent duplicate pending invitations
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_invitations_unique_pending
  ON household_invitations(household_id, invitee_email, status)
  WHERE status = 'pending';

-- 4. Add trigger for updated_at timestamp (if using PostgreSQL)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_household_invitations_updated_at 
  BEFORE UPDATE ON household_invitations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Verify the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'household_invitations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
