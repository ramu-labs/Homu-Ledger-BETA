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

export type ChangeEntry = {
  type: "new" | "fix" | "improvement";
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
