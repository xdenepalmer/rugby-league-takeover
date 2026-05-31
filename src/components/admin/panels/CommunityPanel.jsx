import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ForumManager from "../ForumManager";
import RegistrationsTable from "../RegistrationsTable";

export default function CommunityPanel() {
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200) });
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200) });

  return (
    <div className="grid gap-8">
      <ForumManager posts={forumPosts} />
      <RegistrationsTable registrations={registrations} />
    </div>
  );
}
