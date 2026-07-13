"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronUp, Plus, MessageSquare, Bug, Lightbulb, HelpCircle } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

// Get or create a persistent visitor ID for upvoting
function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("nba2kapi-visitor-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("nba2kapi-visitor-id", id);
  }
  return id;
}

const FEEDBACK_TYPES = [
  { value: "feature", label: "Feature", icon: Lightbulb, dot: "#3b6fd4" },
  { value: "bug", label: "Bug", icon: Bug, dot: "#c2410c" },
  { value: "improvement", label: "Improvement", icon: MessageSquare, dot: "#b7791f" },
  { value: "other", label: "Other", icon: HelpCircle, dot: "#8a8577" },
];

const INPUT_CLASS =
  "flex w-full rounded-lg border border-[#e5e2da] bg-white px-3 py-2 text-[14px] text-[#1a1918] placeholder:text-[#b5b0a1] focus-visible:outline-none focus-visible:border-[#1a1918] disabled:cursor-not-allowed disabled:opacity-50";

const LABEL_CLASS = "text-[12px] font-medium text-[#57534a]";

export default function FeedbackPage() {
  const [visitorId, setVisitorId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [type, setType] = useState("feature");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const feedback = useQuery(api.feedback.getFeedback);
  const submitFeedback = useMutation(api.feedback.submitFeedback);
  const upvoteFeedback = useMutation(api.feedback.upvoteFeedback);
  const removeUpvote = useMutation(api.feedback.removeUpvote);

  useEffect(() => {
    // Visitor ID lives in localStorage, so it must be read on the client after
    // mount to avoid an SSR/hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisitorId(getVisitorId());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      await submitFeedback({
        type,
        title,
        description,
        authorName: authorName || undefined,
        visitorId,
      });
      setDialogOpen(false);
      setTitle("");
      setDescription("");
      setAuthorName("");
      setType("feature");
    } catch {
      // Error logged server-side, generic message for users
    }
    setIsSubmitting(false);
  };

  const handleUpvote = async (feedbackId: Id<"feedback">, hasVoted: boolean) => {
    try {
      if (hasVoted) {
        await removeUpvote({ feedbackId, visitorId });
      } else {
        await upvoteFeedback({ feedbackId, visitorId });
      }
    } catch {
      // Error logged server-side, generic message for users
    }
  };

  const getTypeConfig = (typeValue: string) => {
    return FEEDBACK_TYPES.find((t) => t.value === typeValue) || FEEDBACK_TYPES[3];
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,#fffdf8,#faf9f5_420px)] font-body text-[#1a1918]">
      <TopNav />

      <main className="mx-auto max-w-[1360px] px-[clamp(20px,4vw,48px)] pt-2 pb-16">
        <div className="mx-auto max-w-[760px]">
          {/* Header */}
          <div className="pt-8 pb-9">
            <div className="mb-3 font-plex text-[11px] tracking-[0.12em] text-[#8a8577]">
              FEEDBACK
            </div>
            <h1 className="font-display text-[clamp(32px,5vw,44px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#1a1918]">
              Feature requests & bugs
            </h1>
            <p className="mt-3.5 max-w-[540px] text-[15px] leading-[1.6] text-[#57534a]">
              Suggest features, report bugs, and upvote what you want built next.
            </p>

            <div className="mt-6">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1a1918] px-5 py-2.5 text-[13.5px] font-semibold text-[#faf9f5] no-underline transition-[background,transform] duration-150 ease-out hover:bg-[#333] active:scale-[0.97] motion-reduce:transition-none"
                  >
                    <Plus className="h-4 w-4" />
                    Submit feedback
                  </button>
                </DialogTrigger>
                <DialogContent className="border-[#e5e2da] bg-[#faf9f5] text-[#1a1918] sm:max-w-lg">
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle className="font-display text-[19px] font-extrabold tracking-[-0.01em] text-[#1a1918]">
                        Submit feedback
                      </DialogTitle>
                      <DialogDescription className="text-[13.5px] text-[#8a8577]">
                        Share an idea or issue to help shape the API.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      {/* Type selector */}
                      <div className="space-y-2">
                        <div className={LABEL_CLASS}>Type</div>
                        <div className="flex flex-wrap gap-2">
                          {FEEDBACK_TYPES.map((t) => {
                            const Icon = t.icon;
                            const selected = type === t.value;
                            return (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => setType(t.value)}
                                className={
                                  selected
                                    ? "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#1a1918] bg-[#1a1918] px-3 py-1.5 text-[12.5px] font-medium text-[#faf9f5] transition-colors duration-150"
                                    : "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#e5e2da] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#57534a] transition-colors duration-150 hover:border-[#1a1918]"
                                }
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Title */}
                      <div className="space-y-2">
                        <label htmlFor="title" className={LABEL_CLASS}>
                          Title <span className="text-[#b5b0a1]">({title.length}/100)</span>
                        </label>
                        <input
                          id="title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                          placeholder="Short, descriptive title"
                          className={INPUT_CLASS}
                          required
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <label htmlFor="description" className={LABEL_CLASS}>
                          Description{" "}
                          <span className="text-[#b5b0a1]">({description.length}/500)</span>
                        </label>
                        <textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                          placeholder="Describe your suggestion or issue in detail"
                          rows={4}
                          className={INPUT_CLASS + " resize-none"}
                          required
                        />
                      </div>

                      {/* Name (optional) */}
                      <div className="space-y-2">
                        <label htmlFor="authorName" className={LABEL_CLASS}>
                          Your name <span className="text-[#b5b0a1]">(optional)</span>
                        </label>
                        <input
                          id="authorName"
                          value={authorName}
                          onChange={(e) => setAuthorName(e.target.value.slice(0, 50))}
                          placeholder="Anonymous"
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <button
                        type="button"
                        onClick={() => setDialogOpen(false)}
                        className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[#e5e2da] bg-white px-4 py-2 text-[13.5px] font-medium text-[#57534a] transition-colors duration-150 hover:border-[#1a1918]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || !title.trim() || !description.trim()}
                        className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#1a1918] px-5 py-2 text-[13.5px] font-semibold text-[#faf9f5] transition-[background,transform] duration-150 ease-out hover:bg-[#333] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                      >
                        {isSubmitting ? "Submitting..." : "Submit"}
                      </button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Feedback List */}
          <div className="space-y-3">
            {feedback === undefined ? (
              <div className="py-16 text-center text-[14px] text-[#8a8577]">Loading...</div>
            ) : feedback.length === 0 ? (
              <div className="rounded-2xl border border-[#e5e2da] bg-white py-16 text-center text-[14px] text-[#8a8577]">
                No feedback yet. Be the first to submit a suggestion.
              </div>
            ) : (
              feedback.map((item) => {
                const typeConfig = getTypeConfig(item.type);
                const hasVoted = item.upvoterIds.includes(visitorId);

                return (
                  <div
                    key={item._id}
                    className="overflow-hidden rounded-2xl border border-[#e5e2da] bg-white transition-colors duration-150 hover:border-[#d8d4c8]"
                  >
                    <div className="flex">
                      {/* Upvote column */}
                      <button
                        onClick={() => handleUpvote(item._id, hasVoted)}
                        aria-pressed={hasVoted}
                        className={
                          hasVoted
                            ? "flex w-[64px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 border-r border-[#e5e2da] bg-[#1a1918] py-5 text-[#faf9f5] transition-colors duration-150"
                            : "flex w-[64px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 border-r border-[#e5e2da] bg-[#faf9f5] py-5 text-[#8a8577] transition-colors duration-150 hover:bg-[#f1efe8] hover:text-[#1a1918]"
                        }
                      >
                        <ChevronUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
                        <span className="text-[13px] font-semibold tabular-nums">{item.upvotes}</span>
                      </button>

                      {/* Content */}
                      <div className="flex-1 px-5 py-4">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e2da] bg-[#faf9f5] px-2.5 py-1 text-[11px] font-medium text-[#57534a]">
                            <span
                              className="h-[7px] w-[7px] rounded-full"
                              style={{ backgroundColor: typeConfig.dot }}
                            />
                            {typeConfig.label}
                          </span>
                          {item.status !== "pending" && (
                            <span className="inline-flex items-center rounded-full border border-[#e5e2da] px-2.5 py-1 text-[11px] font-medium capitalize text-[#8a8577]">
                              {item.status}
                            </span>
                          )}
                        </div>
                        <h3 className="text-[15px] font-semibold leading-snug text-[#1a1918]">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-[13.5px] leading-[1.55] text-[#57534a]">
                          {item.description}
                        </p>
                        <div className="mt-2.5 font-plex text-[11px] text-[#b5b0a1]">
                          {item.authorName || "Anonymous"} &bull;{" "}
                          {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <FooterStrip />
    </div>
  );
}
