document.addEventListener('DOMContentLoaded', () => {
    const bookmarkForm = document.getElementById('bookmarkForm');
    const titleInput = document.getElementById('title');
    const urlInput = document.getElementById('url');
    const categorySelect = document.getElementById('category');
    const newCategoryInput = document.getElementById('newCategory');
    const prioritySelect = document.getElementById('priority');
    const statusMessageDiv = document.getElementById('statusMessage');
    const openInNewTabButton = document.getElementById('openInNewTabButton');

    // --- Helper Functions ---
    const getActiveTabInfo = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            titleInput.value = tab.title || '';
            urlInput.value = tab.url || '';
        }
    };

    const getFaviconUrl = (url) => {
        return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;
    };

    const loadCategories = async (selectedCategory = '') => {
        const result = await chrome.storage.local.get('categories');
        let allCategories = result.categories || [];

        categorySelect.innerHTML = '<option value="">Select or Type New</option>';
        allCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });

        if (selectedCategory) {
            categorySelect.value = selectedCategory;
        }
    };

    // --- Event Listeners ---
    openInNewTabButton.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
    });

    bookmarkForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const title = titleInput.value.trim();
        const url = urlInput.value.trim();
        let category = categorySelect.value.trim();
        const newCategory = newCategoryInput.value.trim();
        const priority = prioritySelect.value;

        if (newCategory) {
            category = newCategory; // Gunakan kategori baru jika diberikan
            const result = await chrome.storage.local.get('categories');
            let allCategories = result.categories || [];
            if (!allCategories.includes(category)) {
                allCategories.push(category);
                allCategories.sort(); // Urutkan kategori
                await chrome.storage.local.set({ categories: allCategories });
            }
        }

        if (!title || !url || !category || !priority) {
            statusMessageDiv.textContent = 'Please fill in all required fields.';
            statusMessageDiv.style.color = 'red';
            setTimeout(() => statusMessageDiv.textContent = '', 2000);
            return;
        }

        const faviconUrl = getFaviconUrl(url);

        const newBookmark = {
            id: Date.now(), // ID unik
            title,
            url,
            category,
            priority,
            faviconUrl,
            completed: false // Default untuk reminder
        };

        const result = await chrome.storage.local.get('bookmarks');
        let allBookmarks = result.bookmarks || [];
        allBookmarks.push(newBookmark);
        allBookmarks.sort((a, b) => b.id - a.id); // Urutkan dari terbaru

        await chrome.storage.local.set({ bookmarks: allBookmarks });

        statusMessageDiv.textContent = 'Bookmark added successfully!';
        statusMessageDiv.style.color = '#28a745'; // Green for success
        setTimeout(() => {
            statusMessageDiv.textContent = '';
            window.close(); // Tutup popup setelah beberapa detik
        }, 1500);

        // Clear form
        bookmarkForm.reset();
        getActiveTabInfo(); // Isi ulang info tab saat ini
        newCategoryInput.value = '';
        loadCategories(); // Muat ulang kategori untuk dropdown
    });

    newCategoryInput.addEventListener('input', () => {
        if (newCategoryInput.value.trim() !== '') {
            categorySelect.value = '';
        }
    });
    categorySelect.addEventListener('change', () => {
        if (categorySelect.value.trim() !== '') {
            newCategoryInput.value = '';
        }
    });

    const openSidePanelButton = document.getElementById('openSidePanelButton');

    openSidePanelButton.addEventListener('click', async () => {
        // Mendapatkan tab yang sedang aktif
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Membuka side panel untuk tab tersebut
        await chrome.sidePanel.open({ tabId: tab.id });
    });

    // --- Initial Load ---
    getActiveTabInfo();
    loadCategories();
});