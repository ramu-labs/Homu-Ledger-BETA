import BottomNav from "@/components/bottom-nav";
import { LanguageProvider } from "@/lib/i18n/provider";
import { getServerT } from "@/lib/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { lang } = await getServerT();
  return (
    <LanguageProvider lang={lang}>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[var(--background)]">
        <main className="flex-1 pb-28">{children}</main>
        <BottomNav />
      </div>
    </LanguageProvider>
  );
}
