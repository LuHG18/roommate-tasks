-- Household Invitations Schema Setup for MySQL
-- This ensures the household_invitations table is properly configured for MySQL

-- 1. Create the household_invitations table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS household_invitations (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  household_id CHAR(36) NOT NULL,
  inviter_id CHAR(36) NOT NULL,
  invitee_email VARCHAR(255) NOT NULL,
  status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Primary key
  PRIMARY KEY (id),
  
  -- Foreign key constraints
  CONSTRAINT fk_household_invitations_household_id 
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  CONSTRAINT fk_household_invitations_inviter_id 
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Unique constraint to prevent duplicate pending invitations
  UNIQUE KEY idx_household_invitations_unique_pending (household_id, invitee_email, status)
);

-- 2. Create indexes for better performance
CREATE INDEX idx_household_invitations_invitee_email 
  ON household_invitations(invitee_email);

CREATE INDEX idx_household_invitations_status 
  ON household_invitations(status);

CREATE INDEX idx_household_invitations_household_id 
  ON household_invitations(household_id);

CREATE INDEX idx_household_invitations_inviter_id 
  ON household_invitations(inviter_id);

-- 3. Verify the table structure
DESCRIBE household_invitations;
