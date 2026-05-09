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
