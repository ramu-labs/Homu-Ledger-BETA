// ─── CHANGELOG SOP ───────────────────────────────────────────────────────────
// Every entry MUST include BOTH `en` (English) and `id` (Bahasa Indonesia).
// Never add an entry with only one language — the Updates page renders both.
//
// Template for a new entry:
//
//   {
//     version: "X.Y.Z",
//     date: "Month D, YYYY",
//     changes: [
//       { type: "new" | "fix" | "improvement", en: "English text", id: "Teks Indonesia" },
//     ],
//   },
//
// Versioning: major feature → +0.1.0 · minor fix/tweak → +0.0.1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which audience this entry should show up for in /settings/updates.
 *
 * - "user"  → only on the User tab. Use for plain-English release notes
 *             ("the AI got better at Indonesian", "fixed a scroll bug").
 * - "dev"   → only on the Developer tab. Use for migration / RPC /
 *             schema-level notes that would confuse a non-dev.
 * - "all"   → shows on both tabs. Default for legacy entries that were
 *             written before the split (v1.28.0); also fine for changes
 *             that read naturally to both audiences.
 *
 * Omitting the field is treated as "all" for backwards compatibility.
 */
export type Audience = "user" | "dev" | "all";

export type ChangeEntry = {
  type: "new" | "fix" | "improvement";
  audience?: Audience;
  en: string;
  id: string;
};

export type VersionEntry = {
  version: string;
  date: string; // e.g. "May 6, 2026"
  changes: ChangeEntry[];
};

