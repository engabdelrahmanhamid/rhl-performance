import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // حماية مسارات /admin على مستوى Super Admin فقط (دفاع إضافي بجانب rbac.ts في كل Server Action)
    if (path.startsWith("/admin") && token?.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/evaluator", req.url));
    }

    // منع المقيّم من الوصول لمسارات evaluator إن كان Super Admin (اختياري، للتنظيم فقط)
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/evaluator/:path*", "/dashboard/:path*"],
};
