import React from 'react';

export const LoadingFallback = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground">
    <div className="relative flex items-center justify-center mb-4">
      {/* Outer pulsing neon circle */}
      <div className="absolute h-12 w-12 rounded-full border-2 border-primary/20 animate-ping" />
      {/* Inner spinning loader */}
      <div className="h-10 w-10 rounded-full border-t-2 border-r-2 border-primary animate-spin" />
    </div>
    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-primary animate-pulse">
      Loading Module...
    </span>
  </div>
);
