import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileTab from "@/components/account/ProfileTab";
import OrdersTab from "@/components/account/OrdersTab";
import PostsTab from "@/components/account/PostsTab";
import InterestTab from "@/components/account/InterestTab";
import SecurityTab from "@/components/account/SecurityTab";

export default function Account() {
  const { user, isAdmin } = useAuth();
  const displayName = user?.full_name || user?.email?.split("@")[0] || "there";

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">My Account</p>
            <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">Welcome, {displayName}</h1>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button asChild variant="outline" className="rounded-none">
                <Link to="/admin"><ShieldCheck className="mr-2 h-4 w-4" /> Admin</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-none">
              <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to site</Link>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="profile" className="mt-8">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-none bg-transparent p-0">
            {[
              ["profile", "Profile"],
              ["orders", "My Orders"],
              ["posts", "My Posts"],
              ["interest", "My Interest"],
              ["security", "Security"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="profile" className="mt-6"><ProfileTab /></TabsContent>
          <TabsContent value="orders" className="mt-6"><OrdersTab /></TabsContent>
          <TabsContent value="posts" className="mt-6"><PostsTab /></TabsContent>
          <TabsContent value="interest" className="mt-6"><InterestTab /></TabsContent>
          <TabsContent value="security" className="mt-6"><SecurityTab /></TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
