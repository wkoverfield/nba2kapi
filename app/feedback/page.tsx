"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { motion } from "framer-motion";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fadeIn, slideUp, staggerContainer } from "@/lib/animations";
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
  { value: "feature", label: "Feature", icon: Lightbulb, color: "bg-blue-500" },
  { value: "bug", label: "Bug", icon: Bug, color: "bg-red-500" },
  { value: "improvement", label: "Improvement", icon: MessageSquare, color: "bg-yellow-500" },
  { value: "other", label: "Other", icon: HelpCircle, color: "bg-gray-500" },
];

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
    <div className="min-h-screen">
      <section className="border-b bg-transparent">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="max-w-4xl mx-auto"
          >
            <motion.div variants={slideUp} className="text-center mb-12">
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                Feedback & Suggestions
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Help us improve the NBA 2K API. Submit feature requests, report bugs, or suggest improvements.
                Upvote ideas you'd like to see implemented.
              </p>
            </motion.div>

            <motion.div variants={slideUp} className="mb-8">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="gap-2 w-full sm:w-auto">
                    <Plus className="h-4 w-4" />
                    Submit Feedback
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>Submit Feedback</DialogTitle>
                      <DialogDescription>
                        Share your ideas to help improve the API.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      {/* Type selector */}
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <div className="flex flex-wrap gap-2">
                          {FEEDBACK_TYPES.map((t) => {
                            const Icon = t.icon;
                            return (
                              <Button
                                key={t.value}
                                type="button"
                                variant={type === t.value ? "default" : "outline"}
                                size="sm"
                                onClick={() => setType(t.value)}
                                className="gap-1.5"
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {t.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Title */}
                      <div className="space-y-2">
                        <Label htmlFor="title">
                          Title <span className="text-muted-foreground">({title.length}/100)</span>
                        </Label>
                        <Input
                          id="title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                          placeholder="Short, descriptive title"
                          required
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label htmlFor="description">
                          Description <span className="text-muted-foreground">({description.length}/500)</span>
                        </Label>
                        <textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                          placeholder="Describe your suggestion or issue in detail..."
                          rows={4}
                          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                          required
                        />
                      </div>

                      {/* Name (optional) */}
                      <div className="space-y-2">
                        <Label htmlFor="authorName">
                          Your Name <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="authorName"
                          value={authorName}
                          onChange={(e) => setAuthorName(e.target.value.slice(0, 50))}
                          placeholder="Anonymous"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting || !title.trim() || !description.trim()}
                      >
                        {isSubmitting ? "Submitting..." : "Submit"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </motion.div>

            {/* Feedback List */}
            <motion.div variants={fadeIn} className="space-y-4">
              {feedback === undefined ? (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              ) : feedback.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No feedback yet. Be the first to submit a suggestion!
                  </CardContent>
                </Card>
              ) : (
                feedback.map((item) => {
                  const typeConfig = getTypeConfig(item.type);
                  const Icon = typeConfig.icon;
                  const hasVoted = item.upvoterIds.includes(visitorId);

                  return (
                    <Card key={item._id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex">
                          {/* Upvote section */}
                          <button
                            onClick={() => handleUpvote(item._id, hasVoted)}
                            className={`flex flex-col items-center justify-center px-4 py-4 border-r transition-colors ${
                              hasVoted
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <ChevronUp className={`h-5 w-5 ${hasVoted ? "fill-current" : ""}`} />
                            <span className="text-sm font-semibold">{item.upvotes}</span>
                          </button>

                          {/* Content */}
                          <div className="flex-1 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant="secondary"
                                className={`${typeConfig.color} text-white border-0 gap-1`}
                              >
                                <Icon className="h-3 w-3" />
                                {typeConfig.label}
                              </Badge>
                              {item.status !== "pending" && (
                                <Badge variant="outline" className="capitalize">
                                  {item.status}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold mb-1">{item.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                            <div className="text-xs text-muted-foreground">
                              {item.authorName || "Anonymous"} &bull;{" "}
                              {new Date(item.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
