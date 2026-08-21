import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LeadDetail } from "@/routes/_app/leads.$id";

interface Props {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds?: string[];
  onNavigate?: (id: string) => void;
}

export function LeadDetailDialog({ leadId, open, onOpenChange, leadIds, onNavigate }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92dvh] max-h-[92dvh] min-h-0 w-[min(96vw,72rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl [&>button]:hidden"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <DialogTitle className="sr-only">Lead-Details</DialogTitle>
        <DialogDescription className="sr-only">Lead-Details mit fixem Kopfbereich und scrollbarem Inhalt.</DialogDescription>
        {leadId && (
          <LeadDetail
            id={leadId}
            inDialog
            onClose={() => onOpenChange(false)}
            leadIds={leadIds}
            onNavigate={onNavigate}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
