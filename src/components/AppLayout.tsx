import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { RadioPlayer } from "./RadioPlayer";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="pt-14 pb-32">
        {children}
      </main>
      <RadioPlayer />
      <BottomNav />
    </div>
  );
};
