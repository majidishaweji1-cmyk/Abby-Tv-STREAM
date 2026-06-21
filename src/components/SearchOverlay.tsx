import { Search, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { t } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChannelCard } from "@/components/ChannelCard";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const SearchOverlay = ({ open, onClose }: SearchOverlayProps) => {
  const [query, setQuery] = useState("");

  const { data: results, isLoading } = useQuery({
    queryKey: ["search-channels", query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data } = await supabase
        .from("channels")
        .select("*, categories(name)")
        .eq("is_active", true)
        .ilike("name", `%${query.trim()}%`)
        .limit(20);
      return data || [];
    },
    enabled: query.trim().length > 0,
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background/98 backdrop-blur-xl"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search")}
                className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground font-body"
              />
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {query.length === 0 ? (
                <p className="text-center text-muted-foreground mt-20">
                  {t("search")}
                </p>
              ) : isLoading ? (
                <p className="text-center text-muted-foreground mt-20">...</p>
              ) : results && results.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {results.map((ch) => (
                    <div key={ch.id} onClick={onClose}>
                      <ChannelCard
                        id={ch.id}
                        name={ch.name}
                        image={ch.image_url || "https://images.unsplash.com/photo-1461896836934-bd45ba48b2b5?w=300&q=80"}
                        category={(ch as any).categories?.name || ""}
                        isPro={ch.is_pro}
                        channelNumber={ch.channel_number || undefined}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground mt-20">
                  {t("noResults")}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
