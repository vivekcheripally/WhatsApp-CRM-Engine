-- ==============================================================================
-- DATABASE MIGRATION SCRIPT: RBAC, SALES_AGENT Hierarchy & Assignments
-- FastSales WhatsApp Module
-- ==============================================================================

BEGIN;

-- 1. Add unassigned_inbox_visible_to_agents column to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS unassigned_inbox_visible_to_agents BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Migrate legacy 'ORG_USER' roles to 'ORG_ADMIN' in users table
UPDATE users SET role = 'ORG_ADMIN' WHERE role = 'ORG_USER';

-- 3. Update table constraint on users for role hierarchy & organization scope
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_org_scope;
ALTER TABLE users ADD CONSTRAINT chk_user_org_scope CHECK (
    (role = 'SYSTEM_ADMIN' AND organization_id IS NULL) OR 
    (role IN ('ORG_ADMIN', 'SALES_AGENT') AND organization_id IS NOT NULL)
);

-- 4. Create UserWhatsAppAccountAssignment bridge table
CREATE TABLE IF NOT EXISTS user_whatsapp_account_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    whatsapp_account_id UUID NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_wa_account_assignment UNIQUE (user_id, whatsapp_account_id)
);

CREATE INDEX IF NOT EXISTS ix_user_wa_assign_org ON user_whatsapp_account_assignments(organization_id);
CREATE INDEX IF NOT EXISTS ix_user_wa_assign_user ON user_whatsapp_account_assignments(user_id);
CREATE INDEX IF NOT EXISTS ix_user_wa_assign_wa ON user_whatsapp_account_assignments(whatsapp_account_id);

-- 5. Create CampaignAgentAssignment bridge table
CREATE TABLE IF NOT EXISTS campaign_agent_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_campaign_user_assignment UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_campaign_agent_assign_org ON campaign_agent_assignments(organization_id);
CREATE INDEX IF NOT EXISTS ix_campaign_agent_assign_camp ON campaign_agent_assignments(campaign_id);
CREATE INDEX IF NOT EXISTS ix_campaign_agent_assign_user ON campaign_agent_assignments(user_id);

-- 6. Add ownership and soft-delete columns to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_contacts_org_owner ON contacts(organization_id, owner_id);

-- 7. Add ownership, execution and soft-delete columns to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 8. Add assignee and soft-delete columns to whatsapp_conversations table
ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_wa_conv_assignee ON whatsapp_conversations(organization_id, assignee_id);

COMMIT;
