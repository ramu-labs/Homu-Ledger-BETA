"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Eye, EyeOff } from "lucide-react";
import { updateProfile } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

const COLOR_PALETTE = [
  "#f97316", "#3b82f6", "#8b5cf6", "#ef4444",
  "#ec4899", "#eab308", "#14b8a6", "#22c55e", "#6b7280",
  "#f59e0b", "#06b6d4", "#84cc16", "#a855f7", "#f43f5e",
];

// 2 hair colours (blonde/light · dark/black) × 2 skin tones (light 🏻 · medium-light 🏼)
// + special characters for variety
const FACE_EMOJIS = [
  // Light skin — blonde hair
  "👱🏻‍♀️","👱🏻","👵🏻","👴🏻","👰🏻‍♀️","🤵🏻",
  // Light skin — dark hair
  "👩🏻","👨🏻","👧🏻","👦🏻","🧔🏻‍♀️","🧔🏻",
  // Light skin — special characters
  "👸🏻","🤴🏻","🧙🏻‍♀️","🧙🏻","🦸🏻‍♀️","🦸🏻",
  // Medium-light skin — blonde hair
  "👱🏼‍♀️","👱🏼","👵🏼","👴🏼","👰🏼‍♀️","🤵🏼",
  // Medium-light skin — dark hair
  "👩🏼","👨🏼","👧🏼","👦🏼","🧔🏼‍♀️","🧔🏼",
  // Medium-light skin — special characters
  "👸🏼","🤴🏼","🧙🏼‍♀️","🧙🏼","🦸🏼‍♀️","🦸🏼",
];

type AvatarMode = "initial" | "emoji";

type Props = {
  profile: {
    name: string;
    username: string | null;
    initials: string;
    avatar_color: string;
    email: string;
  };
};

export default function EditProfileShell({ profile }: Props) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [avatarColor, setAvatarColor] = useState(profile.avatar_color);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>(
    FACE_EMOJIS.includes(profile.initials) ? "emoji" : "initial"
  );
  const [initials, setInitials] = useState(
    FACE_EMOJIS.includes(profile.initials) ? profile.initials : profile.initials
  );
  const [selectedEmoji, setSelectedEmoji] = useState(
    FACE_EMOJIS.includes(profile.initials) ? profile.initials : FACE_EMOJIS[0]
  );
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const displayInitials = avatarMode === "emoji" ? selectedEmoji : (initials || profile.initials);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("username", username);
    fd.set("avatar_color", avatarColor);
    fd.set("initials", displayInitials);
    if (newPassword) fd.set("new_password", newPassword);
    const result = await updateProfile(fd);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSaved(true);
      setTimeout(() => router.back(), 600);
    }
  }

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-2 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">Edit Profile</h1>
        <div className="h-9 w-9" />
      </header>

      <form onSubmit={handleSave} className="px-5 space-y-5 mt-4">

        {/* Avatar preview */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-[32px] font-semibold text-white shadow-md"
            style={{ backgroundColor: avatarColor }}
          >
            {displayInitials}
          </div>
        </div>

        {/* Avatar mode toggle */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Avatar style</label>
          <div className="flex gap-1 rounded-full bg-black/[0.05] p-1 mb-3">
            {(["initial", "emoji"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setAvatarMode(m)}
                className={cn("flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all min-h-[32px]",
                  avatarMode === m ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm" : "text-[var(--label-secondary)]"
                )}
              >
                {m === "initial" ? "Initials" : "Face emoji"}
              </button>
            ))}
          </div>

          {avatarMode === "initial" ? (
            <input
              type="text"
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="e.g. MJ"
              maxLength={2}
              className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-center text-[18px] font-semibold tracking-wider outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
            />
          ) : (
            <>
              <div className="grid grid-cols-6 gap-2">
                {FACE_EMOJIS.map((em) => (
                  <button key={em} type="button" onClick={() => setSelectedEmoji(em)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-xl text-[22px] transition-all",
                      selectedEmoji === em
                        ? "bg-[var(--foreground)]/10 ring-2 ring-[var(--foreground)]/30 scale-95"
                        : "bg-[var(--surface)] ring-1 ring-black/[0.06]"
                    )}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-black/[0.07]" />
                <span className="text-[11px] text-[var(--label-tertiary)]">or type your own</span>
                <div className="h-px flex-1 bg-black/[0.07]" />
              </div>
              <input
                type="text"
                value={FACE_EMOJIS.includes(selectedEmoji) ? "" : selectedEmoji}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val) setSelectedEmoji(val);
                }}
                placeholder="Paste any emoji ✨"
                className="mt-2 h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-center text-[22px] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow placeholder:text-[18px] placeholder:text-[var(--label-tertiary)]"
              />
            </>
          )}
        </div>

        {/* Background color */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Background color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => setAvatarColor(c)}
                className={cn("h-9 w-9 rounded-full transition-all",
                  avatarColor === c ? "ring-2 ring-offset-2 ring-[var(--foreground)]/50 scale-110" : ""
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Full name */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
          />
        </div>

        {/* Username */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Username</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-[var(--label-tertiary)]">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="yourname"
              maxLength={20}
              className="h-12 w-full rounded-2xl bg-[var(--surface)] pl-8 pr-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
            />
          </div>
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Email</label>
          <input
            type="email"
            value={profile.email}
            readOnly
            className="h-12 w-full rounded-2xl bg-black/[0.03] px-4 text-[15px] text-[var(--label-secondary)] outline-none ring-1 ring-black/[0.05] cursor-default"
          />
        </div>

        {/* New password */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">New password <span className="text-[var(--label-tertiary)] font-normal">(leave blank to keep current)</span></label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 pr-12 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--label-tertiary)]"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || saved}
          className={cn(
            "flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white transition-all",
            saved ? "bg-emerald-500" : "bg-[var(--foreground)] disabled:opacity-60"
          )}
        >
          {saved ? <><Check className="h-4 w-4" /> Saved</> : loading ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
