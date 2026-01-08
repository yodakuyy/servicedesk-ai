# Business Hours Component - Documentation

## Overview
Komponen Business Hours telah dibuat dengan fitur lengkap sesuai dengan desain yang diberikan.

## Fitur yang Tersedia

### 1. **List View (Tampilan Daftar)**
- Tabel daftar Business Hours dengan kolom:
  - Name
  - Timezone
  - Used By Groups
  - Status (Active/Inactive)
  - Edit button
- Tombol "Add Business Hours" di header

### 2. **Detail View (Tampilan Detail)**
- Form informasi Business Hours:
  - Business Hours Name
  - Timezone selector
- Weekly Schedule dengan:
  - 7 hari dalam seminggu
  - Time picker untuk start dan end time
  - Toggle switch untuk enable/disable setiap hari
  - Button "+ Break" untuk hari yang memiliki break
  - Label "Closed" untuk hari libur (Saturday/Sunday)
- Summary Card yang menampilkan:
  - Working Days
  - Daily Hours
  - Weekly Hours
  - SLA Calculation info
- Tombol "Back to List", "Cancel", dan "Save Changes"

### 3. **Holiday Calendar**
- Tabel daftar holiday dengan kolom Date dan Name
- Tombol "Add Holiday"
- Modal untuk menambah holiday baru dengan field:
  - Date (date picker)
  - Holiday Name
  - Scope (dropdown)
  - Info note tentang SLA

## Cara Menggunakan

### Opsi 1: Standalone Page
Tambahkan route baru di aplikasi Anda untuk menampilkan Business Hours sebagai halaman terpisah:

```tsx
import BusinessHours from './components/BusinessHours';

// Di dalam routing atau conditional rendering
{currentPage === 'business-hours' && <BusinessHours />}
```

### Opsi 2: Integrasi ke Dashboard
Jika Anda ingin menambahkan Business Hours ke dalam Dashboard yang sudah ada:

```tsx
// Di Dashboard.tsx
import BusinessHours from './BusinessHours';

// Tambahkan menu item untuk Business Hours
// Kemudian render komponen saat menu dipilih
```

### Opsi 3: Tambahkan ke App.tsx
Modifikasi App.tsx untuk menambahkan view baru:

```tsx
const [currentView, setCurrentView] = useState<'login' | 'departments' | 'dashboard' | 'business-hours'>('login');

if (currentView === 'business-hours') {
  return <BusinessHours />;
}
```

## Struktur File
```
components/
├── BusinessHours.tsx      # Komponen utama
└── BusinessHours.css      # Styling
```

## Dependencies
Komponen ini menggunakan:
- React (useState)
- lucide-react (untuk icons: ArrowLeft, Plus, Edit2, Calendar, X)

Pastikan lucide-react sudah terinstall:
```bash
npm install lucide-react
```

## Customization

### Menghubungkan dengan Database
Saat ini komponen menggunakan sample data. Untuk menghubungkan dengan Supabase:

1. **Fetch Business Hours dari database:**
```tsx
useEffect(() => {
  const fetchBusinessHours = async () => {
    const { data, error } = await supabase
      .from('business_hours')
      .select('*');
    
    if (data) setBusinessHours(data);
  };
  
  fetchBusinessHours();
}, []);
```

2. **Save changes ke database:**
```tsx
const handleSaveChanges = async () => {
  const { error } = await supabase
    .from('business_hours')
    .update({
      name: selectedBusinessHour.name,
      timezone: selectedBusinessHour.timezone,
      weekly_schedule: weeklySchedule
    })
    .eq('id', selectedBusinessHour.id);
    
  if (!error) {
    // Show success message
  }
};
```

3. **Add holiday ke database:**
```tsx
const handleAddHoliday = async () => {
  const { error } = await supabase
    .from('holidays')
    .insert([newHoliday]);
    
  if (!error) {
    // Refresh holiday list
  }
};
```

## Styling
Komponen menggunakan CSS custom dengan color scheme yang modern:
- Primary Blue: #0066cc
- Success Green: #22c55e
- Warning Orange: #f97316
- Neutral Gray: #6b7280

Anda dapat menyesuaikan warna di file `BusinessHours.css` sesuai dengan brand colors aplikasi Anda.

## Responsive Design
Komponen sudah responsive dengan breakpoints:
- Mobile: Single column layout
- Tablet (768px+): Optimized layout
- Desktop (1024px+): Two-column layout untuk detail view

## Next Steps
1. Install dependencies jika belum: `npm install lucide-react`
2. Integrasikan komponen ke routing/navigation aplikasi
3. Hubungkan dengan Supabase database
4. Sesuaikan styling jika diperlukan
5. Tambahkan validasi form
6. Implementasi error handling
