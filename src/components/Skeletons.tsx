import { motion } from "framer-motion";

export const ChannelCardSkeleton = () => (
  <div className="flex-shrink-0 w-36">
    <div className="skeleton-loading aspect-video rounded-lg mb-2" />
    <div className="skeleton-loading h-3 w-24 mb-1" />
    <div className="skeleton-loading h-2.5 w-16" />
  </div>
);

export const BannerSkeleton = () => (
  <div className="skeleton-loading w-full aspect-[16/7] rounded-xl" />
);

export const MatchCardSkeleton = () => (
  <div className="flex-shrink-0 w-64">
    <div className="skeleton-loading aspect-[16/9] rounded-lg" />
  </div>
);
