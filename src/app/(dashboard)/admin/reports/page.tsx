import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { User, Building2, Network } from "lucide-react";

const REPORT_CARDS = [
  {
    href: "/admin/reports/employee",
    icon: User,
    title: "تقرير الموظف",
    description: "سجل أداء موظف واحد عبر كل الدورات: النتيجة النهائية والتصنيف في كل دورة.",
  },
  {
    href: "/admin/reports/branch",
    icon: Building2,
    title: "تقرير الفرع",
    description: "ملخص أداء فرع في دورة محددة: نسبة الإنجاز، متوسط النتائج، وتوزيع التصنيفات.",
  },
  {
    href: "/admin/reports/department",
    icon: Network,
    title: "تقرير القسم",
    description: "نفس ملخص تقرير الفرع، لكن مجمَّع على مستوى القسم عبر كل الفروع.",
  },
];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="التقارير"
        description='المقارنة دائمًا "موظف مقابل هدفه" - لا يوجد أي ترتيب لموظف مقابل موظف في هذه التقارير.'
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {REPORT_CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="card p-5 transition hover:border-primary-300 hover:shadow-sm">
            <c.icon className="mb-3 text-primary-600" size={28} />
            <div className="mb-1 font-semibold text-slate-800">{c.title}</div>
            <div className="text-sm text-slate-500">{c.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
