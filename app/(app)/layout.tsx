import BottomNav from "@/components/bottom-nav";
import { LanguageProvider } from "@/lib/i18n/provider";
import { getServerT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import DevFeedbackNotifier from "@/components/dev-feedback-notifier";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { lang } = await getServerT();

  // Mount the dev feedback notifier globally inside the (app) group only
  // when the current user is a developer. Non-devs never load the client
  // bundle or open the realtime subscription.
  // The user lookup here is cheap — getServerT already hit auth.getUser()
  // in the same request, so it's the same cached session under the hood.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isDeveloper = false;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("is_developer")
      .eq("id", user.id)
      .single();
    isDeveloper = data?.is_developer === true;
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
