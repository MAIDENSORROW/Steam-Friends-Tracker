// 🔔 Background script with Auto-Monitoring and Status Tracking
let lastNotificationTime = 0;
const COOLDOWN = 10000;
let monitoringInterval = null;

// Кэш статусов друзей для предотвращения лишних запросов
let friendStatusCache = {};
const STATUS_CACHE_TTL = 30000; // 30 секунд

// Функция для проверки всех вкладок Steam
function checkAllSteamTabs() {
  chrome.tabs.query({ url: '*://steamcommunity.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      const url = new URL(tab.url);
      const path = url.pathname;
      
      // Точное совпадение с /friends без дополнительных сегментов
      if (/^\/(?:id\/[^/]+|profiles\/\d+)\/friends$/.test(path)) {
        chrome.tabs.sendMessage(tab.id, { type: 'MANUAL_CHECK' }).catch(() => {});
      }
    });
  });
}

// Получение статуса друга через анализ personastate
function getPersonastateStatus(personastate) {
  if (personastate === 0) return 'offline';
  if (personastate === 1) return 'online';
  if (personastate >= 2 && personastate <= 4) return 'ingame';
  return 'offline';
}

// Массовое обновление статусов на основе времени последнего появления
function updateFriendsStatuses() {
  chrome.storage.local.get(['lastFriendsList', 'friendLastOnline'], (result) => {
    const friends = result.lastFriendsList || [];
    const friendLastOnline = result.friendLastOnline || {};
    
    if (friends.length === 0) return;
    
    const now = Date.now();
    const statuses = {};
    
    friends.forEach(friend => {
      const lastSeen = friendLastOnline[friend.id] || 0;
      const timeSinceLastSeen = now - lastSeen;
      
      // Если друг был в сети в последние 5 минут - считаем его онлайн
      if (timeSinceLastSeen < 5 * 60 * 1000) {
        statuses[friend.id] = 'online';
      }
      // Если друг был в сети в последние 30 минут - считаем что он мог быть в игре
      else if (timeSinceLastSeen < 30 * 60 * 1000) {
        statuses[friend.id] = 'ingame';
      }
      // Если друг не был в сети больше 7 дней - помечаем как "давно не заходил"
      else if (timeSinceLastSeen > 7 * 24 * 60 * 60 * 1000) {
        statuses[friend.id] = 'inactive';
      }
      // Иначе - офлайн
      else {
        statuses[friend.id] = 'offline';
      }
    });
    
    // Сохраняем обновлённые статусы
    chrome.storage.local.get(['friendStatuses'], (res) => {
      const existingStatuses = res.friendStatuses || {};
      
      // Не перезаписываем пользовательские статусы
      const userStatuses = ['favorite', 'suspicious', 'playing_together'];
      Object.entries(statuses).forEach(([id, status]) => {
        if (!userStatuses.includes(existingStatuses[id])) {
          existingStatuses[id] = status;
        }
      });
      
      chrome.storage.local.set({
        friendStatuses: existingStatuses
      }, () => {
        console.log('[Background] Статусы друзей обновлены');
        chrome.runtime.sendMessage({ type: 'UPDATE_AVAILABLE' }).catch(() => {});
      });
    });
  });
}

// Запускаем авто-мониторинг каждые 5 секунд
function startAutoMonitoring() {
  if (monitoringInterval) clearInterval(monitoringInterval);
  monitoringInterval = setInterval(() => {
    checkAllSteamTabs();
    updateFriendsStatuses();
  }, 5000);
  console.log('[Background] Авто-мониторинг запущен');
}

// Останавливаем авто-мониторинг
function stopAutoMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('[Background] Авто-мониторинг остановлен');
  }
}

// Запускаем мониторинг при запуске расширения
startAutoMonitoring();

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

  if (message.type === 'RESTART_MONITORING') {
    startAutoMonitoring();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'UPDATE_STATUSES') {
    updateFriendsStatuses();
    sendResponse({ success: true });
    return true;
  }

  return true;
});

function sendNotification(newFriends, removedFriends) {
  const added = newFriends?.length || 0;
  const removed = removedFriends?.length || 0;
  if (added === 0 && removed === 0) return;

  let title = '🎮 Friends Tracker Pro';
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
