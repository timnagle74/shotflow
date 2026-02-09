"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Send, Loader2, Building2, Calendar, Film } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Vendor {
  id: string;
  name: string;
  code: string | null;
}

interface Shot {
  id: string;
  code: string;
}

interface SendShotsForBidsProps {
  shots: Shot[];
  projectId: string;
  title?: string;
  onSent?: () => void;
  trigger?: React.ReactNode;
}

export function SendShotsForBids({
  shots,
  projectId,
  title,
  onSent,
  trigger,
}: SendShotsForBidsProps) {
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      fetchVendors();
    }
  }, [open]);

  const fetchVendors = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from("vendors")
      .select("id, name, code")
      .or(`project_id.eq.${projectId},project_id.is.null`)
      .eq("active", true)
      .order("name");

    setVendors((data as Vendor[]) || []);
    setLoading(false);
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
    if (selectedVendors.size === 0 || shots.length === 0) return;

    setSending(true);
    try {
      const res = await fetch("/api/bid-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          shotIds: shots.map(s => s.id),
          vendorIds: Array.from(selectedVendors),
          deadline: deadline?.toISOString() || null,
          notes: notes || null,
          title: title || `${shots.length} shot${shots.length > 1 ? 's' : ''} for bidding`,
        }),
      });

      if (res.ok) {
        setOpen(false);
        setSelectedVendors(new Set());
        setDeadline(undefined);
        setNotes("");
        onSent?.();
      }
    } catch (err) {
      console.error("Failed to send bid requests:", err);
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Send className="h-4 w-4 mr-2" />
            Send for Bids
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send for Bids</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Shots Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Film className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{title || "Selected Shots"}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{shots.length} shot{shots.length !== 1 ? 's' : ''}</p>
            <div className="flex flex-wrap gap-1">
              {shots.slice(0, 10).map((shot) => (
                <Badge key={shot.id} variant="secondary" className="text-xs">
                  {shot.code}
                </Badge>
              ))}
              {shots.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{shots.length - 10} more
                </Badge>
              )}
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="text-sm font-medium flex items-center gap-2 mb-1.5">
              <Calendar className="h-4 w-4" />
              Bid Deadline (optional)
            </label>
            <DatePicker
              date={deadline}
              onSelect={setDeadline}
              placeholder="Select deadline"
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

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : vendors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No vendors available. Add vendors first.
              </p>
            ) : (
              <ScrollArea className="h-[200px] border rounded-md mt-2 p-2">
                <div className="space-y-1">
                  {vendors.map((vendor) => (
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
