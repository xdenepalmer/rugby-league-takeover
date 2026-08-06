import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Shirt, Repeat, MessageSquare, Plus, X, Loader2, Sparkles,
  CheckCircle2, ArrowLeftRight, Trash2, Handshake,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { findMatches } from "@/lib/swap-match";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import MediaAttach from "@/components/forum/MediaAttach";
import { hideBrokenImage } from "@/lib/img-fallback";

const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "Kids"];
const CONDITIONS = ["New with tags", "Excellent", "Good", "Well-loved"];

const splitTeams = (raw) =>
  String(raw ?? "")
    .split(",")
    .map((team) => team.trim())
    .filter(Boolean)
    .slice(0, 6);

/* ── Listing card ── */
function ListingCard({ listing, onWithdraw, onConfirm, busy }) {
  const wants = Array.isArray(listing.want_teams) ? listing.want_teams : [];
  const wantSizes = Array.isArray(listing.want_sizes) ? listing.want_sizes : [];
  const completed = listing.status === "completed";

  return (
    <article className={`flex min-w-0 flex-col border bg-card/30 ${completed ? "border-emerald-500/25" : "border-border/60"}`}>
      <div className="relative h-40 overflow-hidden border-b border-border/40 bg-muted/10">
        {listing.image_url ? (
          <img src={listing.image_url} alt={`${listing.have_team} jersey`} onError={hideBrokenImage} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Shirt className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}
        {completed && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Swapped
          </span>
        )}
        {listing.is_me && !completed && (
          <span className="absolute left-2 top-2 border border-primary/40 bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            Your listing
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Has</p>
          <h3 className="truncate text-sm font-bold text-foreground">
            {listing.have_team}
            {listing.have_size ? <span className="ml-1.5 text-muted-foreground">· {listing.have_size}</span> : null}
          </h3>
          {listing.have_condition && (
            <p className="text-[10px] text-muted-foreground">{listing.have_condition}</p>
          )}
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Wants</p>
          {wants.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {wants.map((team) => (
                <span key={team} className="border border-purple-400/25 bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-300">
                  {team}
                </span>
              ))}
              {wantSizes.length > 0 && (
                <span className="border border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {wantSizes.join(" / ")}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[10px] italic text-muted-foreground">Open to offers</p>
          )}
        </div>

        {listing.have_description && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{listing.have_description}</p>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-border/30 pt-2 text-[10px] text-muted-foreground">
          <span className="truncate">
            {listing.display_name}
            {Number(listing.swap_count) > 0 && (
              <span className="ml-1 text-emerald-400">· {Number(listing.swap_count)} swap{Number(listing.swap_count) === 1 ? "" : "s"}</span>
            )}
          </span>
          <span>{listing.created_date ? formatDistanceToNow(new Date(listing.created_date), { addSuffix: true }) : ""}</span>
        </div>

        {!completed && (
          <div className="flex gap-2">
            {listing.thread_id && (
              <Link
                to={`/forum?thread=${listing.thread_id}`}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 border border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Discuss
              </Link>
            )}
            {listing.is_me ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onWithdraw(listing)}
                aria-label="Withdraw listing"
                className="flex h-9 w-9 items-center justify-center border border-border/50 text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onConfirm(listing)}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-500/20"
              >
                <Handshake className="h-3.5 w-3.5" /> We swapped
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/* ── Create listing form ── */
function CreateListingForm({ onClose, onCreated }) {
  const [haveTeam, setHaveTeam] = useState("");
  const [haveSize, setHaveSize] = useState("");
  const [haveCondition, setHaveCondition] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [wantTeamsRaw, setWantTeamsRaw] = useState("");
  const [wantSizes, setWantSizes] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleWantSize = (size) =>
    setWantSizes((current) => (current.includes(size) ? current.filter((s) => s !== size) : [...current, size]));

  const submit = async (event) => {
    event.preventDefault();
    if (!haveTeam.trim() || submitting) return;
    setSubmitting(true);
    try {
      const wantTeams = splitTeams(wantTeamsRaw);
      // The negotiation thread first, through the forum's own front door —
      // its rate limits, ban checks and profanity rules all apply.
      const wantLine = wantTeams.length ? `wanting ${wantTeams.join(", ")}` : "open to offers";
      const threadResponse = await base44.functions.invoke("submitForumPost", {
        title: `SWAP: ${haveTeam.trim()}${haveSize ? ` (${haveSize})` : ""} — ${wantLine}`.slice(0, 120),
        body: [
          `Listed on the Swap Board.`,
          ``,
          `HAVE: ${haveTeam.trim()}${haveSize ? `, size ${haveSize}` : ""}${haveCondition ? `, ${haveCondition.toLowerCase()}` : ""}`,
          `WANT: ${wantTeams.length ? wantTeams.join(", ") : "open to offers"}${wantSizes.length ? ` (${wantSizes.join("/")})` : ""}`,
          description.trim() ? `` : null,
          description.trim() || null,
          ``,
          `Reply here to sort out the swap — swap only, no cash. Post to each other directly; never share your address publicly.`,
        ].filter((line) => line !== null).join("\n"),
        category: "JerseySwap",
        media_url: imageUrl || "",
      });

      const response = await base44.functions.invoke("swapBoard", {
        action: "create",
        haveTeam: haveTeam.trim(),
        haveSize,
        haveCondition,
        haveDescription: description.trim(),
        imageUrl,
        wantTeams,
        wantSizes,
        threadId: threadResponse?.data?.id || "",
      });
      if (!response?.data?.ok) throw new Error(response?.data?.error || "Could not create the listing");

      toast({ title: "Listing live! 🏉", description: "Your jersey is on the board and its forum thread is open." });
      onCreated();
      onClose();
    } catch (error) {
      const payload = error?.response?.data || error?.data || {};
      toast({
        title: "Couldn't create the listing",
        description: payload.error || error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 border border-border/60 bg-card/40 p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground">
          <Plus className="h-4 w-4 text-primary" /> List a jersey
        </p>
        <button type="button" onClick={onClose} aria-label="Close" className="touch-target flex items-center justify-center text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">What jersey do you have?</span>
        <Input value={haveTeam} onChange={(e) => setHaveTeam(e.target.value)} maxLength={48} placeholder="e.g. Canterbury Bulldogs 2024 home" required className="h-11 rounded-none border-border/40" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Size</span>
          <select value={haveSize} onChange={(e) => setHaveSize(e.target.value)} className="h-11 w-full rounded-none border border-border/40 bg-background px-3 text-sm">
            <option value="">Not sure</option>
            {SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Condition</span>
          <select value={haveCondition} onChange={(e) => setHaveCondition(e.target.value)} className="h-11 w-full rounded-none border border-border/40 bg-background px-3 text-sm">
            <option value="">Pick one</option>
            {CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Photo</span>
        <MediaAttach value={imageUrl} onChange={setImageUrl} />
      </label>

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Teams you want (comma-separated, blank = open to offers)</span>
        <Input value={wantTeamsRaw} onChange={(e) => setWantTeamsRaw(e.target.value)} maxLength={200} placeholder="e.g. Leeds Rhinos, Wigan, any Super League" className="h-11 rounded-none border-border/40" />
      </label>

      <div>
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sizes you'd take (none = any)</span>
        <div className="flex flex-wrap gap-1.5">
          {SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => toggleWantSize(size)}
              aria-pressed={wantSizes.includes(size)}
              className={`border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                wantSizes.includes(size)
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes (optional)</span>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="Signed? Player issue? Slight fade? Say so here." className="min-h-16 rounded-none border-border/40 resize-none" />
      </label>

      <Button type="submit" disabled={submitting || !haveTeam.trim()} className="h-11 w-full rounded-none text-[11px] font-bold uppercase tracking-wider">
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Repeat className="mr-2 h-4 w-4" />}
        Put it on the board
      </Button>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Swap only — no cash sales. Listing also opens a forum thread where the swap is arranged.
        Never share your postal address publicly; sort delivery in replies or in person at the Vegas event.
      </p>
    </form>
  );
}

/* ── Confirm-swap chooser ── */
function ConfirmSwapSheet({ target, myListings, onCancel, onPick, busy }) {
  return (
    <div className="border border-emerald-500/30 bg-emerald-500/[0.05] p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
        Which of your listings did you swap for {target.have_team}?
      </p>
      <div className="grid gap-2">
        {myListings.map((mine) => (
          <button
            key={mine.id}
            type="button"
            disabled={busy}
            onClick={() => onPick(mine)}
            className="flex items-center justify-between border border-border/50 bg-background/40 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:border-emerald-500/50"
          >
            <span className="truncate">{mine.have_team}{mine.have_size ? ` (${mine.have_size})` : ""}</span>
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-emerald-400" />
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Both sides must confirm before the swap counts. When your partner confirms too, you each earn
        150 chips, 50 XP and the Jersey Swapper badge.
      </p>
      <Button type="button" variant="outline" onClick={onCancel} className="h-9 w-full rounded-none border-border/50 text-[10px] font-bold uppercase tracking-wider">
        Cancel
      </Button>
    </div>
  );
}

/* ── Page ── */
export default function SwapBoard() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["swapListings"],
    queryFn: () => base44.entities.SwapListing.list("-created_date", 200),
    enabled: appParams.hasBase44Config,
    staleTime: 30_000,
  });

  const active = useMemo(() => listings.filter((listing) => listing.status === "active"), [listings]);
  const recentSwaps = useMemo(
    () => listings.filter((listing) => listing.status === "completed").slice(0, 6),
    [listings],
  );
  const myActive = useMemo(() => active.filter((listing) => listing.is_me), [active]);
  const matches = useMemo(() => findMatches(myActive, active), [myActive, active]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["swapListings"] });

  const withdrawMutation = useMutation({
    mutationFn: (listing) => base44.functions.invoke("swapBoard", { action: "withdraw", listingId: listing.id }),
    onSuccess: () => {
      toast({ title: "Listing withdrawn" });
      refresh();
    },
    onError: (error) => {
      const payload = error?.response?.data || error?.data || {};
      toast({ title: "Couldn't withdraw", description: payload.error || error?.message, variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: ({ mine, theirs }) =>
      base44.functions.invoke("swapBoard", { action: "confirm", listingId: mine.id, counterpartListingId: theirs.id }),
    onSuccess: (response) => {
      const data = response?.data || {};
      if (data.state === "completed") {
        toast({ title: "Swap complete! 🏉🤝", description: "+150 chips, +50 XP and the Jersey Swapper badge for both of you." });
      } else {
        toast({ title: "Confirmed on your side", description: data.message || "The swap completes when your partner confirms too." });
      }
      setConfirmTarget(null);
      refresh();
    },
    onError: (error) => {
      const payload = error?.response?.data || error?.data || {};
      toast({ title: "Couldn't confirm the swap", description: payload.error || error?.message, variant: "destructive" });
    },
  });

  const busy = withdrawMutation.isPending || confirmMutation.isPending;

  const startConfirm = (theirs) => {
    if (!isAuthenticated) return navigate("/login");
    if (myActive.length === 0) {
      toast({ title: "List a jersey first", description: "A swap is confirmed between two listings — put yours on the board." });
      return;
    }
    if (myActive.length === 1) {
      confirmMutation.mutate({ mine: myActive[0], theirs });
      return;
    }
    setConfirmTarget(theirs);
  };

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-purple-400">Fan to fan</p>
          <h1 className="mt-2 font-display text-4xl uppercase leading-none tracking-wide text-foreground sm:text-5xl">
            Jersey Swap Board
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Trade the supporter gear you&apos;re not wearing for jerseys from clubs across the world — the way
            fans already do it, with a board to find each other. Swap only, no cash. Confirmed swaps earn
            chips and the Jersey Swapper badge.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => (isAuthenticated ? setShowCreate((current) => !current) : navigate("/login"))}
          className="h-11 rounded-none px-5 text-[11px] font-bold uppercase tracking-wider"
        >
          <Plus className="mr-2 h-4 w-4" /> List a jersey
        </Button>
      </div>

      {showCreate && (
        <div className="mb-6 max-w-2xl">
          <CreateListingForm onClose={() => setShowCreate(false)} onCreated={refresh} />
        </div>
      )}

      {confirmTarget && (
        <div className="mb-6 max-w-xl">
          <ConfirmSwapSheet
            target={confirmTarget}
            myListings={myActive}
            busy={busy}
            onCancel={() => setConfirmTarget(null)}
            onPick={(mine) => confirmMutation.mutate({ mine, theirs: confirmTarget })}
          />
        </div>
      )}

      {/* Mutual matches */}
      {matches.length > 0 && (
        <section aria-labelledby="swap-matches-heading" className="mb-8 border border-purple-400/30 bg-purple-500/[0.05] p-4">
          <h2 id="swap-matches-heading" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-300">
            <Sparkles className="h-4 w-4" /> Your matches
          </h2>
          <div className="mt-3 grid gap-2">
            {matches.slice(0, 6).map(({ mine, theirs }) => (
              <div key={`${mine.id}-${theirs.id}`} className="flex flex-wrap items-center justify-between gap-2 border border-border/40 bg-background/40 px-3 py-2.5">
                <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                  Your <span className="font-bold">{mine.have_team}</span>
                  <ArrowLeftRight className="mx-2 inline h-3.5 w-3.5 text-purple-400" />
                  {theirs.display_name}&apos;s <span className="font-bold">{theirs.have_team}</span>
                </p>
                <div className="flex gap-2">
                  {theirs.thread_id && (
                    <Link to={`/forum?thread=${theirs.thread_id}`} className="flex h-9 items-center border border-border/50 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                      Discuss
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => confirmMutation.mutate({ mine, theirs })}
                    className="flex h-9 items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 px-3 text-[10px] font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <Handshake className="h-3.5 w-3.5" /> We swapped
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Board */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse border border-border/30 bg-card/20" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="border border-border/40 bg-card/20 p-10 text-center">
          <Shirt className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-bold uppercase tracking-wider text-foreground">The board is empty</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
            Got supporter gear you&apos;re not using? Be the first to list it. Bulldogs for Rhinos started
            this whole thing — your swap could be next.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {active.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              busy={busy}
              onWithdraw={(l) => withdrawMutation.mutate(l)}
              onConfirm={startConfirm}
            />
          ))}
        </div>
      )}

      {/* Recent swaps — social proof */}
      {recentSwaps.length > 0 && (
        <section aria-labelledby="recent-swaps-heading" className="mt-10">
          <h2 id="recent-swaps-heading" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Recently swapped
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recentSwaps.map((listing) => (
              <ListingCard key={listing.id} listing={listing} busy={busy} onWithdraw={() => {}} onConfirm={() => {}} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 border-t border-border/30 pt-4 text-[10px] leading-relaxed text-muted-foreground">
        The Swap Board is fan-to-fan: RLT hosts the introductions, you arrange the swap in the forum thread
        or in person at the Las Vegas event. Swap only — listings offering or asking for money are removed.
        Never post your home address publicly.
      </p>
    </main>
  );
}
