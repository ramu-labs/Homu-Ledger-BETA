// Layout for the /auth/* routes (callback, setup). Mirrors the (auth) group
// chrome so the OAuth setup page reads as part of the auth flow even though
// it's authenticated under the hood.
export default function AuthFlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-[var(--background)] px-6 py-12">
      {children}
    </div>
  );
}
