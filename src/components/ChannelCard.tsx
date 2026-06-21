import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { Link } from "react-router-dom";

interface ChannelCardProps {
  id: string;
  name: string;
  image: string;
  category: string;
  isPro: boolean;
  channelNumber?: number;
  gridMode?: boolean;
}

export const ChannelCard = ({ id, name, image, category, isPro, channelNumber, gridMode }: ChannelCardProps) => {
  return (
    <Link to={`/channel/${id}`} className={gridMode ? "block" : "flex-shrink-0 w-36 min-w-0 group"}>
      <motion.div
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="relative aspect-video rounded-xl overflow-hidden bg-card mb-2 group"
      >
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="gradient-card absolute inset-0" />
        <div className="absolute top-2 right-2">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            isPro ? "bg-gold text-gold-foreground" : "bg-primary text-primary-foreground"
          }`}>
            {isPro ? "PRO" : "FREE"}
          </span>
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
          {channelNumber && (
            <span className="text-[10px] text-muted-foreground font-body">CH {channelNumber}</span>
          )}
          <div className="w-7 h-7 rounded-full bg-primary/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-3 h-3 fill-current" />
          </div>
        </div>
      </motion.div>
      <p className="text-xs font-semibold truncate">{name}</p>
      <p className="text-[10px] text-muted-foreground">{category}</p>
    </Link>
  );
};
