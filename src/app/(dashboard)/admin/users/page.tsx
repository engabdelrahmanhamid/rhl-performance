import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { toggleUserActive } from "./actions";
import NewUserForm from "./NewUserForm";
import ResetPasswordButton from "./ResetPasswordButton";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <div>
      <PageHeader title="المستخدمون" description="إنشاء حسابات مدراء النظام والمقيّمين." />

      <div className="mb-6">
        <NewUserForm />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-5 py-3">الاسم</th>
              <th className="px-5 py-3">البريد الإلكتروني</th>
              <th className="px-5 py-3">الدور</th>
              <th className="px-5 py-3">عدد التعيينات</th>
              <th className="px-5 py-3">الحالة</th>
              <th className="px-5 py-3">آخر دخول</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/50">
                <td className="px-5 py-3 font-medium text-slate-800">{u.fullName}</td>
                <td className="px-5 py-3 text-slate-500" dir="ltr">
                  {u.email}
                </td>
                <td className="px-5 py-3">
                  <Badge tone={u.role === "SUPER_ADMIN" ? "blue" : "slate"}>
                    {u.role === "SUPER_ADMIN" ? "مدير النظام" : "مقيّم"}
                  </Badge>
                </td>
                <td className="px-5 py-3">{u._count.assignments}</td>
                <td className="px-5 py-3">
                  <Badge tone={u.isActive ? "green" : "slate"}>{u.isActive ? "مفعّل" : "معطّل"}</Badge>
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ar-SA") : "—"}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <ResetPasswordButton userId={u.id} />
                    <form
                      action={async () => {
                        "use server";
                        await toggleUserActive(u.id, !u.isActive);
                      }}
                    >
                      <button className="text-slate-500 hover:underline">{u.isActive ? "تعطيل" : "تفعيل"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
