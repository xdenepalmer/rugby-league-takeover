import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessagesSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminPanelHeader from "../shared/AdminPanelHeader";
import AdminPanelTabs from "../shared/AdminPanelTabs";
import ForumManager from "../ForumManager";

export default function CommunityPanel() {
  const [activeTab, setActiveTab] = useState("forum");
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200) });

  const tabs = [
    { id: "forum", label: "Forum Moderation", icon: MessagesSquare, count: forumPosts.length },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <AdminPanelHeader
        icon={MessagesSquare}
        module="Community Module"
        title="Community Hub"
        description="Moderate fan discussions and manage community engagement. Keep the conversation on-topic and the community thriving."
      />

      <AdminPanelTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        layoutId="community-subtabs-glow"
        ariaLabel="Community tabs"
      />

      {/* Active Tab Panel */}
      <div className="min-h-[250px]">
        <AnimatePresence mode="wait">
          {activeTab === "forum" && (
            <motion.div
              key="forum-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <ForumManager posts={forumPosts} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
