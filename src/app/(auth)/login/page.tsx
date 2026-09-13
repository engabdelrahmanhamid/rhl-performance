"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Scale } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white">
            <Scale size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">نظام إدارة تقييم الأداء</h1>
            <p className="text-sm text-slate-500">مكتب المحامي رامي الحامد</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-8">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="label-field" htmlFor="email">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              placeholder="name@rhl.local"
            />
          </div>

          <div>
            <label className="label-field" htmlFor="password">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              required
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "جارِ الدخول..." : "تسجيل الدخول"}
          </button>

          <a href="/forgot-password" className="block text-center text-sm text-primary-600 hover:underline">
            نسيت كلمة المرور؟
          </a>
        </form>
      </div>
    </div>
  );
}
