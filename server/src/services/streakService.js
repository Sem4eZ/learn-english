const db = require('../db/schema');

/**
 * Calculates current streak based on list of active dates (YYYY-MM-DD)
 * @param {string[]} dateStrings
 * @param {string} [referenceDateStr] Optional 'YYYY-MM-DD' reference date (defaults to today)
 * @returns {number}
 */
function calculateStreakFromDates(dateStrings, referenceDateStr) {
  if (!dateStrings || dateStrings.length === 0) return 1;

  const uniqueDates = Array.from(new Set(dateStrings.filter(Boolean))).sort().reverse();
  if (uniqueDates.length === 0) return 1;

  const todayStr = referenceDateStr || new Date().toISOString().slice(0, 10);
  const latestDate = uniqueDates[0];

  const dToday = new Date(todayStr + 'T00:00:00Z');
  const dLatest = new Date(latestDate + 'T00:00:00Z');
  const diffFromToday = Math.round((dToday.getTime() - dLatest.getTime()) / (1000 * 60 * 60 * 24));

  // If user hasn't had activity today or yesterday, streak is reset to 1
  if (diffFromToday > 1) {
    return 1;
  }

  let streak = 1;
  let cursorDate = dLatest;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i] + 'T00:00:00Z');
    const diffDays = Math.round((cursorDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak += 1;
      cursorDate = prevDate;
    } else if (diffDays === 0) {
      continue;
    } else {
      break;
    }
  }

  return Math.max(1, streak);
}

/**
 * Evaluates the user's active streak based on all activity in srs_reviews and user_answers
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function getUserStreak(userId) {
  if (!userId) return 1;

  try {
    const query = `
      SELECT DISTINCT d FROM (
        SELECT date(reviewed_at) as d FROM srs_reviews WHERE user_id = ?
        UNION
        SELECT date(answered_at) as d FROM user_answers WHERE user_id = ?
      )
      WHERE d IS NOT NULL
      ORDER BY d DESC
    `;
    const rows = await db.prepare(query).all(userId, userId);
    const dates = rows.map(r => r.d);

    const user = await db.prepare('SELECT streak, last_active_date FROM users WHERE id = ?').get(userId);
    if (user?.last_active_date) {
      dates.push(user.last_active_date.slice(0, 10));
    }

    return calculateStreakFromDates(dates);
  } catch (err) {
    console.error('Error calculating streak for user:', userId, err.message);
    return 1;
  }
}

/**
 * Records activity, updates XP, and computes the streak for the user.
 * @param {string} userId
 * @param {number} xpToAdd
 * @returns {Promise<{ xp: number, streak: number, lastActiveDate: string }>}
 */
async function recordUserActivity(userId, xpToAdd = 0) {
  if (!userId) return { xp: 0, streak: 1, lastActiveDate: '' };

  const todayStr = new Date().toISOString().slice(0, 10);
  const user = await db.prepare('SELECT id, xp, streak, last_active_date FROM users WHERE id = ?').get(userId);
  if (!user) return { xp: xpToAdd, streak: 1, lastActiveDate: todayStr };

  let streak = user.streak || 1;
  const lastActive = user.last_active_date ? user.last_active_date.slice(0, 10) : null;

  if (!lastActive) {
    streak = 1;
  } else if (lastActive === todayStr) {
    // Already active today; keep current streak
    streak = Math.max(1, user.streak || 1);
  } else {
    const dToday = new Date(todayStr + 'T00:00:00Z');
    const dLast = new Date(lastActive + 'T00:00:00Z');
    const diffDays = Math.round((dToday.getTime() - dLast.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day! Increment streak
      streak = (user.streak || 0) + 1;
    } else {
      // Check if there was activity yesterday recorded in srs_reviews or user_answers
      const yesterday = new Date(dToday.getTime() - 86400000).toISOString().slice(0, 10);
      const activityYesterday = await db.prepare(`
        SELECT 1 FROM (
          SELECT date(reviewed_at) as d FROM srs_reviews WHERE user_id = ? AND date(reviewed_at) = ?
          UNION
          SELECT date(answered_at) as d FROM user_answers WHERE user_id = ? AND date(answered_at) = ?
        ) LIMIT 1
      `).get(userId, yesterday, userId, yesterday);

      if (activityYesterday) {
        streak = (user.streak || 0) + 1;
      } else {
        streak = 1;
      }
    }
  }

  const newXp = (user.xp || 0) + xpToAdd;

  await db.prepare(`
    UPDATE users 
    SET xp = ?, streak = ?, last_active_date = ?
    WHERE id = ?
  `).run(newXp, streak, todayStr, userId);

  return {
    xp: newXp,
    streak,
    lastActiveDate: todayStr
  };
}

module.exports = {
  calculateStreakFromDates,
  getUserStreak,
  recordUserActivity
};
