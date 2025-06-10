document.addEventListener('DOMContentLoaded', () => {
    const bookmarkList = document.getElementById('bookmarkList');
    const filterCategorySelect = document.getElementById('filterCategory');
    const filterPrioritySelect = document.getElementById('filterPriority');
    const showCompletedCheckbox = document.getElementById('showCompleted');
    const openInNewTabButton = document.getElementById('openInNewTabButton'); // Ambil referensi tombol baru

    const exportButton = document.getElementById('exportBookmarks');
    const importButton = document.getElementById('importButton');
    const importInput = document.getElementById('importBookmarks');

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
            const matchesCompleted = showCompleted || !bookmark.completed;

            return matchesCategory && matchesPriority && matchesCompleted;
        });

        // Group bookmarks by priority
        const groupedBookmarks = {
            'High': [],
            'Medium': [],
            'Low': []
        };

        filteredBookmarks.forEach(bookmark => {
            if (groupedBookmarks[bookmark.priority]) {
                groupedBookmarks[bookmark.priority].push(bookmark);
            }
        });

        // Render each priority group
        const priorityOrder = ['High', 'Medium', 'Low'];
        priorityOrder.forEach(priority => {
            const bookmarksInGroup = groupedBookmarks[priority];
            if (bookmarksInGroup.length > 0) {
                const groupDiv = document.createElement('div');
                groupDiv.classList.add('priority-group');

                const groupTitle = document.createElement('h2');
                groupTitle.textContent = `${priority} Priority`;
                groupDiv.appendChild(groupTitle);

                const ul = document.createElement('ul');
                ul.id = 'bookmarkList-' + priority.toLowerCase(); // ID unik untuk setiap UL
                
                bookmarksInGroup.sort((a, b) => b.id - a.id); // Urutkan terbaru dulu dalam setiap grup

                bookmarksInGroup.forEach(bookmark => {
                    const li = document.createElement('li');
                    li.dataset.id = bookmark.id;
                    if (bookmark.completed) {
                        li.classList.add('completed');
                    }

                    li.style.setProperty('--favicon-url', `url("${bookmark.faviconUrl || getFaviconUrl(bookmark.url)}")`);
                    
                    li.innerHTML = `
                        <div class="bookmark-item-content">
                            <img src="${bookmark.faviconUrl || getFaviconUrl(bookmark.url)}" class="favicon" alt="Favicon">
                            <a href="${bookmark.url}" target="_blank">${bookmark.title}</a>
                        </div>
                        <div class="bookmark-actions">
                            <button class="mark-done" data-id="${bookmark.id}">${bookmark.completed ? 'Mark Undone' : 'Mark Done'}</button>
                            <button class="delete" data-id="${bookmark.id}">Delete</button>
                        </div>
                    `;
                    // Anda bisa menambahkan kategori dan prioritas sebagai span jika ingin ditampilkan di dalam item
                    // li.querySelector('.bookmark-item-content').insertAdjacentHTML('afterend', `<span>Category: ${bookmark.category}</span><span>Priority: ${bookmark.priority}</span>`);
                    ul.appendChild(li);
                });
                groupDiv.appendChild(ul);
                bookmarkList.appendChild(groupDiv); // Tambahkan grup ke #bookmarkList utama
            }
        });

        if (filteredBookmarks.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No bookmarks found for the current filters.';
            bookmarkList.appendChild(li);
        }
    };

    // --- Event Listeners ---
    bookmarkList.addEventListener('click', async (event) => {
        const target = event.target;
        const id = parseInt(target.dataset.id);

        if (target.classList.contains('delete')) {
            allBookmarks = allBookmarks.filter(b => b.id !== id);
            await saveBookmarks();
            renderBookmarks();
        } else if (target.classList.contains('mark-done')) {
            const bookmarkIndex = allBookmarks.findIndex(b => b.id === id);
            if (bookmarkIndex !== -1) {
                allBookmarks[bookmarkIndex].completed = !allBookmarks[bookmarkIndex].completed;
                await saveBookmarks();
                renderBookmarks();
            }
        }
        // Tidak ada lagi edit button di sini, jadi bagian ini bisa dihapus atau diubah jika Anda ingin mengimplementasikan edit modal
    });

    filterCategorySelect.addEventListener('change', renderBookmarks);
    filterPrioritySelect.addEventListener('change', renderBookmarks);
    showCompletedCheckbox.addEventListener('change', renderBookmarks);

    // --- New Event Listener for Open in New Tab Button ---
    openInNewTabButton.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
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
    loadBookmarksAndCategories();
});