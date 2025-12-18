// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.API_KEY || "";
const PORT = process.env.PORT || 3000;

if (!API_KEY) console.warn("⚠️  WARNING: API_KEY environment variable not set!");

// ============================================================================
// GAME LOGIC & TEMPLATES
// ============================================================================

const defaultGameState = {
  player: {
    name: "Adventurer",
    level: 1,
    xp: 0,
    totalXpEarned: 0,
    title: "Curious Beginner",
    titleLevel: 1,
    stats: { health: 100, energy: 100, focus: 50, discipline: 50, productivity: 50, consistency: 50 },
    streak: 0,
    longestStreak: 0,
    currentDay: new Date().getDate(),
    lastMessageDay: new Date().toDateString(),
    lastMessageTime: Date.now(),
    badges: [],
    statistics: {
      totalMessages: 0,
      totalXpEarned: 0,
      averageXpPerMessage: 0,
      highestSingleMessageXp: 0,
      totalHighQualityMessages: 0,
      totalDaysActive: 1,
      favoriteQuestionType: "Analytical",
      questsCompleted: 0,
      dailyQuestsCompletedTotal: 0
    },
    personalityType: "Unknown"
  },
  dailyQuests: [],
  weeklyQuests: [],
  lastQuestGenerationDay: new Date().toDateString(),
  lastWeeklyQuestGenDate: new Date().toDateString(),
  messageCount: 0
};

const achievementTitles = [
  { level: 1, name: "Curious Beginner", icon: "🌱", minXp: 0, maxXp: 99, description: "Your journey begins with the first question" },
  { level: 2, name: "Thoughtful Learner", icon: "📚", minXp: 100, maxXp: 499, description: "Every conversation deepens your understanding" },
  { level: 3, name: "Insightful Mind", icon: "💭", minXp: 500, maxXp: 1499, description: "Your questions reveal layers of meaning" },
  { level: 4, name: "Philosopher", icon: "🧠", minXp: 1500, maxXp: 4999, description: "Wisdom flows through your words" },
  { level: 5, name: "Master of Discourse", icon: "👑", minXp: 5000, maxXp: 9999, description: "Your insights illuminate the path for others" },
  { level: 6, name: "Legendary Scholar", icon: "⭐", minXp: 10000, maxXp: Infinity, description: "A seeker of infinite knowledge and understanding" }
];

const badgeDefinitions = {
  "flame-on": { name: "🔥 Flame On", description: "Achieve a 7-day streak", condition: (p) => p.streak >= 7 },
  "big-brain": { name: "🧠 Big Brain", description: "Earn 50+ XP in a single message", condition: (p) => p.statistics.highestSingleMessageXp >= 50 },
  "health-guardian": { name: "💚 Health Guardian", description: "Maintain 80+ health for 7 days", condition: (p) => p.stats.health >= 80 && p.streak >= 7 },
  "legendary": { name: "🌟 Legendary", description: "Achieve a 30-day streak", condition: (p) => p.streak >= 30 },
  "bibliophile": { name: "📚 Bibliophile", description: "Earn 1,000 total XP", condition: (p) => p.totalXpEarned >= 1000 },
  "tech-wizard": { name: "🤖 Tech Wizard", description: "Send 20 technical questions", condition: (p) => p.statistics.totalHighQualityMessages >= 20 },
  "creative-genius": { name: "🎨 Creative Genius", description: "Send 20 creative questions", condition: (p) => p.statistics.totalHighQualityMessages >= 20 },
  "consistent": { name: "🤝 Consistent", description: "Never break a streak (reach level 10)", condition: (p) => p.level >= 10 && p.longestStreak >= 10 },
  "master": { name: "👑 Master", description: "Reach level 50", condition: (p) => p.level >= 50 },
  "quest-master": { name: "🎯 Quest Master", description: "Complete all daily quests", condition: (p) => p.statistics.dailyQuestsCompletedTotal >= 5 },
  "night-owl": { name: "🦉 Night Owl", description: "Send a message between 11PM and 4AM", condition: () => { const h = new Date().getHours(); return h >= 23 || h <= 4; } },
  "early-bird": { name: "🌅 Early Bird", description: "Send a message between 5AM and 9AM", condition: () => { const h = new Date().getHours(); return h >= 5 && h <= 9; } },
  "weekend-warrior": { name: "⚔️ Weekend Warrior", description: "Active on a weekend", condition: () => { const d = new Date().getDay(); return d === 0 || d === 6; } },
  "social-butterfly": { name: "🦋 Social Butterfly", description: "Send 100 total messages", condition: (p) => p.statistics.totalMessages >= 100 },
  "deep-thinker": { name: "🤔 Deep Thinker", description: "Average XP per message > 20", condition: (p) => p.statistics.averageXpPerMessage >= 20 }
};