export const CHANGELOG: VersionEntry[] = [
  {
    version: "1.35.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "improvement", audience: "user",
        en: "Nothing visible changes this release — this is the plumbing for the offline-write feature shipping in v1.36.0. If your phone has been online lately you won’t notice anything.",
        id: "Tidak ada perubahan terlihat di rilis ini — ini adalah fondasi untuk fitur edit offline yang akan datang di v1.36.0. Kalau HP-mu online belakangan, kamu tidak akan merasakan apa-apa." },
      // ── Developer-facing ──
      { type: "new", audience: "dev",
        en: "Migration 0028 adds nullable `client_op_id UUID` + `updated_at TIMESTAMPTZ` to transactions, wallets, and categories. Partial unique index `(household_id, client_op_id) WHERE client_op_id IS NOT NULL` on each — repeat inserts with the same op id surface as Postgres 23505 unique-violation, which the server actions catch and return as success. Plus a shared `set_updated_at()` BEFORE-UPDATE trigger. Purely additive — v1.34.0 keeps working unchanged.",
        id: "Migrasi 0028 menambahkan `client_op_id UUID` + `updated_at TIMESTAMPTZ` (nullable) di transactions, wallets, dan categories. Index unique parsial `(household_id, client_op_id) WHERE client_op_id IS NOT NULL` di setiap tabel — insert berulang dengan op id sama muncul sebagai 23505 unique-violation Postgres, yang server action tangkap dan kembalikan sebagai sukses. Plus trigger `set_updated_at()` BEFORE-UPDATE bersama. Murni aditif — v1.34.0 tetap berjalan tanpa perubahan." },
      { type: "new", audience: "dev",
        en: "lib/idempotency.ts — `getClientOpId(formData)` extracts the op id from a server-action FormData; `isClientOpDuplicate(error)` detects the unique-violation. Used in addTransaction / addWallet / addCategory: on a dedupe the server refetches the previously-inserted row (where the caller expects one back) and returns it as if the insert just succeeded.",
        id: "lib/idempotency.ts — `getClientOpId(formData)` mengekstrak op id dari FormData server action; `isClientOpDuplicate(error)` mendeteksi unique-violation. Dipakai di addTransaction / addWallet / addCategory: saat dedupe, server memuat ulang baris yang sudah ada (dimana caller mengharapkan baris kembali) dan mengembalikannya seolah insert baru sukses." },
      { type: "new", audience: "dev",
        en: "lib/version.ts — APP_VERSION + MIN_CLIENT_VERSION constants and compareVersions(). GET /api/version returns { current, min } with Cache-Control: no-store. New components/version-gate.tsx checks on mount + online + visibilitychange; if APP_VERSION < server min, blocks the app with a hard-refresh modal. Dormant in 1.35.0 (min still 1.34.0) — primed for Phase 3 to start enforcing.",
        id: "lib/version.ts — konstanta APP_VERSION + MIN_CLIENT_VERSION dan compareVersions(). GET /api/version mengembalikan { current, min } dengan Cache-Control: no-store. components/version-gate.tsx baru memeriksa saat mount + online + visibilitychange; kalau APP_VERSION < server min, memblokir app dengan modal hard-refresh. Dorman di 1.35.0 (min masih 1.34.0) — disiapkan untuk Phase 3 mulai mengaktifkannya." },
    ],
  },
  {
    version: "1.34.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "improvement", audience: "user",
        en: "The app now keeps working on flaky wifi: if your connection drops mid-browse, the last pages you opened still render from cache. A small ‘Offline’ pill appears below the status bar so you know what you’re looking at might be a few seconds behind reality.",
        id: "Aplikasi tetap berjalan di wifi yang tidak stabil: kalau koneksi putus saat sedang browsing, halaman yang baru saja kamu buka tetap muncul dari cache. Pil kecil ‘Offline’ akan tampil di bawah status bar agar kamu tahu data yang dilihat mungkin sedikit tertinggal." },
      { type: "improvement", audience: "user",
        en: "Editing things while offline is NOT supported yet — that arrives in v1.36.0. Phase 1 just makes read-only browsing reliable.",
        id: "Mengedit saat offline BELUM didukung — fitur itu akan datang di v1.36.0. Phase 1 hanya membuat browsing read-only jadi andal." },
      // ── Developer-facing ──
      { type: "improvement", audience: "dev",
        en: "Service worker rewritten as network-first for navigation with a smart redirect guard. 200 text/html responses go into a separate `homu-nav-v1` cache (LRU-trimmed to 30 entries). Responses with response.redirected, opaqueredirect, RSC headers (rsc / next-router-prefetch), or auth paths (/login, /signup, /auth, /onboarding, /privacy, /) are NEVER cached — the old SW comment about caching the login bounce as the page response is the exact failure mode the guard prevents.",
        id: "Service worker ditulis ulang jadi network-first untuk navigasi dengan pengaman redirect. Respons 200 text/html disimpan di cache `homu-nav-v1` terpisah (LRU dipotong ke 30 entri). Respons dengan response.redirected, opaqueredirect, header RSC (rsc / next-router-prefetch), atau jalur auth (/login, /signup, /auth, /onboarding, /privacy, /) TIDAK PERNAH disimpan — komentar SW lama soal caching login-bounce sebagai page response adalah failure mode yang pengaman ini hindari." },
      { type: "new", audience: "dev",
        en: "Kill-switch endpoint at GET /api/sw-kill-switch (force-dynamic, no-store). Returns { kill: process.env.NEXT_PUBLIC_SW_KILL === \"1\" }. Registrar fetches it on every page load; if `kill` is true it unregisters all SWs, wipes caches, then reloads. Escape hatch for the day we ship a bad sw.js — flip the var in Vercel, no code deploy needed.",
        id: "Endpoint kill-switch di GET /api/sw-kill-switch (force-dynamic, no-store). Mengembalikan { kill: process.env.NEXT_PUBLIC_SW_KILL === \"1\" }. Registrar memanggilnya di setiap page load; kalau `kill` true ia unregister semua SW, hapus caches, lalu reload. Jalur darurat kalau suatu hari kami merilis sw.js yang rusak — cukup flip var di Vercel, tidak perlu deploy kode." },
      { type: "new", audience: "dev",
        en: "components/sync-status-pill.tsx — tiny client pill mounted in app/(app)/layout.tsx. Listens to window online/offline and renders WifiOff + t(\"common.offline\") below the status-bar shield when navigator.onLine === false. SSR-safe via mounted gate so there's no hydration flash.",
        id: "components/sync-status-pill.tsx — pil kecil client yang dipasang di app/(app)/layout.tsx. Mendengarkan event online/offline window dan menampilkan WifiOff + t(\"common.offline\") di bawah status-bar shield kalau navigator.onLine === false. Aman dari SSR lewat gate `mounted` jadi tidak ada flash saat hydration." },
    ],
  },
  {
    version: "1.33.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "new", audience: "user",
        en: "You can now edit Gender and Date of birth from Edit Profile (existing accounts can leave them blank or add them now).",
        id: "Sekarang kamu bisa mengedit Jenis kelamin dan Tanggal lahir di Edit Profile (akun lama boleh kosongkan atau isi sekarang)." },
      { type: "new", audience: "user",
        en: "Forgot your password? On the sign-in screen tap 'Forgot your password?' — we'll send a 6-digit code to your email. Enter the code, set a new password, and you're back in.",
        id: "Lupa password? Di layar sign-in, ketuk 'Lupa password?' — kami akan kirim kode 6 digit ke emailmu. Masukkan kodenya, atur password baru, dan kamu masuk lagi." },
      { type: "new", audience: "user",
        en: "Settings → Security: change your password while signed in. (Google-only accounts: your password is managed by Google, so the form is hidden — change it in your Google Account.)",
        id: "Pengaturan → Keamanan: ganti passwordmu sambil sudah masuk. (Akun Google-only: password dikelola Google, jadi form-nya disembunyikan — ganti di pengaturan Akun Google.)" },
      // ── Developer-facing ──
      { type: "improvement", audience: "dev",
        en: "Edit Profile shell stripped of the 'New password' field — security operations live on /settings/security now. updateProfile action accepts gender + birth_date (re-uses the same 13–120-year DoB bound + VALID_GENDERS enum as signup).",
        id: "Shell Edit Profile dipangkas dari field 'New password' — operasi security pindah ke /settings/security. Aksi updateProfile menerima gender + birth_date (pakai bound DoB 13–120 tahun + enum VALID_GENDERS yang sama seperti signup)." },
      { type: "new", audience: "dev",
        en: "New SecurityShell at /settings/security. Detects email/password identity vs Google-only via user.identities[].provider on the server; Google-only users see a hint instead of the form. Calls updatePassword server action which wraps supabase.auth.updateUser({ password }).",
        id: "SecurityShell baru di /settings/security. Mendeteksi identitas email/password vs Google-only via user.identities[].provider di server; pengguna Google-only melihat hint, bukan form. Memanggil aksi updatePassword yang membungkus supabase.auth.updateUser({ password })." },
      { type: "new", audience: "dev",
        en: "Forgot-password flow at /login/forgot — three-step state machine (email → otp → new password). Uses supabase.auth.resetPasswordForEmail for the send, verifyOtp({type:'recovery'}) for the code, then updateUser({password}) on the resulting recovery session. Lands the user on /transactions — no extra sign-in step needed.",
        id: "Alur lupa-password di /login/forgot — state machine tiga langkah (email → otp → password baru). Memakai supabase.auth.resetPasswordForEmail untuk kirim, verifyOtp({type:'recovery'}) untuk kode, lalu updateUser({password}) di session recovery yang dihasilkan. Pengguna langsung ke /transactions — tanpa langkah sign-in tambahan." },
      { type: "improvement", audience: "dev",
        en: "Design choice — no current-password confirmation on the signed-in change (user picked low-friction over the stolen-session protection). Documented as a trade-off; can be added later behind a Settings toggle if needed.",
        id: "Pilihan desain — tidak ada konfirmasi password lama di perubahan saat sudah masuk (user memilih low-friction daripada proteksi sesi tercuri). Didokumentasikan sebagai trade-off; bisa ditambah belakangan di balik toggle Settings kalau perlu." },
    ],
  },
  {
    version: "1.32.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "improvement", audience: "user",
        en: "Sign up flow cleaned up — the form is just email & password now (the Google option lives on the Sign in landing). The header is locked at the top with a back button, so navigating is easier when the keyboard is up.",
        id: "Alur Sign up dirapikan — formnya kini email & password saja (opsi Google ada di halaman Sign in). Header dikunci di atas dengan tombol kembali, jadi lebih mudah navigasi saat keyboard naik." },
      { type: "new", audience: "user",
        en: "Sign up now asks for Gender, Date of birth, and a Password confirmation. The 'Already have an account? Sign in' link goes straight to the password sign-in form now.",
        id: "Sign up sekarang menanyakan Jenis kelamin, Tanggal lahir, dan Konfirmasi password. Link 'Sudah punya akun? Sign in' langsung ke form sign-in password sekarang." },
      { type: "new", audience: "user",
        en: "Email verification: after you fill out the sign up form, we send a 6-digit code to your email. Enter it on the next screen to finish creating your account.",
        id: "Verifikasi email: setelah mengisi form sign up, kami kirim kode 6 digit ke email kamu. Masukkan di layar berikutnya untuk menyelesaikan pembuatan akun." },
      // ── Developer-facing ──
      { type: "new", audience: "dev",
        en: "Migration 0027 adds profiles.gender (text + CHECK in 'male'|'female'|'other'|'prefer_not_to_say') and profiles.birth_date (date). Both nullable so existing rows survive.",
        id: "Migrasi 0027 menambahkan profiles.gender (text + CHECK in 'male'|'female'|'other'|'prefer_not_to_say') dan profiles.birth_date (date). Keduanya nullable agar baris lama tetap aman." },
      { type: "improvement", audience: "dev",
        en: "Signup action split into signUpStartEmailOtp + verifySignUpOtp + resendSignUpOtp. Promo redemption + profile-field writes happen ONLY after the OTP is verified, so an abandoned signup doesn't burn a promo code. If Supabase email-confirmation is disabled at the project level, supabase.auth.signUp returns a session directly and we finalise inline (old behaviour preserved).",
        id: "Aksi signup dipecah menjadi signUpStartEmailOtp + verifySignUpOtp + resendSignUpOtp. Redemption promo + tulis field profil hanya dilakukan SETELAH OTP diverifikasi, jadi signup yang ditinggalkan tidak menghabiskan kode promo. Jika email-confirmation di-disable di project level, supabase.auth.signUp mengembalikan session langsung dan kami menyelesaikan inline (perilaku lama dipertahankan)." },
      { type: "improvement", audience: "dev",
        en: "Signup page rewritten as a two-step state machine (form ↔ otp). Locked sticky header with back button (top-left, matches the app convention). The previous Google sign-in button removed from /signup; new users either continue through /login (Google) or fill the form (email + OTP). Sign-in link target updated to /login/password.",
        id: "Halaman signup ditulis ulang sebagai state machine dua-langkah (form ↔ otp). Header sticky terkunci dengan tombol kembali (kiri-atas, mengikuti konvensi app). Tombol Google sign-in dihapus dari /signup; user baru lewat /login (Google) atau isi form (email + OTP). Target link sign-in diubah ke /login/password." },
      { type: "fix", audience: "dev",
        en: "Required after deploy: enable email confirmation in Supabase Dashboard → Authentication → Sign in / providers → Email → Confirm email. Without it the new OTP step never fires (signUp returns a session and we redirect inline). Code handles both states so no regression.",
        id: "Diperlukan setelah deploy: aktifkan email confirmation di Supabase Dashboard → Authentication → Sign in / providers → Email → Confirm email. Tanpa itu, langkah OTP tidak akan muncul (signUp mengembalikan session dan kami redirect inline). Kode menangani kedua kondisi jadi tidak ada regresi." },
    ],
  },
  {
    version: "1.31.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "fix", audience: "user",
        en: "Fixed the 'Load cannot follow more than 20 redirections' error you saw when opening the app on a device whose session had been signed out from elsewhere. The app now correctly lands on the Login screen.",
        id: "Memperbaiki error 'Load cannot follow more than 20 redirections' yang muncul saat membuka app di perangkat yang sesinya sudah di-sign-out dari tempat lain. Sekarang app langsung ke halaman Login dengan benar." },
      { type: "improvement", audience: "user",
        en: "Settings page opens instantly now — added a quick skeleton so it doesn't feel laggy while the data loads.",
        id: "Halaman Pengaturan kini terbuka instan — ditambahkan skeleton singkat agar tidak terasa lambat saat data dimuat." },
      { type: "new", audience: "user",
        en: "You can now give each signed-in device a nickname (Settings → Support → Signed-in Devices, tap the pencil icon). Useful when you have multiple iPhones / browsers and want to tell them apart at a glance.",
        id: "Sekarang setiap perangkat yang masuk bisa diberi nama (Pengaturan → Support → Perangkat Terhubung, ketuk ikon pensil). Berguna kalau punya beberapa iPhone / browser dan ingin mudah membedakannya." },
      // ── Developer-facing ──
      { type: "fix", audience: "dev",
        en: "Middleware switched from supabase.auth.getSession() to getUser(). getSession() only decodes the cookie locally, so a revoked-but-not-yet-expired JWT looked valid → /transactions appeared 'authenticated' → page-level requireSession() called getUser() (actually validates) → null → redirect to /login → middleware bounces back to /transactions. Infinite loop = the 20-redirect Safari error. getUser() validates against Supabase auth on every request (~50–100ms cost) but eliminates the loop.",
        id: "Middleware diubah dari supabase.auth.getSession() ke getUser(). getSession() hanya mendekode cookie secara lokal, jadi JWT yang sudah dicabut tapi belum expired terlihat valid → /transactions tampak 'terotentikasi' → requireSession() di page memanggil getUser() (validasi sungguhan) → null → redirect ke /login → middleware membalikkan ke /transactions. Loop tak terbatas = error 20 redirect Safari. getUser() memvalidasi ke Supabase auth setiap request (~50–100ms) tapi menghilangkan loop." },
      { type: "new", audience: "dev",
        en: "Migration 0026 adds public.device_nicknames keyed by auth.sessions.id with FK cascade. list_user_sessions widened to LEFT JOIN the nicknames; new rename_device_session(p_session_id, p_nickname) RPC with empty-string-clears semantics. Same ownership re-check pattern as the other auth RPCs.",
        id: "Migrasi 0026 menambahkan public.device_nicknames dengan key auth.sessions.id dan FK cascade. list_user_sessions diperluas dengan LEFT JOIN nicknames; RPC rename_device_session(p_session_id, p_nickname) baru dengan semantik string-kosong-menghapus. Pola pemeriksaan kepemilikan yang sama dengan RPC auth lainnya." },
      { type: "improvement", audience: "dev",
        en: "Added app/(app)/settings/loading.tsx with a skeleton that matches the real page layout (profile card + section group shapes) so the route swap is jitter-free. The route itself runs a requireSession + household query (+ feedback count for devs) which is the ~200ms perceived delay the skeleton hides.",
        id: "Menambahkan app/(app)/settings/loading.tsx dengan skeleton yang cocok dengan layout halaman asli (kartu profil + bentuk section group) jadi pergantian route tidak goyang. Route-nya menjalankan requireSession + query household (+ count feedback untuk dev) yang menyebabkan ~200ms perceived delay yang skeleton ini sembunyikan." },
    ],
  },
  {
    version: "1.30.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "fix", audience: "user",
        en: "Signing out only signs you out of THIS device now. Before, signing out anywhere would kick you out of every device — that's why your iPhone was getting logged out after you signed out on the web.",
        id: "Sign out sekarang hanya keluar dari perangkat INI. Sebelumnya, sign out di mana pun akan mengeluarkan kamu dari semua perangkat — itulah penyebab iPhone-mu logout setelah kamu sign out di web." },
      { type: "new", audience: "user",
        en: "New Signed-in Devices page in Settings → Support. See every device that's signed in to your account, sign out the ones you don't recognise, then delete them to clean up. Plus a one-tap 'Sign out other devices' for the lost-phone scenario.",
        id: "Halaman Perangkat Terhubung baru di Pengaturan → Support. Lihat semua perangkat yang sedang masuk ke akunmu, sign out yang tidak kamu kenali, lalu hapus untuk merapikan. Plus tombol 'Sign out perangkat lain' satu ketuk untuk skenario kehilangan ponsel." },
      // ── Developer-facing ──
      { type: "fix", audience: "dev",
        en: "signOut() in app/actions/auth.ts switched from default scope:'global' to scope:'local'. Stops a sign-out on one device from revoking every refresh token across the user's other sessions.",
        id: "signOut() di app/actions/auth.ts diubah dari scope:'global' default ke scope:'local'. Mencegah sign-out di satu perangkat mencabut semua refresh token di sesi pengguna lainnya." },
      { type: "new", audience: "dev",
        en: "Migration 0025 adds three SECURITY DEFINER RPCs over the auth schema: list_user_sessions (returns sessions for auth.uid() plus is_current from auth.jwt() session_id and is_signed_out from refresh-tokens.revoked), sign_out_session (marks refresh_tokens.revoked=true for one session), delete_user_session (DELETE on auth.sessions with cascade).",
        id: "Migrasi 0025 menambahkan tiga RPC SECURITY DEFINER di atas auth schema: list_user_sessions (mengembalikan sesi untuk auth.uid() plus is_current dari auth.jwt() session_id dan is_signed_out dari refresh-tokens.revoked), sign_out_session (mengatur refresh_tokens.revoked=true untuk satu sesi), delete_user_session (DELETE pada auth.sessions dengan cascade)." },
      { type: "new", audience: "dev",
        en: "Devices page UX: per-row two-tap Sign out (arms red, auto-cancels in 3s) → flips row to 'Signed out' status → two-tap Delete appears → row removed. Current device shows 'This device' badge instead of buttons. Bulk 'Sign out other devices' uses Supabase's built-in scope:'others'.",
        id: "UX halaman Perangkat: per-baris Sign out dua-ketuk (armed merah, batal otomatis dalam 3 detik) → status baris berubah 'Signed out' → Delete dua-ketuk muncul → baris dihapus. Perangkat saat ini menampilkan badge 'This device' bukan tombol. 'Sign out perangkat lain' massal pakai scope:'others' bawaan Supabase." },
      { type: "improvement", audience: "dev",
        en: "Tiny inline UA parser at lib/user-agent.ts — ~80 lines of regex covering iPhone/iPad/Android/Mac/Windows + Safari/Chrome/Firefox/Edge. Avoids pulling ua-parser-js (~30KB) for a feature this narrow.",
        id: "Parser UA inline kecil di lib/user-agent.ts — ~80 baris regex yang mencakup iPhone/iPad/Android/Mac/Windows + Safari/Chrome/Firefox/Edge. Menghindari menarik ua-parser-js (~30KB) untuk fitur sesempit ini." },
    ],
  },
  {
    version: "1.29.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "improvement", audience: "user",
        en: "Renamed 'Updates' to 'Version Updates' so it's clearer what this page is about.",
        id: "'Updates' diganti menjadi 'Version Updates' agar lebih jelas isi halaman ini." },
      // ── Developer-facing ──
      { type: "improvement", audience: "dev",
        en: "Updates split into two distinct routes: /settings/updates (Version Updates, user-only view; shown to everyone including devs in the Support group) and /settings/dev-changelog (technical view; under the Developer group, gated on is_developer). Tab switcher removed; updates-shell now takes a `view: 'user'|'dev'` prop + explicit `title`.",
        id: "Updates dipecah ke dua route berbeda: /settings/updates (Version Updates, hanya tampilan user; ditampilkan ke semua termasuk dev di grup Support) dan /settings/dev-changelog (tampilan teknis; di grup Developer, dijaga is_developer). Tab switcher dihapus; updates-shell sekarang menerima prop `view: 'user'|'dev'` + `title` eksplisit." },
    ],
  },
  {
    version: "1.28.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "new", audience: "user",
        en: "Updates page now has two tabs: simple plain-language notes on the User tab, and the full technical breakdown on the Developer tab (devs only).",
        id: "Halaman Updates sekarang punya dua tab: catatan singkat dalam bahasa sederhana di tab User, dan rincian teknis lengkap di tab Developer (hanya developer)." },
      { type: "fix", audience: "user",
        en: "Fixed Add Transaction button being cut off at the bottom of the screen on some phones.",
        id: "Memperbaiki tombol Add Transaction yang terpotong di bagian bawah layar pada beberapa ponsel." },
      // ── Developer-facing ──
      { type: "improvement", audience: "dev",
        en: "Added an `audience: 'user' | 'dev' | 'all'` field to ChangeEntry. Updates page is now a server wrapper that reads is_developer and passes it to a client shell with a tab switcher. Existing recent entries re-tagged as 'dev'; user-facing rewrites added in this and prior releases.",
        id: "Menambahkan field `audience: 'user' | 'dev' | 'all'` ke ChangeEntry. Halaman Updates kini server wrapper yang membaca is_developer dan meneruskan ke client shell dengan tab switcher. Entri rilis terakhir ditandai 'dev'; versi user-friendly ditambahkan di rilis ini dan sebelumnya." },
      { type: "fix", audience: "dev",
        en: "Sheet height switched from 100lvh to 100dvh in add-transaction-sheet.tsx + add-recurring-sheet.tsx so the footer no longer drops below the visible chrome on Android Chrome PWA. Footer paddingBottom floor bumped 12 → 20px for extra clearance under gesture-nav strips.",
        id: "Tinggi sheet diubah dari 100lvh ke 100dvh di add-transaction-sheet.tsx + add-recurring-sheet.tsx supaya footer tidak turun di bawah area chrome di Android Chrome PWA. paddingBottom floor footer dinaikkan 12 → 20px untuk ruang tambahan di atas gesture-nav strip." },
    ],
  },
  {
    version: "1.27.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "new", audience: "user",
        en: "Tell the AI what language your transactions are in. Pick Auto / English / Indonesian under Settings → Household → AI Language. Fixes things like 'Babi Cincang' being put into baby stuff instead of groceries.",
        id: "Beri tahu AI bahasa transaksi kamu. Pilih Auto / Inggris / Indonesia di Pengaturan → Rumah Tangga → Bahasa AI. Memperbaiki hal seperti 'Babi Cincang' yang masuk ke kebutuhan bayi alih-alih belanjaan." },
      { type: "improvement", audience: "user",
        en: "You can now create up to 20 ledgers. If you ever need more, just delete an old one to make room.",
        id: "Sekarang kamu bisa membuat hingga 20 ledger. Kalau perlu lebih, hapus yang lama untuk membuat tempat." },
      // ── Developer-facing ──
      { type: "new", audience: "dev",
        en: "Per-household ai_language column (auto/en/id) via migration 0024. Gemini prompt prepends a one-liner when set ('description is in Bahasa Indonesia… do NOT translate babi as baby'). Wired through suggestCategory → categorize in app/actions/ai.ts.",
        id: "Kolom ai_language per-household (auto/en/id) via migrasi 0024. Prompt Gemini menambahkan satu baris saat di-set ('description is in Bahasa Indonesia… do NOT translate babi as baby'). Disambungkan lewat suggestCategory → categorize di app/actions/ai.ts." },
      { type: "improvement", audience: "dev",
        en: "AI Settings shows live usage vs free-tier limits as RPM/RPD/TPM progress bars (amber@75%, rose@90%) via new SECURITY DEFINER RPC api_usage_recent_window. Tokens mini-stat now shows input + output split (Google bills output 4x).",
        id: "Pengaturan AI menampilkan penggunaan vs batas tier gratis sebagai progress bar RPM/RPD/TPM (amber@75%, rose@90%) lewat RPC SECURITY DEFINER baru api_usage_recent_window. Mini-stat Token kini menunjukkan pemisahan input + output (Google menagih output 4x)." },
      { type: "fix", audience: "dev",
        en: "createNewLedger hard-caps at 20 per owner via an indexed COUNT() on owner_id. Initial createHousehold path unguarded (you can't be at cap mid-onboarding).",
        id: "createNewLedger dibatasi maksimum 20 per pemilik via COUNT() ber-indeks pada owner_id. Jalur createHousehold awal tidak dijaga (tidak mungkin sudah penuh saat onboarding)." },
    ],
  },
  {
    version: "1.26.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "fix", audience: "user",
        en: "Fixed the background page scrolling behind the Add Transaction sheet when the keyboard was up, especially when scrolling near the right edge.",
        id: "Memperbaiki halaman di belakang yang ikut bergulir saat keyboard naik di sheet Tambah Transaksi, terutama saat menggulir di tepi kanan." },
      // ── Developer-facing ──
      { type: "improvement", audience: "dev",
        en: "AI Settings split: /settings/ai-admin is read-only (stats + free-tier card + chart with 7/28/90-day range). Key form moved to /settings/ai-admin/key with two-tap Clear confirmation (auto-cancels in 3s).",
        id: "Pengaturan AI dipecah: /settings/ai-admin sekarang read-only (statistik + kartu tier gratis + grafik dengan rentang 7/28/90 hari). Form key pindah ke /settings/ai-admin/key dengan konfirmasi Clear dua-tap (batal otomatis dalam 3 detik)." },
      { type: "new", audience: "dev",
        en: "Recharts stacked bar of daily usage (hits / misses / errors) with a Tokens metric tab. Server-side bucketing fills empty days with zeros so the X-axis stays uniform.",
        id: "Recharts stacked bar penggunaan harian (hits / misses / errors) dengan tab metrik Token. Bucketing server-side mengisi hari kosong dengan nol agar sumbu X tetap rata." },
      { type: "fix", audience: "dev",
        en: "iOS scroll bleed fixed: add-transaction-sheet + add-recurring-sheet now pin body with position:fixed + top:-scrollY on open and restore scrollY on close. Kills the keyboard-up momentum bleed and right-edge swipe leak.",
        id: "Bleed scroll iOS diperbaiki: add-transaction-sheet + add-recurring-sheet kini mengunci body dengan position:fixed + top:-scrollY saat dibuka dan mengembalikan scrollY saat ditutup. Mengatasi bleed momentum saat keyboard naik dan kebocoran swipe tepi kanan." },
    ],
  },
  {
    version: "1.25.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "new", audience: "user",
        en: "AI auto-categorize: as you type, the right category fills in for you. The app learns from every save so the next time you type the same thing, it's instant. Most of the time it costs nothing.",
        id: "Auto-kategori AI: saat kamu mengetik, kategorinya terisi otomatis. Aplikasi belajar dari setiap penyimpanan jadi lain kali kamu mengetik hal yang sama, langsung muncul. Sebagian besar waktu gratis." },
      { type: "improvement", audience: "user",
        en: "Everyone in your household shares the AI's memory. If one of you teaches it 'Pampers → Baby's Health', the rest of the family benefits next time. About 250 common words come pre-loaded so it's useful from day one.",
        id: "Semua anggota rumah berbagi memori AI. Kalau salah satu mengajari 'Pampers → Kesehatan Bayi', anggota lain langsung dapat manfaatnya. Sekitar 250 kata umum sudah dimuat dari awal agar berguna sejak hari pertama." },
      // ── Developer-facing ──
      { type: "new", audience: "dev",
        en: "Cache-first AI categorization: candidateKeys() → indexed lookup on category_hints → on miss, call Gemini Flash-Lite → INSERT hint. Migration 0023 adds category_hints + api_usage_logs + app_settings, plus a household-creation trigger that seeds ~250 bilingual keywords.",
        id: "Auto-kategori dengan cache-first: candidateKeys() → lookup ber-indeks pada category_hints → pada miss, panggil Gemini Flash-Lite → INSERT hint. Migrasi 0023 menambahkan category_hints + api_usage_logs + app_settings, plus trigger pembuatan household yang menyemai ~250 kata kunci dwibahasa." },
      { type: "new", audience: "dev",
        en: "Developer Settings → AI Settings: API key form, Test Connection, and a token / cost / cache hit-rate dashboard. Gemini key stored in app_settings (developer-only RLS); never reaches the client.",
        id: "Pengaturan Developer → Pengaturan AI: form API key, Test Connection, dan dashboard token / biaya / tingkat cache. Key Gemini tersimpan di app_settings (RLS developer-only); tidak pernah sampai ke klien." },
    ],
  },
  {
    version: "1.24.0",
    date: "May 15, 2026",
    changes: [
      // ── User-facing ──
      { type: "new", audience: "user",
        en: "Make a transaction recurring without leaving the Add screen. Tap the new Repeat icon next to the date, pick how often it should repeat, and you're done.",
        id: "Buat transaksi berulang tanpa keluar dari layar Tambah. Ketuk ikon Ulang baru di sebelah tanggal, pilih seberapa sering harus berulang, selesai." },
      { type: "improvement", audience: "user",
        en: "Cleaner login page: Continue with Google up top, Sign up below it, and a small 'Already have an account? Sign in' link for returning email/password users.",
        id: "Halaman login lebih rapi: Lanjut dengan Google di atas, Daftar di bawahnya, dan link kecil 'Sudah punya akun? Masuk' untuk pengguna email/password lama." },
      // ── Developer-facing ──
      { type: "improvement", audience: "dev",
        en: "Promo codes can be labelled at generation ('For Andi', 'Twitter giveaway') and the redeemer's email shows up next to each redeemed code (RLS join on profiles).",
        id: "Kode promo bisa diberi nama saat dibuat ('Untuk Andi', 'Giveaway Twitter') dan email penebus muncul di samping setiap kode yang sudah ditebus (RLS join pada profiles)." },
      { type: "improvement", audience: "dev",
        en: "Lightweight logging for the random-logout report: /login fires sendBeacon to /api/auth-log when the referrer is an authenticated path. Console logs the bounce details (PWA standalone? referrer? hidden duration?).",
        id: "Pencatatan ringan untuk laporan logout acak: /login mengirim sendBeacon ke /api/auth-log saat referrer adalah path terautentikasi. Console mencatat detail bounce (PWA standalone? referrer? durasi tersembunyi?)." },
    ],
  },
  {
    version: "1.23.1",
    date: "May 14, 2026",
    changes: [
      { type: "improvement", en: "Total Balance card simplified: dropped the wallet icon and centered the label + amount so it reads as the headline number", id: "Kartu Total Saldo disederhanakan: ikon dompet dihilangkan dan label + nilainya dipusatkan agar terbaca sebagai angka utama" },
    ],
  },
  {
    version: "1.23.0",
    date: "May 14, 2026",
    changes: [
      { type: "fix", en: "Closed the intermittent 'kicked to /login' bug for good. v1.18.1 fixed it for the layout; v1.23.0 fixes it everywhere by routing every page through a single per-request session cache, so auth.getUser() runs exactly once per page render no matter how many components ask for it", id: "Menutup bug intermiten 'tiba-tiba kembali ke halaman /login' untuk selamanya. v1.18.1 memperbaikinya untuk layout; v1.23.0 memperbaikinya di semua tempat dengan menyalurkan setiap halaman melalui satu cache sesi per-request, sehingga auth.getUser() berjalan tepat sekali per render halaman tidak peduli berapa banyak komponen yang memintanya" },
      { type: "fix", en: "Recurring items show up immediately on first load after their due date. Previously the materialise RPC was fire-and-forget — it resolved before the rows were actually inserted, so the first page render missed them", id: "Item berulang muncul langsung saat pertama dibuka setelah jatuh tempo. Sebelumnya RPC materialise dipanggil tapi tidak ditunggu — selesai sebelum baris benar-benar dimasukkan, jadi render pertama melewatkannya" },
      { type: "improvement", en: "Cleaner script tag handling in the root layout — replaces the inline <script> bootstrap with next/script and adds suppressHydrationWarning to <html>, fixing two console warnings that appeared in dev", id: "Penanganan tag script di root layout dirapikan — mengganti bootstrap <script> inline dengan next/script dan menambahkan suppressHydrationWarning pada <html>, memperbaiki dua peringatan console yang muncul di dev" },
    ],
  },
  {
    version: "1.22.0",
    date: "May 14, 2026",
    changes: [
      { type: "new", en: "Continue with Google! Sign in or sign up using your Google account — no email + password to remember. Lands you on a setup page where you just pick a username (promo code is optional, skip it for the free tier)", id: "Lanjut dengan Google! Masuk atau daftar memakai akun Google-mu — tidak perlu mengingat email dan kata sandi. Lalu kamu hanya perlu memilih nama pengguna di halaman setup (kode promo opsional, lewati untuk paket gratis)" },
      { type: "new", en: "Free tier introduced: Google sign-up without a promo code gets you the full app without the PRO badge", id: "Paket gratis diperkenalkan: pendaftaran via Google tanpa kode promo memberimu seluruh aplikasi tanpa lencana PRO" },
      { type: "fix", en: "Real fix for the 'background scrolls while a sheet is open' bug: the pull-to-refresh listener was firing on touches inside open sheets and pushing the page underneath down as you dragged. It now bails entirely whenever any sheet/modal has locked body scroll", id: "Perbaikan sesungguhnya untuk bug 'latar bisa di-scroll saat sheet terbuka': listener pull-to-refresh ternyata tetap aktif saat sheet dibuka, dan menggeser halaman di bawahnya saat kamu menyeret. Kini dimatikan total selama ada sheet/modal yang mengunci scroll body" },
    ],
  },
  {
    version: "1.21.1",
    date: "May 13, 2026",
    changes: [
      { type: "improvement", en: "Add Transaction: the Wallet row now has a wallet icon on the left so it's obviously a wallet selector (the row used to look like info-only after v1.21.0 removed the 'Wallet' label)", id: "Tambah Transaksi: baris Dompet kini punya ikon dompet di kiri agar jelas bahwa baris itu adalah pemilih dompet (sebelumnya terlihat seperti info biasa setelah v1.21.0 menghapus label 'Dompet')" },
      { type: "fix", en: "Add Transaction / Add Recurring: the Amount input's top edge was getting clipped by the scroll container — added a 4px top padding so the rounded ring is fully visible again", id: "Tambah Transaksi / Tambah Pengulangan: tepi atas kotak Jumlah terpotong oleh kontainer scroll — menambahkan 4px padding atas agar ring bundar di tepinya tampil utuh" },
      { type: "fix", en: "Add Transaction / Add Recurring: stronger background-scroll lock — set touch-action: none on the document root while the sheet is open, so iOS rejects pan gestures before they have a chance to scroll the page underneath", id: "Tambah Transaksi / Tambah Pengulangan: kunci scroll latar diperkuat — set touch-action: none pada akar dokumen selama sheet terbuka, sehingga iOS menolak gestur pan sebelum sempat menggulung halaman di belakangnya" },
    ],
  },
  {
    version: "1.21.0",
    date: "May 13, 2026",
    changes: [
      { type: "improvement", en: "Add Transaction / Add Recurring sheets: tapping + now auto-focuses the Amount field so the numeric keyboard pops immediately — no extra tap needed", id: "Sheet Tambah Transaksi / Tambah Pengulangan: mengetuk + langsung memfokuskan kolom Jumlah sehingga keyboard angka muncul seketika — tidak perlu ketuk lagi" },
      { type: "improvement", en: "The Expense / Income / Transfer tab pill at the top of the Add Transaction sheet (and Expense / Income in Add Recurring) now stays locked at the top while you scroll through the fields below", id: "Pill tab Pengeluaran / Pemasukan / Transfer di atas sheet Tambah Transaksi (juga Pengeluaran / Pemasukan di Tambah Pengulangan) kini terkunci di atas saat kamu menggulung kolom di bawahnya" },
      { type: "improvement", en: "Add Transaction / Add Recurring: removed the redundant 'Amount', 'Wallet', 'Description', 'Category', 'Date', 'Photo' labels above each input — the placeholders already say the same thing. The form is now noticeably more compact, which keeps the Description field above the keyboard fold so iOS doesn't shove the screen up when you start typing it", id: "Tambah Transaksi / Tambah Pengulangan: menghapus label berulang 'Jumlah', 'Dompet', 'Deskripsi', 'Kategori', 'Tanggal', 'Foto' di atas tiap input — placeholder sudah menjelaskan hal yang sama. Form kini terasa jauh lebih ringkas, jadi kolom Deskripsi tetap di atas keyboard sehingga layar tidak terdorong saat mengetik" },
    ],
  },
  {
    version: "1.20.0",
    date: "May 13, 2026",
    changes: [
      { type: "improvement", en: "Transactions page: Total Balance is now a full-width bento card that matches the Income/Expense cards below — all three read as one stacked bento set", id: "Halaman Transaksi: Total Saldo kini berupa bento card sebar penuh yang serasi dengan kartu Pemasukan/Pengeluaran di bawahnya — ketiganya tampil sebagai satu set bento yang konsisten" },
      { type: "improvement", en: "Settings → Categories: the Expense / Income tab pill now sticks to the top alongside the page title when scrolling the category list", id: "Pengaturan → Kategori: pill tab Pengeluaran / Pemasukan kini menempel di atas bersama judul halaman saat daftar kategori di-scroll" },
      { type: "fix", en: "Settings → Icon Style: the selected card was invisible in dark mode (white icons + white text on cream background). Now uses the theme-aware --on-foreground token so contrast works in both modes", id: "Pengaturan → Gaya Ikon: kartu terpilih tidak terbaca di dark mode (ikon putih + teks putih di latar krem). Kini memakai token --on-foreground yang sadar tema, jadi kontras tepat di kedua mode" },
      { type: "new", en: "Settings → Icon Style: tapping a style now opens a confirmation sheet with a live preview before applying — no more accidental switch on a stray tap", id: "Pengaturan → Gaya Ikon: mengetuk gaya kini membuka sheet konfirmasi dengan preview langsung sebelum diterapkan — tidak ada lagi pergantian tidak sengaja karena ketukan keliru" },
      { type: "improvement", en: "Settings → Ledger Symbol: split into Default and Custom tabs. Default keeps the 40-emoji grid; Custom has a big live preview + a centered emoji input so picking your own emoji feels like a real feature, not an afterthought", id: "Pengaturan → Simbol Buku: dipisah jadi tab Default dan Custom. Default tetap memuat grid 40 emoji; Custom punya preview besar langsung + input emoji di tengah, sehingga memilih emoji sendiri terasa seperti fitur utuh, bukan tambahan" },
    ],
  },
  {
    version: "1.19.0",
    date: "May 13, 2026",
    changes: [
      { type: "new", en: "DesignSystem catalog (developer-only) at Settings → Developer → DesignSystem. Live editor for every theme token (colors, status tints, radii, type sizes, spacing, shadows, z-index) with a Copy CSS button that produces a paste-ready globals.css block", id: "Katalog DesignSystem (khusus developer) di Pengaturan → Developer → DesignSystem. Editor langsung untuk setiap token tema (warna, status, radius, ukuran teks, spacing, shadow, z-index) dengan tombol Copy CSS yang menghasilkan blok globals.css siap-tempel" },
      { type: "improvement", en: "Reusable UI primitives in components/ui/ (Button, Chip, StatusPill, SurfaceCard, Sheet, Input/Textarea, EmptyState, Avatar, FilterTabs, StickyHeader). Use these in new code instead of hand-rolling — they pick up every token change automatically", id: "Komponen UI siap-pakai di components/ui/ (Button, Chip, StatusPill, SurfaceCard, Sheet, Input/Textarea, EmptyState, Avatar, FilterTabs, StickyHeader). Pakai ini di kode baru biar otomatis ikut perubahan token" },
    ],
  },
  {
    version: "1.18.1",
    date: "May 13, 2026",
    changes: [
      { type: "fix", en: "Fixed an intermittent bug that could log you out when navigating between Settings sub-pages (e.g. tapping Theme, then tapping another row) — the v1.18.0 dev-notifier wiring was making a second auth check per page render, which sometimes raced the session-cookie refresh and invalidated your login", id: "Memperbaiki bug intermiten yang bisa mengeluarkanmu dari aplikasi saat berpindah antar halaman Pengaturan (mis. ketuk Theme lalu ketuk baris lain) — wiring dev-notifier di v1.18.0 melakukan pengecekan autentikasi kedua per render, yang kadang bertabrakan dengan refresh cookie sesi dan membatalkan login-mu" },
    ],
  },
  {
    version: "1.18.0",
    date: "May 13, 2026",
    changes: [
      { type: "new", en: "Help & Feedback now has a My tickets tab — see every ticket you submitted, its current status (Open / In progress / Closed), and any reply from the dev. Replies and status changes appear live without refreshing", id: "Help & Feedback kini punya tab My tickets — lihat setiap tiket yang kamu kirim, statusnya saat ini (Open / In progress / Closed), dan balasan dari developer. Balasan dan perubahan status muncul langsung tanpa perlu refresh" },
      { type: "new", en: "Developers: a red badge on the Feedback Tickets row in Settings shows how many tickets are still Open. A toast also pops up at the top of the screen when a new ticket comes in — tap it to jump straight to the ticket in the admin queue", id: "Developer: lencana merah di baris Feedback Tickets pada Pengaturan menampilkan jumlah tiket yang masih Open. Toast juga muncul di atas layar saat tiket baru masuk — ketuk untuk langsung ke tiket di antrian admin" },
      { type: "improvement", en: "Backend security and performance follow-ups on the feedback feature: tightened RLS policy evaluation, locked down internal helper functions from public RPC access, and added covering indexes on foreign keys", id: "Penyesuaian keamanan dan performa backend untuk fitur feedback: kebijakan RLS dievaluasi lebih efisien, fungsi helper internal dikunci dari akses RPC publik, dan indeks penutup ditambahkan pada foreign key" },
    ],
  },
  {
    version: "1.17.1",
    date: "May 12, 2026",
    changes: [
      { type: "fix", en: "Buttons with the dark-text background (the + on the bottom bar, Send feedback, Save, Add recurring, category-chip selections, etc.) now use a theme-aware text color so the label and icon stay readable in dark mode instead of vanishing into the cream button", id: "Tombol berlatar teks-gelap (tombol + di bar bawah, Send feedback, Save, Add recurring, pilihan chip kategori, dll) kini memakai warna teks adaptif tema sehingga label dan ikonnya tetap terbaca di dark mode, tidak ikut menyatu dengan tombol berwarna krem" },
      { type: "improvement", en: "Floating bottom bar now has a more visible outline so it stands apart from the page background — especially noticeable in dark mode", id: "Bar mengambang di bawah kini punya garis tepi yang lebih terlihat sehingga lebih terpisah dari latar — terutama di dark mode" },
      { type: "improvement", en: "Every page's locked header sits tighter against the iPhone status bar — removed the extra padding that left too much empty space at the top", id: "Header terkunci di setiap halaman kini lebih rapat ke status bar iPhone — padding berlebih di atas dihapus" },
      { type: "improvement", en: "Reports category drilldown sheet now has an X close button and locks the background from scrolling while the sheet is open", id: "Sheet drilldown kategori di Reports kini punya tombol tutup X dan mengunci scroll latar saat sheet terbuka" },
      { type: "fix", en: "Help & Feedback page now scrolls to the top when opened (instead of starting mid-form)", id: "Halaman Help & Feedback kini scroll ke atas saat dibuka (bukan mulai di tengah form)" },
    ],
  },
  {
    version: "1.17.0",
    date: "May 12, 2026",
    changes: [
      { type: "new", en: "Help & Feedback works! Settings → Help & Feedback opens a form with subject, message, category (Bug/Feature/Question/Other), and attachments — multiple screenshots and one video up to 50 MB. Submitted tickets land in the developer's queue in-app", id: "Help & Feedback kini berfungsi! Pengaturan → Help & Feedback membuka form dengan subjek, pesan, kategori (Bug/Fitur/Pertanyaan/Lainnya), dan lampiran — beberapa screenshot dan satu video maksimal 50 MB. Tiket yang dikirim masuk ke antrian developer di aplikasi" },
    ],
  },
  {
    version: "1.16.1",
    date: "May 12, 2026",
    changes: [
      { type: "new", en: "Tap any category (or the Uncategorized row) in Reports to open a sheet listing every transaction in that category for the currently-selected period", id: "Ketuk kategori mana pun (atau baris Uncategorized) di Reports untuk membuka sheet berisi semua transaksi di kategori tersebut untuk periode yang dipilih" },
    ],
  },
  {
    version: "1.16.0",
    date: "May 12, 2026",
    changes: [
      { type: "new", en: "Dark mode! Settings → Account → Theme. Pick Automatic (follow phone), Always Light, or Always Dark. Set instantly with no flash on app launch.", id: "Mode gelap! Pengaturan → Akun → Theme. Pilih Otomatis (ikut HP), Selalu Terang, atau Selalu Gelap. Berubah instan tanpa flash saat aplikasi dibuka." },
    ],
  },
  {
    version: "1.15.1",
    date: "May 12, 2026",
    changes: [
      { type: "fix", en: "Status-bar zone is now always opaque — Reports header no longer shows scrolled content through the dynamic-island area, and Settings header no longer overlaps the iPhone status bar when scrolled", id: "Area status bar kini selalu solid — header Reports tidak lagi menampilkan konten yang di-scroll lewat area dynamic island, dan header Settings tidak lagi tertabrak status bar iPhone saat di-scroll" },
      { type: "improvement", en: "Transactions page header now stays pinned at the top when scrolling, matching the rest of the app", id: "Header halaman Transaksi kini tetap menempel di atas saat di-scroll, konsisten dengan halaman lain" },
      { type: "improvement", en: "Settings page no longer has a big empty gap below the version label — the layout's bottom-nav padding is canceled here since Settings hides the bottom nav anyway", id: "Halaman Pengaturan tidak lagi punya ruang kosong besar di bawah label versi — padding untuk bottom-nav dibatalkan karena Pengaturan memang menyembunyikan bottom-nav" },
      { type: "improvement", en: "Removed the Privacy Policy entry from Settings", id: "Menghapus entri Privacy Policy dari Pengaturan" },
    ],
  },
  {
    version: "1.15.0",
    date: "May 12, 2026",
    changes: [
      { type: "new", en: "Recurring items now auto-post into your transaction history when their due date arrives — e.g. a Meta Verified item set to 10th of each month appears in the history on the 10th automatically, with a Recurring tag so you can tell it apart from manually-entered rows. Back-fills missed periods if you haven't opened the app in a while", id: "Item berulang kini otomatis ditambahkan ke riwayat transaksi saat tanggal jatuh tempo — mis. Meta Verified yang dijadwalkan tanggal 10 setiap bulan akan muncul di tanggal 10 secara otomatis, dengan tag Recurring agar mudah dibedakan dari entri manual. Periode yang terlewat akan di-back-fill jika kamu lama tidak membuka aplikasi" },
    ],
  },
  {
    version: "1.14.3",
    date: "May 12, 2026",
    changes: [
      { type: "improvement", en: "Transaction rows now show the wallet name inline after the category (Food & Drink · Marcel's) instead of a small badge stuck on the category icon — easier to read at a glance", id: "Baris transaksi kini menampilkan nama dompet sejajar setelah kategori (Food & Drink · Marcel's) daripada lencana kecil di ikon kategori — lebih mudah dibaca sekilas" },
      { type: "improvement", en: "Recurring item rows now show when they were added (e.g. Added 10 May 2026) so you can tell new entries from long-running ones at a glance", id: "Daftar item berulang kini menampilkan tanggal pembuatan (mis. Dibuat 10 Mei 2026) sehingga mudah membedakan entri baru dari yang sudah lama" },
    ],
  },
  {
    version: "1.14.2",
    date: "May 12, 2026",
    changes: [
      { type: "improvement", en: "Transaction list now groups by day with a header — Today, Mon 11 May, etc. — instead of repeating the date on every row", id: "Daftar transaksi kini dikelompokkan per hari dengan header — Today, Sen 11 Mei, dsb. — daripada mengulang tanggal di setiap baris" },
      { type: "improvement", en: "Income and Expense summary pills on the Transactions page have the icon moved up next to the label so the amount below has more room to breathe", id: "Ringkasan Pemasukan dan Pengeluaran di halaman Transaksi: ikon dipindah ke atas sejajar dengan label sehingga angka di bawahnya punya lebih banyak ruang" },
    ],
  },
  {
    version: "1.14.1",
    date: "May 12, 2026",
    changes: [
      { type: "fix", en: "Sticky headers on Settings pages now actually stick — an iOS Safari quirk with overflow-x: hidden on html/body was preventing position: sticky from engaging", id: "Header menempel di halaman Pengaturan kini benar-benar menempel — bug iOS Safari dengan overflow-x: hidden pada html/body sebelumnya membuat position: sticky tidak aktif" },
    ],
  },
  {
    version: "1.14.0",
    date: "May 10, 2026",
    changes: [
      { type: "fix", en: "Delete category actually works now — the old RLS policy was silently blocking deletion of the seeded default categories, which made them reappear after leaving the page", id: "Hapus kategori kini benar-benar bekerja — kebijakan RLS lama diam-diam memblokir penghapusan kategori bawaan, sehingga kategori muncul kembali setelah meninggalkan halaman" },
      { type: "improvement", en: "Categories settings split into Expense and Income tabs, with three new income defaults (Salary, Bonus, Reimburse) seeded for every household. The category picker in Add Transaction / Add Recurring automatically filters by the type you're entering, and switching type clears a now-invalid category selection", id: "Pengaturan Kategori dipecah menjadi tab Pengeluaran dan Pemasukan, dengan tiga kategori pemasukan baru (Gaji, Bonus, Reimburse) disiapkan otomatis untuk setiap buku. Pemilih kategori di Tambah Transaksi / Tambah Pengulangan kini otomatis menyaring sesuai tipe yang dipilih, dan beralih tipe akan membersihkan pilihan kategori yang tidak relevan" },
      { type: "improvement", en: "Deleting a category now asks for a two-tap confirm (the second tap shows a red button). Transactions and recurring items previously assigned to a deleted category move to Uncategorized automatically", id: "Menghapus kategori kini meminta konfirmasi dua-ketuk (ketukan kedua tombol berubah merah). Transaksi dan item berulang yang sebelumnya dikaitkan dengan kategori yang dihapus akan otomatis pindah ke Uncategorized" },
      { type: "improvement", en: "Headers on all Settings pages now stick to the top when scrolling — the back button is always reachable without scrolling up", id: "Header di seluruh halaman Pengaturan kini menempel di atas saat di-scroll — tombol kembali selalu terjangkau tanpa perlu scroll ke atas" },
      { type: "improvement", en: "Only the ledger owner sees the delete-ledger button now (the server-side check was already in place; this gates the UI too)", id: "Hanya pemilik buku yang melihat tombol hapus buku (cek di server sudah ada sebelumnya; sekarang UI juga ikut menyembunyikan)" },
      { type: "fix", en: "Daily-trend chart: tapping a bar no longer shows the iOS blue tap-highlight square, and the tooltip now shows the full day format (e.g. Mon, 11 May 2026)", id: "Grafik tren harian: mengetuk batang tidak lagi memunculkan kotak biru iOS, dan tooltip kini menampilkan format hari penuh (mis. Sen, 11 Mei 2026)" },
    ],
  },
  {
    version: "1.13.4",
    date: "May 10, 2026",
    changes: [
      { type: "fix", en: "Search bar's bottom outline ring is no longer clipped during the slide-down animation. Removed the `overflow: hidden` from the reveal animation that was cropping it", id: "Garis luar bawah pada bar pencarian tidak lagi terpotong saat animasi muncul. `overflow: hidden` pada animasi yang menyebabkan pemotongan sudah dihilangkan" },
    ],
  },
  {
    version: "1.13.3",
    date: "May 10, 2026",
    changes: [
      { type: "fix", en: "Photo viewer's close X is no longer hidden behind the iPhone status bar — the header now respects the safe-area top inset", id: "Tombol X di photo viewer tidak lagi tertutup status bar iPhone — header kini menghormati safe area atas" },
      { type: "improvement", en: "Filter sheet now slides up smoothly when opened (was appearing instantly)", id: "Sheet Filter kini meluncur naik dengan halus saat dibuka (sebelumnya muncul tiba-tiba)" },
      { type: "improvement", en: "Search bar slides down and fades in when the search button is pressed (was appearing instantly)", id: "Bar pencarian meluncur turun dan memudar masuk saat tombol pencarian ditekan (sebelumnya muncul tiba-tiba)" },
    ],
  },
  {
    version: "1.13.2",
    date: "May 10, 2026",
    changes: [
      { type: "improvement", en: "Bottom navigation: a little wider (more space between buttons), sits even closer to the home indicator, and the shadow is now tighter so the bar reads as a distinct floating layer against the warm cream page background", id: "Navigasi bawah: sedikit lebih lebar (lebih banyak jarak antar tombol), posisinya lebih dekat ke home indicator, dan bayangannya kini lebih rapat sehingga bar terbaca sebagai lapisan mengambang yang jelas di atas latar krem halaman" },
    ],
  },
  {
    version: "1.13.1",
    date: "May 10, 2026",
    changes: [
      { type: "improvement", en: "Bottom navigation tweaks: wider spacing between buttons, position lowered slightly closer to the home indicator, and the bar is now hidden on Settings screens (which have their own back-button navigation)", id: "Penyesuaian navigasi bawah: jarak antar tombol lebih lebar, posisinya sedikit diturunkan mendekati home indicator, dan bar disembunyikan di layar Pengaturan (yang sudah punya navigasi tombol kembali sendiri)" },
    ],
  },
  {
    version: "1.13.0",
    date: "May 10, 2026",
    changes: [
      { type: "improvement", en: "Bottom navigation refined: bigger tabs, sits closer to the bottom (8px above the home indicator instead of 16px), and labels (Transactions, Reports) are now always visible below their icons. The active tab still gets a soft pill highlight, but tabs no longer change size — so the centre + button never gets nudged out of its position", id: "Navigasi bawah disempurnakan: tab lebih besar, posisi lebih rendah (8px di atas home indicator, dari sebelumnya 16px), dan label (Transaksi, Laporan) kini selalu tampil di bawah ikonnya. Tab aktif tetap mendapat sorotan pill lembut, tapi tab tidak lagi berubah ukuran — jadi tombol + di tengah tidak akan tergeser dari posisinya" },
      { type: "improvement", en: "Restored iOS-native rubber-band scroll on the Transactions and Reports pages. Reaching the top or bottom of the list now bounces gently instead of stopping abruptly", id: "Mengembalikan rubber-band scroll khas iOS di halaman Transaksi dan Laporan. Saat mencapai bagian atas atau bawah, daftar kini memantul lembut, bukan berhenti tiba-tiba" },
    ],
  },
  {
    version: "1.12.0",
    date: "May 9, 2026",
    changes: [
      { type: "new", en: "New floating-capsule bottom navigation. Sits 16px above the home indicator with side-margins from the screen edges, the active tab gets a soft pill highlight and shows its label, the + button has a tactile press animation (scale + shadow change). Same buttons and behaviour, fresh look", id: "Navigasi bawah baru berbentuk kapsul mengambang. Berada 16px di atas home indicator dengan jarak dari tepi layar, tab aktif mendapat sorotan pill lembut dan menampilkan label, dan tombol + memiliki animasi tekan yang terasa di tangan (skala + bayangan). Tombol dan fungsinya sama, tampilan baru" },
    ],
  },
  {
    version: "1.11.0",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Rebuilt the Add Transaction and Add Recurring popup mechanics from scratch. Sheet is now anchored to `top: 0` with explicit `height: 100lvh` instead of `bottom: 0; h-dvh`, which sidesteps the iOS PWA standalone bug that was clipping the sheet above the home-indicator zone. Body-scroll lock simplified to `overflow: hidden` on html and body. Same UI, same slide-up animation, same form contents — just clean underlying mechanics", id: "Membangun ulang mekanisme popup Tambah Transaksi dan Tambah Pengulangan dari awal. Sheet kini diikat ke `top: 0` dengan `height: 100lvh` eksplisit, bukan `bottom: 0; h-dvh`, sehingga menghindari bug iOS PWA standalone yang memotong sheet di atas zona home indicator. Kunci body-scroll disederhanakan menjadi `overflow: hidden` pada html dan body. UI dan animasi sama, isi form sama — hanya mekanisme di baliknya yang dibersihkan" },
    ],
  },
  {
    version: "1.10.2",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Reverted v1.10.1's popup height change. `h-[100lvh] min-h-screen` made the popup taller than the visible viewport, pushing the close button and form contents above the iPhone status bar where they couldn't be tapped. Popup is back to `h-dvh` (the v1.8.3 baseline)", id: "Mengembalikan perubahan tinggi popup di v1.10.1. `h-[100lvh] min-h-screen` membuat popup lebih tinggi dari viewport terlihat, sehingga tombol tutup dan isi form terdorong ke atas status bar iPhone dan tidak bisa diketuk. Popup kembali ke `h-dvh` (baseline v1.8.3)" },
    ],
  },
  {
    version: "1.10.1",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Popup height changed from `h-dvh` to `h-[100lvh] min-h-screen`. iOS PWA standalone can compute `100dvh` shorter than the physical viewport even with explicit body bounds, leaving a strip uncovered. `100lvh` (large viewport height) plus a `min-h-screen` floor force the popup to span the full physical screen", id: "Tinggi popup diubah dari `h-dvh` menjadi `h-[100lvh] min-h-screen`. iOS PWA standalone bisa menghitung `100dvh` lebih pendek dari viewport fisik meskipun body sudah diberi batas eksplisit, sehingga ada strip yang tidak tertutup. `100lvh` (large viewport height) plus floor `min-h-screen` memaksa popup memenuhi seluruh layar fisik" },
    ],
  },
  {
    version: "1.10.0",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Rolled back the popup behaviour and animations to the v1.8.3 baseline. v1.9.0–v1.9.3 attempts to refine the close animation, scroll-bleed, and home-indicator strip kept introducing new regressions, so reverted entirely to the version that was last reported as working", id: "Mengembalikan perilaku popup dan animasi ke baseline v1.8.3. Upaya v1.9.0–v1.9.3 untuk memperbaiki animasi menutup, scroll bocor, dan strip home indicator terus memunculkan regresi baru, jadi dikembalikan sepenuhnya ke versi yang terakhir dilaporkan bekerja" },
    ],
  },
  {
    version: "1.9.3",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Stopped trying to make the popup `cover` the iPhone home-indicator zone (which iOS PWA standalone has been refusing to do across multiple attempts) and instead made the page underneath blend with the popup. While a popup is open, body gets a `popup-open` class that flips `--page-bg` from cream to surface. So the home-indicator strip iOS leaves uncovered now matches the popup's white surface and is invisible", id: "Berhenti memaksa popup `menutupi` zona home indicator iPhone (yang ditolak iOS PWA standalone berulang kali) dan sebaliknya membuat halaman di bawahnya berbaur dengan popup. Saat popup terbuka, body mendapat kelas `popup-open` yang membalik `--page-bg` dari krem ke putih sheet. Strip yang ditinggalkan iOS di zona home indicator kini berwarna sama dengan popup dan tidak terlihat" },
    ],
  },
  {
    version: "1.9.2",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Reverted the prev-snapshot pattern and the 420ms close-defer in the popup body-lock. The snapshot could capture locked values when popup open/close events overlapped, leaving the body permanently locked or causing fixed children to anchor wrong. Body-lock styles are now unconditionally cleared on close. Trade-off: the close-jolt comes back briefly, which we can smooth in a future release once the cream strip is conclusively gone", id: "Mengembalikan pola snapshot sebelumnya dan penundaan 420ms saat menutup popup pada body-lock. Snapshot bisa menangkap nilai dalam keadaan terkunci saat acara buka/tutup popup tumpang tindih, sehingga body bisa terkunci permanen atau elemen tetap salah posisi. Style body-lock kini dibersihkan tanpa syarat saat ditutup. Konsekuensinya: jolt kecil saat menutup kembali muncul, akan dihaluskan kemudian setelah strip krem benar-benar hilang" },
    ],
  },
  {
    version: "1.9.1",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Forced an extra service-worker cache invalidation pass so devices that cached chunks from older versions are guaranteed to fetch fresh code on the next launch", id: "Memaksa satu siklus pembersihan cache service worker tambahan agar perangkat yang masih menyimpan chunk dari versi lama dipastikan mengambil kode baru saat aplikasi dibuka berikutnya" },
    ],
  },
  {
    version: "1.9.0",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Add Transaction and Add Recurring popups close smoothly now — the page underneath no longer freezes/jolts during the slide-out. The body-scroll unlock is deferred until the close animation finishes (which is finally safe to do now that v1.8.3's explicit-bounds body-lock keeps the bottom nav anchored correctly throughout)", id: "Popup Tambah Transaksi dan Tambah Pengulangan kini menutup dengan halus — halaman di belakang tidak lagi membeku atau melompat saat slide turun. Pembukaan kunci scroll body kini ditunda hingga animasi penutupan selesai (sekarang aman karena v1.8.3 menahan bar bawah tetap di posisi yang benar selama kunci aktif)" },
      { type: "improvement", en: "Slowed and softened the transaction-list reveal animation: 0.22s ease → 0.5s easeOutQuart with a slightly bigger slide-up. Feels more considered and less twitchy", id: "Animasi munculnya daftar transaksi diperlambat dan dilembutkan: 0.22d ease → 0.5d easeOutQuart dengan slide ke atas yang sedikit lebih besar. Terasa lebih kalem dan tidak gugup" },
      { type: "improvement", en: "Slowed the total-balance count-up animation: 600ms ease-out cubic → 1100ms easeOutQuart so the number glides to its final value instead of snapping", id: "Animasi hitung naik total saldo diperlambat: 600ms ease-out cubic → 1100ms easeOutQuart sehingga angkanya meluncur halus ke nilai akhir, bukan terhenti tiba-tiba" },
      { type: "improvement", en: "Softened the filter-chip pop on activation: 0.22s sharp pop → 0.32s gentler settle with smoother easing", id: "Pop chip filter saat diaktifkan dilembutkan: 0.22d pop tajam → 0.32d settle yang lebih halus dengan easing yang lebih lembut" },
      { type: "improvement", en: "All bottom-sheet modals (Add Category, Edit Category, Edit Wallet, Wallet Picker, Category Picker) now use the same calm Apple-style ease as the main popups for visual consistency", id: "Semua modal sheet bawah (Tambah Kategori, Edit Kategori, Edit Dompet, Pemilih Dompet, Pemilih Kategori) kini memakai easing Apple yang sama tenangnya dengan popup utama, agar tampak konsisten" },
    ],
  },
  {
    version: "1.8.3",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Combined fix for the cream strip and the popup-scroll-bleed in the installed iPhone PWA: body-scroll lock is back to `position: fixed` (which iOS Safari respects reliably) but body now also gets explicit `top: -scrollY; bottom: 0; left: 0; right: 0` so its box fills the viewport. iOS no longer collapses body's height, so fixed children with `bottom: 0` resolve to the actual viewport bottom — no cream strip — while scroll inside the popup stays inside the popup", id: "Perbaikan gabungan untuk strip krem dan kebocoran scroll popup di aplikasi iPhone terinstal: kunci body-scroll kembali memakai `position: fixed` (yang dihormati Safari iOS) tetapi body kini juga diberi `top: -scrollY; bottom: 0; left: 0; right: 0` eksplisit agar kotaknya memenuhi viewport. iOS tidak lagi merobek tinggi body, sehingga elemen fixed dengan `bottom: 0` menempel di dasar viewport sebenarnya — tanpa strip krem — sembari scroll di dalam popup tetap di dalam popup" },
    ],
  },
  {
    version: "1.8.2",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Scrolling inside the Add Transaction or Add Recurring popup no longer scrolls the page underneath. Added `overscroll-behavior: contain` to the popup's inner scroll area on the recurring sheet (was missing) and `overscroll-behavior: none` globally on html/body so iOS scroll-chaining can't bubble out of the popup.", id: "Scroll di dalam popup Tambah Transaksi atau Tambah Pengulangan tidak lagi menggeser halaman di belakangnya. Menambahkan `overscroll-behavior: contain` pada area scroll di popup pengulangan (sebelumnya tidak ada) dan `overscroll-behavior: none` global di html/body sehingga scroll iOS tidak menerobos keluar dari popup." },
    ],
  },
  {
    version: "1.8.1",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Body-scroll lock for popups switched from `position: fixed` (which on iOS PWA standalone made the bottom nav and popup anchor above the home indicator, exposing a cream strip) to `overflow: hidden` on html and body. The touchmove guard still prevents momentum scroll from bypassing the lock.", id: "Kunci body-scroll untuk popup beralih dari `position: fixed` (yang di iPhone PWA terinstal membuat bar navigasi dan popup melayang di atas home indicator, sehingga muncul strip krem) ke `overflow: hidden` pada html dan body. Penjaga touchmove tetap mencegah scroll inertia menerobos kunci tersebut." },
    ],
  },
  {
    version: "1.8.0",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Reverted the layout changes that were causing the popup-bottom and bottom-navigation glitches in the installed iPhone app. The popup sheet structure is back to v1.5.5's single-div pattern, the body-scroll unlock fires immediately on close (instead of after 420ms), and the experimental safe-area filler element has been removed", id: "Mengembalikan perubahan layout yang menyebabkan masalah pada bagian bawah popup dan bar navigasi bawah di aplikasi iPhone terinstal. Struktur popup kembali ke pola satu div seperti v1.5.5, kunci body-scroll dibuka segera setelah popup ditutup (bukan setelah 420ms), dan elemen pengisi safe area eksperimental telah dihapus" },
    ],
  },
  {
    version: "1.7.7",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Cream strip below the popup and the bottom navigation bar in the installed iPhone app is now finally fixed by adding a fixed surface-coloured filler in the iPhone home-indicator zone — it sits behind everything so any element clipped at the visual viewport boundary blends with it instead of showing the cream page background", id: "Strip cream di bawah popup dan bar navigasi bawah di aplikasi iPhone terinstal akhirnya diperbaiki dengan menambah lapisan latar warna sheet di zona home indicator iPhone — lapisan ini berada di belakang semua elemen, sehingga apa pun yang terpotong di batas viewport visual menyatu dengannya, bukan menampilkan latar krem halaman" },
    ],
  },
  {
    version: "1.7.6",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Bottom navigation bar in the installed iPhone app: the cream strip below it (visible behind the home indicator) is gone. Same fix also covers the strip below the Add Transaction and Add Recurring popups when they're open, so the floating-bar flash on close is gone too", id: "Bar navigasi bawah di aplikasi iPhone terinstal: strip cream di bawahnya (yang terlihat di balik home indicator) sudah hilang. Perbaikan ini juga menutup strip di bawah popup Tambah Transaksi dan Tambah Pengulangan saat terbuka, jadi kilatan bar mengambang ketika menutup popup ikut hilang" },
    ],
  },
  {
    version: "1.7.5",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Add Transaction and Add Recurring popups in the installed iPhone app: the home-indicator safe-area zone below the popup is now coloured the same as the sheet (white) instead of showing the page background. Also restored normal scrolling inside the popup, which the previous attempt had broken", id: "Popup Tambah Transaksi dan Tambah Pengulangan di aplikasi iPhone terinstal: zona safe area di atas home indicator kini berwarna sama dengan sheet (putih), bukan latar halaman. Scroll di dalam popup juga kembali normal setelah perbaikan sebelumnya sempat merusaknya" },
    ],
  },
  {
    version: "1.7.4",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Add Transaction and Add Recurring popups: forced the wrapper to extend past the visual viewport bottom by env(safe-area-inset-bottom) so the white background reliably covers the iPhone home-indicator zone (iOS PWA standalone was clipping bottom: 0 above the safe area, leaving a strip of page background visible)", id: "Popup Tambah Transaksi dan Tambah Pengulangan: pembungkus dipaksa keluar melewati batas viewport visual sebesar env(safe-area-inset-bottom), supaya latar putih benar-benar menutupi zona home indicator iPhone (iOS PWA standalone memotong bottom: 0 di atas safe area sehingga strip latar halaman masih terlihat)" },
    ],
  },
  {
    version: "1.7.3",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Add Transaction and Add Recurring popups: forced explicit h-full on the sheet card so its white background fills the entire iPhone viewport reliably (the implicit flexbox stretch wasn't always extending through the home-indicator zone). Bumped the service-worker cache so stale assets aren't served on first launch", id: "Popup Tambah Transaksi dan Tambah Pengulangan: tinggi penuh dipaksa pada kartu sheet sehingga latar putih benar-benar memenuhi seluruh layar iPhone (peregangan flexbox bawaan kadang tidak mencapai zona home indicator). Versi cache service worker juga dinaikkan agar aset lama tidak terpakai saat pertama dibuka" },
    ],
  },
  {
    version: "1.7.2",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Add Transaction and Add Recurring popups now truly cover the whole iPhone screen — no cream strip below the submit button, and the close animation no longer makes the page underneath jump while the sheet is sliding away", id: "Popup Tambah Transaksi dan Tambah Pengulangan kini benar-benar menutupi seluruh layar iPhone — tidak ada strip cream di bawah tombol simpan, dan animasi menutup tidak lagi membuat halaman di belakang melompat saat popup sedang bergerak turun" },
    ],
  },
  {
    version: "1.7.1",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Add Transaction and Add Recurring popups now reach the very bottom of the iPhone screen — the strip of page background that used to show under the popup is gone, and the closing animation no longer flashes that strip", id: "Popup Tambah Transaksi dan Tambah Pengulangan kini benar-benar menyentuh dasar layar iPhone — strip latar halaman yang muncul di bawah popup sudah hilang, dan animasi menutup tidak lagi memperlihatkan strip itu" },
    ],
  },
  {
    version: "1.7.0",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Add Recurring popup is now reachable on iPhone — top no longer hides behind the Dynamic Island, the close button works, and scrolling stays inside the popup instead of moving the page underneath", id: "Popup Tambah Pengulangan kini bisa diakses di iPhone — bagian atas tidak lagi tertutup Dynamic Island, tombol tutup bekerja, dan scroll tetap di dalam popup, bukan menggeser halaman di belakangnya" },
      { type: "improvement", en: "Add Transaction popup now fills the screen instead of leaving a strip of background showing underneath, and respects the iPhone safe areas so the close and submit buttons sit correctly", id: "Popup Tambah Transaksi kini memenuhi layar tanpa menyisakan strip latar di bawahnya, dan menghormati safe area iPhone agar tombol tutup dan simpan berada di posisi yang pas" },
      { type: "improvement", en: "Calmer popup entry animation — replaced the bouncy spring with a smooth ease-out so opening Add Transaction or Add Recurring feels less distracting", id: "Animasi pembukaan popup lebih tenang — gerakan pegas yang memantul diganti dengan ease-out yang halus, jadi membuka Tambah Transaksi atau Tambah Pengulangan terasa tidak mengganggu" },
      { type: "improvement", en: "Renamed remaining 'Family' references to 'Homu' for naming consistency — ledger name placeholder, internal package name, and PWA cache key now all use the Homu brand", id: "Sisa kata 'Family' diganti menjadi 'Homu' agar penamaan konsisten — placeholder nama buku, nama paket internal, dan kunci cache PWA kini menggunakan merek Homu" },
    ],
  },
  {
    version: "1.6.0",
    date: "May 9, 2026",
    changes: [
      { type: "new", en: "Branded launch splash — relaunching the installed app now shows the Homu icon on a warm cream background with a gentle breathing animation instead of a black flash, and fades smoothly into the main screen", id: "Splash screen ber-branding — saat membuka kembali aplikasi terinstal kini muncul ikon Homu di latar cream hangat dengan animasi napas lembut menggantikan kilatan layar hitam, lalu memudar mulus ke layar utama" },
      { type: "improvement", en: "PWA launch background colour switched from dark to brand cream so the iOS pre-render flash matches the app instead of looking black", id: "Warna latar saat aplikasi PWA dimuat diganti dari gelap ke cream Homu, jadi kilatan iOS sebelum aplikasi siap kini selaras dengan tampilan aplikasi" },
    ],
  },
  {
    version: "1.5.5",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Bottom navigation bar is now exactly as tall as the icons — no empty white strip above them. The bar still reaches the physical bottom of the screen so nothing looks floating", id: "Bar navigasi bawah kini setinggi ikon — tidak ada strip putih kosong di atasnya. Bar tetap menyentuh dasar layar sehingga tidak terlihat mengambang" },
    ],
  },
  {
    version: "1.5.4",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Bottom navigation no longer floats above the screen edge — the white background now reaches the physical bottom on iPhone, and the icons sit just above the home indicator instead of leaving an empty band below them", id: "Navigasi bawah tidak lagi mengambang di atas tepi layar — latar putih kini menyentuh dasar layar di iPhone, dan ikon duduk persis di atas home indicator tanpa menyisakan ruang kosong di bawahnya" },
    ],
  },
  {
    version: "1.5.3",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Bottom navigation no longer leaves an empty white strip below the icons. The whole bar (background + icons) now floats above the home indicator instead of stretching all the way to the physical bottom", id: "Navigasi bawah tidak lagi menyisakan strip putih kosong di bawah ikon. Seluruh bar (latar + ikon) kini mengambang di atas home indicator, bukan memanjang sampai dasar layar" },
    ],
  },
  {
    version: "1.5.2",
    date: "May 9, 2026",
    changes: [
      { type: "improvement", en: "Bottom navigation icons sit lower in the bar — the gap above the iPhone home indicator was halved so Transactions, Add, and Reports no longer feel floaty", id: "Ikon navigasi bawah turun lebih rendah — jarak ke home indicator iPhone dipangkas separuh sehingga Transaksi, Tambah, dan Laporan tidak terasa mengambang" },
    ],
  },
  {
    version: "1.5.1",
    date: "May 9, 2026",
    changes: [
      { type: "fix", en: "Top of every page is no longer hidden behind the iPhone status bar in the installed app — the profile, ledger switcher, search, and filter buttons are now tappable again", id: "Bagian atas tiap halaman tidak lagi tertutup status bar iPhone di aplikasi terinstal — tombol profil, pengganti buku, pencarian, dan filter kini bisa ditekan lagi" },
    ],
  },
  {
    version: "1.5.0",
    date: "May 9, 2026",
    changes: [
      { type: "new", en: "Delete a ledger from Settings → Ledger name — tap the trash icon top-right and confirm. Permanently removes the ledger and all its wallets, categories, transactions, recurring items, and members. You can't delete your only ledger — create or join another first.", id: "Hapus buku dari Pengaturan → Nama buku — ketuk ikon tempat sampah di kanan atas dan konfirmasi. Menghapus permanen buku beserta semua dompet, kategori, transaksi, item berulang, dan anggotanya. Buku terakhirmu tidak bisa dihapus — buat atau gabung buku lain dulu." },
    ],
  },
  {
    version: "1.4.0",
    date: "May 8, 2026",
    changes: [
      { type: "improvement", en: "Major security hardening: ledger membership is now atomic, photo storage is private with on-demand signed URLs, and developer flag can no longer be self-promoted", id: "Pengamanan besar: keanggotaan buku kini atomik, penyimpanan foto privat dengan URL bertanda tangan sesuai permintaan, dan flag developer tidak bisa dipromosikan sendiri" },
      { type: "improvement", en: "Privacy policy page added (Settings → Privacy Policy) — required for App Store and Play Store submission", id: "Halaman kebijakan privasi ditambahkan (Pengaturan → Kebijakan Privasi) — diperlukan untuk pengiriman App Store dan Play Store" },
      { type: "improvement", en: "iPhone notch and home indicator are now respected — bottom navigation no longer hides under the home bar on newer iPhones", id: "Notch iPhone dan home indicator kini dihormati — navigasi bawah tidak lagi tertutup home bar di iPhone baru" },
      { type: "improvement", en: "Reports page is faster on low-end phones — the breakdown list no longer re-renders when you toggle the period dropdown or tap a bar segment", id: "Halaman Laporan lebih cepat di ponsel low-end — daftar rincian tidak lagi di-render ulang saat ganti periode atau ketuk segmen bar" },
      { type: "improvement", en: "Server validates description length, amount bounds, type, and date format — clearer error messages instead of silent failures or oversized data", id: "Server memvalidasi panjang deskripsi, batas jumlah, tipe, dan format tanggal — pesan error lebih jelas, bukan kegagalan diam atau data terlalu besar" },
    ],
  },
  {
    version: "1.3.6",
    date: "May 8, 2026",
    changes: [
      { type: "fix", en: "Transaction page no longer crashes on load — balance totals are now fetched with a direct paginated query instead of a missing database function", id: "Halaman Transaksi tidak lagi error saat dimuat — total saldo kini diambil dengan kueri langsung, bukan fungsi database yang tidak ada" },
      { type: "improvement", en: "Transaction rows slide in with a gentle stagger on page load and after refresh, and the newest row flashes green to confirm it was saved", id: "Baris transaksi muncul dengan efek stagger halus saat halaman dimuat, dan baris terbaru berkedip hijau sebagai konfirmasi simpan" },
      { type: "improvement", en: "Balance count-up animation — the total balance smoothly counts to the real value instead of snapping instantly", id: "Animasi hitung naik saldo — total saldo bergerak mulus ke nilai sebenarnya, bukan langsung muncul" },
      { type: "improvement", en: "Add Transaction sheet slides up with a spring bounce, and filter chips now have a snappier press feel", id: "Sheet Tambah Transaksi muncul dengan animasi pegas, dan chip filter kini terasa lebih responsif saat ditekan" },
    ],
  },
  {
    version: "1.3.5",
    date: "May 8, 2026",
    changes: [
      { type: "improvement", en: "Transaction list now loads 20 items at a time instead of 10 — fewer scroll triggers, more content visible on first glance", id: "Daftar transaksi kini memuat 20 item sekaligus, bukan 10 — lebih sedikit pemicu scroll, lebih banyak konten terlihat sejak awal" },
    ],
  },
  {
    version: "1.3.4",
    date: "May 8, 2026",
    changes: [
      { type: "fix", en: "Database setup is now complete for fresh installs, including wallets, invitations, promo codes, transfer helpers, storage policies, and the latest security rules", id: "Setup database kini lengkap untuk instalasi baru, termasuk dompet, undangan, kode promo, helper transfer, kebijakan storage, dan aturan keamanan terbaru" },
      { type: "fix", en: "Dashboard balances and Reports totals now read full ledger history instead of stopping at the first page of transactions", id: "Saldo Dashboard dan total Laporan kini membaca seluruh riwayat buku, bukan berhenti di halaman transaksi pertama" },
      { type: "fix", en: "Reports wallet filter now treats every-wallet selection exactly like All wallets, including older transactions without a wallet", id: "Filter dompet di Laporan kini memperlakukan pilihan semua dompet sama persis seperti Semua dompet, termasuk transaksi lama tanpa dompet" },
      { type: "fix", en: "Invite-code lookups and promo-code deletion are stricter, so ledger invites stay private and developers can only delete their own unused promo codes", id: "Pencarian kode undangan dan penghapusan kode promo kini lebih ketat, jadi undangan buku tetap privat dan developer hanya bisa menghapus kode promo kosong miliknya sendiri" },
    ],
  },
  {
    version: "1.3.3",
    date: "May 8, 2026",
    changes: [
      { type: "new", en: "Developer-only: delete generated promo codes that haven't been redeemed yet — tap the trash icon, confirm by tapping it once more (auto-cancels after 3 seconds)", id: "Khusus developer: hapus kode promo yang dibuat tapi belum digunakan — ketuk ikon tempat sampah, konfirmasi dengan ketuk sekali lagi (otomatis batal setelah 3 detik)" },
    ],
  },
  {
    version: "1.3.2",
    date: "May 8, 2026",
    changes: [
      { type: "improvement", en: "Reports: replaced the big donut chart with a thin horizontal stacked bar — same colour-per-category visualisation, but the breakdown list below is now visible without scrolling", id: "Laporan: grafik donat besar diganti dengan bar horizontal tipis bertumpuk — visualisasi warna per kategori tetap sama, tapi rincian di bawah kini terlihat tanpa harus scroll" },
    ],
  },
  {
    version: "1.3.1",
    date: "May 8, 2026",
    changes: [
      { type: "improvement", en: "Reports wallet filter now supports picking multiple wallets at once — tap each wallet to toggle it, or tap All wallets to clear", id: "Filter dompet di Laporan kini bisa memilih beberapa dompet sekaligus — ketuk tiap dompet untuk menyalakan/mematikan, atau ketuk Semua dompet untuk reset" },
    ],
  },
  {
    version: "1.3.0",
    date: "May 8, 2026",
    changes: [
      { type: "new", en: "Wallet filter on the Reports page — pick a single wallet to scope every chart, total, and breakdown to that wallet only", id: "Filter dompet di halaman Laporan — pilih satu dompet untuk menyaring semua grafik, total, dan rincian khusus dompet itu" },
      { type: "improvement", en: "Reports header reorganised: wallet filter on the left, date range centred, period selector on the right", id: "Header Laporan ditata ulang: filter dompet di kiri, rentang tanggal di tengah, pilih periode di kanan" },
    ],
  },
  {
    version: "1.2.0",
    date: "May 8, 2026",
    changes: [
      { type: "new", en: "Tap a transaction's photo to open it fullscreen, with a download button to save the receipt to your phone", id: "Ketuk foto transaksi untuk membukanya layar penuh, dengan tombol unduh untuk menyimpan struk ke ponselmu" },
      { type: "improvement", en: "Photos are now auto-compressed in the browser before upload — typical iPhone receipts go from 4-6 MB down to ~300 KB without losing readability, so saves are dramatically faster on mobile data", id: "Foto kini dikompres otomatis di browser sebelum diunggah — struk iPhone biasa turun dari 4-6 MB menjadi ~300 KB tanpa kehilangan ketajaman, jadi simpan jauh lebih cepat di data seluler" },
    ],
  },
  {
    version: "1.1.2",
    date: "May 8, 2026",
    changes: [
      { type: "fix", en: "Save Transaction with a photo on iOS Chrome no longer hangs on \"Saving…\" — photos now upload directly to storage, bypassing the server's request-size limit", id: "Simpan Transaksi dengan foto di iOS Chrome tidak lagi macet di \"Menyimpan…\" — foto kini diunggah langsung ke storage, tidak lewat batas ukuran request server" },
      { type: "improvement", en: "If a photo upload stalls or the connection drops, you now get a clear error message instead of a frozen button (30s timeout)", id: "Jika unggah foto tersendat atau koneksi putus, kamu akan melihat pesan error yang jelas, bukan tombol membeku (timeout 30 detik)" },
    ],
  },
  {
    version: "1.1.1",
    date: "May 7, 2026",
    changes: [
      { type: "new", en: "New ledgers now start with three default wallets (Cash, Savings, Credit) instead of just Cash", id: "Buku baru kini mulai dengan tiga dompet default (Tunai, Tabungan, Kartu Kredit) bukan cuma Tunai" },
      { type: "fix", en: "Wallet badge on transaction rows now sits perfectly centred — fixed a hairline baseline offset on the icon", id: "Lencana dompet di baris transaksi kini benar-benar di tengah — perbaikan kecil pada posisi ikon" },
      { type: "improvement", en: "Wallet picker auto-sizes to its content and respects the iPhone home-indicator safe area, so the bottom row no longer feels cut off", id: "Pemilih dompet kini menyesuaikan tinggi sesuai isi dan menghormati area aman home indicator iPhone, baris bawah tidak terpotong lagi" },
    ],
  },
  {
    version: "1.1.0",
    date: "May 7, 2026",
    changes: [
      { type: "new", en: "Transfer between wallets — third option in Add Transaction (Expense | Income | Transfer) with From and To wallet pickers", id: "Transfer antar dompet — opsi ketiga di Tambah Transaksi (Pengeluaran | Pemasukan | Transfer) dengan pemilih dompet Dari dan Ke" },
      { type: "new", en: "Transfer rows show with a neutral coral colour and a From → To label, so they don't get mixed up with real income/expense", id: "Baris transfer tampil dengan warna coral netral dan label Dari → Ke, supaya tidak tertukar dengan pemasukan/pengeluaran asli" },
      { type: "improvement", en: "Transfers are excluded from Income, Expenses and Reports aggregates (they net to zero across your wallets)", id: "Transfer tidak dihitung dalam total Pemasukan, Pengeluaran, dan Laporan (saling menghapus antar dompet)" },
      { type: "improvement", en: "Per-wallet balance correctly accounts for transfers — the source wallet decreases, the destination wallet increases", id: "Saldo per dompet dihitung benar sesuai transfer — dompet sumber berkurang, dompet tujuan bertambah" },
      { type: "fix", en: "Hydration mismatch on the Total Balance card resolved", id: "Memperbaiki ketidakcocokan hydration pada kartu Total Saldo" },
    ],
  },
  {
    version: "0.9.0",
    date: "May 7, 2026",
    changes: [
      { type: "new", en: "Promo codes — sign up now requires a single-use HOMU-XXXX-XXXX code", id: "Kode promo — pendaftaran kini memerlukan kode sekali pakai HOMU-XXXX-XXXX" },
      { type: "new", en: "Developer-only Promo Codes page in Settings — generate codes for 3 months / 6 months / 1 year / Lifetime / Developer tiers, with stats on how many were generated and redeemed", id: "Halaman Kode Promo khusus developer di Pengaturan — buat kode untuk 3 bulan / 6 bulan / 1 tahun / Seumur hidup / Developer, dengan statistik jumlah dibuat dan ditukar" },
      { type: "new", en: "Welcome modal celebrates new PRO users on first sign-in (\"Congratulations — you are a [tier] PRO user\")", id: "Modal selamat datang merayakan pengguna PRO baru saat pertama kali masuk (\"Selamat — Anda kini pengguna PRO [tier]\")" },
      { type: "new", en: "PRO badge in your profile shows your subscription tier and expiry date (lifetime/developer never expire)", id: "Lencana PRO di profilmu menampilkan tier langganan dan tanggal kedaluwarsa (seumur hidup/developer tidak kedaluwarsa)" },
      { type: "improvement", en: "Existing users grandfathered as Lifetime PRO so nobody loses access", id: "Pengguna lama otomatis jadi Lifetime PRO supaya tidak ada yang kehilangan akses" },
    ],
  },
  {
    version: "0.8.0",
    date: "May 7, 2026",
    changes: [
      { type: "new", en: "Wallets — track each transaction's source (Cash, BCA, Gopay, etc.) with custom name, icon, color and initial balance", id: "Dompet — catat sumber tiap transaksi (Tunai, BCA, Gopay, dll) dengan nama, ikon, warna, dan saldo awal kustom" },
      { type: "new", en: "Wallet picker in Add Transaction — defaults to your chosen default wallet, change in Settings → Wallets", id: "Pemilih dompet di Tambah Transaksi — default ke dompet utama pilihanmu, ubah di Pengaturan → Dompet" },
      { type: "new", en: "Wallet badge on the left of each transaction's icon — mirrors the member badge on the right", id: "Lencana dompet di kiri ikon tiap transaksi — cermin lencana anggota di kanan" },
      { type: "new", en: "Filter transactions by wallet, alongside date and category filters", id: "Saring transaksi berdasarkan dompet, selain filter tanggal dan kategori" },
      { type: "improvement", en: "Brand coral colour now appears on the Sign in button, Add Transaction button, and homescreen icon", id: "Warna coral Homu kini muncul di tombol Masuk, tombol Tambah Transaksi, dan ikon homescreen" },
    ],
  },
  {
    version: "0.7.1",
    date: "May 6, 2026",
    changes: [
      { type: "improvement", en: "Updates page now shows in your chosen language (English & Bahasa Indonesia)", id: "Halaman Pembaruan kini tampil sesuai bahasa pilihanmu (Inggris & Bahasa Indonesia)" },
    ],
  },
  {
    version: "0.7.0",
    date: "May 6, 2026",
    changes: [
      { type: "new", en: "Quick-add recurring from any transaction — open Edit Transaction → tap Recurring → pick weekly / monthly / yearly", id: "Tambah pengulangan cepat dari transaksi mana saja — buka Edit Transaksi → ketuk Pengulangan → pilih mingguan / bulanan / tahunan" },
    ],
  },
  {
    version: "0.6.3",
    date: "May 6, 2026",
    changes: [
      { type: "improvement", en: "Categories now show as one flat list — defaults can be edited and deleted just like custom ones", id: "Kategori kini tampil sebagai satu daftar — kategori bawaan bisa diedit dan dihapus seperti kategori kustom" },
      { type: "fix", en: "Edit Category sheet now respects 2D Icons mode (shows Lucide icons grid instead of 3D emojis)", id: "Sheet Edit Kategori kini mengikuti mode Ikon 2D (menampilkan grid ikon Lucide, bukan emoji 3D)" },
      { type: "fix", en: "Lucide symbols now render correctly in the filter chips and recurring item editor (no more 'lu:shirt' text)", id: "Simbol Lucide kini tampil dengan benar di filter chip dan editor item berulang (tidak ada lagi teks 'lu:shirt')" },
    ],
  },
  {
    version: "0.6.2",
    date: "May 6, 2026",
    changes: [
      { type: "improvement", en: "Pending invitees now appear inline in the Members list with a 'Pending' badge", id: "Undangan yang belum diterima kini muncul langsung di daftar Anggota dengan lencana 'Menunggu'" },
    ],
  },
  {
    version: "0.6.1",
    date: "May 6, 2026",
    changes: [
      { type: "fix", en: "Fixed inviting users outside your ledger — lookup now finds users by email or username across the whole app", id: "Memperbaiki undangan ke pengguna di luar buku kamu — pencarian kini menemukan pengguna lewat email atau nama pengguna di seluruh aplikasi" },
    ],
  },
  {
    version: "0.6.0",
    date: "May 6, 2026",
    changes: [
      { type: "new", en: "Invite members to a ledger by email or username", id: "Undang anggota ke buku lewat email atau nama pengguna" },
      { type: "new", en: "Pending invitations show in My Ledgers with Accept/Decline buttons", id: "Undangan yang belum dijawab muncul di Buku Saya dengan tombol Terima/Tolak" },
      { type: "new", en: "Join an existing ledger with an invite code from the My Ledgers sheet", id: "Bergabung ke buku yang sudah ada menggunakan kode undangan dari sheet Buku Saya" },
      { type: "improvement", en: "Owners can see and cancel pending invitations from the Members page", id: "Pemilik buku bisa melihat dan membatalkan undangan yang menunggu dari halaman Anggota" },
    ],
  },
  {
    version: "0.5.0",
    date: "May 6, 2026",
    changes: [
      { type: "new", en: "Migrated to new infrastructure (homu.ramu.app)", id: "Pindah ke infrastruktur baru (homu.ramu.app)" },
      { type: "new", en: "Tap ledger name in Settings to rename it", id: "Ketuk nama buku di Pengaturan untuk mengubahnya" },
      { type: "improvement", en: "Renamed 'Household' section to 'Ledger'", id: "Bagian 'Household' diubah namanya menjadi 'Buku'" },
      { type: "improvement", en: "FAB opens recurring sheet when on Recurring tab", id: "Tombol FAB membuka sheet pengulangan saat berada di tab Pengulangan" },
      { type: "new", en: "Added Updates page to track what's new", id: "Halaman Pembaruan ditambahkan untuk melihat hal-hal baru" },
    ],
  },
];
