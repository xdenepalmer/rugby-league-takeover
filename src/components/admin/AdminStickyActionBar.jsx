export default function AdminStickyActionBar({ children, className = "" }) {
  return (
    <div className={`sticky bottom-0 z-20 -mx-5 border-t border-border bg-background/95 px-5 py-3 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 ${className}`}>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
        {children}
      </div>
    </div>
  );
}
