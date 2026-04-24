// 🔔 Background script with Auto-Monitoring
let lastNotificationTime = 0;
const COOLDOWN = 10000;
let monitoringInterval = null;

// Функция для проверки всех вкладок Steam
function checkAllSteamTabs() {
  chrome.tabs.query({ url: '*://steamcommunity.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      // Проверяем, является ли вкладка страницей друзей
      const url = new URL(tab.url);
      const path = url.pathname;
      
      // Точное совпадение с /friends без дополнительных сегментов
      if (/^\/(?:id\/[^/]+|profiles\/\d+)\/friends$/.test(path)) {
        // Отправляем сообщение content script для проверки
        chrome.tabs.sendMessage(tab.id, { type: 'MANUAL_CHECK' }).catch(() => {});
      }
    });
  });
}

// Запускаем авто-мониторинг каждые 5 секунд
function startAutoMonitoring() {
  if (monitoringInterval) clearInterval(monitoringInterval);
  monitoringInterval = setInterval(checkAllSteamTabs, 5000);
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
  
  // Обработка запроса на перезапуск мониторинга
  if (message.type === 'RESTART_MONITORING') {
    startAutoMonitoring();
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