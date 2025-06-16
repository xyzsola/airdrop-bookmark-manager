chrome.action.onClicked.addListener(async (tab) => {
  // Selalu buka popup.html saat ikon diklik untuk menyimpan bookmark baru
  // default_popup sudah diatur di manifest.json, jadi tidak perlu kode open() di sini.
  // Jika Anda ingin mengendalikan pembukaan popup, Anda bisa menggunakan chrome.windows.create
  // dengan tipe 'popup', tapi default_popup lebih sederhana.

  // Jika Anda ingin side panel dibuka secara otomatis juga saat popup dibuka,
  // Anda bisa tambahkan ini (tetapi biasanya tidak diperlukan, karena side panel bisa dibuka dari menu Chrome)
  // await chrome.sidePanel.open({ tabId: tab.id });
});

// Alarm dan notifikasi pengingat
// ... (Sertakan semua kode alarm dan notifikasi dari background.js Anda sebelumnya di sini) ...

// Variabel untuk menyimpan interval pengingat
let reminderInterval;

// Fungsi untuk menampilkan notifikasi
const showReminderNotification = async () => {
    console.log('showReminderNotification dipanggil pada:', new Date().toLocaleTimeString()); // Debugging
    const result = await chrome.storage.local.get(['bookmarks', 'lastReminderId', 'resetTime']);
    let bookmarks = result.bookmarks || [];
    let lastReminderId = result.lastReminderId || null;
    const resetTime = result.resetTime || null;

    // Periksa apakah perlu direset
    if (resetTime) {
        const now = new Date();
        const resetDate = new Date(resetTime);
        if (now >= resetDate) {
            // Waktunya reset!
            lastReminderId = null; // Atur ulang lastReminderId
            await chrome.storage.local.set({ lastReminderId: null, resetTime: null }); // Simpan status yang direset
        }
    }

    // Filter bookmark yang belum "selesai" (misalnya, belum dicentang)
    // Penting: hanya ingatkan bookmark yang belum selesai
    bookmarks = bookmarks.filter(b => !b.completed);
    console.log('Jumlah bookmark yang belum selesai:', bookmarks.length);

    // Urutkan berdasarkan prioritas (High > Medium > Low)
    bookmarks.sort((a, b) => {
        const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    if (bookmarks.length === 0) {
        // Tidak ada bookmark yang perlu diingatkan
        // Opsional: Hentikan interval pengingat jika tidak ada bookmark yang tersisa
        chrome.alarms.clear('30minReminder');
        // stopReminder();
        return;
    }

    // Cari bookmark berikutnya yang akan ditampilkan
    let nextBookmark;
    if (lastReminderId) {
        const lastIndex = bookmarks.findIndex(b => b.id === lastReminderId);
        // Jika bookmark terakhir yang diingatkan tidak ditemukan (mungkin sudah dihapus/diselesaikan),
        // atau jika sudah di akhir daftar, mulai dari awal
        if (lastIndex === -1 || lastIndex === bookmarks.length - 1) {
            nextBookmark = bookmarks[0];
        } else {
            nextBookmark = bookmarks[lastIndex + 1];
        }
    } else {
        nextBookmark = bookmarks[0]; // Tampilkan bookmark pertama jika belum ada pengingat
    }

    // Pastikan nextBookmark valid sebelum membuat notifikasi
    if (!nextBookmark) {
        console.log("No next bookmark found for notification.");
        return;
    }

    // Buat notifikasi
    console.log('Menampilkan notifikasi untuk:', nextBookmark.title);
    chrome.notifications.create({
        type: 'basic',
        iconUrl: nextBookmark.faviconUrl || getFaviconUrl(nextBookmark.url),
        title: "Airdrop Reminder - " + nextBookmark.title,
        message: "Tak garap maka tak JP!",
        buttons: [{ title: 'Mark as Done' }],
        requireInteraction: true,
        priority: 2,
        eventTime: Date.now()
    }, (notificationId) => {
        // Simpan ID bookmark yang ditampilkan
        chrome.storage.local.set({ lastReminderId: nextBookmark.id });
    });
};

// Event listener untuk klik notifikasi
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (buttonIndex === 0) { // Tombol "Mark as Done" diklik
        const result = await chrome.storage.local.get('bookmarks');
        let bookmarks = result.bookmarks || [];
        const lastReminderIdObj = await chrome.storage.local.get('lastReminderId');
        const currentReminderId = lastReminderIdObj.lastReminderId;

        // Cari bookmark yang sesuai
        const bookmarkIndex = bookmarks.findIndex(b => b.id === currentReminderId);
        if (bookmarkIndex !== -1) {
            // Tandai sebagai selesai
            bookmarks[bookmarkIndex].completed = true;
            await chrome.storage.local.set({ bookmarks: bookmarks });

            // Coba tampilkan notifikasi berikutnya (akan mengambil bookmark berikutnya yang belum selesai)
            showReminderNotification();
        }
    }
});

