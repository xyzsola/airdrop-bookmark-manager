document.addEventListener('DOMContentLoaded', () => {
    const tabNavigation = document.querySelector('.tab-navigation');
    const bookmarkGridContainer = document.querySelector('.bookmark-grid-container'); // Ganti dari bookmarkList
    const filterPrioritySelect = document.getElementById('filterPriority');
    const filterStatusSelect = document.getElementById('filterStatus');
    const openInNewTabButton = document.getElementById('openInNewTabButton');
    const openSettingsButton = document.getElementById('openSettingsButton');

    // Modal elements
    const bookmarkDetailModal = document.getElementById('bookmarkDetailModal');
    const closeButton = document.querySelector('.close-button');
    const detailTitle = document.getElementById('detailTitle');
    const detailCategory = document.getElementById('detailCategory');
    const detailPriority = document.getElementById('detailPriority');
    const detailNotes = document.getElementById('detailNotes');
    const openAirdropButton = document.getElementById('openAirdropButton');

    let currentBookmarkUrl = ''; // To store the URL of the currently displayed bookmark

    const exportButton = document.getElementById('exportBookmarks');
    const importButton = document.getElementById('importButton');
    const importInput = document.getElementById('importBookmarks');

    let allBookmarks = [];
    let allCategories = [];
    let activeCategory = ''; // Kategori yang sedang aktif (default: All)

    // --- Helper Functions ---
    const getFaviconUrl = (url) => {
        return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;
    };

    const loadCategoriesAndRenderTabs = async () => {
        const result = await chrome.storage.local.get(['categories', 'bookmarks']);
        allCategories = result.categories || [];
        allBookmarks = result.bookmarks || [];

        // Pastikan 'All' selalu ada sebagai kategori pertama
        const uniqueCategories = ['All', ...new Set(allCategories.filter(cat => cat !== 'All'))];

        tabNavigation.innerHTML = ''; // Clear existing tabs

        uniqueCategories.forEach(category => {
            const tabButton = document.createElement('button');
            tabButton.classList.add('tab-button');
            tabButton.textContent = category === 'All' ? 'All' : category; // Teks untuk tombol "All"
            tabButton.dataset.category = category === 'All' ? '' : category; // Data attribute untuk filter

            if (tabButton.dataset.category === activeCategory) {
                tabButton.classList.add('active');
            }

            tabButton.addEventListener('click', () => {
                activeCategory = tabButton.dataset.category;
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                tabButton.classList.add('active');
                renderBookmarkCards(); // Render ulang kartu berdasarkan kategori baru
            });
            tabNavigation.appendChild(tabButton);
        });

        // Pastikan activeCategory diatur jika belum
        if (!activeCategory && uniqueCategories.length > 0) {
            activeCategory = uniqueCategories[0] === 'All' ? '' : uniqueCategories[0];
            tabNavigation.querySelector(`[data-category="${activeCategory}"]`).classList.add('active');
        }
    };

    const saveBookmarks = async () => {
        await chrome.storage.local.set({ bookmarks: allBookmarks });
    };

    const renderBookmarkCards = () => {
        bookmarkGridContainer.innerHTML = ''; // Clear current grid

        const filterPrio = filterPrioritySelect.value;
        const filterStatus = filterStatusSelect.value;

        const filteredBookmarks = allBookmarks.filter(bookmark => {
            const matchesCategory = activeCategory === '' || bookmark.category === activeCategory;
            const matchesPriority = filterPrio === '' || bookmark.priority === filterPrio;
            // const matchesCompleted = showCompleted || !bookmark.completed;

            let matchesStatus = true;
            if (filterStatus === 'inProgress') {
                matchesStatus = !bookmark.completed;
            } else if (filterStatus === 'completed') {
                matchesStatus = bookmark.completed;
            }

            return matchesCategory && matchesPriority && matchesStatus;
        });

        if (filteredBookmarks.length === 0) {
            const message = document.createElement('p');
            message.textContent = 'No bookmarks found for the selected category or filters.';
            message.style.textAlign = 'center';
            message.style.color = '#b9bbbe';
            bookmarkGridContainer.appendChild(message);
            return;
        }

        // Sort bookmarks by creation date (newest first)
        filteredBookmarks.sort((a, b) => b.id - a.id);

        filteredBookmarks.forEach(bookmark => {
            const card = document.createElement('div');
            card.classList.add('bookmark-card');
            card.dataset.id = bookmark.id;
            
            if (bookmark.completed) {
                card.classList.add('completed');
            }

            // if (bookmark.isFavorite) {
            //     card.classList.add('is-favorite');
            // }

            // HTML untuk setiap kartu
            card.innerHTML = `
                <img src="${bookmark.faviconUrl || getFaviconUrl(bookmark.url)}" class="favicon" alt="Favicon">
                <h3>${bookmark.title}</h3>
                ${bookmark.notes ? `<p class="bookmark-notes">${bookmark.notes}</p>` : ''}
                <div class="action-buttons-group">
                    <button class="action-button mark-done" data-id="${bookmark.id}">${bookmark.completed ? 'Undone' : 'Done'}</button>
                    <button class="delete-button" data-id="${bookmark.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;

            // Tambahkan event listener untuk membuka link saat kartu diklik
            card.addEventListener('click', (e) => {
                // Prevent opening the link if a button inside the card was clicked
                if (e.target.tagName !== 'BUTTON' && !e.target.closest('.action-button')) {
                    // Populate modal with bookmark details
                    detailTitle.textContent = bookmark.title;
                    detailCategory.textContent = bookmark.category;
                    detailPriority.textContent = bookmark.priority;
                    detailNotes.textContent = bookmark.notes || 'No notes.';
                    document.getElementById('detailFavicon').src = bookmark.faviconUrl || getFaviconUrl(bookmark.url);
                    document.getElementById('detailUrl').textContent = bookmark.url;
                    currentBookmarkUrl = bookmark.url;
                    bookmarkDetailModal.style.display = 'flex'; // Show the modal
                }
            });

            bookmarkGridContainer.appendChild(card);
        });
    };

    // --- Daily Reset ---
    const resetBookmarksDaily = async () => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // Ambil waktu terakhir reset dari storage
        const result = await chrome.storage.local.get('lastResetDate');
        const lastResetDate = result.lastResetDate ? new Date(result.lastResetDate) : null;

        // Cek apakah hari ini sudah direset (atau belum pernah direset)
        const isNewDay = !lastResetDate || lastResetDate.toDateString() !== now.toDateString();

        // Jika ini hari baru DAN jam 7 pagi atau lebih (dan belum direset hari ini)
        if (isNewDay && currentHour >= 7) {
            console.log('It is a new day and past 7 AM. Resetting bookmarks...');
            
            let changed = false;
            allBookmarks.forEach(b => {
                if (b.completed) {
                    b.completed = false; // Set semua ke belum selesai
                    changed = true;
                }
            });

            if (changed) {
                await saveBookmarks();
                renderBookmarkCards();
            }

            // Simpan tanggal reset terakhir
            await chrome.storage.local.set({ lastResetDate: now.toISOString() });
            console.log('Bookmarks reset and lastResetDate updated.');
        } else {
            console.log('Not yet time to reset, or already reset today.');
        }
    };

    // --- Event Listeners ---
    bookmarkGridContainer.addEventListener('click', async (event) => {
        const target = event.target;
        const id = parseInt(target.dataset.id);
        const card = target.closest('.bookmark-card');

        if (target.classList.contains('mark-done')) {
            const bookmarkIndex = allBookmarks.findIndex(b => b.id === id);
            if (bookmarkIndex !== -1) {
                allBookmarks[bookmarkIndex].completed = !allBookmarks[bookmarkIndex].completed;
                await saveBookmarks();
                
                // Jika tombol "Mark Done" diklik, sembunyikan/tampilkan sesuai dropdown status
                if (filterStatusSelect.value === 'inProgress' && allBookmarks[bookmarkIndex].completed) {
                    card.style.display = 'none';
                } else if (filterStatusSelect.value === 'completed' && !allBookmarks[bookmarkIndex].completed) {
                    card.style.display = 'none';
                } else {
                    renderBookmarkCards();
                }
            }
        } else if (target.classList.contains('delete-button')) { 
            if (confirm('Are you sure you want to delete this bookmark?')) {
                allBookmarks = allBookmarks.filter(b => b.id !== id);
                await saveBookmarks();
                renderBookmarkCards();
            }
        }
        // Jika Anda ingin tombol delete di kartu, tambahkan di sini
        // else if (target.classList.contains('delete-card')) { ... }
    });

    filterPrioritySelect.addEventListener('change', renderBookmarkCards);
    filterStatusSelect.addEventListener('change', renderBookmarkCards);

    openInNewTabButton.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
    });

    openSettingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Modal event listeners
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            bookmarkDetailModal.style.display = 'none';
        });
    }

    if (openAirdropButton) {
        openAirdropButton.addEventListener('click', () => {
            if (currentBookmarkUrl) {
                chrome.tabs.create({ url: currentBookmarkUrl });
            }
        });
    }

    // Close modal if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === bookmarkDetailModal) {
            bookmarkDetailModal.style.display = 'none';
        }
    });

    // --- Export/Import Event Listeners ---
    const exportBookmarks = () => {
        const bookmarkData = JSON.stringify(allBookmarks, null, 2);
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
                    // Pastikan bookmark yang diimpor memiliki properti 'completed' dan 'isFavorite'
                    allBookmarks.forEach(b => {
                        if (b.completed === undefined) b.completed = false;
                        if (b.isFavorite === undefined) b.isFavorite = false;
                    });
                    await saveBookmarks();
                    await loadCategoriesAndRenderTabs(); // Muat ulang tab dan render kartu
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

    exportButton.addEventListener('click', exportBookmarks);

    importButton.addEventListener('click', () => {
        importInput.click();
    });

    importInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            importBookmarksFromFile(file);
        }
    });

    // --- Initial Load ---
    const initializeBookmarks = async () => {
        const result = await chrome.storage.local.get(['bookmarks', 'categories']);
        allBookmarks = result.bookmarks || [];
        allCategories = result.categories || [];
        // Pastikan setiap bookmark memiliki properti 'completed' dan 'isFavorite'
        allBookmarks.forEach(b => {
            if (b.completed === undefined) {
                b.completed = false;
            }
            if (b.isFavorite === undefined) {
                b.isFavorite = false;
            }
        });
        await saveBookmarks(); 
        await resetBookmarksDaily();
        await loadCategoriesAndRenderTabs(); 
        renderBookmarkCards(); 
    };

    initializeBookmarks();
});