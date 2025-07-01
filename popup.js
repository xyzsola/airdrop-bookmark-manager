document.addEventListener('DOMContentLoaded', () => {
    const bookmarkForm = document.getElementById('bookmarkForm');
    const titleInput = document.getElementById('title');
    const urlInput = document.getElementById('url');
    const categorySelect = document.getElementById('category');
    const prioritySelect = document.getElementById('priority');
    const notesInput = document.getElementById('notes');
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

        categorySelect.innerHTML = '<option value="">Select a Category</option>'; // Changed text
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

        const title = titleInput.value;
        const url = urlInput.value;
        const category = categorySelect.value;
        const priority = prioritySelect.value;
        const notes = notesInput.value.trim();

        if (!category) {
            statusMessageDiv.textContent = 'Please select or type a category.';
            statusMessageDiv.style.color = '#dc3545'; // Merah untuk error
            return;
        }

        const newBookmark = {
            id: Date.now(),
            title: title,
            url: url,
            category: category,
            priority: priority,
            notes: notes,
            faviconUrl: getFaviconUrl(url), // Simpan favicon saat bookmark dibuat
            completed: false, // Default: belum selesai
            isFavorite: false // Default: bukan favorit
        };

        const result = await chrome.storage.local.get(['bookmarks', 'categories']);
        let bookmarks = result.bookmarks || [];
        let categories = result.categories || [];

        bookmarks.push(newBookmark);

        

        await chrome.storage.local.set({ bookmarks: bookmarks });

        statusMessageDiv.textContent = 'Bookmark added successfully!';
        statusMessageDiv.style.color = '#28a745'; // Hijau untuk sukses

        // Reset form (kecuali URL)
        titleInput.value = '';
        categorySelect.value = '';
        prioritySelect.value = 'Medium';
        notesInput.value = '';
    });

    // --- Initial Load ---
    getActiveTabInfo();
    loadCategories();
});