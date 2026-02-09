"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Send, Loader2, Building2, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Vendor {
  id: string;
  name: string;
  code: string | null;
}

interface SendForBidsDialogProps {
  turnoverId: string;
  turnoverTitle: string;
  projectId: string;
  shotCount: number;
  onSent?: () => void;
}

export function SendForBidsDialog({
  turnoverId,
  turnoverTitle,
  projectId,
  shotCount,
  onSent,
}: SendForBidsDialogProps) {
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [existingRequests, setExistingRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchVendors();
      fetchExistingRequests();
    }
  }, [open]);

  const fetchVendors = async () => {
    if (!supabase) return;
    setLoading(true);
    // Get vendors for this project + global vendors
    const { data } = await supabase
      .from("vendors")
      .select("id, name, code")
      .or(`project_id.eq.${projectId},project_id.is.null`)
      .eq("active", true)
      .order("name");

    setVendors(data || []);
    setLoading(false);
  };

  const fetchExistingRequests = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("bid_requests")
      .select("vendor_id")
      .eq("turnover_id", turnoverId);

    if (data) {
      setExistingRequests(new Set((data as { vendor_id: string }[]).map((r) => r.vendor_id)));
    }
  };

  const toggleVendor = (vendorId: string) => {
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) {
        next.delete(vendorId);
      } else {
        next.add(vendorId);
      }
      return next;
    });
  };

  const handleSend = async () => {
    if (selectedVendors.size === 0) return;

    setSending(true);
    try {
      const res = await fetch("/api/bid-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnoverId,
          vendorIds: Array.from(selectedVendors),
          deadline: deadline || null,
          notes: notes || null,
        }),
      });

      if (res.ok) {
        setOpen(false);
        setSelectedVendors(new Set());
        setDeadline("");
        setNotes("");
        onSent?.();
      }
    } catch (err) {
      console.error("Failed to send bid requests:", err);
    }
    setSending(false);
  };

  const availableVendors = vendors.filter((v) => !existingRequests.has(v.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="h-4 w-4 mr-2" />
          Send for Bids
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send for Bids</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Turnover Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{turnoverTitle}</p>
            <p className="text-sm text-muted-foreground">{shotCount} shots</p>
          </div>

          {/* Deadline */}
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Bid Deadline (optional)
            </label>
            <Input
              type="datetime-local"
              className="mt-1.5"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium">Notes to Vendors (optional)</label>
            <Textarea
              className="mt-1.5"
              placeholder="Any special requirements, rush rates, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Vendor Selection */}
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Select Vendors
            </label>
            {existingRequests.size > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {existingRequests.size} vendor(s) already have pending bid requests
              </p>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : availableVendors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No vendors available. Add vendors first.
              </p>
            ) : (
              <ScrollArea className="h-[200px] border rounded-md mt-2 p-2">
                <div className="space-y-1">
                  {availableVendors.map((vendor) => (
                    <label
                      key={vendor.id}
                      className="flex items-center gap-3 p-2 hover:bg-muted rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedVendors.has(vendor.id)}
                        onCheckedChange={() => toggleVendor(vendor.id)}
                      />
                      <div className="flex-1">
                        <span className="font-medium">{vendor.name}</span>
                        {vendor.code && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {vendor.code}
                          </Badge>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {selectedVendors.size > 0 && (
            <p className="text-sm text-muted-foreground">
              Bid requests will be sent to {selectedVendors.size} vendor(s)
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={selectedVendors.size === 0 || sending}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send to {selectedVendors.size} Vendor{selectedVendors.size !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
