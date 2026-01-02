-- Update the handle_new_user function to use first_name as display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, employee_id)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'display_name', 
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'employee_id'
  );
  RETURN NEW;
END;
$function$;