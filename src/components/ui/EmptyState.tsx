import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
      {Icon && <Icon size={36} className="mb-3 text-slate-300" />}
      <div className="font-medium text-slate-700">{title}</div>
      {description && <div className="mt-1 max-w-sm text-sm text-slate-500">{description}</div>}
    </div>
  );
}
