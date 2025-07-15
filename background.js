chrome.action.onClicked.addListener(async (tab) => {
  // This is handled by default_popup in manifest.json
});

// --- Reminder and Notification Logic ---

let reminderIntervalInHours;

// Function to get the user's reminder setting
const loadReminderSetting = async () => {
    const result = await chrome.storage.sync.get(['reminderInterval']);
    reminderIntervalInHours = result.reminderInterval || 1; // Default to 1 hour
};

let notificationTimeout;

// Function to show a notification for an uncompleted bookmark
const showReminderNotification = async () => {
    console.log('showReminderNotification called at:', new Date().toLocaleTimeString());
    const result = await chrome.storage.local.get(['bookmarks', 'remindedBookmarkIds']);
    let bookmarks = result.bookmarks || [];
    let remindedBookmarkIds = result.remindedBookmarkIds || [];

    // Filter for uncompleted bookmarks
    let uncompletedBookmarks = bookmarks.filter(b => !b.completed);

    // Sort by priority (High > Medium > Low)
    uncompletedBookmarks.sort((a, b) => {
        const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });

    // Find the next bookmark to show
    let nextBookmark = null;
    for (const bookmark of uncompletedBookmarks) {
        if (!remindedBookmarkIds.includes(bookmark.id)) {
            nextBookmark = bookmark;
            break;
        }
    }

    // If all current uncompleted bookmarks have been reminded, reset the cycle
    if (!nextBookmark && uncompletedBookmarks.length > 0) {
        remindedBookmarkIds = [];
        await chrome.storage.local.set({ remindedBookmarkIds: [] });
        nextBookmark = uncompletedBookmarks[0]; // Start from the highest priority again
    }

    if (!nextBookmark) {
        console.log("No next bookmark found for notification.");
        return;
    }

    console.log('Showing notification for:', nextBookmark.title);
    chrome.notifications.create({
        type: 'basic',
        iconUrl: nextBookmark.faviconUrl || getFaviconUrl(nextBookmark.url),
        title: `Airdrop Reminder: ${nextBookmark.title}`,
        message: "Don't forget to check this airdrop!",
        buttons: [{ title: 'Mark as Done' }],
        requireInteraction: true,
        priority: 2
    }, async (notificationId) => {
        // Add the reminded bookmark ID to the list
        remindedBookmarkIds.push(nextBookmark.id);
        await chrome.storage.local.set({ remindedBookmarkIds: remindedBookmarkIds });

        // Clear any existing timeout
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
        }

        // Set a timeout to close the notification after 1 minute
        notificationTimeout = setTimeout(() => {
            chrome.notifications.clear(notificationId);
            console.log(`Notification ${notificationId} closed due to timeout.`);
        }, 60000); // 1 minute in milliseconds
    });
};

// --- Alarm Scheduling ---

// Schedules the main reminder based on user settings
const scheduleReminderAlarm = async () => {
    await loadReminderSetting();
    const periodInMinutes = reminderIntervalInHours * 60;
    
    chrome.alarms.create('airdropReminder', {
        delayInMinutes: 1, // Start after 1 minute from when the alarm is set
        periodInMinutes: periodInMinutes
    });
    console.log(`Airdrop reminder alarm scheduled to run every ${reminderIntervalInHours} hour(s).`);
};

// Schedules a daily alarm to reset the 'completed' status of bookmarks at 7 AM
const scheduleDailyReset = () => {
    const now = new Date();
    const resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0, 0);

    if (now > resetTime) {
        resetTime.setDate(resetTime.getDate() + 1); // If it's past 7 AM, schedule for tomorrow
    }

    const timeUntilReset = resetTime.getTime() - now.getTime();
    
    chrome.alarms.create('dailyReset', {
        when: Date.now() + timeUntilReset,
        periodInMinutes: 24 * 60 // Repeat every 24 hours
    });
    console.log(`Daily reset alarm scheduled for ${resetTime.toLocaleString()}`);
};


// --- Event Listeners ---

// Handles all alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('Alarm triggered:', alarm.name, 'at:', new Date().toLocaleTimeString());
    if (alarm.name === 'dailyReset') {
        // Reset the 'completed' status for all bookmarks and clear reminded IDs
        const result = await chrome.storage.local.get('bookmarks');
        let bookmarks = result.bookmarks || [];
        bookmarks.forEach(b => b.completed = false);
        await chrome.storage.local.set({ bookmarks: bookmarks, remindedBookmarkIds: [] });
        console.log('All bookmarks have been reset to uncompleted and reminded IDs cleared.');
        // Show a notification right after reset
        // showReminderNotification();
    } else if (alarm.name === 'airdropReminder') {
        // showReminderNotification();
    }
});

// Handles clicks on the "Mark as Done" button in a notification
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }

    if (buttonIndex === 0) { // "Mark as Done" was clicked
        const { remindedBookmarkIds, bookmarks } = await chrome.storage.local.get(['remindedBookmarkIds', 'bookmarks']);
        const currentReminderId = remindedBookmarkIds[remindedBookmarkIds.length - 1]; // Get the last reminded ID

        if (currentReminderId && bookmarks) {
            const bookmarkIndex = bookmarks.findIndex(b => b.id === currentReminderId);
            if (bookmarkIndex !== -1) {
                bookmarks[bookmarkIndex].completed = true;
                await chrome.storage.local.set({ bookmarks: bookmarks });
                console.log(`Bookmark '${bookmarks[bookmarkIndex].title}' marked as done.`);
                // Immediately show the next notification
                // showReminderNotification();
            }
        }
    }
});

// Reschedule alarm if the user changes the setting
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.reminderInterval) {
        console.log('Reminder interval setting changed. Rescheduling alarm.');
        scheduleReminderAlarm();
    }
});

// --- Initialization ---

// Initial setup when the extension is installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed or updated. Initializing...');
    scheduleDailyReset();
    scheduleReminderAlarm();
    
    // Initialize bookmark properties on first install
    if (details.reason === 'install') {
        const result = await chrome.storage.local.get('bookmarks');
        let bookmarks = result.bookmarks || [];
        bookmarks.forEach(b => {
            if (b.completed === undefined) b.completed = false;
        });
        await chrome.storage.local.set({ bookmarks: bookmarks });
    }
});

// Rerun scheduling when the browser starts
chrome.runtime.onStartup.addListener(() => {
    console.log("Browser started. Scheduling alarms.");
    scheduleDailyReset();
    scheduleReminderAlarm();
});

// Helper to get favicon URL (needed for notifications)
const getFaviconUrl = (url) => {
    try {
        const urlObject = new URL(url);
        return `https://www.google.com/s2/favicons?sz=64&domain_url=${urlObject.origin}`;
    } catch (e) {
        return 'icons/icon48.png'; // Default icon
    }
};
