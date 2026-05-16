// One-line, plain-language release summaries shown to end users on
// /settings/updates. The full technical changelog lives in
// lib/changelog.ts and is shown only on the developer-only
// /settings/dev-changelog page.
//
// Every version in lib/changelog.ts's CHANGELOG must have an entry here.
// Keep each summary to ONE short, jargon-free sentence in both languages.

export const CHANGELOG_SUMMARIES: Record<string, { en: string; id: string }> = {
  "1.46.0": {
    en: "Version Updates is simpler — each release now shows one short, friendly note about what's new.",
    id: "Version Updates kini lebih sederhana — tiap rilis menampilkan satu catatan singkat dan ramah tentang yang baru.",
  },
  "1.45.4": {
    en: "Adding a transaction feels smoother — a clean number pad appears the moment you tap +.",
    id: "Menambah transaksi terasa lebih mulus — papan angka yang rapi muncul begitu kamu ketuk +.",
  },
  "1.45.3": {
    en: "Add Transaction is tidier, with gentler animations and a cleaner look at the bottom of the screen.",
    id: "Add Transaction lebih rapi, dengan animasi lebih lembut dan tampilan lebih bersih di bagian bawah layar.",
  },
  "1.45.2": {
    en: "The AI suggests a category from your description again when you add a transaction.",
    id: "AI kembali menyarankan kategori dari deskripsimu saat kamu menambah transaksi.",
  },
  "1.45.1": {
    en: "Add Transaction now sits neatly above the keyboard so every field stays in reach.",
    id: "Add Transaction kini berada rapi di atas keyboard sehingga semua kolom tetap terjangkau.",
  },
  "1.45.0": {
    en: "Add Transaction got a fresh redesign, and you can now set a transaction to repeat right from it.",
    id: "Add Transaction didesain ulang, dan sekarang kamu bisa mengatur transaksi berulang langsung dari sana.",
  },
  "1.44.0": {
    en: "Categories fill in faster and more accurately, recognising thousands of Indonesian brands and foods.",
    id: "Kategori terisi lebih cepat dan akurat, mengenali ribuan brand dan makanan khas Indonesia.",
  },
  "1.43.3": {
    en: "The AI button on the Transactions screen sits more comfortably near the bottom.",
    id: "Tombol AI di layar Transactions kini berada lebih nyaman di dekat bawah layar.",
  },
  "1.43.2": {
    en: "Voice now reliably picks up the amount even when you say it in one breath.",
    id: "Voice kini andal menangkap jumlah meski kamu ucapkan dalam satu napas.",
  },
  "1.43.1": {
    en: "Voice transactions feel faster and smoother, with calmer, more consistent colours across the app.",
    id: "Transaksi suara terasa lebih cepat dan mulus, dengan warna yang lebih tenang dan konsisten di seluruh aplikasi.",
  },
  "1.43.0": {
    en: "Voice can now stitch a description and amount said separately, and change categories by voice.",
    id: "Voice kini bisa menyatukan deskripsi dan jumlah yang diucapkan terpisah, serta mengubah kategori lewat suara.",
  },
  "1.42.4": {
    en: "The version number on the Settings page is always accurate now.",
    id: "Nomor versi di halaman Pengaturan kini selalu akurat.",
  },
  "1.42.3": {
    en: "Voice rows appear faster, and amounts in Indonesian are understood more accurately.",
    id: "Baris suara muncul lebih cepat, dan jumlah dalam Bahasa Indonesia dipahami lebih akurat.",
  },
  "1.42.2": {
    en: "Voice waits a little longer so it no longer cuts you off mid-sentence.",
    id: "Voice menunggu sedikit lebih lama sehingga tidak lagi memotong kamu di tengah kalimat.",
  },
  "1.42.1": {
    en: "Voice spends fewer resources and asks which row you mean when more than one matches.",
    id: "Voice lebih hemat dan bertanya baris mana yang kamu maksud saat ada lebih dari satu yang cocok.",
  },
  "1.42.0": {
    en: "Voice transactions feel much snappier, and voice and typed entries now learn from each other.",
    id: "Transaksi suara terasa jauh lebih responsif, dan entri suara serta ketik kini saling belajar.",
  },
  "1.41.1": {
    en: "Behind-the-scenes work to test voice transactions before a wider release.",
    id: "Penyiapan di balik layar untuk menguji transaksi suara sebelum dirilis lebih luas.",
  },
  "1.41.0": {
    en: "New AI voice transactions — just speak in Indonesian or English and the rows fill in for you.",
    id: "Transaksi suara AI baru — cukup bicara dalam Bahasa Indonesia atau Inggris dan barisnya terisi sendiri.",
  },
  "1.40.1": {
    en: "The onboarding category picker is cleaner and more consistent across every use case.",
    id: "Pilihan kategori saat onboarding lebih rapi dan konsisten untuk setiap jenis penggunaan.",
  },
  "1.40.0": {
    en: "Sign up shows a live password match check, and categories are tailored to how you'll use the ledger.",
    id: "Sign up menampilkan cek kecocokan password langsung, dan kategori disesuaikan dengan cara kamu memakai buku.",
  },
  "1.38.1": {
    en: "Creating a new ledger from Settings now uses the same friendly step-by-step setup as signup.",
    id: "Membuat buku baru dari Pengaturan kini memakai penyiapan langkah demi langkah yang sama seperti saat daftar.",
  },
  "1.39.0": {
    en: "Loading screens now look right in dark mode.",
    id: "Layar pemuatan kini tampil dengan benar di mode gelap.",
  },
  "1.38.0": {
    en: "Onboarding now asks what your ledger is for and sets up matching categories and wallets.",
    id: "Onboarding kini menanyakan untuk apa bukumu dan menyiapkan kategori serta dompet yang cocok.",
  },
  "1.37.0": {
    en: "You can now change your account email address from Edit Profile.",
    id: "Sekarang kamu bisa mengganti alamat email akunmu dari Edit Profil.",
  },
  "1.36.1": {
    en: "You can now edit or remove a transaction that's still waiting to sync.",
    id: "Sekarang kamu bisa mengubah atau menghapus transaksi yang masih menunggu disinkronkan.",
  },
  "1.36.0": {
    en: "Transactions added offline now show up right away and sync once you're back online.",
    id: "Transaksi yang ditambahkan saat offline kini langsung muncul dan tersinkron begitu kamu online lagi.",
  },
  "1.35.1": {
    en: "Add transactions, wallets, or categories while offline — they're saved and sent when you reconnect.",
    id: "Tambah transaksi, dompet, atau kategori saat offline — semua tersimpan dan terkirim saat kamu online lagi.",
  },
  "1.35.0": {
    en: "Under-the-hood groundwork for offline support — nothing to notice yet.",
    id: "Penyiapan di balik layar untuk dukungan offline — belum ada yang terlihat.",
  },
  "1.34.0": {
    en: "The app keeps working on shaky connections — recently opened pages still show up.",
    id: "Aplikasi tetap berjalan di koneksi yang tidak stabil — halaman yang baru dibuka tetap tampil.",
  },
  "1.33.0": {
    en: "Forgot your password? You can now reset it with a code sent to your email.",
    id: "Lupa password? Sekarang kamu bisa mengaturnya ulang dengan kode yang dikirim ke emailmu.",
  },
  "1.32.0": {
    en: "Sign up is cleaner and now confirms your account with a code sent to your email.",
    id: "Sign up lebih rapi dan kini mengonfirmasi akunmu dengan kode yang dikirim ke emailmu.",
  },
  "1.31.0": {
    en: "Settings opens instantly, and you can now give each signed-in device a nickname.",
    id: "Pengaturan terbuka instan, dan kamu kini bisa memberi nama setiap perangkat yang masuk.",
  },
  "1.30.0": {
    en: "Signing out now only signs out the device you're on, and you can manage all your devices in Settings.",
    id: "Sign out kini hanya keluar dari perangkat yang kamu pakai, dan kamu bisa kelola semua perangkat di Pengaturan.",
  },
  "1.29.0": {
    en: "The Updates page is now called Version Updates for clarity.",
    id: "Halaman Updates kini bernama Version Updates agar lebih jelas.",
  },
  "1.28.0": {
    en: "The Updates page now shows simple, plain-language release notes.",
    id: "Halaman Updates kini menampilkan catatan rilis dalam bahasa yang sederhana.",
  },
  "1.27.0": {
    en: "Tell the AI which language your transactions are in for better categories, and create up to 20 ledgers.",
    id: "Beri tahu AI bahasa transaksimu untuk kategori yang lebih tepat, dan buat hingga 20 buku.",
  },
  "1.26.0": {
    en: "The page behind the Add Transaction sheet no longer scrolls by accident.",
    id: "Halaman di belakang sheet Add Transaction tidak lagi ikut tergulir tanpa sengaja.",
  },
  "1.25.0": {
    en: "New AI auto-categorize — the right category fills in as you type, and the app learns from every save.",
    id: "Auto-kategori AI baru — kategori yang tepat terisi saat kamu mengetik, dan aplikasi belajar dari tiap simpan.",
  },
  "1.24.0": {
    en: "Make a transaction recurring without leaving the Add screen, and the login page is cleaner.",
    id: "Buat transaksi berulang tanpa keluar dari layar Tambah, dan halaman login lebih rapi.",
  },
  "1.23.1": {
    en: "The Total Balance card is simpler and easier to read at a glance.",
    id: "Kartu Total Saldo lebih sederhana dan mudah dibaca sekilas.",
  },
  "1.23.0": {
    en: "Staying signed in is more reliable, and recurring items show up on time.",
    id: "Tetap masuk kini lebih andal, dan item berulang muncul tepat waktu.",
  },
  "1.22.0": {
    en: "Sign in with Google, and a new free tier lets you use the whole app.",
    id: "Masuk dengan Google, dan paket gratis baru memungkinkan kamu memakai seluruh aplikasi.",
  },
  "1.21.1": {
    en: "Small polish to the Add Transaction screen for a cleaner look.",
    id: "Sedikit penyempurnaan pada layar Add Transaction untuk tampilan yang lebih bersih.",
  },
  "1.21.0": {
    en: "Adding a transaction is quicker — the keyboard opens right away and the form is more compact.",
    id: "Menambah transaksi lebih cepat — keyboard langsung terbuka dan formnya lebih ringkas.",
  },
  "1.20.0": {
    en: "Cleaner Transactions and Settings screens, with a smoother icon-style picker.",
    id: "Layar Transactions dan Pengaturan lebih bersih, dengan pemilih gaya ikon yang lebih mulus.",
  },
  "1.19.0": {
    en: "Behind-the-scenes design tools for the development team.",
    id: "Perkakas desain di balik layar untuk tim pengembang.",
  },
  "1.18.1": {
    en: "Moving between Settings pages keeps you reliably signed in now.",
    id: "Berpindah antar halaman Pengaturan kini menjaga kamu tetap masuk dengan andal.",
  },
  "1.18.0": {
    en: "Help & Feedback now has a My Tickets tab to follow your submitted tickets and replies.",
    id: "Help & Feedback kini punya tab My Tickets untuk memantau tiket dan balasan yang kamu kirim.",
  },
  "1.17.1": {
    en: "Buttons and headers read more clearly, especially in dark mode.",
    id: "Tombol dan header lebih jelas terbaca, terutama di mode gelap.",
  },
  "1.17.0": {
    en: "Help & Feedback is here — send a message with screenshots or a video right from Settings.",
    id: "Help & Feedback hadir — kirim pesan dengan tangkapan layar atau video langsung dari Pengaturan.",
  },
  "1.16.1": {
    en: "Tap any category in Reports to see every transaction inside it.",
    id: "Ketuk kategori mana pun di Reports untuk melihat semua transaksi di dalamnya.",
  },
  "1.16.0": {
    en: "Dark mode is here — pick light, dark, or follow your phone in Settings.",
    id: "Mode gelap hadir — pilih terang, gelap, atau ikut HP-mu di Pengaturan.",
  },
  "1.15.1": {
    en: "Page headers stay tidy and in place while you scroll.",
    id: "Header halaman tetap rapi dan di tempatnya saat kamu menggulir.",
  },
  "1.15.0": {
    en: "Recurring items now post into your transaction history automatically when they're due.",
    id: "Item berulang kini otomatis masuk ke riwayat transaksi saat jatuh tempo.",
  },
  "1.14.3": {
    en: "Transaction rows now show the wallet name inline so they're easier to read.",
    id: "Baris transaksi kini menampilkan nama dompet sejajar agar lebih mudah dibaca.",
  },
  "1.14.2": {
    en: "The transaction list now groups by day with clear date headers.",
    id: "Daftar transaksi kini dikelompokkan per hari dengan header tanggal yang jelas.",
  },
  "1.14.1": {
    en: "Headers on Settings pages now stay pinned in place as expected.",
    id: "Header di halaman Pengaturan kini tetap menempel sebagaimana mestinya.",
  },
  "1.14.0": {
    en: "Categories are split into Expense and Income tabs, and deleting a category works smoothly now.",
    id: "Kategori dipisah jadi tab Pengeluaran dan Pemasukan, dan menghapus kategori kini berjalan mulus.",
  },
  "1.13.4": {
    en: "Small visual polish to the search bar.",
    id: "Sedikit penyempurnaan tampilan pada bar pencarian.",
  },
  "1.13.3": {
    en: "Smoother sliding animations for the search bar and filter sheet.",
    id: "Animasi geser yang lebih mulus untuk bar pencarian dan sheet filter.",
  },
  "1.13.2": {
    en: "The bottom navigation bar looks cleaner and sits more comfortably.",
    id: "Bar navigasi bawah tampil lebih bersih dan duduk lebih nyaman.",
  },
  "1.13.1": {
    en: "Small tweaks to the bottom navigation bar's spacing and placement.",
    id: "Sedikit penyesuaian pada jarak dan posisi bar navigasi bawah.",
  },
  "1.13.0": {
    en: "The bottom navigation is refined, with always-visible labels and gentle bounce scrolling.",
    id: "Navigasi bawah disempurnakan, dengan label yang selalu terlihat dan gulir memantul yang lembut.",
  },
  "1.12.0": {
    en: "A fresh floating bottom navigation bar with a tactile + button.",
    id: "Bar navigasi bawah mengambang yang baru dengan tombol + yang terasa di tangan.",
  },
  "1.11.0": {
    en: "The Add Transaction and Add Recurring screens are more reliable on iPhone.",
    id: "Layar Add Transaction dan Add Recurring lebih andal di iPhone.",
  },
  "1.10.2": {
    en: "Restored the Add screen so its buttons are always reachable.",
    id: "Memulihkan layar Tambah agar tombolnya selalu terjangkau.",
  },
  "1.10.1": {
    en: "Adjusted the Add screen to cover the full iPhone display.",
    id: "Menyesuaikan layar Tambah agar memenuhi seluruh layar iPhone.",
  },
  "1.10.0": {
    en: "Restored the Add screen to a known-good, stable version.",
    id: "Memulihkan layar Tambah ke versi yang stabil dan teruji.",
  },
  "1.9.3": {
    en: "The area below an open Add screen now blends in neatly.",
    id: "Area di bawah layar Tambah yang terbuka kini menyatu dengan rapi.",
  },
  "1.9.2": {
    en: "More reliable behaviour when closing the Add screen.",
    id: "Perilaku yang lebih andal saat menutup layar Tambah.",
  },
  "1.9.1": {
    en: "Minor stability tune-up so the latest version loads cleanly.",
    id: "Penyetelan stabilitas kecil agar versi terbaru termuat dengan bersih.",
  },
  "1.9.0": {
    en: "The Add screen closes smoothly, with calmer animations across the app.",
    id: "Layar Tambah menutup dengan mulus, dengan animasi yang lebih tenang di seluruh aplikasi.",
  },
  "1.8.3": {
    en: "A cleaner look at the bottom of the screen when the Add screen is open.",
    id: "Tampilan lebih bersih di bagian bawah layar saat layar Tambah terbuka.",
  },
  "1.8.2": {
    en: "Scrolling inside the Add screen no longer moves the page behind it.",
    id: "Menggulir di dalam layar Tambah tidak lagi menggeser halaman di belakangnya.",
  },
  "1.8.1": {
    en: "Smoother behaviour at the bottom of the screen when the Add screen is open.",
    id: "Perilaku lebih mulus di bagian bawah layar saat layar Tambah terbuka.",
  },
  "1.8.0": {
    en: "Restored the Add screen to fix a few display quirks on iPhone.",
    id: "Memulihkan layar Tambah untuk mengatasi beberapa kejanggalan tampilan di iPhone.",
  },
  "1.7.7": {
    en: "Tidied up the strip below the Add screen and bottom navigation on iPhone.",
    id: "Merapikan area di bawah layar Tambah dan navigasi bawah di iPhone.",
  },
  "1.7.6": {
    en: "Cleaner look below the bottom navigation and Add screens on iPhone.",
    id: "Tampilan lebih bersih di bawah navigasi bawah dan layar Tambah di iPhone.",
  },
  "1.7.5": {
    en: "The Add screen looks cleaner near the bottom and scrolls normally again.",
    id: "Layar Tambah tampil lebih bersih di dekat bawah dan kembali menggulir normal.",
  },
  "1.7.4": {
    en: "The Add screen now covers the bottom of the iPhone screen properly.",
    id: "Layar Tambah kini menutupi bagian bawah layar iPhone dengan benar.",
  },
  "1.7.3": {
    en: "The Add screen now fills the whole iPhone screen reliably.",
    id: "Layar Tambah kini memenuhi seluruh layar iPhone dengan andal.",
  },
  "1.7.2": {
    en: "The Add screen now covers the whole iPhone screen with a smoother close.",
    id: "Layar Tambah kini menutupi seluruh layar iPhone dengan penutupan yang lebih mulus.",
  },
  "1.7.1": {
    en: "The Add screen now reaches the very bottom of the iPhone screen.",
    id: "Layar Tambah kini mencapai bagian paling bawah layar iPhone.",
  },
  "1.7.0": {
    en: "The Add Recurring screen works well on iPhone, with calmer opening animations.",
    id: "Layar Add Recurring berfungsi baik di iPhone, dengan animasi pembukaan yang lebih tenang.",
  },
  "1.6.0": {
    en: "A new branded splash screen greets you when you open the app.",
    id: "Layar pembuka ber-merek baru menyambutmu saat membuka aplikasi.",
  },
  "1.5.5": {
    en: "The bottom navigation bar is sized just right, with no empty space above the icons.",
    id: "Bar navigasi bawah berukuran pas, tanpa ruang kosong di atas ikon.",
  },
  "1.5.4": {
    en: "The bottom navigation bar now reaches the bottom edge neatly on iPhone.",
    id: "Bar navigasi bawah kini mencapai tepi bawah dengan rapi di iPhone.",
  },
  "1.5.3": {
    en: "Tidied up the bottom navigation bar so it no longer leaves an empty strip.",
    id: "Merapikan bar navigasi bawah agar tidak lagi menyisakan area kosong.",
  },
  "1.5.2": {
    en: "The bottom navigation icons sit a little lower for a more grounded feel.",
    id: "Ikon navigasi bawah duduk sedikit lebih rendah agar terasa lebih mantap.",
  },
  "1.5.1": {
    en: "The top of every page is fully tappable again on iPhone.",
    id: "Bagian atas setiap halaman kembali bisa diketuk sepenuhnya di iPhone.",
  },
  "1.5.0": {
    en: "You can now delete a ledger from Settings.",
    id: "Sekarang kamu bisa menghapus buku dari Pengaturan.",
  },
  "1.4.0": {
    en: "Stronger account security and several reliability and speed improvements.",
    id: "Keamanan akun lebih kuat serta beberapa peningkatan keandalan dan kecepatan.",
  },
  "1.3.6": {
    en: "The Transactions page loads reliably, with smooth animations and a balance count-up.",
    id: "Halaman Transactions termuat andal, dengan animasi mulus dan hitung naik saldo.",
  },
  "1.3.5": {
    en: "The transaction list now loads more items at once, so you scroll less.",
    id: "Daftar transaksi kini memuat lebih banyak item sekaligus, jadi kamu lebih sedikit menggulir.",
  },
  "1.3.4": {
    en: "Balances and report totals now reflect your full ledger history.",
    id: "Saldo dan total laporan kini mencerminkan seluruh riwayat bukumu.",
  },
  "1.3.3": {
    en: "Developer tools for managing promo codes.",
    id: "Perkakas developer untuk mengelola kode promo.",
  },
  "1.3.2": {
    en: "Reports now shows a compact bar so the breakdown list is visible without scrolling.",
    id: "Reports kini menampilkan bar ringkas sehingga rincian terlihat tanpa harus menggulir.",
  },
  "1.3.1": {
    en: "You can now filter Reports by several wallets at once.",
    id: "Sekarang kamu bisa menyaring Reports berdasarkan beberapa dompet sekaligus.",
  },
  "1.3.0": {
    en: "New wallet filter on the Reports page to focus on a single wallet.",
    id: "Filter dompet baru di halaman Reports untuk fokus pada satu dompet.",
  },
  "1.2.0": {
    en: "Tap a transaction photo to view it fullscreen, and photos upload much faster now.",
    id: "Ketuk foto transaksi untuk melihatnya layar penuh, dan foto kini terunggah jauh lebih cepat.",
  },
  "1.1.2": {
    en: "Saving a transaction with a photo is more reliable on iPhone.",
    id: "Menyimpan transaksi dengan foto lebih andal di iPhone.",
  },
  "1.1.1": {
    en: "New ledgers now start with three wallets ready to go.",
    id: "Buku baru kini langsung dilengkapi tiga dompet siap pakai.",
  },
  "1.1.0": {
    en: "Transfer money between wallets — a new option right inside Add Transaction.",
    id: "Transfer uang antar dompet — opsi baru langsung di dalam Add Transaction.",
  },
  "0.9.0": {
    en: "Promo codes and PRO tiers arrive, with a welcome celebration for new PRO users.",
    id: "Kode promo dan tier PRO hadir, lengkap dengan sambutan untuk pengguna PRO baru.",
  },
  "0.8.0": {
    en: "Wallets are here — track which source each transaction came from.",
    id: "Dompet hadir — catat dari sumber mana setiap transaksi berasal.",
  },
  "0.7.1": {
    en: "The Updates page now shows in your chosen language.",
    id: "Halaman Updates kini tampil dalam bahasa pilihanmu.",
  },
  "0.7.0": {
    en: "You can now turn any transaction into a recurring one.",
    id: "Sekarang kamu bisa mengubah transaksi apa pun menjadi berulang.",
  },
  "0.6.3": {
    en: "Categories now show as one simple list you can fully edit.",
    id: "Kategori kini tampil sebagai satu daftar sederhana yang bisa kamu edit sepenuhnya.",
  },
  "0.6.2": {
    en: "People you've invited now appear in the Members list while they wait to join.",
    id: "Orang yang kamu undang kini muncul di daftar Anggota selagi menunggu bergabung.",
  },
  "0.6.1": {
    en: "Inviting people from outside your ledger works reliably now.",
    id: "Mengundang orang dari luar bukumu kini berjalan dengan andal.",
  },
  "0.6.0": {
    en: "Invite family members to share a ledger by email or username.",
    id: "Undang anggota keluarga untuk berbagi buku lewat email atau nama pengguna.",
  },
  "0.5.0": {
    en: "You can now rename your ledger, and a new Updates page tracks what's new.",
    id: "Sekarang kamu bisa mengganti nama bukumu, dan halaman Updates baru memuat hal-hal baru.",
  },
};
