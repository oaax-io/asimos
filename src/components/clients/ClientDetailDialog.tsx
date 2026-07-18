import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ClientDetail } from "@/routes/_app/clients.$id";

interface Props {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientIds?: string[];
  onNavigate?: (id: string) => void;
}

export function ClientDetailDialog({ clientId, open, onOpenChange, clientIds, onNavigate }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92dvh] max-h-[92dvh] min-h-0 w-[min(96vw,72rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl [&>button]:hidden"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <DialogTitle className="sr-only">Kundendetails</DialogTitle>
        <DialogDescription className="sr-only">Kundendetails mit fixem Kopfbereich und scrollbarem Inhalt.</DialogDescription>
        {clientId && (
          <ClientDetail
            id={clientId}
            inDialog
            onClose={() => onOpenChange(false)}
            clientIds={clientIds}
            onNavigate={onNavigate}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
