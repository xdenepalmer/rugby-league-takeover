import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    (<input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-none border border-border/60 bg-secondary/35 px-3 py-1 text-sm shadow-inner transition-all placeholder:text-muted-foreground/45 focus-visible:outline-none focus-visible:border-primary/65 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:bg-secondary/60 focus-visible:shadow-[0_0_8px_hsl(var(--primary)/0.15)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
