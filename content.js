// 🎮 Steam Friends Tracker - Optimized Version with Auto-Monitoring
let checkInterval = null;
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 10000;

function cleanAvatarUrl(url) {
  if (!url) return null;
  return url.replace('avatars.akamai.steamstatic.com', 'avatars.steamstatic.com')
    .replace('avatars.cloudflare.steamstatic.com', 'avatars.steamstatic.com')
    .replace('_medium.', '.').replace('_small.', '.').replace('_full.', '.')
    .replace(/\?t=\d+/, '').split('?')[0].split('&')[0];
}

function getFriendsFromPage() {
  const friends = [], seenIds = new Set();
  const containers = document.querySelectorAll('div.friend_block_v2[data-steamid], div.friend_block_v2[data-miniprofile]');

  if (containers.length === 0) return [];

  containers.forEach(container => {
    const steamId = container.getAttribute('data-steamid') || container.getAttribute('data-miniprofile');
    if (!steamId || seenIds.has(steamId)) return;

    let profileUrl = `https://steamcommunity.com/profiles/${steamId}`;
    const overlay = container.querySelector('a.selectable_overlay');
    if (overlay?.href) profileUrl = overlay.href.split('?')[0];

    let name = 'Unknown';
    const nameLink = container.querySelector('.friend_block_content');
    if (nameLink) {
        const rawName = nameLink.firstChild?.textContent?.trim();
        if (rawName) name = rawName;
    }

    if (name === 'Unknown') {
        name = container.getAttribute('aria-label') || overlay?.getAttribute('title') || steamId;
    }

    let avatar = null;
    const img = container.querySelector('img[src*="steamstatic.com"]');
    if (img?.src) avatar = cleanAvatarUrl(img.src);
    const finalAvatar = avatar || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';

    seenIds.add(steamId);
    friends.push({ id: steamId, name, avatar: finalAvatar, profileUrl });
  });
  return friends;
}

function checkAndSave() {
  const currentFriends = getFriendsFromPage();
  
  // Если друзей не найдено на странице — НЕ обновляем сохранённый список
  // Это предотвращает стирание данных при переходе на другие вкладки (заблокированные, подписки и т.д.)
  if (currentFriends.length === 0) {
    console.log('[Steam Friends Tracker] Друзья не найдены на странице, пропускаем сохранение (возможно, это не основная страница друзей)');
    return;
  }

  chrome.storage.local.get(['lastFriendsList', 'logs', 'friendLastOnline'], (result) => {
    const lastList = result.lastFriendsList || [];
    const logs = result.logs || [];
    const friendLastOnline = result.friendLastOnline || {};

    // Если это самый первый запуск — просто сохраняем текущий список без записи в лог
    if (lastList.length === 0) {
      console.log('[Steam Friends Tracker] Первый запуск, сохраняем список из', currentFriends.length, 'друзей');
      chrome.storage.local.set({ 
        lastFriendsList: currentFriends, 
        logs: [],
        friendLastOnline: friendLastOnline
      });
      return;
    }

    const lastIds = new Set(lastList.map(f => f.id));
    const currentIds = new Set(currentFriends.map(f => f.id));

    const newFriends = currentFriends.filter(f => !lastIds.has(f.id));
    const removedFriends = lastList.filter(f => !currentIds.has(f.id));

    // Обновляем время последнего появления для текущих друзей
    const now = Date.now();
    currentFriends.forEach(f => {
      friendLastOnline[f.id] = now;
    });

    if (newFriends.length > 0 || removedFriends.length > 0) {
      const timestamp = Date.now();
      const newLog = { date: timestamp, new: newFriends, removed: removedFriends };

      const updatedLogs = [newLog, ...logs].slice(0, 50);

      console.log('[Steam Friends Tracker] Изменения найдены:', newFriends.length, 'новых,', removedFriends.length, 'удалённых');

      chrome.storage.local.set({ 
        lastFriendsList: currentFriends, 
        logs: updatedLogs,
        friendLastOnline: friendLastOnline
      }, () => {
        chrome.runtime.sendMessage({ type: 'UPDATE_AVAILABLE' }).catch(() => {});
      });

      if (timestamp - lastNotificationTime > NOTIFICATION_COOLDOWN) {
        chrome.runtime.sendMessage({ type: 'SEND_NOTIFICATION', data: { newFriends, removedFriends } }).catch(() => {});
        lastNotificationTime = timestamp;
      }
    } else {
      console.log('[Steam Friends Tracker] Изменений нет, список не обновляем');
      // Всё равно обновляем время последнего появления
      chrome.storage.local.set({ friendLastOnline: friendLastOnline });
    }
  });
}

function isExactFriendsPage() {
  const path = window.location.pathname;
  // Точное совпадение: /friends в конце URL без дополнительных сегментов
  // Проверяем что URL заканчивается на /friends и после него нет ничего (кроме возможных query параметров)
  return /^\/(?:id\/[^/]+|profiles\/\d+)\/friends(?:\?.*)?$/.test(path);
}

function startTracking() {
  if (!isExactFriendsPage()) {
    console.log('[Steam Friends Tracker] Не страница друзей (' + window.location.pathname + '), отслеживание отключено');
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = null;
    return;
  }

  console.log('[Steam Friends Tracker] Запуск отслеживания на странице друзей');

  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(checkAndSave, 3000);
  
  // Первая проверка сразу после запуска
  setTimeout(checkAndSave, 500);

  const observer = new MutationObserver(() => {
    if (document.querySelectorAll('div.friend_block_v2').length > 0) {
        checkAndSave();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Запуск при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTracking);
} else {
    startTracking();
}

window.addEventListener('load', () => setTimeout(startTracking, 1000));

chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'MANUAL_CHECK') {
        checkAndSave();
        return true;
    }
});

// Отслеживаем переходы по страницам через History API (SPA навигация Steam)
window.addEventListener('popstate', () => {
  console.log('[Steam Friends Tracker] Навигация popstate, новая URL:', window.location.pathname);
  setTimeout(startTracking, 300);
});

// Перехватываем pushState для SPA-навигации Steam
const originalPushState = history.pushState;
history.pushState = function(...args) {
  originalPushState.apply(this, args);
  console.log('[Steam Friends Tracker] pushState вызван, новая URL:', window.location.pathname);
  setTimeout(startTracking, 300);
};

// Также перехватываем replaceState
const originalReplaceState = history.replaceState;
history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  console.log('[Steam Friends Tracker] replaceState вызван, новая URL:', window.location.pathname);
  setTimeout(startTracking, 300);
};

// ВАЖНО: При уходе со страницы друзей НЕ очищаем сохранённые данные
// Данные хранятся в chrome.storage.local и не зависят от текущей страницы
