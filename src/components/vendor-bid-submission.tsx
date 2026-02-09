"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  DollarSign,
  Clock,
  Send,
  FileText,
  Calendar,
  Film,
  Eye,
} from "lucide-react";

interface BidRequest {
  id: string;
  turnover_id: string;
  status: string;
  deadline: string | null;
  notes: string | null;
  created_at: string;
  turnover: {
    id: string;
    turnover_number: number;
    title: string | null;
    project: {
      id: string;
      name: string;
      code: string;
    };
  };
  bids: Bid[];
}

interface Bid {
  id: string;
  price_cents: number | null;
  currency: string;
  timeline_days: number | null;
  timeline_notes: string | null;
  notes: string | null;
  submitted_at: string;
}

interface VendorBidSubmissionProps {
  bidRequest: BidRequest;
  userId: string;
  onSubmit?: () => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600",
  viewed: "bg-blue-500/20 text-blue-600",
  submitted: "bg-green-500/20 text-green-600",
  accepted: "bg-emerald-500/20 text-emerald-600",
  rejected: "bg-red-500/20 text-red-600",
  expired: "bg-gray-500/20 text-gray-600",
};

export function VendorBidSubmission({
  bidRequest,
  userId,
  onSubmit,
}: VendorBidSubmissionProps) {
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [price, setPrice] = useState("");
  const [timelineDays, setTimelineDays] = useState("");
  const [timelineNotes, setTimelineNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existingBid = bidRequest.bids[0];
  const canSubmit = ["pending", "viewed"].includes(bidRequest.status);
  const canRevise = bidRequest.status === "submitted";

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bidRequestId: bidRequest.id,
          priceCents: price ? Math.round(parseFloat(price) * 100) : null,
          currency: "USD",
          timelineDays: timelineDays ? parseInt(timelineDays) : null,
          timelineNotes: timelineNotes || null,
          notes: notes || null,
          submittedBy: userId,
        }),
      });

      if (res.ok) {
        setShowSubmitDialog(false);
        setPrice("");
        setTimelineDays("");
        setTimelineNotes("");
        setNotes("");
        onSubmit?.();
      }
    } catch (err) {
      console.error("Failed to submit bid:", err);
    }
    setSubmitting(false);
  };

  const formatPrice = (cents: number | null) => {
    if (cents === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <>
      <Card className="hover:border-primary/50 transition-colors">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                {bidRequest.turnover.project.code}
              </p>
              <CardTitle className="text-base">
                {bidRequest.turnover.title || `Turnover #${bidRequest.turnover.turnover_number}`}
              </CardTitle>
            </div>
            <Badge className={statusColors[bidRequest.status] || ""}>
              {bidRequest.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Deadline */}
          {bidRequest.deadline && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                Deadline: {new Date(bidRequest.deadline).toLocaleDateString()}
              </span>
              {new Date(bidRequest.deadline) < new Date() && (
                <Badge variant="destructive" className="text-xs">Expired</Badge>
              )}
            </div>
          )}

          {/* Notes from producer */}
          {bidRequest.notes && (
            <div className="bg-muted/50 rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">Notes from producer:</p>
              <p className="text-sm">{bidRequest.notes}</p>
            </div>
          )}

          {/* Existing bid */}
          {existingBid && (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Your Bid</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatPrice(existingBid.price_cents)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Timeline</p>
                  <p className="text-lg font-semibold">
                    {existingBid.timeline_days ? `${existingBid.timeline_days} days` : "—"}
                  </p>
                </div>
              </div>
              {existingBid.notes && (
                <p className="text-sm text-muted-foreground">{existingBid.notes}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {bidRequest.turnover_id && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                asChild
              >
                <a href={`/vendor/turnover/${bidRequest.turnover_id}`} target="_blank">
                  <Eye className="h-4 w-4 mr-2" />
                  View Shots
                </a>
              </Button>
            )}

            {(canSubmit || canRevise) && (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (existingBid) {
                    setPrice((existingBid.price_cents || 0) / 100 + "");
                    setTimelineDays(existingBid.timeline_days?.toString() || "");
                    setTimelineNotes(existingBid.timeline_notes || "");
                    setNotes(existingBid.notes || "");
                  }
                  setShowSubmitDialog(true);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                {existingBid ? "Revise Bid" : "Submit Bid"}
              </Button>
            )}
          </div>

          {bidRequest.status === "accepted" && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
              <p className="text-green-600 font-medium">🎉 Bid Accepted!</p>
              <p className="text-sm text-muted-foreground">
                You've been awarded this work.
              </p>
            </div>
          )}

          {bidRequest.status === "rejected" && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
              <p className="text-red-600 font-medium">Bid Not Selected</p>
              <p className="text-sm text-muted-foreground">
                Another vendor was chosen for this work.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Bid Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {existingBid ? "Revise Your Bid" : "Submit Bid"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-medium">
                {bidRequest.turnover.title || `Turnover #${bidRequest.turnover.turnover_number}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {bidRequest.turnover.project.name}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Price (USD)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="mt-1.5"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline (days)
              </label>
              <Input
                type="number"
                min="1"
                className="mt-1.5"
                placeholder="e.g., 14"
                value={timelineDays}
                onChange={(e) => setTimelineDays(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Timeline Notes</label>
              <Textarea
                className="mt-1.5"
                placeholder="e.g., 2 weeks for first pass, 1 week for revisions"
                value={timelineNotes}
                onChange={(e) => setTimelineNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Additional Notes</label>
              <Textarea
                className="mt-1.5"
                placeholder="Any assumptions, exclusions, or comments..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {existingBid ? "Update Bid" : "Submit Bid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
