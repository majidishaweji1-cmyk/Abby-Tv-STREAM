import { Bell, X, Check } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export const NotificationBell = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .or(`is_global.eq.true,user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent transition-colors relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 top-11 w-80 max-h-96 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between p-3 border-b border-border">
                <p className="font-display font-bold text-sm">Notifications</p>
                <button onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <div className="overflow-y-auto max-h-80">
                {(!notifications || notifications.length === 0) ? (
                  <p className="text-center text-muted-foreground text-xs py-8">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 border-b border-border last:border-0 ${!n.is_read ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{n.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{n.message}</p>
                          <p className="text-[9px] text-muted-foreground mt-1">
                            {new Date(n.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {!n.is_read && (
                          <button
                            onClick={() => markReadMutation.mutate(n.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-accent"
                          >
                            <Check className="w-3 h-3 text-primary" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
