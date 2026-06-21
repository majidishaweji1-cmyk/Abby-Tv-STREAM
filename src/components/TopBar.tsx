import { Search } from "lucide-react";
import { useState } from "react";
import { SearchOverlay } from "./SearchOverlay";
import { NotificationBell } from "./NotificationBell";

const LOGO_URL = "https://raw.githubusercontent.com/xmdloft23/Bot-master/main/stream/loft-tv.jpg";

export const TopBar = () => {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <img
              src={LOGO_URL}
              alt="LOFT Tv"
              className="w-8 h-8 rounded-md object-cover"
            />
            <span className="font-display font-bold text-lg tracking-tight">
              LOFT<span className="text-primary"> Tv</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <NotificationBell />
          </div>
        </div>
      </header>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};
