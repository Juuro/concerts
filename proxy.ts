import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const protectedRoutes = ["/concerts/new", "/concerts/edit", "/settings", "/map"];

const authRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/resend-verification",
];

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://*.ingest.sentry.io https://tiles.openfreemap.org",
    "img-src 'self' blob: data: https://upload.wikimedia.org https://avatars.githubusercontent.com https://tiles.openfreemap.org",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
  ].join("; ");
}

export async function proxy(request: Request) {
  const url = new URL(request.url);
  const { pathname } = url;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const sessionCookie = getSessionCookie(request);
  const isAuthenticated = !!sessionCookie;

  if (authRoutes.some((route) => pathname.startsWith(route))) {
    if (isAuthenticated) {
      const res = NextResponse.redirect(new URL("/", request.url));
      res.headers.set("Content-Security-Policy", csp);
      return res;
    }
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  }

  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const res = NextResponse.redirect(loginUrl);
      res.headers.set("Content-Security-Policy", csp);
      return res;
    }
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
