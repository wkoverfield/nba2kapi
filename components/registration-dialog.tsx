"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ApiKeyDisplay } from "@/components/api-key-display";
import { AlertCircle, CheckCircle2, Copy, Play, Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

interface RegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (apiKey: string) => void;
}

export function RegistrationDialog({
  open,
  onOpenChange,
  onSuccess,
}: RegistrationDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [demoResult, setDemoResult] = useState<any>(null);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const createApiKey = useMutation(api.apiKeys.createApiKey);

  const API_BASE = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") || "https://api.nba2kapi.com";

  const getCurlCommand = (key: string) =>
    `curl -H "X-API-Key: ${key}" ${API_BASE}/api/players/slug/lebron-james`;

  const copyCommand = async () => {
    if (!newApiKey) return;
    await navigator.clipboard.writeText(getCurlCommand(newApiKey));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runDemoCall = async () => {
    if (!newApiKey) return;
    setIsDemoLoading(true);
    setDemoResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/players/slug/lebron-james`, {
        headers: { "X-API-Key": newApiKey }
      });
      const data = await response.json();
      setDemoResult(data);
    } catch (err) {
      setDemoResult({ success: false, error: { message: "Failed to make request" } });
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await createApiKey({
        email,
        name,
        purpose: purpose || undefined,
      });

      setNewApiKey(result.apiKey);

      // Store in localStorage
      localStorage.setItem("nba2k_api_key", result.apiKey);

      // Call onSuccess callback
      if (onSuccess) {
        onSuccess(result.apiKey);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create API key. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (newApiKey) {
      // Reset form after successful registration
      setEmail("");
      setName("");
      setPurpose("");
      setNewApiKey(null);
      setError(null);
      setDemoResult(null);
      setCopied(false);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {!newApiKey ? (
          <>
            <DialogHeader>
              <DialogTitle>Get Your API Key</DialogTitle>
              <DialogDescription>
                Create a free API key to access NBA 2K player ratings and
                statistics.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">
                  What will you use this API for? (Optional)
                </Label>
                <Input
                  id="purpose"
                  type="text"
                  placeholder="e.g., Discord bot, mobile app, website"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create API Key"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                API Key Created!
              </DialogTitle>
              <DialogDescription>
                Your API key has been created successfully. Make sure to save
                it somewhere safe - you won't be able to see it again!
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <ApiKeyDisplay apiKey={newApiKey} />

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Save your API key now. For
                  security reasons, we won't show it again. You can regenerate
                  it later if needed.
                </AlertDescription>
              </Alert>

              {/* Try It Now Section */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold text-sm">Try your first API call:</h4>

                <div className="rounded-lg bg-slate-950 p-3 overflow-x-auto">
                  <code className="text-xs text-green-400 whitespace-pre-wrap break-all">
                    {getCurlCommand(newApiKey)}
                  </code>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyCommand}
                    className="flex-1"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={runDemoCall}
                    disabled={isDemoLoading}
                    className="flex-1"
                  >
                    {isDemoLoading ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3 mr-1" />
                    )}
                    Run Now
                  </Button>
                </div>

                {demoResult && (
                  <div className="rounded-lg bg-slate-100 dark:bg-slate-900 p-3">
                    {demoResult.success ? (
                      <>
                        <Badge variant="default" className="mb-2">
                          Success! Your API key works.
                        </Badge>
                        <pre className="text-xs overflow-auto max-h-32 mt-2">
                          {JSON.stringify(demoResult.data, null, 2)}
                        </pre>
                      </>
                    ) : (
                      <Badge variant="destructive">
                        Error: {demoResult.error?.message || "Request failed"}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Go to Dashboard
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
