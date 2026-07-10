import NativeTopBar from "./NativeTopBar.jsx";

/**
 * Wraps a secondary destination (Gallery, FAQ, Terms, …) in native chrome:
 * a top bar with Back plus the content. Interim screens may render existing
 * web page components inside — they keep working standalone because they
 * fetch their own data and carry their own layout.
 */
export default function NativeSubScreen({ title, fallback = "/", right, children }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <NativeTopBar title={title} fallback={fallback} right={right} />
      {children}
    </div>
  );
}
