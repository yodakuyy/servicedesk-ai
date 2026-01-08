# Panduan Pengaturan Urutan Menu per Role

## Ringkasan
Fitur ini memungkinkan setiap role (Agent L1, L2, L3, dll) untuk memiliki urutan menu yang berbeda sesuai kebutuhan masing-masing.

## Implementasi

### 1. Struktur Database
Kolom `sort_order` ditambahkan ke tabel `role_menu_permissions`:
- Tipe: `INTEGER`
- Default: `0`
- Nilai lebih kecil akan muncul di posisi atas

### 2. Perubahan Kode

#### LoginSection.tsx
- Mengambil kolom `sort_order` dari tabel `role_menu_permissions`
- Menyimpan `sort_order` dalam `accessibleMenus` di localStorage

#### Dashboard.tsx
- Mengurutkan `accessibleMenus` berdasarkan `sort_order` sebelum render
- Menu dengan `sort_order` lebih kecil akan muncul di atas

## Cara Menggunakan

### Langkah 1: Jalankan SQL untuk menambahkan kolom
```bash
# Jalankan script ini di Supabase SQL Editor
add_sort_order_to_role_menu_permissions.sql
```

### Langkah 2: Atur urutan menu untuk role tertentu

#### Contoh: Mengatur urutan menu Agent L2

1. **Identifikasi role_id dan menu_id**:
```sql
-- Cari role_id untuk Agent L2
SELECT id, role_name FROM roles WHERE role_name ILIKE '%L2%';

-- Cari menu_id untuk menu yang ingin diurutkan
SELECT id, name, label FROM menus 
WHERE name IN ('Escalated Tickets', 'My Tickets', 'Knowledge Base');
```

2. **Update sort_order**:
```sql
-- Escalated Tickets di posisi 1 (paling atas)
UPDATE role_menu_permissions
SET sort_order = 1
WHERE role_id = <AGENT_L2_ROLE_ID>
AND menu_id = <ESCALATED_TICKETS_MENU_ID>;

-- My Tickets di posisi 2
UPDATE role_menu_permissions
SET sort_order = 2
WHERE role_id = <AGENT_L2_ROLE_ID>
AND menu_id = <MY_TICKETS_MENU_ID>;

-- Knowledge Base di posisi 3
UPDATE role_menu_permissions
SET sort_order = 3
WHERE role_id = <AGENT_L2_ROLE_ID>
AND menu_id = <KNOWLEDGE_BASE_MENU_ID>;
```

3. **Verifikasi urutan**:
```sql
SELECT 
    r.role_name,
    m.name as menu_name,
    rmp.sort_order
FROM role_menu_permissions rmp
JOIN roles r ON rmp.role_id = r.id
JOIN menus m ON rmp.menu_id = m.id
WHERE r.role_name ILIKE '%L2%'
ORDER BY rmp.sort_order ASC;
```

### Langkah 3: Logout dan Login kembali
Setelah mengubah urutan menu di database, user harus logout dan login kembali agar perubahan terlihat.

## Contoh Konfigurasi

### Agent L2
```
1. Escalated Tickets (sort_order = 1)
2. My Tickets (sort_order = 2)
3. Knowledge Base (sort_order = 3)
```

### Agent L1
```
1. My Tickets (sort_order = 1)
2. Knowledge Base (sort_order = 2)
3. Escalated Tickets (sort_order = 3)
```

### Admin
```
1. Dashboard (sort_order = 1)
2. All Incidents (sort_order = 2)
3. User Management (sort_order = 3)
4. Group Management (sort_order = 4)
```

## Tips

1. **Gunakan angka berurutan**: 1, 2, 3, 4, ... untuk memudahkan pengelolaan
2. **Sisipkan menu**: Gunakan angka desimal jika ingin menyisipkan menu di tengah (misal: 1.5)
3. **Default order**: Menu dengan `sort_order = 0` akan mengikuti urutan default dari database
4. **Reset order**: Set `sort_order = 0` untuk mengembalikan ke urutan default

## Troubleshooting

### Menu tidak berubah urutannya?
1. Pastikan sudah logout dan login kembali
2. Cek apakah `sort_order` sudah diupdate di database
3. Buka browser console dan cek `localStorage.getItem('accessibleMenus')`

### Error saat menjalankan SQL?
1. Pastikan sudah menjalankan script `add_sort_order_to_role_menu_permissions.sql` terlebih dahulu
2. Cek apakah tabel `role_menu_permissions` dan `menus` sudah ada
3. Verifikasi role_id dan menu_id yang digunakan benar

## File yang Dimodifikasi
- `components/LoginSection.tsx` - Mengambil dan menyimpan sort_order
- `components/Dashboard.tsx` - Mengurutkan menu berdasarkan sort_order

## File SQL Baru
- `add_sort_order_to_role_menu_permissions.sql` - Menambahkan kolom sort_order
- `set_agent_l2_menu_order.sql` - Contoh script untuk mengatur urutan menu Agent L2
