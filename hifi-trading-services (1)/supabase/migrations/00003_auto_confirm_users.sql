-- Migration for Auto Confirming User Email in Supabase Auth

-- 1. Function to auto-confirm user email upon insert or update in auth.users
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto confirm email immediately upon creation or email update
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at = now();
  END IF;
  IF NEW.confirmed_at IS NULL THEN
    NEW.confirmed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger on auth.users (runs BEFORE INSERT OR UPDATE)
DROP TRIGGER IF EXISTS trigger_auto_confirm_new_user ON auth.users;
CREATE TRIGGER trigger_auto_confirm_new_user
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_new_user();

-- 3. Public RPC function to auto-confirm any user by email (Security Definer)
CREATE OR REPLACE FUNCTION public.auto_confirm_user(target_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF target_email IS NULL OR TRIM(target_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email is required');
  END IF;

  -- Update auth.users directly to confirm email
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmed_at = COALESCE(confirmed_at, now())
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(target_email))
  RETURNING id INTO v_user_id;

  -- Ensure profile exists and status is ACTIVE
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET status = 'ACTIVE'
    WHERE id = v_user_id OR LOWER(TRIM(email)) = LOWER(TRIM(target_email));
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'user_id', v_user_id,
    'confirmed_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Public RPC function to auto-confirm user by user_id
CREATE OR REPLACE FUNCTION public.auto_confirm_user_by_id(target_user_id UUID)
RETURNS JSONB AS $$
BEGIN
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;

  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmed_at = COALESCE(confirmed_at, now())
  WHERE id = target_user_id;

  UPDATE public.profiles
  SET status = 'ACTIVE'
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Auto-confirm any existing unconfirmed users in auth.users
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmed_at = COALESCE(confirmed_at, now())
WHERE email_confirmed_at IS NULL OR confirmed_at IS NULL;

-- 6. Grant execute permissions on RPC functions to authenticated & anon roles
GRANT EXECUTE ON FUNCTION public.auto_confirm_user(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auto_confirm_user_by_id(UUID) TO authenticated, anon;
