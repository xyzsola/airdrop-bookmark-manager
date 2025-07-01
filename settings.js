document.addEventListener('DOMContentLoaded', () => {    
	const reminderIntervalInput = document.getElementById('reminderInterval');
    const saveReminderButton = document.getElementById('saveReminder');
    const statusDiv = document.getElementById('status');

    const newCategoryInput = document.getElementById('newCategoryInput');
    const addCategoryButton = document.getElementById('addCategoryButton');
    const categoryStatusDiv = document.getElementById('categoryStatus');
    const categoryList = document.getElementById('categoryList');

    // --- Reminder Settings ---
    // Load saved reminder interval
    chrome.storage.sync.get(['reminderInterval'], (result) => {
        if (result.reminderInterval) {
            reminderIntervalInput.value = result.reminderInterval;
        } else {
            reminderIntervalInput.value = 1; // Default to 1 hour
        }
    });

    // Save reminder interval
    saveReminderButton.addEventListener('click', () => {
        const interval = reminderIntervalInput.value;
        if (interval && parseInt(interval) > 0) {
            chrome.storage.sync.set({ reminderInterval: parseInt(interval) }, () => {
                statusDiv.textContent = 'Settings saved.';
                setTimeout(() => {
                    statusDiv.textContent = '';
                }, 2000);
            });
        } else {
            statusDiv.textContent = 'Please enter a valid interval.';
        }
    });

    // --- Category Management ---
    const loadCategories = async () => {
        const result = await chrome.storage.local.get('categories');
        let categories = result.categories || [];
        categoryList.innerHTML = '';
        if (categories.length === 0) {
            categoryList.innerHTML = '<li class="list-group-item text-center text-muted">No categories added yet.</li>';
            return;
        }
        categories.forEach(cat => {
            const li = document.createElement('li');
            li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
            li.textContent = cat;
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('btn', 'btn-danger', 'btn-sm');
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete the category "${cat}"?`)) {
                    categories = categories.filter(c => c !== cat);
                    await chrome.storage.local.set({ categories: categories });
                    loadCategories(); // Reload list
                    categoryStatusDiv.textContent = `Category "${cat}" deleted.`;
                    categoryStatusDiv.style.color = '#dc3545';
                    setTimeout(() => categoryStatusDiv.textContent = '', 2000);
                }
            });
            li.appendChild(deleteButton);
            categoryList.appendChild(li);
        });
    };

    addCategoryButton.addEventListener('click', async () => {
        const newCategory = newCategoryInput.value.trim();
        if (newCategory) {
            const result = await chrome.storage.local.get('categories');
            let categories = result.categories || [];
            if (!categories.includes(newCategory)) {
                categories.push(newCategory);
                categories.sort(); // Keep categories sorted alphabetically
                try {
                    await chrome.storage.local.set({ categories: categories });
                    newCategoryInput.value = '';
                    loadCategories(); // Reload list
                    categoryStatusDiv.textContent = `Category "${newCategory}" added.`;
                    categoryStatusDiv.style.color = '#28a745';
                    setTimeout(() => categoryStatusDiv.textContent = '', 2000);
                } catch (error) {
                    console.error("Error saving categories:", error);
                    categoryStatusDiv.textContent = 'Error saving category.';
                    categoryStatusDiv.style.color = '#dc3545';
                    setTimeout(() => categoryStatusDiv.textContent = '', 2000);
                }
            } else {
                categoryStatusDiv.textContent = 'Category already exists.';
                categoryStatusDiv.style.color = '#ffc107';
                setTimeout(() => categoryStatusDiv.textContent = '', 2000);
            }
        } else {
            categoryStatusDiv.textContent = 'Please enter a category name.';
            categoryStatusDiv.style.color = '#ffc107';
            setTimeout(() => categoryStatusDiv.textContent = '', 2000);
        }
    });

    // Initial load of categories
    loadCategories();
});
