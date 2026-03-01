// =============================================================
// middleware.ts – Route protection & session management
//
// Runs on every request. Refreshes Supabase auth tokens and
// redirects unauthenticated users away from protected routes.
// Redirects authenticated users away from auth routes.
// =============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session if expired — REQUIRED for Server Components
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // Redirect unauthenticated users to login
    if (!user && pathname.startsWith('/dashboard')) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/auth/login';
        return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users away from auth pages,
    // BUT only if they weren't sent here by the dashboard due to an error.
    // If ?error= is present, the dashboard redirected them here — don't bounce back.
    const hasError = request.nextUrl.searchParams.get('error');
    if (user && !hasError && (pathname === '/auth/login' || pathname === '/auth/signup')) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = '/dashboard';
        return NextResponse.redirect(dashboardUrl);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api).*)',
    ],
};