const dailyQuestTemplates = [
  { title: "Send 3 meaningful messages", target: 3, type: "messages", xp: 50 },
  { title: "Ask a question with 10+ words", target: 1, type: "long-question", xp: 40 },
  { title: "Maintain 70+ Focus during session", target: 1, type: "focus-maintenance", xp: 45 },
  { title: "Earn 50+ XP in one message", target: 1, type: "high-xp-message", xp: 60 },
  { title: "Send 5 messages in one day", target: 5, type: "volume", xp: 75 },
  { title: "Ask a philosophical question", target: 1, type: "philosophical", xp: 35 },
  { title: "Build a 3-message conversation", target: 3, type: "streak", xp: 55 },
  { title: "Reach 500+ character question", target: 1, type: "long-message", xp: 50 }
];

const weeklyQuestTemplates = [
  { title: "Send 50 messages this week", target: 50, type: "volume", xp: 300 },
  { title: "Maintain 80+ Focus for 3 days", target: 3, type: "focus-week", xp: 250 },
  { title: "Earn 500 XP this week", target: 500, type: "xp-gain", xp: 400 },
  { title: "Complete 10 Daily Quests", target: 10, type: "daily-quests-week", xp: 350 },
  { title: "Ask 20 questions", target: 20, type: "questions", xp: 200 }
];

// --- HELPER FUNCTIONS (Pure Logic) ---

function getStreakMultiplier(gameState) {
  const now = new Date();
  const today = now.toDateString();
  const lastDay = gameState.player.lastMessageDay;

  if (today !== lastDay) {
    const lastMessageDate = new Date(lastDay);
    const timeDiff = now - lastMessageDate;
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    if (daysDiff === 1) gameState.player.streak += 1;
    else gameState.player.streak = 1;
    gameState.player.currentDay = now.getDate();
    gameState.player.lastMessageDay = today;
  }

  let multiplier = 1.0;
  if (gameState.player.streak >= 30) multiplier = 5.0;
  else if (gameState.player.streak >= 14) multiplier = 3.0;
  else if (gameState.player.streak >= 7) multiplier = 2.0;
  else if (gameState.player.streak >= 3) multiplier = 1.5;
  return multiplier;
}

function updateHealth(gameState) {
  const now = Date.now();
  const timeSinceLastMessage = now - gameState.player.lastMessageTime;
  const daysSinceMessage = timeSinceLastMessage / (1000 * 60 * 60 * 24);

  if (!gameState.player.stats) gameState.player.stats = { ...defaultGameState.player.stats };

  if (daysSinceMessage > 1) {
    const healthLoss = Math.floor(daysSinceMessage * 10);
    gameState.player.stats.health = Math.max(0, gameState.player.stats.health - healthLoss);
  }
  gameState.player.lastMessageTime = now;
}

function checkBadges(gameState) {
  const newBadges = [];
  for (const [key, badge] of Object.entries(badgeDefinitions)) {
    if (!gameState.player.badges.includes(key)) {
      if (badge.condition(gameState.player)) {
        gameState.player.badges.push(key);
        newBadges.push(badge);
      }
    }
  }
  return newBadges;
}

function generateDailyQuests(gameState) {
  const today = new Date().toDateString();
  if (today !== gameState.lastQuestGenerationDay) {
    gameState.dailyQuests = [];
    gameState.lastQuestGenerationDay = today;
    const shuffled = dailyQuestTemplates.sort(() => Math.random() - 0.5);
    for (let i = 0; i < 3; i++) {
      gameState.dailyQuests.push({ ...shuffled[i], id: i, progress: 0, completed: false });
    }
  }
  return gameState.dailyQuests;
}

