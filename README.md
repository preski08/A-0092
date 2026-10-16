# Mizu Chain API

**API-only** blockchain server.  
Siap dipanggil dari aplikasi Android (APK), iOS, atau web client.

---

## Fitur

- REST API lengkap (login, saldo, transaksi, mine, history, chain)
- WebSocket real-time (`/ws`)
- Simple auth (token)
- Consensus: Proof-of-Work
- Distributed ledger

---

## Install & Jalankan

```bash
npm install
npm start
```

Server berjalan di:
- REST → `http://localhost:3000`
- WebSocket → `ws://localhost:3000/ws`

---

## API Endpoints

### 1. Login / Register
```http
POST /api/login
Content-Type: application/json

{
  "username": "Alice",
  "password": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "token": "uuid-token-here",
  "address": "Alice",
  "balance": 0
}
```

> Simpan `token` untuk request selanjutnya (Authorization header).

---

### 2. Cek Saldo
```http
GET /api/balance/Alice
```

---

### 3. Riwayat Transaksi
```http
GET /api/history/Alice
```

---

### 4. Kirim Transaksi (perlu login)
```http
POST /api/tx
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "Bob",
  "amount": 10
}
```

---

### 5. Mining (perlu login)
```http
POST /api/mine
Authorization: Bearer <token>
```

Dapat reward 50 MIZU per block.

---

### 6. Full Chain
```http
GET /api/chain
```

---

### 7. Status Jaringan
```http
GET /api/status
```

---

## Contoh pakai dari APK (Android)

```kotlin
// Login
val body = JSONObject()
body.put("username", "Alice")
body.put("password", "123456")

// Setelah dapat token:
val headers = Headers.Builder()
  .add("Authorization", "Bearer $token")
  .build()

// Kirim transaksi
val txBody = JSONObject()
txBody.put("to", "Bob")
txBody.put("amount", 15)
```

Atau pakai Retrofit / Volley / OkHttp.

---

## WebSocket Events

Connect ke `ws://HOST:3000/ws`

Server akan kirim:
- `new_tx` → ada transaksi baru
- `new_block` → ada block baru di-mine

Client bisa kirim:
```json
{ "type": "auth", "token": "your-token" }
```

---

## Deploy

Bisa di-deploy ke:
- Railway
- Render
- VPS (DigitalOcean, Contabo, dll)
- Glitch / Replit

Set environment variable `PORT` jika perlu.

---

## Catatan

- Auth sangat sederhana (demo only)
- Untuk production tambahkan JWT + database + rate limit
- Difficulty = 2 (cepat untuk testing)
