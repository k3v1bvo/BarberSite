import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.delete({
            name,
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.delete({
            name,
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const isAdminRoute = pathname.startsWith('/admin')
  const isRecepcionRoute = pathname.startsWith('/recepcion')
  const isBarberoRoute = pathname.startsWith('/barbero')
  const isAgendaRoute = pathname.startsWith('/agenda')
  const isClienteRoute = pathname.startsWith('/cliente')
  const isCalendarioRoute = pathname.startsWith('/calendario')
  const isReservarRoute = pathname.startsWith('/reservar')
  const isLoginPage = pathname === '/login'
  const isRegisterPage = pathname === '/register'

  const protectedRoutes =
    isAdminRoute ||
    isRecepcionRoute ||
    isBarberoRoute ||
    isReservarRoute ||
    isAgendaRoute ||
    isClienteRoute ||
    isCalendarioRoute

  if (!user && protectedRoutes) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (isLoginPage || isRegisterPage)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    if (profile?.role === 'recepcionista') {
      return NextResponse.redirect(new URL('/recepcion', request.url))
    }
    if (profile?.role === 'barbero') {
      return NextResponse.redirect(new URL('/barbero', request.url))
    }
    if (profile?.role === 'cliente') {
      return NextResponse.redirect(new URL('/cliente', request.url))
    }
  }

  // Barbero no puede ver agenda general (solo /agenda exacto)
  if (user && pathname === '/agenda') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'barbero') {
      return NextResponse.redirect(new URL(`/agenda/${user.id}`, request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/recepcion/:path*',
    '/barbero/:path*',
    '/agenda/:path*',
    '/cliente/:path*',
    '/calendario',
    '/reservar',
    '/login',
    '/register',
  ],
}
