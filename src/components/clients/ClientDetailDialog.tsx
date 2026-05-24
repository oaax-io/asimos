import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ClientDetail } from "@/routes/_app/clients.$id";

interface Props {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDetailDialog({ clientId, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-6 [&>button]:hidden">
        {clientId && <ClientDetail id={clientId} inDialog onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
