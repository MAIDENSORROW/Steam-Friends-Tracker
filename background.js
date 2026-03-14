// 🔔 Background script с радио
let lastNotificationTime = 0;
const COOLDOWN = 10000;
let offscreenCreated = false;

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
  
  // 🎵 Управление радио через offscreen
  if (message.type === 'PLAY_RADIO') {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ type: 'PLAY', url: message.url }, sendResponse);
    }).catch(err => {
      console.error('Offscreen error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (message.type === 'PAUSE_RADIO') {
    chrome.runtime.sendMessage({ type: 'PAUSE' }, sendResponse);
    return true;
  }
  
  if (message.type === 'STOP_RADIO') {
    chrome.runtime.sendMessage({ type: 'STOP' }, sendResponse);
    return true;
  }
  
  return true;
});

async function ensureOffscreen() {
  if (offscreenCreated) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Radio playback'
  });
  offscreenCreated = true;
  console.log('[Background] Offscreen created');
}

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