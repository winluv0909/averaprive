import { isPlatformRole, needsPasswordChange } from "@/lib/auth/platform-access";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requirePublicSupabaseEnv } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Keep old bookmarks working while making the role-specific URLs canonical.
  // Agency profile management and review submission belong to the agency portal;
  // every other legacy dashboard operation belongs to the owner portal.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const destination = request.nextUrl.clone();

    destination.pathname = pathname === "/admin/login"
      ? "/owners/login"
      : pathname === "/admin"
        ? "/owners/dashboard"
        : `/owners/dashboard${pathname.slice("/admin".length)}`;

    return NextResponse.redirect(destination, 308);
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const destination = request.nextUrl.clone();

    const agencyPath = pathname === "/dashboard"
      || pathname === "/dashboard/agencies"
      || pathname.startsWith("/dashboard/agencies/")
      || pathname === "/dashboard/reviews/new";

    destination.pathname = agencyPath
      ? `/agency${pathname}`
      : `/owners${pathname}`;

    return NextResponse.redirect(destination, 308);
  }

  let response = NextResponse.next({ request });

  const { url, key } = requirePublicSupabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),

      setAll(items) {
        items.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        items.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Carry refreshed authentication cookies onto redirect responses.
  function redirectWithCookies(destination: URL) {
    const redirectResponse = NextResponse.redirect(destination);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");

  const isOwnerRoute =
    pathname === "/owners" || pathname.startsWith("/owners/");

  const isAgencyRoute =
    pathname === "/agency" || pathname.startsWith("/agency/");

  const isProtectedAdminRoute =
    isAdminRoute && pathname !== "/admin/login";

  const isProtectedOwnerRoute =
    isOwnerRoute && pathname !== "/owners/login";

  const isProtectedAgencyRoute =
    isAgencyRoute
    && !["/agency/login", "/agency/register"].includes(pathname)
    && !pathname.startsWith("/agency/claim/");

  const isDashboardRoute =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  const isProtectedRoute =
    isDashboardRoute
    || isProtectedAdminRoute
    || isProtectedOwnerRoute
    || isProtectedAgencyRoute;

  if ((!user || authenticationError) && isProtectedRoute) {
    const login = request.nextUrl.clone();

    login.pathname =
      isProtectedAdminRoute || isProtectedOwnerRoute
        ? "/owners/login"
        : "/agency/login";

    login.search = "";
    login.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );

    return redirectWithCookies(login);
  }

  if (
    user
    && !authenticationError
    && (
      isProtectedAdminRoute
      || isProtectedOwnerRoute
      || isProtectedAgencyRoute
    )
  ) {
    const {
      data: staffRoles,
      error: roleError,
    } = await supabase
      .from("ap_staff_roles")
      .select("role")
      .eq("user_id", user.id);

    // A failed role lookup must not grant protected access.
    if (roleError || !staffRoles) {
      const login = request.nextUrl.clone();

      login.pathname =
        isProtectedAdminRoute || isProtectedOwnerRoute
          ? "/owners/login"
          : "/agency/login";

      login.search = "";
      login.searchParams.set(
        "error",
        "Your account access could not be verified. Please try again.",
      );

      return redirectWithCookies(login);
    }

    const isPlatformAccount = staffRoles.length > 0;

    const hasPlatformRole = staffRoles.some(
      (staffRole) => isPlatformRole(staffRole.role),
    );

    if (isProtectedOwnerRoute && hasPlatformRole && needsPasswordChange(user.app_metadata) && pathname !== "/owners/account") {
      const setup = request.nextUrl.clone(); setup.pathname = "/owners/account"; setup.search = "";
      return redirectWithCookies(setup);
    }

    if (isProtectedAgencyRoute && isPlatformAccount) {
      const forbidden = request.nextUrl.clone();

      forbidden.pathname = "/forbidden";
      forbidden.search = "";
      forbidden.searchParams.set("portal", "agency");
      forbidden.searchParams.set(
        "error",
        "Platform staff accounts cannot access the agency portal. Please use the owner login with your platform account, or a separate agency account.",
      );

      return redirectWithCookies(forbidden);
    }

    if (
      (isProtectedAdminRoute || isProtectedOwnerRoute)
      && !hasPlatformRole
    ) {
      const forbidden = request.nextUrl.clone();

      forbidden.pathname = "/forbidden";
      forbidden.search = "";
      forbidden.searchParams.set("portal", "owner");

      return redirectWithCookies(forbidden);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/agency/:path*",
    "/owners/:path*",
    "/platform-reviews/:path*",
    "/login",
  ],
};