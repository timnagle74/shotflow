"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  Building2,
} from "lucide-react";

interface BidRequest {
  id: string;
  turnover_id: string;
  vendor_id: string;
  status: string;
  deadline: string | null;
  notes: string | null;
  created_at: string;
  vendor: {
    id: string;
    name: string;
    code: string | null;
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

interface BidRequestsPanelProps {
  turnoverId: string;
  onAccept?: (bidRequestId: string, vendorId: string) => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600",
  viewed: "bg-blue-500/20 text-blue-600",
  submitted: "bg-green-500/20 text-green-600",
  accepted: "bg-emerald-500/20 text-emerald-600",
  rejected: "bg-red-500/20 text-red-600",
  expired: "bg-gray-500/20 text-gray-600",
};

export function BidRequestsPanel({ turnoverId, onAccept }: BidRequestsPanelProps) {
  const [bidRequests, setBidRequests] = useState<BidRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBid, setSelectedBid] = useState<BidRequest | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchBidRequests();
  }, [turnoverId]);

  const fetchBidRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bid-requests?turnoverId=${turnoverId}`);
      if (res.ok) {
        const data = await res.json();
        setBidRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch bid requests:", err);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string, vendorId?: string) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/bid-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      if (res.ok) {
        fetchBidRequests();
        if (status === "accepted" && vendorId && onAccept) {
          onAccept(id, vendorId);
        }
      }
    } catch (err) {
      console.error("Failed to update bid request:", err);
    }
    setUpdating(null);
  };

  const formatPrice = (cents: number | null, currency: string) => {
    if (cents === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (bidRequests.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Bid Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No bid requests sent yet. Use "Send for Bids" to request quotes from vendors.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Bid Requests ({bidRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y">
              {bidRequests.map((br) => {
                const latestBid = br.bids[0];
                return (
                  <div
                    key={br.id}
                    className="p-4 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedBid(br)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{br.vendor.name}</span>
                          <Badge className={statusColors[br.status] || ""}>
                            {br.status}
                          </Badge>
                        </div>

                        {latestBid && (
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3.5 w-3.5 text-green-600" />
                              {formatPrice(latestBid.price_cents, latestBid.currency)}
                            </span>
                            {latestBid.timeline_days && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-blue-600" />
                                {latestBid.timeline_days} days
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {br.status === "submitted" && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(br.id, "accepted", br.vendor_id);
                            }}
                            disabled={updating === br.id}
                          >
                            {updating === br.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(br.id, "rejected");
                            }}
                            disabled={updating === br.id}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Bid Detail Dialog */}
      <Dialog open={!!selectedBid} onOpenChange={() => setSelectedBid(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedBid?.vendor.name}
            </DialogTitle>
          </DialogHeader>

          {selectedBid && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <Badge className={statusColors[selectedBid.status] || ""}>
                  {selectedBid.status}
                </Badge>
                {selectedBid.deadline && (
                  <span className="text-sm text-muted-foreground">
                    Deadline: {new Date(selectedBid.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>

              {selectedBid.notes && (
                <div>
                  <label className="text-sm font-medium">Request Notes</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedBid.notes}
                  </p>
                </div>
              )}

              {selectedBid.bids.length > 0 ? (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Submitted Bid</label>
                  {selectedBid.bids.map((bid) => (
                    <Card key={bid.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground">Price</label>
                            <p className="text-lg font-semibold text-green-600">
                              {formatPrice(bid.price_cents, bid.currency)}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Timeline</label>
                            <p className="text-lg font-semibold">
                              {bid.timeline_days ? `${bid.timeline_days} days` : "—"}
                            </p>
                          </div>
                        </div>

                        {bid.timeline_notes && (
                          <div>
                            <label className="text-xs text-muted-foreground">Timeline Notes</label>
                            <p className="text-sm">{bid.timeline_notes}</p>
                          </div>
                        )}

                        {bid.notes && (
                          <div>
                            <label className="text-xs text-muted-foreground">Notes</label>
                            <p className="text-sm">{bid.notes}</p>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          Submitted {new Date(bid.submitted_at).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No bid submitted yet
                </p>
              )}

              {selectedBid.status === "submitted" && (
                <div className="flex gap-2 pt-4">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      updateStatus(selectedBid.id, "accepted", selectedBid.vendor_id);
                      setSelectedBid(null);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Accept Bid
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      updateStatus(selectedBid.id, "rejected");
                      setSelectedBid(null);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
