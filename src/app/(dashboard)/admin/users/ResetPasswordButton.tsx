"use client";

import { useState, useTransition } from "react";
import { resetUserPassword } from "./actions";

export default function ResetPasswordButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-primary-600 hover:underline">
        إعادة تعيين كلمة المرور
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        placeholder="كلمة مرور جديدة"
        className="input-field !w-40 !py-1.5"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        disabled={pending || password.length < 8}
        className="text-primary-600 hover:underline disabled:opacity-40"
        onClick={() =>
          startTransition(async () => {
            await resetUserPassword(userId, password);
            setDone(true);
            setOpen(false);
          })
        }
      >
        حفظ
      </button>
      <button onClick={() => setOpen(false)} className="text-slate-400 hover:underline">
        إلغاء
      </button>
      {done && <span className="text-emerald-600">✓</span>}
    </div>
  );
}
