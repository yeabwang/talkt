import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes are derived from the existing Clerk env vars (sign-in /
// sign-up). Everything else is protected by default — protected-first.
const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in'
const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? '/sign-up'

const isPublicRoute = createRouteMatcher([`${signInUrl}(.*)`, `${signUpUrl}(.*)`])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
