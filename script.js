// script.js - Chat Interface Logic (Client-Side Persistence)

document.addEventListener('DOMContentLoaded', () => {
    const chat = document.getElementById("chat");
    const input = document.getElementById("message-input");
    const sendBtn = document.getElementById("sendBtn");

    const elLevel = document.getElementById('level');
    const elXp = document.getElementById('xp');
    const elFocus = document.getElementById('focus');

    input.focus();

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    handleInitialLoad();

    // Expose helper to get ANY current state for other scripts
    window.getGameState = () => {
        const s = localStorage.getItem('gameState');
        return s ? JSON.parse(s) : null;
    };

    // Expose fetcher for UI updates
    window.fetchGameStatus = handleInitialLoad;

    async function handleInitialLoad() {
        const navEntry = performance.getEntriesByType("navigation")[0];
        let savedState = localStorage.getItem('gameState');

        // Check reset
        if (navEntry && navEntry.type === 'reload') {
            // Optional: You can choose to NOT reset on reload now since we want persistence.
            // But if user wants a "reset", they should use a button.
            // For now, let's KEEP persistence even on reload, as that's the Vercel fix.
            console.log("➡️ Reload detected: Keeping saved state.");
        }

        if (savedState) {
            const parsed = JSON.parse(savedState);
            updateStatsDisplay(parsed.player);
            return;
        }

        // checking for default
        try {
            const res = await fetch('/game-status');
            const data = await res.json();
            localStorage.setItem('gameState', JSON.stringify(data));
            updateStatsDisplay(data.player);
        } catch (e) {
            console.error("Error init:", e);
        }
    }

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, true);
        input.value = "";
        sendBtn.disabled = true;
        input.style.height = 'auto';
        addLoading();

        // Get CURRENT state from local storage
        let currentState = localStorage.getItem('gameState');
        if (!currentState) {
            // Fallback
            currentState = JSON.stringify({});
        }

        try {
            const res = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    gameState: JSON.parse(currentState) // Send State
                })
            });

            removeLoading();
            const data = await res.json();

            if (data.candidates?.length) {
                const reply = data.candidates[0].content.parts[0].text;
                addMessage(reply, false, true);
            } else if (data.error) {
                addMessage(`⚠️ Error: ${data.error}`, false);
            }

            // Update & SAVE new state
            if (data.gameState) {
                localStorage.setItem('gameState', JSON.stringify(data.gameState));
                updateStatsDisplay(data.gameState.player);
            }

        } catch (e) {
            removeLoading();
            addMessage(`❌ Connection Error: ${e.message}`, false);
        } finally {
            sendBtn.disabled = false;
            input.focus();
        }
    }

    function addMessage(text, isUser, animate = false) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${isUser ? "user" : "ai"}`;
        const formattedText = text.replace(/\n/g, '<br>');
        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        messageDiv.appendChild(bubble);
        chat.appendChild(messageDiv);

        if (animate && !isUser) {
            typeWriter(bubble, formattedText);
        } else {
            bubble.innerHTML = formattedText;
            scrollToBottom();
        }
        if (!animate) scrollToBottom();
    }

    function typeWriter(element, text) {
        let i = 0;
        const speed = 15;
        function type() {
            if (i < text.length) {
                if (text.charAt(i) === '<') {
                    const tagEnd = text.indexOf('>', i);
                    if (tagEnd !== -1) {
                        element.innerHTML += text.substring(i, tagEnd + 1);
                        i = tagEnd + 1;
                    } else { element.innerHTML += text.charAt(i); i++; }
                } else { element.innerHTML += text.charAt(i); i++; }
                scrollToBottom();
                setTimeout(type, speed);
            }
        }
        type();
    }

    function addLoading() {
        const messageDiv = document.createElement("div");
        messageDiv.className = "message ai";
        messageDiv.id = "loading-indicator";
        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.innerHTML = '<span class="loading-spinner"></span> Thinking...';
        messageDiv.appendChild(bubble);
        chat.appendChild(messageDiv);
        scrollToBottom();
    }

    function removeLoading() {
        const loading = document.getElementById("loading-indicator");
        if (loading) loading.remove();
    }

    function scrollToBottom() {
        chat.scrollTop = chat.scrollHeight;
    }

    function updateStatsDisplay(player) {
        if (elLevel) elLevel.textContent = player.level;
        if (elXp) elXp.textContent = `${player.xp}/100`;
        if (elFocus) elFocus.textContent = player.stats.focus;
        updateSidebar(player);
    }

    function updateSidebar(player) {
        const elType = document.getElementById('sidebar-type');
        const elDesc = document.getElementById('sidebar-desc');
        const elLevel = document.getElementById('sidebar-level');
        const elAvatar = document.getElementById('avatar-initials');

        if (elAvatar) {
            const initial = (player.personalityType && player.personalityType !== "Unknown")
                ? player.personalityType[0]
                : (player.name ? player.name[0] : "A");
            elAvatar.textContent = initial;
        }

        if (elType) elType.textContent = player.personalityType || 'UNKNOWN';
        if (elLevel) elLevel.textContent = player.level;

        const descMap = {
            'INTJ': 'The Architect', 'INTP': 'The Logician', 'ENTJ': 'The Commander', 'ENTP': 'The Debater',
            'INFJ': 'The Advocate', 'INFP': 'The Mediator', 'ENFJ': 'The Protagonist', 'ENFP': 'The Campaigner',
            'ISTJ': 'The Logistician', 'ISFJ': 'The Defender', 'ESTJ': 'The Executive', 'ESFJ': 'The Consul',
            'ISTP': 'The Virtuoso', 'ISFP': 'The Adventurer', 'ESTP': 'The Entrepreneur', 'ESFP': 'The Entertainer'
        };
        if (elDesc) elDesc.textContent = descMap[player.personalityType] || 'The Novice';

        const elStats = document.getElementById('sidebar-stats');
        if (elStats) {
            const stats = [
                { l: 'Creativity', v: player.stats.creativity, c: 'bar-creativity' },
                { l: 'Focus', v: player.stats.focus, c: 'bar-focus' },
                { l: 'Energy', v: player.stats.energy, c: 'bar-energy' },
                { l: 'Kindness', v: player.stats.kindness, c: 'bar-kindness' },
                { l: 'Intelligence', v: player.stats.awareness, c: 'bar-intelligence' }
            ];

            elStats.innerHTML = stats.map(s => `
                <div class="stat-item">
                    <div class="stat-header"><span>${s.l}</span><span>${s.v || 50}</span></div>
                    <div class="stat-bar-bg"><div class="stat-bar-fill ${s.c}" style="width: ${s.v || 50}%"></div></div>
                </div>
            `).join('');
        }
    }
});
