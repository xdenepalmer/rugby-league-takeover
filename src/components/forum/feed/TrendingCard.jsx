/* ━━━ Trending Card (Premium) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { memo } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Eye } from "lucide-react";
import { getCategoryMeta, getEngagement } from "./forumHelpers";

const TrendingCard = memo(function TrendingCard({ thread, rank, onClick }) {
  const meta = getCategoryMeta(thread.category);
  const engagement = getEngagement(thread);
  const MetaIcon = meta.icon;

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={onClick}
      className="group relative overflow-hidden border border-border/30 bg-card/30 hover:border-primary/25 transition-all duration-300 cursor-pointer"
    >
      {/* Rank accent */}
      <div className={`absolute top-0 left-0 w-8 h-8 bg-gradient-to-br ${meta.gradient} flex items-end justify-start p-1`}>
        <span className="font-display text-lg font-bold text-foreground/60 leading-none">
          {rank}
        </span>
      </div>

      <div className="pl-10 pr-4 py-3">
        <div className="flex items-center gap-1.5 mb-1">
          <MetaIcon className={`h-2.5 w-2.5 ${meta.accent}`} />
          <span className={`text-[8px] font-bold uppercase tracking-wider ${meta.accent}`}>
            {meta.label}
          </span>
        </div>
        <p className="text-xs font-bold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {thread.title}
        </p>
        <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground/50">
          <span className="flex items-center gap-1">
            <Heart className="h-2.5 w-2.5" /> {engagement.likes}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-2.5 w-2.5" /> {(thread.replies || []).length}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-2.5 w-2.5" /> {engagement.views}
          </span>
        </div>
      </div>

      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/3 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </motion.div>
  );
});

export default TrendingCard;
