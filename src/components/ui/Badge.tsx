import clsx from "clsx";

const toneMap: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  blue: "bg-primary-100 text-primary-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
};

export default function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: keyof typeof toneMap;
}) {
  return <span className={clsx("badge", toneMap[tone])}>{children}</span>;
}