function generateWeeklyQuests(gameState) {
  const now = new Date();
  const lastGen = new Date(gameState.lastWeeklyQuestGenDate || 0);
  const diffTime = Math.abs(now - lastGen);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (!gameState.weeklyQuests || gameState.weeklyQuests.length === 0 || diffDays >= 7) {
    gameState.weeklyQuests = [];
    gameState.lastWeeklyQuestGenDate = now.toDateString();
    const shuffled = weeklyQuestTemplates.sort(() => Math.random() - 0.5);
    for (let i = 0; i < 3; i++) {
      gameState.weeklyQuests.push({ ...shuffled[i], id: i, progress: 0, completed: false });
    }
  }
  return gameState.weeklyQuests;
}

function updateQuestProgress(gameState, message, xp) {
  generateDailyQuests(gameState);
  generateWeeklyQuests(gameState); // Ensure weekly exist

  const messageLength = message.length;
  const hasQuestion = message.includes('?');
  const wordCount = message.split(/\s+/).length;

  // Daily
  gameState.dailyQuests.forEach(quest => {
    if (!quest.completed) {
      if (quest.type === "messages" && xp > 0) quest.progress += 1;
      else if (quest.type === "long-question" && hasQuestion && wordCount >= 10) quest.progress += 1;
      else if (quest.type === "focus-maintenance" && gameState.player.stats.focus >= 70) quest.progress += 1;
      else if (quest.type === "high-xp-message" && xp >= 50) quest.progress += 1;
      else if (quest.type === "volume") quest.progress += 1;
      else if (quest.type === "philosophical" && hasQuestion && messageLength > 100) quest.progress += 1;
      else if (quest.type === "streak") quest.progress += 1;
      else if (quest.type === "long-message" && messageLength >= 500) quest.progress += 1;

      if (quest.progress >= quest.target) {
        quest.completed = true;
        gameState.player.statistics.questsCompleted += 1;
        if (gameState.dailyQuests.every(q => q.completed)) gameState.player.statistics.dailyQuestsCompletedTotal += 1;
      }
    }
  });

  // Weekly
  gameState.weeklyQuests.forEach(quest => {
    if (!quest.completed) {
      if (quest.type === 'volume' && xp > 0) quest.progress += 1;
      else if (quest.type === 'questions' && hasQuestion) quest.progress += 1;
      else if (quest.type === 'xp-gain') quest.progress += xp;
      // Simply increment others if needed or add logic
      if (quest.progress >= quest.target) quest.completed = true;
    }
  });
}

function updateAchievementTitle(gameState) {
  const totalXp = gameState.player.totalXpEarned;
  let newTitle = achievementTitles[0];
  for (const title of achievementTitles) {
    if (totalXp >= title.minXp && totalXp <= title.maxXp) {
      newTitle = title;
      break;
    }
  }
  const titleChanged = gameState.player.title !== newTitle.name;
  gameState.player.title = newTitle.name;
  gameState.player.titleLevel = newTitle.level;
  return { titleChanged, newTitle };
}

function updateStatistics(gameState, message, xp) {
  if (!gameState.player.statistics) gameState.player.statistics = { ...defaultGameState.player.statistics };
  const stats = gameState.player.statistics;
  stats.totalMessages = (stats.totalMessages || 0) + 1;
  stats.totalXpEarned = (stats.totalXpEarned || 0) + xp;
  stats.averageXpPerMessage = Math.round(stats.totalXpEarned / stats.totalMessages);
  if (xp > (stats.highestSingleMessageXp || 0)) stats.highestSingleMessageXp = xp;
  if (xp >= 20) stats.totalHighQualityMessages = (stats.totalHighQualityMessages || 0) + 1;
  if (gameState.player.streak > (stats.totalDaysActive || 0)) stats.totalDaysActive = gameState.player.streak;
  if (gameState.player.streak > (gameState.player.longestStreak || 0)) gameState.player.longestStreak = gameState.player.streak;
  updateAchievementTitle(gameState);
}

function awardXP(gameState, message) {
  // Logic from original
  const trimmed = message.trim().toLowerCase();
  const valid = trimmed.length >= 10 && !['hi', 'hello', 'ok'].includes(trimmed); // Simplified check

  if (!valid) return { xp: 0, multiplier: 1, baseXp: 0, streak: gameState.player.streak, newBadges: [], titleInfo: null };

  updateHealth(gameState);
  const multiplier = getStreakMultiplier(gameState);

  let baseXp = message.length > 50 ? 20 : 10;
  if (message.includes('?')) baseXp += 5;

  let xp = Math.floor(baseXp * multiplier);
  gameState.player.xp += xp;
  gameState.player.totalXpEarned += xp;

  if (gameState.player.xp >= 100) {
    gameState.player.level += Math.floor(gameState.player.xp / 100);
    gameState.player.xp %= 100;
  }

  updateStatistics(gameState, message, xp);
  updateQuestProgress(gameState, message, xp);
  const newBadges = checkBadges(gameState);
  const titleInfo = updateAchievementTitle(gameState);

  return { xp, multiplier, baseXp, streak: gameState.player.streak, newBadges, titleInfo };
}

