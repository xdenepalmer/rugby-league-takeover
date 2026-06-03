import React, { useEffect, useState, useRef } from "react";

export default function LazySection({ children, height = 300, fallback, className = "" }) {
  const [isIntersected, setIsIntersected] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    
    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsIntersected(true);
            observer.disconnect();
          }
        },
        { rootMargin: "250px 0px" } // Load section 250px before it scrolls into view
      );
      observer.observe(ref.current);
      return () => observer.disconnect();
    } else {
      setIsIntersected(true);
    }
  }, []);

  return (
    <div ref={ref} className={className} style={{ minHeight: isIntersected ? "auto" : height }}>
      {isIntersected ? (
        children
      ) : (
        fallback || (
          <div 
            className="w-full bg-neutral-900/10 animate-pulse border border-border/10 flex items-center justify-center text-[10px] font-mono text-muted-foreground/30 uppercase tracking-widest" 
            style={{ height }}
          >
            Loading Section...
          </div>
        )
      )}
    </div>
  );
}
