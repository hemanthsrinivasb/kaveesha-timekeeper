import { Link, useLocation, useNavigate } from "react-router-dom";
import { Moon, Sun, LogOut, Menu, X, BarChart3 } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "./ThemeProvider";
import logo from "@/assets/logo.webp";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, role, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const userLinks = [
    { to: "/", label: "Dashboard" },
    { to: "/timesheet", label: "Timesheet" },
  ];

  const adminLinks = [
    { to: "/", label: "Dashboard" },
    { to: "/reports", label: "Reports" },
    { to: "/analytics", label: "Analytics" },
  ];

  const navLinks = role === "admin" ? adminLinks : userLinks;

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <img src={logo} alt="Kaveesha Technologies" className="h-10 w-10 transition-transform group-hover:scale-105" />
            <span className="hidden sm:block text-xl font-bold gradient-text">
              Kaveesha Technologies
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {user && navLinks.map((link) => (
              <Link key={link.to} to={link.to}>
                <Button
                  variant={isActive(link.to) ? "default" : "ghost"}
                  className="transition-all"
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {role === "admin" && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                <BarChart3 className="w-3 h-3 mr-1" />
                Admin
              </span>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="transition-transform hover:scale-105"
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>

            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="hidden md:flex transition-transform hover:scale-105"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2 animate-fade-in">
            {user && navLinks.map((link) => (
              <Link key={link.to} to={link.to} onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant={isActive(link.to) ? "default" : "ghost"}
                  className="w-full justify-start"
                >
                  {link.label}
                </Button>
              </Link>
            ))}
            {user && (
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start"
              >
                <LogOut className="mr-2 h-5 w-5" />
                Logout
              </Button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};
