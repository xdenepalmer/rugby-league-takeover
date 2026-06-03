/* ━━━ AdminFilterBar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Compact horizontal filter strip for admin list views.
 * Search input + filter pills + sort dropdown.
 * Collapses to search icon on mobile that expands.
 *
 * Usage:
 *   <AdminFilterBar
 *     searchValue={search}
 *     onSearch={setSearch}
 *     searchPlaceholder="Search orders..."
 *     filters={[
 *       { label: "All", value: "all", active: true },
 *       { label: "Pending", value: "pending", count: 3 },
 *       { label: "Shipped", value: "shipped" },
 *     ]}
 *     onFilterChange={(value) => setFilter(value)}
 *     sortOptions={[
 *       { label: "Newest", value: "-created_date" },
 *       { label: "Oldest", value: "created_date" },
 *     ]}
 *     sortValue={sort}
 *     onSortChange={setSort}
 *   />
 */
import React, { useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminFilterBar({
  searchValue = "",
  onSearch,
  searchPlaceholder = "Search…",
  filters = [],
  onFilterChange,
  sortOptions = [],
  sortValue,
  onSortChange,
  resultCount,
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Top row: search + sort */}
      <div className="flex items-center gap-2">
        {/* Mobile search toggle */}
        <button
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          className="p-2.5 border border-border/40 bg-card/20 text-muted-foreground hover:text-foreground transition-colors sm:hidden"
          aria-label="Toggle search"
        >
          {mobileSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </button>

        {/* Desktop search (always visible) */}
        <div className="hidden sm:block relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={searchValue}
            onChange={(e) => onSearch?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 pl-9 rounded-none border-border/40 bg-card/20 text-sm"
          />
          {searchValue && (
            <button
              onClick={() => onSearch?.("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter pills (scroll on mobile) */}
        {filters.length > 0 && (
          <div className="flex-1 overflow-x-auto sm:flex-initial">
            <div className="flex items-center gap-1.5 min-w-max">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => onFilterChange?.(filter.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] whitespace-nowrap transition-all border ${
                    filter.active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/30 bg-card/10 text-muted-foreground hover:border-border/60 hover:text-foreground"
                  }`}
                >
                  {filter.label}
                  {filter.count != null && (
                    <span className={`text-[9px] font-mono ${filter.active ? "text-primary" : "text-muted-foreground/60"}`}>
                      {filter.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sort dropdown */}
        {sortOptions.length > 0 && (
          <Select value={sortValue} onValueChange={onSortChange}>
            <SelectTrigger className="h-10 w-auto min-w-[120px] rounded-none border-border/40 bg-card/20 text-xs gap-1.5 ml-auto">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Result count */}
        {resultCount != null && (
          <span className="hidden sm:block text-[10px] font-mono text-muted-foreground whitespace-nowrap">
            {resultCount} {resultCount === 1 ? "result" : "results"}
          </span>
        )}
      </div>

      {/* Mobile search (expanded) */}
      {mobileSearchOpen && (
        <div className="relative sm:hidden">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={searchValue}
            onChange={(e) => onSearch?.(e.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
            className="h-11 pl-9 rounded-none border-border/40 bg-card/20 text-sm"
          />
          {searchValue && (
            <button
              onClick={() => onSearch?.("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