// Fungsi untuk menjadwalkan alarm harian
const scheduleDailyReset = () => {
    const now = new Date();
    const resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0, 0);

    if (now > resetTime) {
        resetTime.setDate(resetTime.getDate() + 1); // Jadwalkan untuk besok jika sudah lewat jam 7 pagi hari ini
    }

    const timeUntilReset = resetTime.getTime() - now.getTime();
    console.log(`Menjadwalkan alarm reset harian pada ${resetTime.toLocaleTimeString()} (${timeUntilReset / 1000} detik lagi)`); // Debugging

    chrome.alarms.create('dailyReset', {
        when: Date.now() + timeUntilReset,
        periodInMinutes: 24 * 60 // Ulangi setiap 24 jam
    });
};

// Fungsi untuk menjadwalkan alarm Pengingat (setiap 30 menit)
const schedule30MinReminder = () => {
    console.log('Menjadwalkan alarm pengingat setiap 30 menit.'); // Debugging
    chrome.alarms.create('30minReminder', {
        delayInMinutes: 0.1, // Dimulai segera, atau set ke 30 untuk penundaan awal
        periodInMinutes: 30 // Ulangi setiap 30 menit
    });
};

chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('Alarm dipicu:', alarm.name, 'pada:', new Date().toLocaleTimeString()); // Debugging
    if (alarm.name === 'dailyReset') {
        await chrome.storage.local.set({ lastReminderId: null, resetTime: null }); // Reset status
        showReminderNotification(); // Tampilkan notifikasi awal setelah reset
        scheduleDailyReset(); // Jadwalkan ulang alarm reset untuk hari berikutnya
    } else if (alarm.name === '30minReminder') {
        showReminderNotification(); // Tampilkan notifikasi pengingat
    }
});

// Event listener untuk klik tombol notifikasi
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (buttonIndex === 0) { // Tombol "Mark as Done" diklik
        const result = await chrome.storage.local.get('bookmarks');
        let bookmarks = result.bookmarks || [];
        const lastReminderIdObj = await chrome.storage.local.get('lastReminderId');
        const currentReminderId = lastReminderIdObj.lastReminderId;

        const bookmarkIndex = bookmarks.findIndex(b => b.id === currentReminderId);
        if (bookmarkIndex !== -1) {
            bookmarks[bookmarkIndex].completed = true; // Tandai selesai
            await chrome.storage.local.set({ bookmarks: bookmarks });
            console.log('Bookmark ditandai selesai:', bookmarks[bookmarkIndex].title); // Debugging
            // Langsung tampilkan notifikasi berikutnya
            showReminderNotification();
        }
    }
});

// Fungsi untuk memulai pengingat
const startReminder = () => {
    // Pastikan hanya satu interval yang berjalan
    if (reminderInterval) clearInterval(reminderInterval);
    // Jalankan setiap 30 menit (30 * 60 * 1000 milidetik)
    reminderInterval = setInterval(showReminderNotification, 30 * 60 * 1000);
};

// Fungsi untuk menghentikan pengingat (misalnya, saat ekstensi dinonaktifkan)
const stopReminder = () => {
    clearInterval(reminderInterval);
};

// Fungsi getFaviconUrl juga perlu ada di background.js karena digunakan oleh showReminderNotification
const getFaviconUrl = (url) => {
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;
};


// Inisialisasi awal saat service worker dimulai
// Pastikan setiap bookmark memiliki properti 'completed' (ini lebih baik dilakukan saat load bookmarks)
// scheduleDailyReset();
// startReminder();

// Untuk memastikan initial setup dilakukan hanya sekali saat service worker pertama kali berjalan
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install' || details.reason === 'update') {
        const result = await chrome.storage.local.get('bookmarks');
        let bookmarks = result.bookmarks || [];
        bookmarks.forEach(b => {
            if (b.completed === undefined) {
                b.completed = false;
            }
        });
        await chrome.storage.local.set({ bookmarks: bookmarks });
    }
    // Selalu jadwalkan pengingat dan alarm saat service worker aktif
    scheduleDailyReset();
    // schedule30MinReminder();
});

// Jika service worker dinonaktifkan/di-restart, pastikan alarm dan interval dimulai kembali
chrome.runtime.onStartup.addListener(() => {
    console.log("Service worker started up, scheduling reminders.");
    scheduleDailyReset();
    // schedule30MinReminder();
});