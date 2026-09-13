import Link from "next/link";
import { MailWarning } from "lucide-react";

/**
 * §9.2 من وثيقة التصميم: إرسال بريد إعادة التعيين معطّل مؤقتًا لعدم تأكيد توفر SMTP.
 * يُفعَّل تلقائيًا بمجرد تزويد بيانات SMTP في .env — إلى حينها إعادة التعيين تتم يدويًا
 * من قِبل Super Admin عبر شاشة المستخدمين.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card max-w-md space-y-4 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <MailWarning size={22} />
        </div>
        <h1 className="text-lg font-bold text-slate-900">إعادة تعيين كلمة المرور</h1>
        <p className="text-sm text-slate-600">
          خدمة إعادة التعيين عبر البريد الإلكتروني غير مفعّلة حاليًا لعدم توفر إعدادات SMTP.
          يرجى التواصل مع مدير النظام لإعادة تعيين كلمة المرور يدويًا من شاشة "المستخدمون".
        </p>
        <Link href="/login" className="btn-secondary inline-flex">
          العودة لتسجيل الدخول
        </Link>
      </div>
    </div>
  );
}
