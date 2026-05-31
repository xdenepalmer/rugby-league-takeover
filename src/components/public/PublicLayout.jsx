import React from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import SiteNav from "./SiteNav";

export default function PublicLayout() {
  const { data: settingsRecords = [] } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    enabled: appParams.hasBase44Config,
  });

  return (
    <>
      <SiteNav settings={settingsRecords[0] || {}} />
      <Outlet />
    </>
  );
}