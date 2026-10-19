/**
 * @file DeleteTemplateDialog.tsx
 * @description Dialog confirming template deletion, with warnings for active dependent batches (PRD-CORE-09).
 * @architecture Modal dialog coordinator preventing accidental deletion of templates with dependent batch records.
 * @agent_note Intercepts template deletion to check for dependent batch cascades, requires explicit confirmation on cascade warnings, and issues DELETE /api/templates/:id.
 */

import { useState } from "react";
import { Trash, Warning, CircleNotch } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export interface DeleteTemplateTarget {
  _id: string;
  name: string;
}

export interface DeleteTemplateDialogProps {
  template: DeleteTemplateTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (templateId: string) => void;
}

/**
 * @component DeleteTemplateDialog
 * @description Accessible confirmation modal alerting users to cascade risks and executing template deletion.
 * @param {DeleteTemplateDialogProps} props - Component properties.
 * @param {DeleteTemplateTarget | null} props.template - Target template entity to delete.
 * @param {boolean} props.open - Modal visibility state.
 * @param {(open: boolean) => void} props.onOpenChange - Open state change handler.
 * @param {(templateId: string) => void} [props.onDeleted] - Callback fired upon successful deletion.
 * @state {boolean} isDeleting - Network mutation loading indicator.
 * @state {Object | null} cascadeWarning - Dependent active batches warning payload returned by server.
 * @api {DELETE} /api/templates/:id - Deletes the template and returns cascade dependency warnings if active batches exist.
 * @returns {JSX.Element} Confirmation dialog with cascade warnings.
 */
export function DeleteTemplateDialog({
  template,
  open,
  onOpenChange,
  onDeleted,
}: DeleteTemplateDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [cascadeWarning, setCascadeWarning] = useState<{
    templateId: string;
    count: number;
    batches: Array<{ _id: string; name: string }>;
  } | null>(null);

  const currentTemplateId = template?._id ?? null;
  const [prevTemplateId, setPrevTemplateId] = useState<string | null>(
    currentTemplateId,
  );

  if (currentTemplateId !== prevTemplateId) {
    setPrevTemplateId(currentTemplateId);
    if (cascadeWarning) {
      setCascadeWarning(null);
    }
  }

  const hasCascadeWarning = Boolean(
    cascadeWarning && template && cascadeWarning.templateId === template._id,
  );

  const handleClose = () => {
    if (isDeleting) return;
    setCascadeWarning(null);
    onOpenChange(false);
  };

  const confirmDelete = async (forceCascade = false) => {
    if (!template) return;

    try {
      setIsDeleting(true);
      const shouldForce =
        forceCascade && cascadeWarning?.templateId === template._id;
      const url = shouldForce
        ? `/api/templates/${template._id}?confirmCascade=true&force=true`
        : `/api/templates/${template._id}`;

      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.status === 409) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === "CASCADE_CONFIRMATION_REQUIRED") {
          setCascadeWarning({
            templateId: template._id,
            count: errData.dependentBatchesCount || 0,
            batches: errData.dependentBatches || [],
          });
          return;
        }
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || errData.message || "Failed to delete template",
        );
      }

      toast.success(
        "Template deleted",
        `"${template.name}" was permanently removed.`,
      );
      onDeleted?.(template._id);
      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast.error("Failed to delete template", message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Trash size={20} weight="bold" />
            </div>
            <div>
              <DialogTitle>Delete Template</DialogTitle>
              <DialogDescription className="font-sans text-xs mt-0.5">
                Permanently delete PDF template asset
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-slate-800">
              "{template.name}"
            </span>
            ? This template and its associated versions will be permanently
            removed.
          </p>

          {hasCascadeWarning && cascadeWarning && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
                <Warning
                  size={16}
                  weight="bold"
                  className="text-amber-600 shrink-0"
                />
                <span>Orphaned Batches Warning</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                This template is linked to{" "}
                <strong>{cascadeWarning.count} batch(es)</strong>:{" "}
                <span className="font-medium text-amber-950">
                  {cascadeWarning.batches.map((b) => b.name).join(", ")}
                </span>
                . Deleting this template will also permanently delete all
                associated batches and recipient draft records.
              </p>
              <p className="text-xs font-semibold text-amber-900">
                Do you want to proceed and delete the template along with these
                batches?
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => confirmDelete(hasCascadeWarning)}
            disabled={isDeleting}
            className="cursor-pointer gap-2"
          >
            {isDeleting ? (
              <>
                <CircleNotch size={14} weight="bold" className="animate-spin" />
                <span>Deleting...</span>
              </>
            ) : hasCascadeWarning ? (
              "Yes, Delete Template & Batches"
            ) : (
              "Delete Template"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
