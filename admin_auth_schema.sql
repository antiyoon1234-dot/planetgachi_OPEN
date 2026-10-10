-- Admin passwords are provisioned privately in admin_config.
-- This public migration contains no default passwords or password hashes.

-- 2. Create verify_admin_password function
CREATE OR REPLACE FUNCTION public.verify_admin_password(input_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stored_super_hash text;
    stored_item_hash text;
    input_hash text;
BEGIN
    -- Get the stored hashes
    SELECT config_value INTO stored_super_hash FROM public.admin_config WHERE config_key = 'super_admin_password_hash';
    SELECT config_value INTO stored_item_hash FROM public.admin_config WHERE config_key = 'item_admin_password_hash';
    
    -- Hash the input password using SHA-256
    input_hash := encode(extensions.digest(input_password, 'sha256'), 'hex');
    
    IF input_hash = stored_super_hash THEN
        RETURN 'super_admin';
    ELSIF input_hash = stored_item_hash THEN
        RETURN 'item_admin';
    ELSE
        RETURN 'none';
    END IF;
END;
$$;

-- 3. Create change_admin_password function
CREATE OR REPLACE FUNCTION public.change_admin_password(
    current_password text,
    new_password text,
    target_role text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_role text;
    target_key text;
    new_hash text;
BEGIN
    -- 1. Verify caller's credential
    caller_role := public.verify_admin_password(current_password);
    
    IF caller_role = 'none' THEN
        RETURN 'CURRENT_PASSWORD_INCORRECT';
    END IF;
    
    -- 2. Check permission:
    -- - super_admin can change 'super_admin' or 'item_admin'
    -- - item_admin can only change 'item_admin'
    IF target_role = 'super_admin' AND caller_role != 'super_admin' THEN
        RETURN 'PERMISSION_DENIED';
    END IF;
    
    IF target_role = 'super_admin' THEN
        target_key := 'super_admin_password_hash';
    ELSIF target_role = 'item_admin' THEN
        target_key := 'item_admin_password_hash';
    ELSE
        RETURN 'INVALID_TARGET_ROLE';
    END IF;
    
    -- 3. Update password hash
    new_hash := encode(extensions.digest(new_password, 'sha256'), 'hex');
    UPDATE public.admin_config
    SET config_value = new_hash
    WHERE config_key = target_key;
    
    -- If it doesn't exist, insert it
    IF NOT FOUND THEN
        INSERT INTO public.admin_config (config_key, config_value)
        VALUES (target_key, new_hash);
    END IF;
    
    RETURN 'SUCCESS';
END;
$$;
