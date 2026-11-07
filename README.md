# Klinik & Farmasi OS

Aplikasi klinik dan farmasi berbasis React/Vite. Seluruh data operasional disimpan langsung di browser dengan `localStorage`; aplikasi tidak memerlukan Base44, server database, maupun akun cloud.

## Menjalankan aplikasi

Prasyarat: Node.js 20 atau yang lebih baru.

```bash
npm install
npm run dev
```

Buka alamat yang dicetak Vite (biasanya `http://localhost:5173`). Untuk build produksi:

```bash
npm run build
npm run preview
```

## Penyimpanan data

- Database lokal tersimpan pada key `klinikfarmasios.local-db` di `localStorage` browser.
- Seed bawaan yang berasal dari data aplikasi lama dimuat otomatis dan di-*merge* secara idempoten. Data pengguna yang sudah ada tidak ditimpa.
- Berkas unggahan disimpan sebagai data URL di browser.
- Data terpisah per browser dan per origin. Menghapus site data/cache browser akan menghapus database lokal tersebut.
- Catatan klinis/keuangan penting dan audit trail tidak dapat dihapus permanen melalui adapter data aplikasi.

## Akun demo

Semua akun demo memakai kata sandi `Demo1234!`.

| Peran | Email |
|---|---|
| Owner | `demo.owner@klinikfarma.com` |
| Admin | `demo.admin@klinikfarma.com` |
| Front Office | `demo.frontoffice@klinikfarma.com` |
| Perawat | `demo.perawat@klinikfarma.com` |
| Dokter Umum | `demo.dokterumum@klinikfarma.com` |
| Dokter Gigi | `demo.doktergigi@klinikfarma.com` |
| Dokter Anak | `demo.dokteranak@klinikfarma.com` |
| Dokter Penyakit Dalam | `demo.dokterdalam@klinikfarma.com` |
| Dokter Locum | `demo.dokterlocum@klinikfarma.com` |
| Apoteker | `demo.apoteker@klinikfarma.com` |
| APJ | `demo.apj@klinikfarma.com` |
| Apoteker Pendamping | `demo.apotekerpendamping@klinikfarma.com` |
| Admin Farmasi | `demo.adminfarmasi@klinikfarma.com` |
| TTK / Asisten Farmasi | `demo.ttk@klinikfarma.com` |
| Kasir | `demo.kasir@klinikfarma.com` |
| Finance | `demo.finance@klinikfarma.com` |
| Manajer Operasional | `demo.opsmanager@klinikfarma.com` |
| Asisten Dokter | `demo.asistendokter@klinikfarma.com` |
| Pasien | `demo.pasien@klinikfarma.com` |
| Staff | `demo.staff@klinikfarma.com` |

## Skenario UAT lintas-role (localStorage)

Jalankan skenario ini pada **satu browser dan origin yang sama** agar semua role membaca database lokal yang sama. Sesi login disimpan per tab, sehingga beberapa role dapat diuji paralel pada tab berbeda tanpa saling mengganti akun.

1. **Front Office**: buat/daftarkan pasien dan arahkan antrean ke dokter.
2. **Perawat**: buka antrean yang sama, isi intake serta vital sign, lalu kirim ke dokter.
3. **Dokter**: terima pasien, isi rekam medis, tindakan dan resep, lalu finalisasi pemeriksaan.
4. **Farmasi / TTK**: verifikasi resep, catat PIO per obat, siapkan/dispensing, dan cetak etiket bila diperlukan.
5. **Kasir**: buka invoice yang berasal dari Visit yang sama dan selesaikan pembayaran.
6. **Finance**: tinjau faktur pemasok, pembayaran/utang, dan nota kredit retur pemasok.
7. **Owner/APJ**: Owner mengatur Jabatan & Hak Akses serta melakukan override harga jual; APJ menyetujui atau menolak retur pemasok sebelum stok dikurangi.

### UAT Retur Supplier

1. Login **Apoteker/Admin Farmasi**, buka Pembelian → `Retur Supplier`, pilih faktur penerimaan dan batch yang masih tersedia, lalu ajukan retur dengan alasan.
2. Login **APJ**, buka tab yang sama, periksa sumber faktur/batch lalu pilih `Setujui` atau `Tolak` (alasan wajib untuk penolakan).
3. Login **Apoteker/Admin Farmasi**, proses retur yang telah disetujui. Sistem mengurangi batch dan stok obat, menulis `StockMovement`, dan membuat tugas nota kredit untuk Finance.
4. Login **Finance**, pastikan status faktur berubah menjadi `Retur Diproses` dan nota kredit dapat ditindaklanjuti.

### UAT Jabatan & Harga

- Login **Owner** → Jabatan & Hak Akses → pilih role dan pengguna → Simpan. Setelah itu cek bahwa anggota role, `User.clinic_role`, sesi pengguna aktif, dan audit log menunjukkan jabatan yang sama.
- Login **Owner** atau **Admin** → Master Obat → ikon `Kelola harga jual`. Setiap perubahan memakai fungsi harga yang sama, menyimpan histori harga dan alasan override. Role lain hanya dapat melihat harga jual; kolom harga terkunci pada formulir edit.

## Alur utama kunjungan

Satu `Visit/Encounter` mengikat seluruh proses: registrasi dan antrean, intake perawat, penerimaan serta pemeriksaan dokter, resep/order, pelayanan farmasi, pembayaran layanan klinik, pembayaran obat, lalu penutupan kunjungan. Kunjungan baru ditutup setelah seluruh order selesai dan kedua invoice terkait sudah final.

Harga transaksi selalu berasal dari master data. Stok obat keluar menggunakan FEFO, resep dokter yang sudah ditandatangani diperlakukan sebagai dokumen klinis final, dan seluruh perubahan penting dicatat ke audit trail lokal.

## Seed pasien per dokter

Seed lokal menyediakan dua pasien yang terelasi untuk setiap akun dokter interaktif (Dokter Umum, Dokter Anak, Dokter Penyakit Dalam, Dokter Gigi, dan Dokter Locum): satu pasien aktif pada tahap `Siap Dokter` dan satu riwayat kunjungan pada tahap `Kasir`. Relasi menggunakan ID pasien dan Visit yang sama pada seluruh modul. Identitas demo lama dimigrasikan otomatis ke ID dokter seed yang benar saat aplikasi dibuka.

- Front Office: identitas, janji temu, antrean, poli, dan dokter tujuan.
- Perawat: intake, alergi, tanda vital, serta kesiapan ruang/alat.
- Dokter: pasien aktif, riwayat rekam medis, diagnosis, tindakan, dan resep miliknya sendiri.
- Dokter Anak: akun keluarga/wali, growth chart, dan kartu imunisasi.
- Dokter Gigi: odontogram serta rencana perawatan multi-sesi.
- Farmasi: resep internal yang berasal dari masing-masing dokter.
- Kasir: invoice klinik dan farmasi yang berasal dari tindakan/resep, bukan harga manual.
- Owner: metrik operasional yang sudah disanitasi dan audit relasi seed.

Seed di-*merge* berdasarkan ID. Record baru otomatis ditambahkan pada reload tanpa menimpa record dengan ID sama yang sudah disunting pengguna.
