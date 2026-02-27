// Форматирование даты
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString();
    const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) return `Сегодня, ${time}`;
    if (isYesterday) return `Вчера, ${time}`;
    return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}, ${time}`;
}

// Создание карточки друга
function createFriendItem(friend, type) {
    const statusClass = type === 'new' ? 'status-new' : 'status-removed';
    const statusText = type === 'new' ? '+ Новый' : '− Удалён';
    const statusIcon = type === 'new' ? '↑' : '↓';
    
    let avatar = friend.avatar;
    if (!avatar || !avatar.startsWith('http')) {
        avatar = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';
    }
    
    return `
        <div class="friend-item">
            <img class="friend-avatar" 
                 src="${avatar}" 
                 alt="${friend.name}"
                 onerror="this.src='https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'"
                 loading="lazy">
            <div class="friend-info">
                <a class="friend-name" 
                   href="${friend.profileUrl}" 
                   target="_blank" 
                   title="Открыть профиль: ${friend.name}">
                    ${escapeHtml(friend.name)}
                </a>
            </div>
            <span class="friend-status ${statusClass}">
                ${statusIcon} ${statusText}
            </span>
        </div>
    `;
}

// Защита от XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Рендеринг истории
function renderLogs() {
    const container = document.getElementById('logs-container');
    
    chrome.storage.local.get(['logs'], (result) => {
        const logs = result.logs || [];
        
        if (!logs.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div>История изменений пуста</div>
                    <div style="margin-top:8px;color:var(--steam-gray);font-size:12px">
                        Зайдите на страницу друзей в Steam,<br>
                        чтобы начать отслеживание
                    </div>
                </div>
            `;
            return;
        }
        
        let html = '';
        let totalAdded = 0;
        let totalRemoved = 0;
        
        logs.forEach((log, index) => {
            const added = log.new?.length || 0;
            const removed = log.removed?.length || 0;
            if (added === 0 && removed === 0) return;
            
            totalAdded += added;
            totalRemoved += removed;
            
            html += `<div class="log-entry" style="animation-delay: ${index * 0.05}s">
                <div class="log-header">
                    <span>📅 ${formatDate(log.date)}</span>
                    <div class="changes-count">
                        ${added > 0 ? `<span class="added">+${added}</span>` : ''}
                        ${removed > 0 ? `<span class="removed">−${removed}</span>` : ''}
                    </div>
                </div>
                <div class="friends-list">`;
            
            if (log.new?.length) {
                log.new.forEach(friend => {
                    html += createFriendItem(friend, 'new');
                });
            }
            if (log.removed?.length) {
                log.removed.forEach(friend => {
                    html += createFriendItem(friend, 'removed');
                });
            }
            
            html += `</div></div>`;
        });
        
        // Добавляем статистику в начало
        if (totalAdded > 0 || totalRemoved > 0) {
            html = `
                <div style="padding:10px 12px;margin-bottom:8px;background:rgba(26,35,44,0.6);border-radius:6px;border:1px solid rgba(102,192,244,0.2);display:flex;gap:16px;justify-content:center;font-size:12px">
                    ${totalAdded > 0 ? `<span style="color:var(--steam-green)">↑ +${totalAdded} новых</span>` : ''}
                    ${totalRemoved > 0 ? `<span style="color:var(--steam-red)">↓ −${totalRemoved} удалено</span>` : ''}
                </div>
            ` + html;
        }
        
        container.innerHTML = html;
    });
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    renderLogs();
    
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const container = document.getElementById('logs-container');
            container.innerHTML = '<div class="loading">Обновление</div>';
            setTimeout(renderLogs, 300);
        });
    }
    
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Очистить всю историю отслеживания?\n\nЭто действие нельзя отменить.')) {
                chrome.storage.local.clear(() => {
                    renderLogs();
                });
            }
        });
    }
    
    // Автообновление при сообщении от content.js
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === 'UPDATE_AVAILABLE') {
            renderLogs();
        }
    });
});
// 🔘 Кнопка ручной проверки (если добавишь кнопку в popup.html)
function forceCheck() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'MANUAL_CHECK' });
        }
    });
}

// Если хочешь добавить кнопку в popup.html, раскомментируй:
// document.getElementById('force-check-btn')?.addEventListener('click', forceCheck);