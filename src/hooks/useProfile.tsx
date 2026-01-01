import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  employee_id: string | null;
  avatar_url: string | null;
}

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, employee_id, avatar_url")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data as Profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (updates: Partial<Pick<Profile, "display_name" | "employee_id" | "avatar_url">>) => {
    if (!user) return { error: new Error("Not authenticated") };

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      setProfile((prev) => prev ? { ...prev, ...updates } : null);
      return { error: null };
    } catch (error) {
      console.error("Error updating profile:", error);
      return { error };
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return { error: new Error("Not authenticated"), url: null };

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete existing avatar if any
      await supabase.storage.from("avatars").remove([fileName]);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Add cache buster to URL
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      await updateProfile({ avatar_url: avatarUrl });
      toast.success("Profile picture updated!");

      return { error: null, url: avatarUrl };
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload profile picture");
      return { error, url: null };
    }
  };

  return { profile, loading, updateProfile, uploadAvatar, refetch: fetchProfile };
};
