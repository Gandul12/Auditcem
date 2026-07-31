# Audit Crucible Tracker

Full-stack tracker progres audit untuk sertifikasi CEM Fase 1 Bulan 4–6, siklus **The Audit Crucible**. Aplikasi memakai Next.js App Router, API routes, PostgreSQL/Neon, Drizzle ORM, Neon HTTP driver, dan cookie session admin.

## Fitur utama

- Login single-user via `ADMIN_PASSWORD` dan cookie httpOnly.
- Driver production menggunakan `@neondatabase/serverless` + `drizzle-orm/neon-http` agar aman untuk Vercel serverless. Local sandbox memakai fallback Postgres biasa hanya saat `DATABASE_URL` mengarah ke localhost.
- Dashboard dark theme premium untuk 5 domain: MQAA, HSE, PS, LEAN & 6S, dan Visual Management.
- Dimensi area penuh: Cutting, Prep, dan CSC di checklist, siklus, findings, dan weekly planner.
- Checklist kesiapan per area/domain tersimpan di PostgreSQL.
- Siklus bulanan resmi berulang: Agu, Sep, Okt × 5 domain × 3 area.
- Weekly Execution Planner Week 1 & Week 2 dengan chevron Senin–Jumat, `activity_type` AUDIT/REVIEW/REPORT, dan `domain` nullable untuk aktivitas non-domain.
- Audit Findings Log dengan field terstruktur: Root Cause, Action Plan, dan Lesson Learned.
- Filter/search berdasarkan area, domain, hasil, dan isi temuan.
- Generate ringkasan otomatis siap-copy untuk mentor dengan breakdown per area dan siklus bulanan.

## Environment variables

Buat `.env` untuk local development atau set di Vercel Project Settings:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
ADMIN_PASSWORD="password-admin-yang-kuat"
```

Untuk Neon, gunakan connection string dari dashboard Neon. Pastikan `sslmode=require` untuk deployment production.

## Database

Source of truth skema ada di `src/db/schema.ts`. Referensi SQL juga tersedia di `schema.sql`.

Commands:

```bash
npm run db:push
npm run db:seed
```

`db:push` membuat/memperbarui tabel di Postgres/Neon. `db:seed` mengisi:

- 111 checklist items: 37 checklist × 3 area.
- 45 monthly cycle rows: Agu/Sep/Okt × 5 domain × 3 area.
- 30 planner rows: 2 minggu × 5 hari × 3 area dengan jadwal eksplisit:
  - Week 1: Senin MQAA, Selasa Review, Rabu 6S & VM, Kamis Review, Jumat MQAA/6S/VM.
  - Week 2: Senin MQAA/6S/VM, Selasa HSE/PS, Rabu MQAA/6S/VM, Kamis HSE/PS, Jumat Audit Report.

## Development

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Buka `http://localhost:3000`, login menggunakan `ADMIN_PASSWORD`.

## Deploy ke Vercel + Neon

1. Buat database Neon dan salin connection string.
2. Deploy repository ke Vercel.
3. Set environment variables di Vercel:
   - `DATABASE_URL`
   - `ADMIN_PASSWORD`
4. Jalankan `npm run db:push` terhadap Neon dari local/CI.
5. Jalankan `npm run db:seed` satu kali untuk seed data awal.

Aplikasi tidak memakai `localStorage` atau `sessionStorage`; semua checklist, monthly cycle, active month, weekly planner, dan findings tersimpan di database.
