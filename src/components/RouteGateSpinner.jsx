import React from "react";

// Full-screen spinner shown by the route gates while auth/settings resolve.
export default function RouteGateSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
    </div>
  );
}
