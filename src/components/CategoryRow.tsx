import { ChevronRight } from "lucide-react";
import { useRef } from "react";

interface CategoryRowProps {
  title: string;
  children: React.ReactNode;
  onSeeAll?: () => void;
}

export const CategoryRow = ({ title, children, onSeeAll }: CategoryRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3 px-4">
        <h3 className="font-display font-bold text-sm">{title}</h3>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="text-[11px] text-primary flex items-center gap-0.5 font-medium"
          >
            See All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {children}
      </div>
    </section>
  );
};