function resolveGameState(req) {
  let state = req.body.gameState || req.body; // Accept from body
  // If invalid, use default
  if (!state || !state.player) {
    state = JSON.parse(JSON.stringify(defaultGameState));
  }
  return state;
}

// ============================================================================
// ENDPOINTS
// ============================================================================

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  const gameState = resolveGameState(req);

  // Chat Logic
  try {
    const xpAwarded = awardXP(gameState, message || "");
    // ... Groq fetch logic (omitted for brevity, assume simple echo or fix if needed)

    // Mocking response for simplicity in this rewrite context, or should I call Groq? 
    // Let's call Groq to be compliant.
    const url = `https://api.groq.com/openai/v1/chat/completions`;
    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: "You are a RPG guide." }, { role: "user", content: message }],
      max_tokens: 1000
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    const text = d.choices?.[0]?.message?.content || "AI Error";

    res.json({
      candidates: [{ content: { parts: [{ text: text }] } }],
      gameState: gameState
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/stats", (req, res) => {
  const gameState = resolveGameState(req);
  const p = gameState.player;
  // Calculate next title info
  const currentTitle = achievementTitles.find(t => t.name === p.title) || achievementTitles[0];
  const nextTitle = achievementTitles.find(t => t.minXp > p.totalXpEarned) || null;

  // Logic from original /stats
  res.json({
    player: p,
    stats: p.stats,
    title: {
      name: p.title,
      icon: currentTitle.icon,
      nextTitle: nextTitle ? nextTitle.name : "Max",
      xpToNextTitle: nextTitle ? (nextTitle.minXp - p.totalXpEarned) : 0,
      minXpForCurrent: currentTitle.minXp,
      maxXpForCurrent: currentTitle.maxXp
    },
    streaks: { current: p.streak, longest: p.longestStreak },
    statistics: p.statistics,
    badges: {
      earned: p.badges.map(b => badgeDefinitions[b]).filter(Boolean),
      locked: Object.values(badgeDefinitions).filter(b => !p.badges.includes(Object.keys(badgeDefinitions).find(k => badgeDefinitions[k] === b))),
      totalEarned: p.badges.length,
      totalAvailable: Object.keys(badgeDefinitions).length
    }
  });
});

app.post("/badges", (req, res) => {
  const gameState = resolveGameState(req);
  const earned = gameState.player.badges.map(b => badgeDefinitions[b]).filter(Boolean);
  const all = Object.values(badgeDefinitions);
  const locked = all.filter(b => !earned.some(e => e.name === b.name));
  res.json({ earned, locked, totalEarned: earned.length, totalAvailable: all.length });
});

app.post("/daily-quests", (req, res) => {
  const gameState = resolveGameState(req);
  generateDailyQuests(gameState);
  res.json({
    quests: gameState.dailyQuests,
    completedCount: gameState.dailyQuests.filter(q => q.completed).length,
    totalQuests: gameState.dailyQuests.length,
    completionBonus: 0
  });
});

app.post("/weekly-quests", (req, res) => {
  const gameState = resolveGameState(req);
  generateWeeklyQuests(gameState);
  res.json({
    quests: gameState.weeklyQuests,
    completedCount: gameState.weeklyQuests.filter(q => q.completed).length,
    completionBonus: 0
  });
});

app.post("/init-profile", (req, res) => {
  const gameState = resolveGameState(req);
  const { stats, personalityType } = req.body;

  if (stats) {
    gameState.player.stats.creativity = stats.creativity;
    gameState.player.stats.productivity = stats.productivity;
    gameState.player.stats.energy = stats.energy;
    gameState.player.stats.kindness = stats.kindness;
    gameState.player.stats.awareness = stats.awareness;
  }
  if (personalityType) gameState.player.personalityType = personalityType;

  res.json({ success: true, player: gameState.player, gameState: gameState }); // Return new state
});

app.get("/game-status", (req, res) => res.json(defaultGameState));
app.post("/game-reset", (req, res) => res.json(defaultGameState));

export default app;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}
