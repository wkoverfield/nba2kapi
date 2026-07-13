"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, CheckCircle2 } from "lucide-react";

const CATEGORIES = [
  { value: "app", label: "App" },
  { value: "league-tool", label: "League tool" },
  { value: "bot", label: "Bot" },
  { value: "data-viz", label: "Data viz" },
  { value: "other", label: "Other" },
];

const INPUT_CLASS =
  "flex w-full rounded-lg border border-[#e5e2da] bg-white px-3 py-2 text-[14px] text-[#1a1918] placeholder:text-[#b5b0a1] focus-visible:outline-none focus-visible:border-[#1a1918] disabled:cursor-not-allowed disabled:opacity-50";

const LABEL_CLASS = "text-[12px] font-medium text-[#57534a]";

export function SubmitProjectDialog() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("app");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitProject = useMutation(api.showcase.submitProject);

  const reset = () => {
    setName("");
    setUrl("");
    setDescription("");
    setCategory("app");
    setSubmitterName("");
    setSubmitterEmail("");
    setError(null);
    setSubmitted(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTimeout(reset, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim() || !description.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await submitProject({
        name,
        url,
        description,
        category,
        submitterName: submitterName || undefined,
        submitterEmail: submitterEmail || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1a1918] px-5 py-2.5 text-[13.5px] font-semibold text-[#faf9f5] no-underline transition-[background,transform] duration-150 ease-out hover:bg-[#333] active:scale-[0.97] motion-reduce:transition-none"
        >
          <Plus className="h-4 w-4" />
          Submit a project
        </button>
      </DialogTrigger>
      <DialogContent className="border-[#e5e2da] bg-[#faf9f5] text-[#1a1918] sm:max-w-lg">
        {submitted ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-[#0a7f3f]" strokeWidth={1.75} />
            <h2 className="mt-4 font-display text-[20px] font-extrabold tracking-[-0.01em] text-[#1a1918]">
              Thanks, it’s in the queue
            </h2>
            <p className="mt-2 max-w-[340px] text-[13.5px] leading-[1.55] text-[#57534a]">
              We review each submission before it goes live, so your project will show up on the
              showcase once it’s approved.
            </p>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-full bg-[#1a1918] px-5 py-2 text-[13.5px] font-semibold text-[#faf9f5] transition-[background,transform] duration-150 ease-out hover:bg-[#333] active:scale-[0.97] motion-reduce:transition-none"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="font-display text-[19px] font-extrabold tracking-[-0.01em] text-[#1a1918]">
                Submit a project
              </DialogTitle>
              <DialogDescription className="text-[13.5px] text-[#8a8577]">
                Built something on nba2kapi? Share it and we’ll feature it after a quick review.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <div className={LABEL_CLASS}>Category</div>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((t) => {
                    const selected = category === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setCategory(t.value)}
                        className={
                          selected
                            ? "inline-flex cursor-pointer items-center rounded-full border border-[#1a1918] bg-[#1a1918] px-3 py-1.5 text-[12.5px] font-medium text-[#faf9f5] transition-colors duration-150"
                            : "inline-flex cursor-pointer items-center rounded-full border border-[#e5e2da] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#57534a] transition-colors duration-150 hover:border-[#1a1918]"
                        }
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="sc-name" className={LABEL_CLASS}>
                  Project name <span className="text-[#b5b0a1]">({name.length}/60)</span>
                </label>
                <input
                  id="sc-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 60))}
                  placeholder="Blacktop Blitz"
                  className={INPUT_CLASS}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="sc-url" className={LABEL_CLASS}>
                  URL
                </label>
                <input
                  id="sc-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value.slice(0, 300))}
                  placeholder="https://yourproject.com"
                  className={INPUT_CLASS}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="sc-desc" className={LABEL_CLASS}>
                  Description <span className="text-[#b5b0a1]">({description.length}/240)</span>
                </label>
                <textarea
                  id="sc-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 240))}
                  placeholder="One line on what it does and how it uses the API."
                  rows={3}
                  className={INPUT_CLASS + " resize-none"}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="sc-author" className={LABEL_CLASS}>
                    Your name <span className="text-[#b5b0a1]">(optional)</span>
                  </label>
                  <input
                    id="sc-author"
                    value={submitterName}
                    onChange={(e) => setSubmitterName(e.target.value.slice(0, 60))}
                    placeholder="Anonymous"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sc-email" className={LABEL_CLASS}>
                    Email <span className="text-[#b5b0a1]">(optional, private)</span>
                  </label>
                  <input
                    id="sc-email"
                    type="email"
                    value={submitterEmail}
                    onChange={(e) => setSubmitterEmail(e.target.value.slice(0, 120))}
                    placeholder="you@email.com"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {error && <p className="text-[13px] text-[#c2410c]">{error}</p>}
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[#e5e2da] bg-white px-4 py-2 text-[13.5px] font-medium text-[#57534a] transition-colors duration-150 hover:border-[#1a1918]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim() || !url.trim() || !description.trim()}
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#1a1918] px-5 py-2 text-[13.5px] font-semibold text-[#faf9f5] transition-[background,transform] duration-150 ease-out hover:bg-[#333] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
