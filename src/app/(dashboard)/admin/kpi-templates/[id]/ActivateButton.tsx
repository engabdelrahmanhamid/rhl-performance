"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

export default function ActivateButton({
  templateId,
  disabled,
  action,
}: {
  templateId: string;
  disabled: boolean;
  action: (templateId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={disabled || pending}
        className="btn-primary"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await action(templateId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "تعذّر التفعيل");
            }
          })
        }
      >
        <CheckCircle2 size={16} />
        {pending ? "جارِ التفعيل..." : "تفعيل القالب"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
