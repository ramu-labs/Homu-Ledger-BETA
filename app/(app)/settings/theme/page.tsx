"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Moon, Sun, SunMoon } from "lucide-react";

type Theme = "auto" | "light" | "dark";

const OPTIONS: { code: Theme; label: string; description: string; icon: React.ReactNode }[] = [
  {
    code: "auto",
    label: "Automatic",
    description: "Follow your phone's appearance setting.",
    icon: <SunMoon className="h-[18px] w-[18px]" strokeWidth={2.25} />,
  },
  {
    code: "light",
    label: "Always Light",
    description: "Keep the warm cream theme regardless of phone setting.",
    icon: <Sun className="h-[18px] w-[18px]" strokeWidth={2.25} />,
  },
  {
    code: "dark",
    label: "Always Dark",
    description: "Use the dark theme regardless of phone setting.",
    icon: <Moon className="h-[18px] w-[18px]" strokeWidth={2.25} />,
  },
];

export default function ThemePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Theme>("auto");

  useEffect(() => {
    const stored = (localStorage.getItem("homu-theme") as Theme | null) ?? "auto";
    setSelected(stored);
  }, []);

  function pickTheme(code: Theme) {
    setSelected(code);
    if (code === "auto") {
      localStorage.removeItem("homu-theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("homu-theme", code);
      document.documentElement.dataset.theme = code;
    }
  }

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-4 backdrop-blur">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">Theme</h1>
        <div className="h-9 w-9" />
      </header>

      <p className="px-6 pb-4 text-[13px] text-[var(--label-secondary)]">
        Choose how Homu should match your phone's appearance.
      </p>

      <ul className="mx-5 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.code;
          return (
            <li key={opt.code}>
              <button
                onClick={() => pickTheme(opt.code)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-black/[0.02] transition-colors [touch-action:manipulation]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[var(--foreground)]">
                  {opt.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-[var(--foreground)]">{opt.label}</p>
                  <p className="text-[12px] text-[var(--label-secondary)]">{opt.description}</p>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
