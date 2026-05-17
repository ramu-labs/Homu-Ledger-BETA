import { ChevronLeft, ChevronRight, Tag, Bell, HelpCircle, LogOut, Users, Coins, Smile, Languages, Layers, RefreshCw, Wallet, Ticket, Sparkles, SunMoon, Palette, Smartphone, Activity } from "lucide-react";
import { TapLink } from "@/components/tap";
import { requireSession } from "@/lib/auth/session";
import { signOut } from "@/app/actions/auth";
import { CopyButton } from "@/components/copy-button";
import { getServerT } from "@/lib/i18n/server";
import DevFeedbackBadge from "@/components/dev-feedback-badge";
import { APP_VERSION } from "@/lib/version";

export default async function SettingsPage() {
  // requireSession + getServerT share the SAME getSession() call via
  // React.cache — one auth.getUser() + one profile SELECT for the whole
  // page render, not two as before v1.23.0.
  const { supabase, user, profile } = await requireSession();
  const { t } = await getServerT();

  const language = profile?.language ?? "en";
  const languageLabel = language === "id" ? "Bahasa Indonesia" : "English";

  const iconStyle = profile?.icon_style ?? "3d";
  const iconStyleLabel = iconStyle === "2d" ? t("settings.iconStyle.2d") : t("settings.iconStyle.3d");

  // Subscription info — show a small badge on the profile card so the user
  // knows their tier at a glance.
  const subTier = profile?.subscription_tier ?? null;
  const subExpires = profile?.subscription_expires_at ?? null;
  const subBadge = (() => {
    if (!subTier) return null;
    if (subTier === "developer") return { label: `PRO · ${t("promo.tier.developer")}`, tone: "rose" as const };
    if (subTier === "lifetime")  return { label: `PRO · ${t("promo.tier.lifetime")}`, tone: "amber" as const };
    const tierKey = `promo.tier.${subTier}` as const;
    if (subExpires) {
      const d = new Date(subExpires);
      const dateStr = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      return { label: `PRO · ${t(tierKey)} · ${t("promo.subscriptionExpires").replace("{date}", dateStr)}`, tone: "emerald" as const };
    }
    return { label: `PRO · ${t(tierKey)}`, tone: "emerald" as const };
  })();
  const badgeColors: Record<"rose" | "amber" | "emerald", string> = {
    rose:    "bg-rose-100 text-rose-700",
    amber:   "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
  };

  const { data: household } = profile?.household_id
    ? await supabase
        .from("households")
        .select("id, name, invite_code, owner_id, currency, symbol, ai_language")
        .eq("id", profile.household_id)
        .single()
    : { data: null };

  // Helper to display the household's current AI-language pick on the
  // RowLink without forcing the user to dive in just to see the value.
  const aiLanguageRaw = (household?.ai_language ?? "auto") as "auto" | "en" | "id";
  const aiLanguageLabel =
    aiLanguageRaw === "en"
      ? "English"
      : aiLanguageRaw === "id"
      ? "Indonesian"
      : t("ai.lang.auto");

  // Open-tickets count for the dev badge. We only fetch this for developers
  // (RLS lets a dev SELECT all feedback; non-devs can only see their own,
  // so the count would be wrong if queried unconditionally).
  let openTicketCount = 0;
  if (profile?.is_developer) {
    const { count } = await supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    openTicketCount = count ?? 0;
  }


  return (
    // Bottom-nav is hidden on Settings (see bottom-nav.tsx), so the layout's
    // 7rem bottom padding leaves a big empty gap below the version label.
    // Cancel ~6rem of it via negative margin; keep ~1rem + safe-area for breathing room.
    <div className="pb-4" style={{ marginBottom: "calc(-7rem + 1rem)" }}>
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-2 backdrop-blur">
        <TapLink
          href="/transactions"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform [touch-action:manipulation]"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </TapLink>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">{t("settings.title")}</h1>
        <div className="h-9 w-9" />
      </header>

      {/* Profile card — tappable to edit */}
      <TapLink
        href="/settings/edit-profile"
        className="mx-5 mt-4 flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-black/[0.04] active:bg-black/[0.02] transition-colors [touch-action:manipulation]"
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[20px] font-semibold text-white"
          style={{ backgroundColor: profile?.avatar_color ?? "#3b82f6" }}
        >
          {profile?.initials ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold text-[var(--foreground)]">
            {profile?.name ?? "—"}
          </p>
          <p className="truncate text-[13px] text-[var(--label-secondary)]">{user.email}</p>
          {subBadge && (
            <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeColors[subBadge.tone]}`}>
              <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
              {subBadge.label}
            </span>
          )}
        </div>
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[var(--label-tertiary)]" strokeWidth={2} />
      </TapLink>

      {/* Household section */}
      {household && (
        <section className="mt-5">
          <p className="mb-2 px-6 text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
            {t("settings.household")}
          </p>
          <div className="mx-5 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04]">
            {/* Ledger name — tappable to rename. We pass an `owner=1` flag
                only when the current user is the household owner; the
                /settings/name page reads it to gate the delete-ledger
                button. The server action enforces the same check, so the
                flag is just for UI cleanliness. */}
            <TapLink
              href={`/settings/name?current=${encodeURIComponent(household.name)}${household.owner_id === user.id ? "&owner=1" : ""}`}
              className="flex items-center justify-between px-4 pt-3.5 pb-2 active:bg-black/[0.02] transition-colors [touch-action:manipulation]"
            >
              <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">{household.name}</p>
              <ChevronRight className="ml-2 h-[18px] w-[18px] shrink-0 text-[var(--label-tertiary)]" strokeWidth={2} />
            </TapLink>

            {/* Invite code (separate row so the copy button isn't nested in the link) */}
            <div className="flex items-center gap-2 border-b border-[var(--separator)] px-4 pb-3">
              <p className="text-[12px] text-[var(--label-secondary)]">
                {t("settings.inviteCode")}{" "}
                <span className="font-mono font-bold tracking-[0.18em] text-[var(--foreground)]">
                  {household.invite_code}
                </span>
              </p>
              <CopyButton text={household.invite_code} />
            </div>

            {/* Symbol link */}
            <TapLink
              href="/settings/symbol"
              className="flex items-center gap-3 border-t border-[var(--separator)] px-4 py-3.5 active:bg-black/[0.02] transition-colors [touch-action:manipulation]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-[var(--foreground)]">
                <Smile className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <p className="flex-1 text-[15px] font-medium text-[var(--foreground)]">{t("settings.symbol")}</p>
              <p className="mr-1 text-[20px] leading-none">{household.symbol ?? "🏠"}</p>
              <ChevronRight className="h-[18px] w-[18px] text-[var(--label-tertiary)]" strokeWidth={2} />
            </TapLink>

            {/* Currency link */}
            <TapLink
              href="/settings/currency"
              className="flex items-center gap-3 border-t border-[var(--separator)] px-4 py-3.5 active:bg-black/[0.02] transition-colors [touch-action:manipulation]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-[var(--foreground)]">
                <Coins className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <p className="flex-1 text-[15px] font-medium text-[var(--foreground)]">{t("settings.currency")}</p>
              <p className="mr-1 text-[14px] font-medium text-[var(--label-secondary)]">{household.currency ?? "IDR"}</p>
              <ChevronRight className="h-[18px] w-[18px] text-[var(--label-tertiary)]" strokeWidth={2} />
            </TapLink>

            {/* Members link */}
            <TapLink
              href="/settings/members"
              className="flex items-center gap-3 border-t border-[var(--separator)] px-4 py-3.5 active:bg-black/[0.02] transition-colors [touch-action:manipulation]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-[var(--foreground)]">
                <Users className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <p className="flex-1 text-[15px] font-medium text-[var(--foreground)]">{t("settings.members")}</p>
              <ChevronRight className="h-[18px] w-[18px] text-[var(--label-tertiary)]" strokeWidth={2} />
            </TapLink>

            {/* AI Language link — per-household preference for AI
                categorisation. Shown to every member (not just devs)
                since it affects everyone's experience inside the
                ledger. Defaults to "Auto-detect". */}
            <TapLink
              href={`/settings/ai-language?current=${aiLanguageRaw}`}
              className="flex items-center gap-3 border-t border-[var(--separator)] px-4 py-3.5 active:bg-black/[0.02] transition-colors [touch-action:manipulation]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-[var(--foreground)]">
                <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <p className="flex-1 text-[15px] font-medium text-[var(--foreground)]">{t("settings.aiLanguage")}</p>
              <p className="mr-1 text-[14px] font-medium text-[var(--label-secondary)]">{aiLanguageLabel}</p>
              <ChevronRight className="h-[18px] w-[18px] text-[var(--label-tertiary)]" strokeWidth={2} />
            </TapLink>
          </div>
        </section>
      )}

      <Group title={t("settings.account")}>
        <RowLink href="/settings/wallets" icon={<Wallet className="h-[18px] w-[18px]" strokeWidth={2} />} label={t("settings.wallets")} />
        <RowLink href="/settings/categories" icon={<Tag className="h-[18px] w-[18px]" strokeWidth={2} />} label={t("settings.categories")} />
        <RowLink
          href={`/settings/style?current=${iconStyle}`}
          icon={<Layers className="h-[18px] w-[18px]" strokeWidth={2} />}
          label={t("settings.iconStyle")}
          value={iconStyleLabel}
        />
        <RowLink
          href="/settings/theme"
          icon={<SunMoon className="h-[18px] w-[18px]" strokeWidth={2} />}
          label="Theme"
        />
        <RowLink
          href={`/settings/language?current=${language}`}
          icon={<Languages className="h-[18px] w-[18px]" strokeWidth={2} />}
          label={t("settings.language")}
          value={languageLabel}
        />
        <Row icon={<Bell className="h-[18px] w-[18px]" strokeWidth={2} />} label={t("settings.notifications")} />
      </Group>

      <Group title={t("settings.support")}>
        <RowLink href="/settings/help" icon={<HelpCircle className="h-[18px] w-[18px]" strokeWidth={2} />} label={t("settings.helpFeedback")} />
        <RowLink href="/settings/devices" icon={<Smartphone className="h-[18px] w-[18px]" strokeWidth={2} />} label={t("settings.devices")} />
        <RowLink href="/settings/updates" icon={<RefreshCw className="h-[18px] w-[18px]" strokeWidth={2} />} label={t("settings.updates")} />
      </Group>

      {/* Developer-only — Promo Codes, Feedback, AI Settings */}
      {profile?.is_developer && (
        <Group title="Developer">
          <RowLink href="/settings/promo-codes" icon={<Ticket className="h-[18px] w-[18px]" strokeWidth={2} />} label={t("settings.promoCodes")} />
          <RowLink
            href="/settings/feedback-admin"
            icon={<HelpCircle className="h-[18px] w-[18px]" strokeWidth={2} />}
            label="Feedback Tickets"
            rightSlot={<DevFeedbackBadge initialCount={openTicketCount} />}
          />
          <RowLink href="/settings/ai-admin" icon={<Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />} label={t("ai.admin.title")} />
          <RowLink href="/settings/dev-analytics" icon={<Activity className="h-[18px] w-[18px]" strokeWidth={2} />} label="Analytics" />
          <RowLink href="/settings/dev-changelog" icon={<RefreshCw className="h-[18px] w-[18px]" strokeWidth={2} />} label={t("settings.devChangelog")} />
          <RowLink href="/design-system" icon={<Palette className="h-[18px] w-[18px]" strokeWidth={2} />} label="DesignSystem" />
        </Group>
      )}

      <div className="mx-5 mt-6">
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--surface)] px-4 py-3.5 text-[15px] font-semibold text-rose-600 ring-1 ring-black/[0.04] active:scale-[0.99] transition-transform"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2.25} />
            {t("settings.logOut")}
          </button>
        </form>
      </div>

      {/* v1.42.4: pulled from lib/version.ts (APP_VERSION) so the label
          can never drift from the actual build. Previously hard-coded
          and stuck at v1.40.0 through several releases. */}
      <p className="mt-6 text-center text-[11px] text-[var(--label-tertiary)]">Homu v{APP_VERSION}</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <p className="mb-2 px-6 text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
        {title}
      </p>
      <ul className="mx-5 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
        {children}
      </ul>
    </section>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li>
      <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left min-h-[52px] active:bg-black/[0.02] transition-colors">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-[var(--foreground)]">
          {icon}
        </span>
        <p className="flex-1 text-[15px] font-medium text-[var(--foreground)]">{label}</p>
        <ChevronRight className="h-[18px] w-[18px] text-[var(--label-tertiary)]" strokeWidth={2} />
      </button>
    </li>
  );
}

function RowLink({
  href,
  icon,
  label,
  value,
  rightSlot,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <li>
      <TapLink href={href} className="flex w-full items-center gap-3 px-4 py-3.5 min-h-[52px] active:bg-black/[0.02] transition-colors [touch-action:manipulation]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-[var(--foreground)]">
          {icon}
        </span>
        <p className="flex-1 text-[15px] font-medium text-[var(--foreground)]">{label}</p>
        {value && <p className="mr-1 text-[14px] font-medium text-[var(--label-secondary)]">{value}</p>}
        {rightSlot}
        <ChevronRight className="h-[18px] w-[18px] text-[var(--label-tertiary)]" strokeWidth={2} />
      </TapLink>
    </li>
  );
}
