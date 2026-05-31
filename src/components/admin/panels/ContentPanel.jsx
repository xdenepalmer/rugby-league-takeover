import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import NewsManager from "../NewsManager";
import EventsManager from "../EventsManager";
import TravelPackagesManager from "../TravelPackagesManager";

export default function ContentPanel() {
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50) });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.EventContent.list("sort_order", 100) });
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => base44.entities.TravelPackage.list("sort_order", 200) });

  return (
    <div className="grid gap-8">
      <NewsManager articles={news} />
      <EventsManager events={events} />
      <TravelPackagesManager packages={packages} />
    </div>
  );
}
