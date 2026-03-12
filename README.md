# Sistem Management Trucking (Web)

Aplikasi web sederhana untuk mengelola:
- Job Order trucking
- Pengajuan dan approval uang jalan
- Pencairan uang jalan
- LPJ driver (maks 1x24 jam)
- Verifikasi finance, pengembalian sisa, reimbursement
- Laporan bulanan dan bonus efisiensi
- Print form resmi siap tanda tangan

Catatan versi saat ini:
- Login menggunakan Cloud Supabase (multi-user).
- Data sinkron antar perangkat berdasarkan `Team Code` yang sama.

## Cara Menjalankan
1. Buka file `index.html` di browser (Chrome/Edge/Firefox).
2. Data tersimpan otomatis di `localStorage` browser.
3. Login cloud:
- Daftarkan akun user dari tombol `Daftar`.
- Login, isi `Team Code`, lalu `Join Tim`.

## Akses dari Rumah/Kantor (Cloud)
Gunakan arsitektur cepat: `Supabase + Vercel + Domain`.

1. Setup Supabase
- Buat project baru di Supabase.
- Buka SQL Editor, jalankan file `supabase/schema.sql`.
- Aktifkan login Email/Password di `Authentication > Providers`.
- Jika sebelumnya sudah pernah menjalankan SQL lama, jalankan ulang `supabase/schema.sql` agar policy multi-user join tim ikut ter-update.

2. Isi konfigurasi aplikasi
- Edit file `config.js`:
  - `SUPABASE_URL` = URL project Supabase
  - `SUPABASE_ANON_KEY` = anon key Supabase
  - `CLOUD_MODE` = `true`
  - `SHARED_TEAM_MODE` = `true` (agar data shared per tim)

3. Deploy ke Vercel
- Upload project ini ke GitHub.
- Import repository ke Vercel.
- Deploy (tanpa build command, karena static app).

4. Pasang domain custom
- Di Vercel: `Project Settings > Domains`.
- Tambah domain perusahaan Anda (contoh: `trucking.namaperusahaan.com`).
- Arahkan DNS sesuai instruksi Vercel.

5. Pakai lintas perangkat/jaringan
- Buka URL domain di rumah/kantor dari HP/laptop.
- Login cloud di header aplikasi.
- Isi `Team Code`, pilih role, klik `Join Tim`.
- Data otomatis sinkron **per tim** (shared antar akun dalam tim yang sama).
- Jika `Team Code` belum ada, sistem membuat tim baru dan akun pertama otomatis menjadi `Admin`.

## Role Multi-User Tim
- `Admin`:
  - akses penuh semua modul.
  - akses menu `Admin Tim` untuk lihat daftar anggota dan ubah role Operasional/Finance/Admin.
- `Operasional`:
  - buat JO, pengajuan uang jalan, approval operasional, input LPJ, kelola master rute.
- `Finance`:
  - approval finance, pencairan uang jalan, verifikasi LPJ, settlement.

## Mode Staging (Uji Coba)
- Buat 2 project Supabase:
  - `trucking-staging` untuk testing.
  - `trucking-production` untuk operasional nyata.
- Buat 2 project Vercel:
  - subdomain uji coba: `staging-...vercel.app`
  - domain produksi: domain utama perusahaan.
- Ubah `config.js` sesuai environment masing-masing.

## Modul Utama
1. `Dashboard`:
- KPI job, LPJ overdue, total uang jalan, pengembalian, reimbursement.
- Antrian tindakan approval dan LPJ pending.

2. `Job Order`:
- Input lengkap nomor job, customer, container, rute, driver, truck, estimasi biaya.
- Dukungan isi otomatis dari `Master Rute`.

3. `Pengajuan Uang Jalan`:
- Approval berjenjang: Staff Operasional -> Manager Operasional -> Finance.
- Kontrol internal: driver diblokir jika masih punya job tanpa LPJ.

4. `Pencairan`:
- Pencairan cash/transfer/e-wallet.
- Otomatis masuk register uang jalan.

5. `LPJ Driver`:
- Input realisasi biaya, tanggal kembali, tanggal submit.
- Validasi keterlambatan LPJ (>24 jam).
- Konfirmasi bukti asli wajib.

6. `Verifikasi & Settlement`:
- Verifikasi LPJ oleh finance.
- Hitung selisih otomatis:
  - Positif -> Pengembalian sisa
  - Negatif -> Reimbursement
  - Nol -> Nihil
- Bonus efisiensi otomatis 20% jika sisa > Rp100.000.

7. `Laporan Bulanan`:
- Rekap per truck/driver:
  - total job
  - total biaya
  - solar per km
  - biaya per km
  - efisiensi
  - bonus
- Export CSV.
- Export Excel (`.xls`).

8. `Print Form`:
- Cetak `Job Order (JO)`.
- Cetak `Form Pengajuan Uang Jalan`.
- Cetak `LPJ Uang Jalan`.
- Cetak `Bukti Penerimaan Kas` (pengembalian sisa uang jalan).
- Tersedia preview dokumen sebelum print.

## Catatan
- Secara default aplikasi berjalan frontend-only (data lokal browser).
- Jika `CLOUD_MODE=true`, data disimpan ke Supabase dan bisa diakses lintas perangkat.
- Jika `SHARED_TEAM_MODE=true`, data disimpan di `team_state` dan dibagi per tim.
- Jalankan ulang `supabase/schema.sql` setiap kali ada update policy RLS (termasuk policy admin ubah role anggota tim).
- Implementasi saat ini membaca 1 membership tim aktif per user (tim pertama yang ditemukan).
- Fitur print terbaru menggunakan `window.print()` langsung dari halaman (tanpa popup window).
- Sinkronisasi cloud saat ini memakai strategi `last write wins` (versi paling akhir akan menggantikan data sebelumnya).
