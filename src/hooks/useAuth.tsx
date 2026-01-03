import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "user" | "hod" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  isHod: boolean;
  hodProjects: string[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  isHod: false,
  hodProjects: [],
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [isHod, setIsHod] = useState(false);
  const [hodProjects, setHodProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc("get_user_role", {
        _user_id: userId,
      });
      if (!error && data) {
        setRole(data as UserRole);
      } else {
        setRole("user");
      }
    } catch (error) {
      console.error("Error fetching role:", error);
      setRole("user");
    }
  };

  const fetchHodStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("project_hods")
        .select("project_id, projects(name)")
        .eq("user_id", userId);

      if (!error && data && data.length > 0) {
        setIsHod(true);
        const projectNames = data
          .map((d: any) => d.projects?.name)
          .filter(Boolean);
        setHodProjects(projectNames);
      } else {
        setIsHod(false);
        setHodProjects([]);
      }
    } catch (error) {
      console.error("Error fetching HOD status:", error);
      setIsHod(false);
      setHodProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error("Error getting session:", error);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserRole(session.user.id);
          await fetchHodStatus(session.user.id);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state listener - CRITICAL: No async operations in callback
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Defer Supabase calls with setTimeout to prevent deadlock
        setTimeout(() => {
          fetchUserRole(session.user.id);
          fetchHodStatus(session.user.id);
        }, 0);
      } else {
        setRole(null);
        setIsHod(false);
        setHodProjects([]);
        setLoading(false);
      }
    });

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setIsHod(false);
    setHodProjects([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, isHod, hodProjects, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
