import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import FeedbackForm from "@/components/feedback-form";

export default async function HelpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-4 backdrop-blur">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">Help & Feedback</h1>
        <div className="h-9 w-9" />
      </header>

      <p className="px-6 pb-4 text-[13px] text-[var(--label-secondary)]">
        Found a bug, want a feature, or just confused? Send it our way — we read every one.
      </p>

      <FeedbackForm userId={user.id} />
    </div>
  );
}
