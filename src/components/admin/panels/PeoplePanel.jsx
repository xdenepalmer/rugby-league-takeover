import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Users, UserPlus, Ban, UserCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminPanelHeader from "../shared/AdminPanelHeader";
import AdminPanelTabs from "../shared/AdminPanelTabs";
import UsersManager from "../UsersManager";
import UserInviteManager from "../UserInviteManager";
import BansManager from "../BansManager";
import RegistrationsTable from "../RegistrationsTable";

export default function PeoplePanel() {
  const [activeTab, setActiveTab] = useState("users");
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200) });

  const tabs = [
    { id: "users", label: "User Accounts", icon: Users },
    { id: "registrations", label: "Interest Registrations", icon: UserCheck, count: registrations.length },
    { id: "invites", label: "Invites & Handover", icon: UserPlus },
    { id: "bans", label: "Bans & Blocks", icon: Ban },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <AdminPanelHeader
        icon={Users}
        module="People Module"
        title="People & Access"
        description="Manage user accounts, send invitations, and control access bans. Full user lifecycle management from onboarding to moderation."
      />

      <AdminPanelTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        layoutId="people-subtabs-glow"
        ariaLabel="People tabs"
      />

      {/* Active Tab Panel */}
      <div className="min-h-[250px]" role="tabpanel">
        <AnimatePresence mode="wait">
          {activeTab === "users" && (
            <motion.div
              key="users-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <UsersManager />
            </motion.div>
          )}

          {activeTab === "registrations" && (
            <motion.div
              key="registrations-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <RegistrationsTable registrations={registrations} />
            </motion.div>
          )}

          {activeTab === "invites" && (
            <motion.div
              key="invites-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <UserInviteManager />
            </motion.div>
          )}

          {activeTab === "bans" && (
            <motion.div
              key="bans-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <BansManager />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
