// 🔔 Background script
let lastNotificationTime = 0;
const COOLDOWN = 10000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEND_NOTIFICATION') {
    const now = Date.now();
    if (now - lastNotificationTime < COOLDOWN) {
      sendResponse({ success: false, reason: 'cooldown' });
      return true;
    }
    sendNotification(message.data?.newFriends, message.data?.removedFriends);
    lastNotificationTime = now;
    sendResponse({ success: true });
    return true;
  }
  
  return true;
});

function sendNotification(newFriends, removedFriends) {
  const added = newFriends?.length || 0;
  const removed = removedFriends?.length || 0;
  if (added === 0 && removed === 0) return;
  
  let title = '🎮 Friends Tracker';
  let msg = '';
  if (added > 0 && removed > 0) msg = `+${added} новых, −${removed} удалено`;
  else if (added > 0) {
    const names = newFriends.slice(0, 3).map(f => f.name).join(', ');
    msg = `+${added} новых: ${names}${added > 3 ? ' и др.' : ''}`;
  } else {
    const names = removedFriends.slice(0, 3).map(f => f.name).join(', ');
    msg = `−${removed} удалено: ${names}${removed > 3 ? ' и др.' : ''}`;
  }
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: title,
    message: msg,
    priority: 2,
    requireInteraction: false
  });
}