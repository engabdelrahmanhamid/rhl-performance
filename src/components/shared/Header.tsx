"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function Header({
  fullName,
  roleLabel,
  notificationBell,
}: {
  fullName: string;
  roleLabel: string;
  notificationBell?: React.ReactNode;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        {notificationBell}
        <div className="text-left">
          <div className="text-sm font-semibold text-slate-800">{fullName}</div>
          <div className="text-xs text-slate-500">{roleLabel}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <LogOut size={16} />
          خروج
        </button>
      </div>
    </header>
  );
}
