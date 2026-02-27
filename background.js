// 🔔 Background script с rate limiting

let lastNotificationTime = 0;
const COOLDOWN = 10000; // 10 секунд

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SEND_NOTIFICATION') {
        const now = Date.now();
        
        // 🔥 Пропускаем, если прошло меньше 10 сек с последнего уведомления
        if (now - lastNotificationTime < COOLDOWN) {
            sendResponse({ success: false, reason: 'cooldown' });
            return true;
        }
        
        sendNotification(message.data.newFriends, message.data.removedFriends);
        lastNotificationTime = now;
        sendResponse({ success: true });
    }
    return true;
});

function sendNotification(newFriends, removedFriends) {
    const addedCount = newFriends?.length || 0;
    const removedCount = removedFriends?.length || 0;
    
    if (addedCount === 0 && removedCount === 0) return;
    
    let title = 'Friends Tracker';
    let message = '';
    
    if (addedCount > 0 && removedCount > 0) {
        message = `+${addedCount} новых, −${removedCount} удалено`;
    } else if (addedCount > 0) {
        const names = newFriends.slice(0, 3).map(f => f.name).join(', ');
        message = `+${addedCount} новых: ${names}${addedCount > 3 ? ' и др.' : ''}`;
    } else if (removedCount > 0) {
        const names = removedFriends.slice(0, 3).map(f => f.name).join(', ');
        message = `−${removedCount} удалено: ${names}${removedCount > 3 ? ' и др.' : ''}`;
    }
    
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: title,
        message: message,
        priority: 2,
        requireInteraction: false
    });
}