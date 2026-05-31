import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MessagesSquare, Activity } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ForumManager from "../ForumManager";
import RegistrationsTable from "../RegistrationsTable";

export default function CommunityPanel() {
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200) });
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200) });

  return (
    <div className="grid gap-5">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <div className="cmd-accent-bar h-[2px] w-full" />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <MessagesSquare className="h-4 w-4 text-primary" />
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">
              Community Module
            </p>
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-primary/5 border border-primary/10">
              <Activity className="h-2.5 w-2.5 text-primary cmd-pulse" />
              <span className="text-[8px] font-bold uppercase tracking-wider text-primary">Live</span>
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">
            Community Hub
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Moderate fan discussions, review interest registrations, and manage community engagement.
            Keep the conversation on-topic and the community thriving.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <ForumManager posts={forumPosts} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <RegistrationsTable registrations={registrations} />
      </motion.div>
    </div>
  );
}
