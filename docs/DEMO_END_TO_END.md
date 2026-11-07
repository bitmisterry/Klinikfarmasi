# Demo End-to-End Klinik

Dokumen ini memetakan implementasi demo terhadap alur operasional aplikasi. Semua data demo bersifat fiktif dan disimpan di `localStorage`.

## Golden path dan sumber data

| Tahap | Role | Pemicu aplikasi | Data yang dibuat/diperbarui | Hasil / penerima berikutnya |
| --- | --- | --- | --- | --- |
| Registrasi | Front Office | `registerVisit` | `QueueEntry`, `Visit` | `WAITING`, diteruskan ke Front Office untuk pemanggilan |
| Kedatangan | Front Office | `callVisit`, `confirmVisitArrival` | `Visit`, `QueueEntry`, audit | `CALLED` / `Menunggu Intake`, diteruskan ke Perawat |
| Intake | Perawat | `saveIntake` | versi baru `ClinicalRecord`, alergi pasien, vital pada antrean | `INTAKE_DONE` / `Siap Dokter`, diteruskan ke Dokter |
| Pemeriksaan | Dokter tujuan | `acceptVisit`, `completeExam` | `MedicalRecord`, `Order`, `Prescription`, invoice klinik | `IN_SERVICE` lalu `COMPLETED`; resep ke Farmasi atau tagihan ke Kasir |
| Dispensing | Farmasi | verifikasi resep dan FEFO di POS | status `Prescription` / `Order`, `StockMovement`, invoice farmasi | `DISPENSED`; invoice dikirim ke Kasir |
| Pembayaran | Kasir | pembayaran invoice Posted | `Payment`, status `Transaction`, kuitansi | seluruh invoice menjadi `PAID` |
| Penutupan | Sistem | `refreshEncounterClosure` | `Visit`, `QueueEntry`, audit | `READY_TO_CLOSE` lalu `CLOSED` hanya jika prasyarat terpenuhi |

`patient_id`, `visit_id` / `encounter_id`, dan `queue_entry_id` dibawa ke catatan klinis, order, resep, tagihan, pembayaran, serta audit. Kartu alur pada layar kerja menunjukkan ID dan handoff yang sama kepada setiap role.

## State transition yang berlaku

### Visit

`WAITING → CALLED → INTAKE_DONE → IN_SERVICE → COMPLETED → READY_TO_CLOSE → CLOSED`

Status tampilan antrean dipetakan tanpa menambah status baru: `Menunggu`, `Dipanggil`, `Menunggu Intake`, `Siap Dokter`, `Pemeriksaan`, `Di Apotek`, `Kasir`, dan `Selesai`. Transisi divalidasi oleh fungsi lokal; pembaruan status biasa dari layar tidak digunakan untuk golden path.

### Resep dan tagihan

- Resep: `SENT_TO_PHARMACY → PROCESSING → DISPENSED`; resep tidak tersedia secara eksplisit dikembalikan ke Dokter.
- Invoice: `POSTED → PAID` (atau `VOIDED` melalui proses koreksi beralasan).
- Status resep, invoice, dan visit disimpan terpisah. Visit tidak tertutup hanya karena resep selesai atau hanya karena satu invoice sudah lunas.

## Batas kewenangan utama

- Front Office mengelola identitas, janji temu, dan registrasi; tidak membuka RME atau harga.
- Perawat hanya menambah intake dan verifikasi alergi; tidak dapat membuat diagnosis, resep, atau mengubah catatan Dokter.
- Dokter hanya menangani pasien yang ditugaskan atau dirujuk secara tercatat.
- Farmasi dapat mengubah status proses resep, bukan isi klinis resep Dokter; informasi RME dibatasi pada data resep relevan.
- Kasir hanya melunasi invoice yang dibentuk otomatis; tidak dapat membuat charge atau mengubah harga manual.
- Owner hanya memantau dan mengajukan permintaan perubahan ke Admin. Admin memutuskan permintaan tersebut dengan audit trail.

## Aturan anti-duplikasi dan audit

- `registerVisit` mengembalikan encounter yang sudah aktif untuk pasien, tanggal, poli, dan Dokter yang sama.
- `completeExam` menolak penyelesaian ulang setelah Visit tidak lagi `IN_SERVICE`; catatan, resep, dan invoice tidak dibuat ganda.
- Setiap perubahan penting, penolakan akses, dan transisi menyimpan aktor, timestamp, alasan bila ada, serta ID entitas terkait dalam `AuditLog`.

## Skenario P0 yang dijalankan otomatis

Jalankan `npm run verify:roles`. Skrip memverifikasi registrasi sampai antrean Dokter, intake, RME/resep/order, dispensing, tagihan/pembayaran/penutupan, penyekatan role, audit penolakan akses, serta relasi pasien seed lintas-role.

Sebelum demo, gunakan satu pasien fiktif baru dan catat `Patient ID`, `Visit ID`, serta `Queue ID` yang muncul pada kartu alur. Jangan mengubah penyimpanan browser secara manual; gunakan tombol dan proses aplikasi agar bukti audit tetap utuh.
