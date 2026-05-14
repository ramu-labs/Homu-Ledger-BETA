import { redirect } from "next/navigation";
import BottomNav from "@/components/bottom-nav";
import { LanguageProvider } from "@/lib/i18n/provider";
import { getServerT } from "@/lib/i18n/server";
import DevFeedbackNotifier from "@/components/dev-feedback-notifier";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Single auth.getUser() per request, via getServerT() — it already fetches
  // the profile row, so reading `is_developer` from there is free. Calling
  // getUser() a second time would race the Supabase SSR cookie refresh and
  // silently log the user out on the next navigation (Server Components
  // can't persist refreshed cookies). See lib/i18n/server.ts comment.
  const { lang, isDeveloper, username } = await getServerT();

  // Google-OAuth users who haven't picked a username yet land here if they
  // type a URL directly (the OAuth callback already routes them to /auth/setup
  // on first sign-in, but a refresh or direct nav lands here). Defense in
  // depth: bounce them back to setup. Existing email/password users always
  // have a username, so this is a no-op for them.
  if (username === null) {
    redirect("/auth/setup");
  }

  return (
    <LanguageProvider lang={lang}>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[var(--background)]">
        {/* Status-bar shield: a fixed, opaque strip covering the iOS safe-area
            inset at the top. Sticky page headers below (top: env(safe-area-
            inset-top)) sit flush underneath it, so scrolled content never
            shows through the dynamic-island / status-bar zone. */}
        <div
          aria-hidden
          className="fixed left-0 right-0 top-0 z-30 bg-[var(--background)]/95 backdrop-blur"
          style={{ height: "env(safe-area-inset-top)" }}
        />
        <main
          className="flex-1"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "calc(7rem + env(safe-area-inset-bottom))",
          }}
        >
          {children}
        </main>
        <BottomNav />
        {isDeveloper && <DevFeedbackNotifier />}
      </div>
    </LanguageProvider>
  );
}
