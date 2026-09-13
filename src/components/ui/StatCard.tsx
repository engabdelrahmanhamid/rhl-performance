import type { LucideIcon } from "lucide-react";

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-primary-50 text-primary-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  };

  return (
    <div className="card flex items-center gap-4 p-5">
      {Icon && (
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
          <Icon size={20} />
        </div>
      )}
      <div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  );
}
