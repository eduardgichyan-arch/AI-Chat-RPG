// stats.js - Robust Standalone Stats Page (Client-Side Persistence)

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    setInterval(loadStats, 10000);
});

async function loadStats() {
    try {
        // Get Local State
        const savedState = localStorage.getItem('gameState');
        const gameState = savedState ? JSON.parse(savedState) : {};

        const response = await fetch('/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameState: gameState })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        renderStats(data);

        const errorEl = document.getElementById('error-banner');
        if (errorEl) errorEl.style.display = 'none';

    } catch (error) {
        console.error('Stats Error:', error);
        showError(error.message);
    }
}

function renderStats(data) {
    setText('playerName', data.player.name);
    setText('playerLevel', data.player.level);
    setText('titleIcon', data.title.icon);
    setText('titleName', data.title.name);

    setText('totalXp', data.player.totalXpEarned);
    setText('currentXp', data.player.xp);
    setText('xpForNext', data.player.xpForNextLevel);

    const levelPct = (data.player.xp / 100) * 100;
    setWidth('levelProgressBar', levelPct);

    if (data.title.maxXpForCurrent === Infinity) {
        setText('titleProgress', 'Max Rank!');
        setWidth('titleProgressBar', 100);
    } else {
        const range = data.title.maxXpForCurrent - data.title.minXpForCurrent;
        const current = data.player.totalXpEarned - data.title.minXpForCurrent;
        const pct = Math.min(100, Math.max(0, (current / range) * 100));
        setText('titleProgress', `${data.title.xpToNextTitle} XP to next rank`);
        setWidth('titleProgressBar', pct);
    }

    setText('currentStreak', data.streaks.current);
    setText('longestStreak', data.streaks.longest);
    setText('totalDaysActive', data.statistics.totalDaysActive);

    const coreContainer = document.getElementById('coreStats');
    if (coreContainer && data.stats) {
        const s = data.stats;
        const items = [
            { l: 'Health', v: s.health },
            { l: 'Energy', v: s.energy },
            { l: 'Focus', v: s.focus },
            { l: 'Discipline', v: s.discipline },
            { l: 'Productivity', v: s.productivity },
            { l: 'Consistency', v: s.consistency }
        ];

        coreContainer.innerHTML = items.map(i => `
            <div class="glass-panel" style="padding: 15px; border-radius: 12px; text-align: center;">
                <div style="font-size: 12px; margin-bottom: 5px; opacity: 0.7;">${i.l}</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--primary-color);">${i.v}</div>
                <div class="progress-container" style="height: 4px; margin-top: 8px;">
                    <div class="progress-bar" style="width: ${i.v}%"></div>
                </div>
            </div>
        `).join('');
    }

    const badgesContainer = document.getElementById('badgesContainer');
    if (badgesContainer && data.badges.earned) {
        if (data.badges.earned.length === 0) {
            badgesContainer.innerHTML = '<div style="opacity:0.5; width:100%; text-align:center;">No badges yet</div>';
        } else {
            badgesContainer.innerHTML = data.badges.earned.map(b => `
                <div title="${b.name}" style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; text-align: center; cursor: help; min-width: 40px;">
                    <div style="font-size: 24px;">${b.name.split(' ')[0]}</div>
                </div>
            `).join('');
        }
    }
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
function setWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${pct}%`;
}
function showError(msg) {
    let banner = document.getElementById('error-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'error-banner';
        banner.style.cssText = 'position:fixed; top:0; left:0; right:0; background:#ff3366; color:white; padding:10px; text-align:center; z-index:9999;';
        document.body.prepend(banner);
    }
    banner.style.display = 'block';
    banner.textContent = `⚠️ Connection Lost: ${msg}. Retrying...`;
}
