// 🎮 Steam Friends Tracker - Optimized Version
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
  if (currentFriends.length === 0) return; // Ждем, пока страница прогрузится
  
  chrome.storage.local.get(['lastFriendsList', 'logs'], (result) => {
    const lastList = result.lastFriendsList || [];
    const logs = result.logs || [];
    
    // Если это самый первый запуск — просто сохраняем текущий список без записи в лог
    if (lastList.length === 0) {
      chrome.storage.local.set({ lastFriendsList: currentFriends, logs: [] });
      return;
    }

    const lastIds = new Set(lastList.map(f => f.id));
    const currentIds = new Set(currentFriends.map(f => f.id));
    
    const newFriends = currentFriends.filter(f => !lastIds.has(f.id));
    const removedFriends = lastList.filter(f => !currentIds.has(f.id));
    
    if (newFriends.length > 0 || removedFriends.length > 0) {
      const timestamp = Date.now();
      const newLog = { date: timestamp, new: newFriends, removed: removedFriends };
      
      const updatedLogs = [newLog, ...logs].slice(0, 50);
      
      chrome.storage.local.set({ lastFriendsList: currentFriends, logs: updatedLogs }, () => {
        // Оповещаем popup, если он открыт
        chrome.runtime.sendMessage({ type: 'UPDATE_AVAILABLE' }).catch(() => {});
      });

      // Уведомление в Windows/macOS
      if (timestamp - lastNotificationTime > NOTIFICATION_COOLDOWN) {
        chrome.runtime.sendMessage({ type: 'SEND_NOTIFICATION', data: { newFriends, removedFriends } }).catch(() => {});
        lastNotificationTime = timestamp;
      }
    }
  });
}

function startTracking() {
  const currentUrl = window.location.href;
  const isFriendsPage = currentUrl.includes('/friends') && 
                       !currentUrl.includes('/pending') && 
                       !currentUrl.includes('/outgoing') && 
                       !currentUrl.includes('/blocked');
                       
  if (!isFriendsPage) return;
  
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(checkAndSave, 3000); // Проверка каждые 3 секунды
  
  const observer = new MutationObserver(() => {
    if (document.querySelectorAll('div.friend_block_v2').length > 0) {
        checkAndSave();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Запуск
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTracking);
} else {
    startTracking();
}

window.addEventListener('load', () => setTimeout(startTracking, 1000));

chrome.runtime.onMessage.addListener((msg) => { 
    if (msg?.type === 'MANUAL_CHECK') checkAndSave(); 
});