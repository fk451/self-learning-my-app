# 📚 Reverso SR — Yoğunlaştırılmış Spaced Repetition Kelime Öğrenme PWA

Reverso Dictionary verilerini kullanarak **SM-2 tabanlı yoğunlaştırılmış spaced repetition** yöntemiyle kelime öğrenmenizi sağlayan Progressive Web App.

## ✨ Özellikler

- **PWA Desteği** — Mobilde tarayıcıdan "Ana Ekrana Ekle" ile uygulama gibi çalışır
- **Spaced Repetition (SM-2)** — Yoğunlaştırılmış parametrelerle akıllı tekrar zamanlaması
- **Kart Çevirme Animasyonu** — Flip card ile interaktif çalışma
- **POS Gruplamalı Anlamlar** — Noun, Verb, Adjective vb. ayrı gruplar
- **6 Mastery Seviyesi** — New → Learning → Reviewing → Mastered + Leech & Relearn
- **Leech Tespiti** — Sorunlu kelimelere özel drill modu
- **İstatistik Dashboard** — Günlük seri, doğruluk oranı, haftalık grafik, POS dağılımı
- **Bildirim Sistemi** — Çalışma zamanı hatırlatıcı (Push + Local)
- **Dark/Light Tema** — Sistem temasına otomatik uyum
- **Etiket Sistemi** — Kelimeleri kategorize etme
- **Offline Desteği** — Service Worker ile çevrimdışı çalışma
- **Responsive Tasarım** — Mobil-first, tablet ve masaüstü uyumlu
- **Veri Dışa Aktarım** — JSON formatında yedekleme

## 🛠️ Kurulum

### Gereksinimler
- Node.js 18+
- MySQL 8.0+

### 1. Projeyi klonlayın
```bash
git clone <repo-url>
cd reverso-sr
```

### 2. Bağımlılıkları yükleyin
```bash
npm install
```

### 3. Veritabanını oluşturun
```bash
mysql -u root -p < server/schema.sql
```

### 4. Ortam değişkenlerini ayarlayın
```bash
cp .env.example .env
# .env dosyasını düzenleyin — DB bilgileri ve JWT_SECRET
```

### 5. Başlatın
```bash
# Geliştirme
npm run dev

# Prodüksiyon
npm start
```

Uygulama `http://localhost:3000` adresinde çalışacaktır.

## 📱 PWA Olarak Yükleme

1. Mobil tarayıcıda `http://your-domain.com` adresine gidin
2. **Chrome**: Menü → "Ana ekrana ekle"
3. **Safari (iOS)**: Paylaş → "Ana Ekrana Ekle"

## 📁 Proje Yapısı

```
reverso-sr/
├── server/
│   ├── index.js              # Express sunucu
│   ├── db.js                 # MySQL bağlantı pool
│   ├── middleware/auth.js     # JWT doğrulama
│   ├── services/sm2.js        # SM-2 algoritması
│   ├── routes/
│   │   ├── auth.js            # Kimlik doğrulama
│   │   ├── words.js           # Kelime CRUD
│   │   ├── review.js          # SR review
│   │   ├── sessions.js        # Çalışma oturumları
│   │   ├── stats.js           # İstatistikler
│   │   ├── tags.js            # Etiketler
│   │   ├── notifications.js   # Bildirimler
│   │   └── settings.js        # Ayarlar
│   └── schema.sql
├── public/
│   ├── index.html             # SPA
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker
│   ├── css/app.css            # Tüm stiller
│   ├── js/
│   │   ├── app.js             # Başlatıcı
│   │   ├── api.js             # API iletişim
│   │   ├── router.js          # Hash router
│   │   ├── store.js           # State yönetimi
│   │   ├── notifications.js   # Bildirim yönetimi
│   │   ├── components/        # UI bileşenleri
│   │   └── pages/             # Sayfa modülleri
│   └── icons/
├── package.json
├── .env.example
└── README.md
```

## 🧠 SM-2 Algoritma Parametreleri (Varsayılan)

| Parametre | Değer | Açıklama |
|-----------|-------|----------|
| Öğrenme Adımları | 1, 10, 30, 1440, 4320 dk | 1dk → 10dk → 30dk → 1gün → 3gün |
| Relearn Adımları | 1, 10, 1440 dk | 1dk → 10dk → 1gün |
| Başlangıç Ease | 2.30 | Standart 2.50'den düşük |
| Minimum Ease | 1.50 | Alt limit |
| Aralık Çarpanı | 0.85 | Tüm aralıklar %15 kısa |
| Maks Aralık | 180 gün | 6 ay |
| Lapse Cezası | ×0.25 | Yanlışta interval çarpanı |
| Leech Eşiği | 5 | Bu kadar lapse → sorunlu |

## 🔗 API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | /api/auth/register | Kayıt |
| POST | /api/auth/login | Giriş |
| GET | /api/auth/me | Profil |
| GET | /api/words | Kelime listesi (filtreli) |
| GET | /api/words/:id | Kelime detay |
| POST | /api/words | Kelime ekle |
| DELETE | /api/words/:id | Kelime sil |
| GET | /api/review/due | Bugün çalışılacaklar |
| POST | /api/review/submit | Review gönder |
| POST | /api/sessions/start | Oturum başlat |
| PUT | /api/sessions/:id/complete | Oturum bitir |
| GET | /api/stats/dashboard | Dashboard verileri |
| GET | /api/stats/pos-distribution | POS dağılımı |
| GET | /api/stats/leeches | Sorunlu kelimeler |
| GET/POST | /api/tags | Etiket CRUD |
| GET/PUT | /api/settings | Ayarlar |
| GET/POST | /api/notifications/schedules | Bildirim zamanlaması |

## 📄 Lisans

MIT