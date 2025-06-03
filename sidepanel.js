document.addEventListener('DOMContentLoaded', () => {
    const bookmarkList = document.getElementById('bookmarkList');
    const filterCategorySelect = document.getElementById('filterCategory');
    const filterPrioritySelect = document.getElementById('filterPriority');
    const showCompletedCheckbox = document.getElementById('showCompleted');

    let allBookmarks = [];
    let allCategories = [];

    // --- Helper Functions ---
    const getFaviconUrl = (url) => {
        return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;
    };

    const loadCategoriesIntoFilter = async () => {
        const result = await chrome.storage.local.get('categories');
        allCategories = result.categories || [];

        filterCategorySelect.innerHTML = '<option value="">All</option>';
        allCategories.forEach(cat => {
            const filterOption = document.createElement('option');
            filterOption.value = cat;
            filterOption.textContent = cat;
            filterCategorySelect.appendChild(filterOption);
        });
    };

    const saveBookmarks = async () => {
        await chrome.storage.local.set({ bookmarks: allBookmarks });
    };

    const loadBookmarksAndCategories = async () => {
        const result = await chrome.storage.local.get(['bookmarks', 'categories']);
        allBookmarks = result.bookmarks || [];
        allCategories = result.categories || [];
        // Pastikan setiap bookmark memiliki properti 'completed'
        allBookmarks.forEach(b => {
            if (b.completed === undefined) {
                b.completed = false;
            }
        });
        await saveBookmarks(); // Simpan jika ada perubahan pada properti 'completed'
        await loadCategoriesIntoFilter();
        renderBookmarks();
    };

    const renderBookmarks = () => {
        bookmarkList.innerHTML = ''; // Clear current list

        const filterCat = filterCategorySelect.value;
        const filterPrio = filterPrioritySelect.value;
        const showCompleted = showCompletedCheckbox.checked;

        const filteredBookmarks = allBookmarks.filter(bookmark => {
            const matchesCategory = filterCat === '' || bookmark.category === filterCat;
            const matchesPriority = filterPrio === '' || bookmark.priority === filterPrio;
            const matchesCompleted = showCompleted || !bookmark.completed; // Tampilkan semua jika showCompleted, atau hanya yang belum selesai

            return matchesCategory && matchesPriority && matchesCompleted;
        }).sort((a, b) => {
            // Urutkan berdasarkan prioritas (High > Medium > Low)
            const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            // Jika prioritas sama, urutkan berdasarkan yang terbaru dulu
            return b.id - a.id;
        });

        if (filteredBookmarks.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No bookmarks found.';
            bookmarkList.appendChild(li);
            return;
        }

        filteredBookmarks.forEach((bookmark) => {
            const li = document.createElement('li');
            li.dataset.id = bookmark.id; // Store ID for easy access
            if (bookmark.completed) {
                li.classList.add('completed');
            }

            li.innerHTML = `
                <div class="bookmark-item-header">
                    <img src="${bookmark.faviconUrl || getFaviconUrl(bookmark.url)}" class="favicon" alt="Favicon">
                    <a href="${bookmark.url}" target="_blank">${bookmark.title}</a>
                </div>
                <span>Category: ${bookmark.category}</span>
                <span>Priority: ${bookmark.priority}</span>
                <div class="bookmark-actions">
                    <button class="mark-done" data-id="${bookmark.id}">${bookmark.completed ? 'Mark Undone' : 'Mark Done'}</button>
                    <!-- <button class="edit" data-id="${bookmark.id}">Edit</button> -->
                    <button class="delete" data-id="${bookmark.id}">Delete</button>
                </div>
            `;
            bookmarkList.appendChild(li);
        });
    };

    // --- Event Listeners ---
    bookmarkList.addEventListener('click', async (event) => {
        const target = event.target;
        const id = parseInt(target.dataset.id);

        if (target.classList.contains('delete')) {
            allBookmarks = allBookmarks.filter(b => b.id !== id);
            await saveBookmarks();
            renderBookmarks();
        } else if (target.classList.contains('edit')) {
            // Untuk mengedit, kita bisa membuka popup lagi dengan data yang sudah terisi
            // Namun, karena popup hanya untuk "tambah", kita akan lebih sederhana
            // langsung mengubah properti di sini (atau membuat form edit inline)
            // Untuk saat ini, kita bisa prompt user atau mengabaikan edit dari sidepanel.
            // Pilihan yang lebih baik adalah memunculkan modal edit atau mengarahkan ke popup dengan parameter.
            // Untuk tujuan demo ini, kita akan biarkan sebagai placeholder.
            alert('Edit functionality not fully implemented yet. Please re-add the bookmark with new details.');
            // Jika ingin mengedit, Anda bisa:
            // 1. Membuat formulir edit inline di dalam <li> ini.
            // 2. Mengirim pesan ke background.js untuk membuka window baru dengan popup.html yang sudah terisi.
            //    Ini lebih kompleks karena butuh IPC (Inter-Process Communication).
        } else if (target.classList.contains('mark-done')) {
            const bookmarkIndex = allBookmarks.findIndex(b => b.id === id);
            if (bookmarkIndex !== -1) {
                allBookmarks[bookmarkIndex].completed = !allBookmarks[bookmarkIndex].completed; // Toggle status
                await saveBookmarks();
                renderBookmarks();
            }
        }
    });

    filterCategorySelect.addEventListener('change', renderBookmarks);
    filterPrioritySelect.addEventListener('change', renderBookmarks);
    showCompletedCheckbox.addEventListener('change', renderBookmarks);


    // --- Initial Load ---
    loadBookmarksAndCategories();

    const exportButton = document.getElementById('exportBookmarks');
    const importButton = document.getElementById('importButton');
    const importInput = document.getElementById('importBookmarks');

    // --- Helper Functions ---
    const exportBookmarks = () => {
        const bookmarkData = JSON.stringify(allBookmarks, null, 2); // Menggunakan JSON.stringify dengan spacing untuk format yang lebih mudah dibaca
        const blob = new Blob([bookmarkData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bookmarks.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const importBookmarksFromFile = (file) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedBookmarks = JSON.parse(event.target.result);
                if (Array.isArray(importedBookmarks)) {
                    allBookmarks = importedBookmarks;
                    await saveBookmarks();
                    renderBookmarks();
                    alert('Bookmarks imported successfully!');
                } else {
                    alert('Invalid bookmark file format.');
                }
            } catch (error) {
                console.error('Error importing bookmarks:', error);
                alert('Error importing bookmarks.');
            }
        };
        reader.readAsText(file);
    };

    // --- Event Listeners ---
    exportButton.addEventListener('click', exportBookmarks);

    importButton.addEventListener('click', () => {
        importInput.click(); // Membuka dialog pemilihan file
    });

    importInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            importBookmarksFromFile(file);
        }
    });
});