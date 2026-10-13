# windows-failed-login-investigation

SOC lab: Windows Security Event Log investigation. Peserta membaca 24 event dari
host `WS-ACCT-01`, mengenali pola kegagalan logon, lalu menentukan tindakan
triage berdasarkan bukti.

Lab ini hanya menyediakan **log viewer**. Task, jawaban, dan scoring ada di
platform [hack.redlimit.id](https://hack.redlimit.id), bukan di dalam lab.
Karena itu repo ini tidak memuat kunci jawaban sama sekali.

Dataset-nya simulasi untuk latihan. Tidak ada host Windows sungguhan, tidak ada
brute force sungguhan, dan tidak ada data nyata siapa pun.

## Jalankan lokal

```bash
docker compose up -d --build
# buka http://127.0.0.1:8080
docker compose down
```

Atau tanpa compose:

```bash
docker build -t windows-failed-login .
docker run --rm -p 8080:8080 windows-failed-login
```

## Deploy

Satu `Dockerfile` di root, satu port. Cocok untuk PaaS yang build dari GitHub
(ngelinx dan sejenisnya), tanpa konfigurasi tambahan.

| Var | Default | Fungsi |
|---|---|---|
| `PORT` | `8080` | port publik, dihormati entrypoint |
| `TASKS_ENABLED` | `false` | biarkan false: task dikerjakan di platform |
| `APP_ENV` | `development` | |

Dengan `TASKS_ENABLED=false` endpoint task dan session menjawab 404, dan
validator tidak pernah dimuat. Itu sebabnya lab ini jalan tanpa kunci jawaban.

## Isi repo

```
app/        aplikasi FastAPI + UI dashboard
config/     challenge.yaml, tasks.yaml, dashboard.yaml
dataset/    windows_security_events.json (yang dilihat peserta)
docs/       api-contract, deployment, security, troubleshooting
```

Kunci jawaban, reference solver, dan test yang memuat jawaban sengaja TIDAK ada
di repo publik ini. Semuanya disimpan di repo internal RedLimit.

## Dashboard

UI-nya memakai RedLimit SOC dashboard template: log viewer dengan search, filter
per kolom, sorting, dan penanda untuk event yang perlu diburu analis. Warnanya
diambil dari logo RedLimit. Detail keputusan desainnya ada di repo internal.

## API

```
GET /api/events   dataset yang dilihat peserta
GET /api/meta     metadata challenge
GET /health       liveness
GET /readyz       readiness
```

Lihat `docs/api-contract.md`.
