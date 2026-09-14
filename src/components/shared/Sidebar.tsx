"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Network,
  Briefcase,
  Users,
  UserCog,
  ClipboardList,
  Target,
  CalendarRange,
  FileBarChart,
  Bell,
  History,
  Settings,
  ListChecks,
} from "lucide-react";
import clsx from "clsx";

const adminLinks = [
  { href: "/admin", label: "لوحة التحكم", icon: LayoutDashboard, exact: true },
  { href: "/admin/branches", label: "الفروع", icon: Building2 },
  { href: "/admin/departments", label: "الأقسام", icon: Network },
  { href: "/admin/job-titles", label: "المسميات الوظيفية", icon: Briefcase },
  { href: "/admin/employees", label: "الموظفون", icon: Users },
  { href: "/admin/users", label: "المستخدمون", icon: UserCog },
  { href: "/admin/evaluator-assignments", label: "تعيينات المقيّمين", icon: ListChecks },
  { href: "/admin/kpi-templates", label: "قوالب KPI", icon: ClipboardList },
  { href: "/admin/targets", label: "الأهداف", icon: Target },
  { href: "/admin/evaluation-cycles", label: "دورات التقييم", icon: CalendarRange },
  { href: "/admin/evaluations", label: "جميع التقييمات", icon: ClipboardList },
  { href: "/admin/reports", label: "التقارير", icon: FileBarChart },
  { href: "/admin/notifications", label: "الإشعارات", icon: Bell },
  { href: "/admin/audit-logs", label: "سجل العمليات", icon: History },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

const evaluatorLinks = [
  { href: "/evaluator", label: "لوحتي", icon: LayoutDashboard, exact: true },
  { href: "/evaluator/employees", label: "الموظفون المكلَّف بهم", icon: Users },
  { href: "/evaluator/submitted", label: "التقييمات المُرسَلة", icon: ClipboardList },
  { href: "/evaluator/notifications", label: "الإشعارات", icon: Bell },
];

export default function Sidebar({ role }: { role: "SUPER_ADMIN" | "EVALUATOR" }) {
  const pathname = usePathname();
  const links = role === "SUPER_ADMIN" ? adminLinks : evaluatorLinks;

  return (
    <aside className="hidden w-64 shrink-0 border-l border-slate-200 bg-white md:block">
      <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white text-sm font-bold">
          RHL
        </div>
        <div className="text-sm font-semibold text-slate-800">إدارة الأداء</div>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
