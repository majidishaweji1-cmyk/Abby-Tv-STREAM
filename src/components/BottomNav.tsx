import { Home, Trophy, User, Shield } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { t } from "@/lib/i18n";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

export const BottomNav = () => {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const navItems = [
    { icon: Home, label: "home", path: "/" },
    { icon: Trophy, label: "matches", path: "/matches" },
    { icon: User, label: "profile", path: "/profile" },
    ...(isAdmin ? [{ icon: Shield, label: "admin", path: "/admin" }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path} className="flex flex-col items-center justify-center gap-1 flex-1 h-full relative">
              {isActive && (
                <motion.div layoutId="activeTab" className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <item.icon className={`w-5 h-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {t(item.label)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
