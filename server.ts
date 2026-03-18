import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

const dbPath = path.join(process.cwd(), 'db.json');
const UPCOMING_SEASON_YEAR = 2026;
const UPCOMING_SEASON_FIRST_ROUND_DATE = '2026-05-20T07:30:00.000Z';
const COURSE_COORDS = { latitude: 41.448082, longitude: -81.838485 };
let lastKnownForecast: any = null;
const PREMATCH_COMMENTS = [
  'Set the tone early and own the opening tee shot.',
  'Matchup of the week: steady putts will decide this one.',
  'Plenty of birdie chances if you stay below the hole.',
  'Stay patient through the middle stretch and strike late.',
  'Fairways first, fireworks second.',
  'This one has comeback potential written all over it.',
  'Pressure match. Commit to every swing.',
  'Two grinders, one point race. Expect a battle.',
  'Play smart, avoid big numbers, and cash in on par 5s.',
  'Momentum match: the first won hole may set the pace.'
];

const COURSE_INFO = {
  name: 'Big Met Golf Course',
  location: '4811 Valley Parkway, Fairview Park, OH 44126',
  reservation: 'Rocky River Reservation',
  openedYear: 1926,
  centennialYear: 2026,
  roundsSinceOpen: '6,000,000+',
  highlights: [
    "Believed to be Ohio's most played golf course.",
    'Moderate length layout with gentle rolling hills and nine sand bunkers.',
    'Original design by Stanley Thompson with major renovations and modern irrigation.'
  ],
  amenities: [
    'Golf club rental',
    'Power and hand cart rental',
    'Putting greens',
    'Lessons and clinics',
    'Private event space'
  ],
  paceOfPlay: {
    nineHoles: '2 hours 15 minutes',
    eighteenHoles: '4 hours 30 minutes'
  },
  links: {
    coursePage: 'https://www.clevelandmetroparks.com/golf/courses/big-met-golf-course',
    teeTimes: 'https://www.chronogolf.com/club/big-met-golf-course',
    waitlist: 'https://clevelandmetroparks.noteefy.app/',
    scorecard: 'https://www.clevelandmetroparks.com/assets/media/Cleveland_Metroparks/Golf/Big-Met-2025.pdf',
    directions: 'https://maps.google.com/maps?q=41.44808200,-81.83848500'
  }
};

const DEFAULT_LEAGUE_CONFIG = {
  leagueName: "F n' G's",
  courseName: 'Big Met Golf Course',
  scoring: {
    holeWinPoints: 1,
    holeTiePoints: 0.5,
    matchWinPoints: 2,
    matchTiePoints: 1,
    avgBonusPoints: 1,
    rollingAverageRounds: 8,
    maxOverParPerHoleRegularSeason: 3
  },
  nineConfig: {
    front: {
      label: 'Front 9',
      holeNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      pars: [4, 4, 4, 3, 5, 4, 5, 3, 4],
      handicapRanks: [3, 6, 8, 4, 5, 9, 2, 7, 1]
    },
    back: {
      label: 'Back 9',
      holeNumbers: [10, 11, 12, 13, 14, 15, 16, 17, 18],
      pars: [3, 4, 3, 5, 4, 4, 5, 4, 4],
      handicapRanks: [3, 6, 4, 8, 1, 2, 7, 9, 5]
    },
    weeklyDefaultPattern: 'alternate'
  }
};

function readDb() {
  const data = fs.readFileSync(dbPath, 'utf-8');
  return JSON.parse(data);
}

function writeDb(data: any) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function roundToNearestHalf(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 2) / 2;
}

function describeWeatherCode(code: number) {
  const map: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with light hail',
    99: 'Thunderstorm with heavy hail'
  };
  return map[code] || 'Unknown conditions';
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Forecast unavailable (${response.status})`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePointPrecision() {
  const db = readDb();
  let changed = false;

  if (Array.isArray(db.rounds)) {
    db.rounds = db.rounds.map((round: any) => {
      const holePoints = roundToNearestHalf(round.holePoints || 0);
      const matchPoints = roundToNearestHalf(round.matchPoints || 0);
      const avgBonusPoints = roundToNearestHalf(round.avgBonusPoints || 0);
      const totalPoints = roundToNearestHalf(
        round.points ?? (holePoints + matchPoints + avgBonusPoints)
      );

      const next = {
        ...round,
        holePoints,
        matchPoints,
        avgBonusPoints,
        points: totalPoints
      };

      if (
        next.holePoints !== round.holePoints ||
        next.matchPoints !== round.matchPoints ||
        next.avgBonusPoints !== round.avgBonusPoints ||
        next.points !== round.points
      ) {
        changed = true;
      }

      return next;
    });
  }

  if (Array.isArray(db.users)) {
    db.users = db.users.map((user: any) => {
      const points = roundToNearestHalf(user.points || 0);
      if (points !== user.points) changed = true;
      return {
        ...user,
        points
      };
    });
  }

  if (changed) {
    writeDb(db);
    console.log('Normalized point precision to nearest 0.5');
  }
}

function ensureLeagueConfig() {
  const db = readDb();
  if (db.leagueConfig) return;
  db.leagueConfig = DEFAULT_LEAGUE_CONFIG;
  writeDb(db);
}

function getSessionUser(req: any) {
  if (!req.session?.userId) return null;
  const db = readDb();
  return db.users.find((u: any) => u.uid === req.session.userId) || null;
}

function buildRoundRobinWeeks(users: any[]) {
  const normalized = [...users]
    .map((u) => ({ uid: u.uid, displayName: u.displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  if (normalized.length === 0) return [];

  const hasBye = normalized.length % 2 === 1;
  const rotation = hasBye
    ? [...normalized, { uid: '__bye__', displayName: 'BYE' }]
    : [...normalized];

  const rounds = rotation.length - 1;
  const half = rotation.length / 2;
  const weeks: any[] = [];
  let arr = [...rotation];

  for (let roundIdx = 0; roundIdx < rounds; roundIdx += 1) {
    const weekMatchups = [];
    for (let i = 0; i < half; i += 1) {
      const a = arr[i];
      const b = arr[arr.length - 1 - i];
      const comment = PREMATCH_COMMENTS[(roundIdx * half + i) % PREMATCH_COMMENTS.length];
      weekMatchups.push({
        id: `w${roundIdx + 1}-${a.uid}-${b.uid}`,
        playerAUid: a.uid,
        playerAName: a.displayName,
        playerBUid: b.uid === '__bye__' ? null : b.uid,
        playerBName: b.displayName,
        status: a.uid === '__bye__' || b.uid === '__bye__' ? 'bye' : 'scheduled',
        comment
      });
    }

    weeks.push(weekMatchups.filter((m) => m.playerAUid !== '__bye__'));

    arr = [arr[0], arr[arr.length - 1], ...arr.slice(1, arr.length - 1)];
  }

  return weeks;
}

function buildPlayerInsights(db: any) {
  const rounds = Array.isArray(db.rounds) ? db.rounds : [];
  const byUser: Record<string, any[]> = {};

  for (const round of rounds) {
    if (!byUser[round.playerUid]) byUser[round.playerUid] = [];
    byUser[round.playerUid].push(round);
  }

  const insights: Record<string, any> = {};
  for (const user of db.users || []) {
    const userRounds = (byUser[user.uid] || []).slice().sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const totalRounds = userRounds.length;
    const scoreAvg = totalRounds
      ? userRounds.reduce((sum, r) => sum + Number(r.totalScore || 0), 0) / totalRounds
      : Number(user.avgScore || 0);
    const totalPutts = userRounds.reduce((sum, r) => sum + Number(r.stats?.putts || 0), 0);
    const totalFairways = userRounds.reduce((sum, r) => sum + Number(r.stats?.fairways || 0), 0);
    const totalGIRs = userRounds.reduce((sum, r) => sum + Number(r.stats?.girs || 0), 0);
    const recent = userRounds.slice(-3);
    const recentAvg = recent.length
      ? recent.reduce((sum, r) => sum + Number(r.totalScore || 0), 0) / recent.length
      : scoreAvg;

    insights[user.uid] = {
      uid: user.uid,
      displayName: user.displayName,
      totalRounds,
      scoreAvg,
      recentAvg,
      trendDelta: recentAvg - scoreAvg,
      puttsPerRound: totalRounds ? totalPutts / totalRounds : Number(user.totalPutts || 0) / Math.max(1, Number(user.totalRounds || 1)),
      fairwaysPerRound: totalRounds ? totalFairways / totalRounds : Number(user.totalFairways || 0) / Math.max(1, Number(user.totalRounds || 1)),
      girPerRound: totalRounds ? totalGIRs / totalRounds : Number(user.totalGIRs || 0) / Math.max(1, Number(user.totalRounds || 1)),
      pointsPerRound: Number(user.points || 0) / Math.max(1, Number(user.totalRounds || totalRounds || 1))
    };
  }

  return insights;
}

function buildIntelligentMatchupComment(a: any, b: any, insights: Record<string, any>, week: number, matchIndex: number) {
  if (!b || b.uid === '__bye__') {
    return `${a.displayName} gets the bye week. Treat it like a focused prep session and come out firing next round.`;
  }

  const ai = insights[a.uid] || {};
  const bi = insights[b.uid] || {};
  const comments: string[] = [];

  if (Number.isFinite(ai.scoreAvg) && Number.isFinite(bi.scoreAvg)) {
    const diff = Math.abs(ai.scoreAvg - bi.scoreAvg);
    if (diff <= 1.5) {
      comments.push('This is a razor-close scoring matchup. Every half-point hole matters.');
    } else if (ai.scoreAvg < bi.scoreAvg) {
      comments.push(`${a.displayName} has the lower scoring average edge, but ${b.displayName} can flip it with a hot start.`);
    } else {
      comments.push(`${b.displayName} holds the scoring-average advantage, so ${a.displayName} will want early pressure.`);
    }
  }

  if (Number.isFinite(ai.trendDelta) && Number.isFinite(bi.trendDelta)) {
    if (ai.trendDelta < -0.6 && bi.trendDelta > 0.6) {
      comments.push(`${a.displayName} is trending up lately while ${b.displayName} is hunting a bounce-back.`);
    } else if (bi.trendDelta < -0.6 && ai.trendDelta > 0.6) {
      comments.push(`${b.displayName} comes in with better recent momentum, so ${a.displayName} needs a clean card.`);
    }
  }

  if (Number.isFinite(ai.girPerRound) && Number.isFinite(bi.girPerRound)) {
    if (Math.abs(ai.girPerRound - bi.girPerRound) >= 1.5) {
      const girLeader = ai.girPerRound > bi.girPerRound ? a.displayName : b.displayName;
      comments.push(`${girLeader} has been finding more greens, making mid-range putts the likely separator.`);
    }
  }

  if (Number.isFinite(ai.puttsPerRound) && Number.isFinite(bi.puttsPerRound)) {
    if (Math.abs(ai.puttsPerRound - bi.puttsPerRound) >= 1) {
      const puttingEdge = ai.puttsPerRound < bi.puttsPerRound ? a.displayName : b.displayName;
      comments.push(`${puttingEdge} has the putting edge lately. Lag putting could decide late holes.`);
    }
  }

  if (comments.length === 0) {
    comments.push(PREMATCH_COMMENTS[(week + matchIndex) % PREMATCH_COMMENTS.length]);
  }

  return comments.slice(0, 2).join(' ');
}

function buildRoundOneMatchups(users: any[]) {
  const weeks = buildRoundRobinWeeks(users);
  const firstWeek = weeks[0] || [];
  return firstWeek.map((m: any) => ({
    id: `r1-${m.playerAUid}-${m.playerBUid || 'bye'}`,
    roundNum: 1,
    date: UPCOMING_SEASON_FIRST_ROUND_DATE,
    playerAUid: m.playerAUid,
    playerAName: m.playerAName,
    playerBUid: m.playerBUid,
    playerBName: m.playerBName,
    status: m.status
  }));
}

function buildYearHistory(db: any, year: number) {
  const yearRounds = (db.rounds || [])
    .filter((r: any) => new Date(r.date).getFullYear() === year)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const players: Record<string, any> = {};
  for (const user of db.users || []) {
    players[user.uid] = {
      uid: user.uid,
      displayName: user.displayName,
      points: 0,
      holePoints: 0,
      matchPoints: 0,
      avgBonusPoints: 0,
      wins: 0,
      ties: 0,
      losses: 0,
      avgScore: 0,
      totalRounds: 0,
      totalPutts: 0,
      totalFairways: 0,
      totalGIRs: 0,
      birdies: 0,
      eagles: 0,
      pars: 0,
      bogeys: 0,
      doubles: 0,
      others: 0,
      _scoreSum: 0
    };
  }

  for (const round of yearRounds) {
    if (!players[round.playerUid]) {
      players[round.playerUid] = {
        uid: round.playerUid,
        displayName: round.playerName,
        points: 0,
        holePoints: 0,
        matchPoints: 0,
        avgBonusPoints: 0,
        wins: 0,
        ties: 0,
        losses: 0,
        avgScore: 0,
        totalRounds: 0,
        totalPutts: 0,
        totalFairways: 0,
        totalGIRs: 0,
        birdies: 0,
        eagles: 0,
        pars: 0,
        bogeys: 0,
        doubles: 0,
        others: 0,
        _scoreSum: 0
      };
    }

    const p = players[round.playerUid];
    p.totalRounds += 1;
    p.points += Number(round.points || 0);
    p.holePoints += Number(round.holePoints || 0);
    p.matchPoints += Number(round.matchPoints || 0);
    p.avgBonusPoints += Number(round.avgBonusPoints || 0);
    p.totalPutts += Number(round.stats?.putts || 0);
    p.totalFairways += Number(round.stats?.fairways || 0);
    p.totalGIRs += Number(round.stats?.girs || 0);
    p.birdies += Number(round.stats?.birdies || 0);
    p.eagles += Number(round.stats?.eagles || 0);
    p.pars += Number(round.stats?.pars || 0);
    p.bogeys += Number(round.stats?.bogeys || 0);
    p.doubles += Number(round.stats?.doubles || 0);
    p.others += Number(round.stats?.others || 0);
    p._scoreSum += Number(round.totalScore || 0);

    if (round.matchResult === 'win') p.wins += 1;
    else if (round.matchResult === 'tie') p.ties += 1;
    else p.losses += 1;
  }

  const playerList = Object.values(players)
    .filter((p: any) => p.totalRounds > 0)
    .map((p: any) => ({
      ...p,
      points: roundToNearestHalf(p.points),
      holePoints: roundToNearestHalf(p.holePoints),
      matchPoints: roundToNearestHalf(p.matchPoints),
      avgBonusPoints: roundToNearestHalf(p.avgBonusPoints),
      avgScore: Number((p._scoreSum / p.totalRounds).toFixed(1))
    }))
    .map(({ _scoreSum, ...rest }: any) => rest);

  const standings = [...playerList].sort((a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.holePoints - a.holePoints;
  });

  return {
    year,
    standings,
    players: playerList,
    results: yearRounds
  };
}

function computeDefaultNineForWeek(week: number) {
  return week % 2 === 1 ? 'front' : 'back';
}

function buildSchedulePayload(db: any) {
  const roundRobinWeeks = buildRoundRobinWeeks(db.users || []);
  const weeks = roundRobinWeeks.length;
  const insights = buildPlayerInsights(db);
  const kickoffTs = new Date(UPCOMING_SEASON_FIRST_ROUND_DATE).getTime();
  const nowTs = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const computedWeek = nowTs < kickoffTs ? 1 : Math.floor((nowTs - kickoffTs) / weekMs) + 1;
  const upcomingWeek = Math.min(Math.max(1, computedWeek), Math.max(1, weeks));

  const scheduleWeeks = Array.from({ length: weeks }, (_, idx) => {
    const week = idx + 1;
    const defaultNine = computeDefaultNineForWeek(week);
    const matchups = (roundRobinWeeks[idx] || []).map((m: any, matchIndex: number) => {
      const a = { uid: m.playerAUid, displayName: m.playerAName };
      const b = m.playerBUid ? { uid: m.playerBUid, displayName: m.playerBName } : null;
      return {
        ...m,
        comment: buildIntelligentMatchupComment(a, b, insights, week, matchIndex)
      };
    });
    return {
      week,
      explicitDefault: 'unset',
      resolvedDefault: defaultNine,
      matchups
    };
  });

  const upcomingRoundDate = new Date(kickoffTs + ((upcomingWeek - 1) * weekMs)).toISOString();

  return {
    weeks: scheduleWeeks,
    upcomingWeek,
    upcomingRoundDate,
    upcomingMatchups: scheduleWeeks.find((w: any) => w.week === upcomingWeek)?.matchups || [],
    pattern: 'alternate',
    note: 'Season starts on front 9 and rotates each week. Matchups are generated in a round-robin format so pairings are balanced.'
  };
}

function resolveSeasonState(db: any) {
  const existing = db.season || {};
  const now = Date.now();
  const kickoffTs = new Date(UPCOMING_SEASON_FIRST_ROUND_DATE).getTime();
  const isActive = now >= kickoffTs;
  return {
    year: UPCOMING_SEASON_YEAR,
    startDate: isActive ? (existing.startDate || UPCOMING_SEASON_FIRST_ROUND_DATE) : null,
    status: isActive ? 'active' : 'not_started',
    firstRoundDate: UPCOMING_SEASON_FIRST_ROUND_DATE,
    firstRoundMatchups: buildRoundOneMatchups(db.users || []),
    weekNineDefaults: existing.weekNineDefaults || {}
  };
}

function buildDefaultSeason(users: any[], weekNineDefaults: Record<string, string> = {}) {
  return {
    year: UPCOMING_SEASON_YEAR,
    startDate: null,
    status: 'not_started',
    firstRoundDate: UPCOMING_SEASON_FIRST_ROUND_DATE,
    firstRoundMatchups: buildRoundOneMatchups(users),
    weekNineDefaults
  };
}

// Helper to hash passwords in db.json if they are not already hashed
function ensureHashedPasswords() {
  const db = readDb();
  let changed = false;
  db.users = db.users.map((user: any) => {
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(user.password);
    if (!isBcryptHash) {
      user.password = bcrypt.hashSync(user.password, 10);
      changed = true;
    }
    return user;
  });
  if (changed) {
    writeDb(db);
    console.log('Hashed passwords in db.json');
  }
}

async function startServer() {
  ensureHashedPasswords();
  ensureLeagueConfig();
  normalizePointPrecision();
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: 'golf-league-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // Set to true if using https
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Auth Middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  // API Routes
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDb();
    const user = db.users.find((u: any) => u.username === username);

    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.userId = user.uid;
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get('/api/me', (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }
    const db = readDb();
    const user = db.users.find((u: any) => u.uid === req.session.userId);
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.get('/api/users', requireAuth, (req, res) => {
    const db = readDb();
    const users = db.users.map(({ password: _, ...u }: any) => u);
    res.json(users);
  });

  app.get('/api/league-config', requireAuth, (req, res) => {
    const db = readDb();
    res.json(db.leagueConfig || DEFAULT_LEAGUE_CONFIG);
  });

  app.get('/api/course-conditions', requireAuth, async (req, res) => {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${COURSE_COORDS.latitude}&longitude=${COURSE_COORDS.longitude}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;

    try {
      let weatherData: any;
      try {
        weatherData = await fetchJsonWithTimeout(weatherUrl, 5000);
      } catch {
        // Retry once to smooth over brief network/API hiccups.
        weatherData = await fetchJsonWithTimeout(weatherUrl, 7000);
      }

      const current = weatherData?.current || {};
      const daily = weatherData?.daily || {};
      const forecast = {
        observedAt: current.time || null,
        condition: describeWeatherCode(Number(current.weather_code)),
        weatherCode: Number(current.weather_code),
        temperatureC: Number(current.temperature_2m),
        feelsLikeC: Number(current.apparent_temperature),
        windKph: Number(current.wind_speed_10m),
        gustKph: Number(current.wind_gusts_10m),
        precipitationMm: Number(current.precipitation || 0),
        todayHighC: Number(daily.temperature_2m_max?.[0]),
        todayLowC: Number(daily.temperature_2m_min?.[0]),
        precipChancePct: Number(daily.precipitation_probability_max?.[0] || 0)
      };

      if (
        !Number.isFinite(forecast.temperatureC) ||
        !Number.isFinite(forecast.todayHighC) ||
        !Number.isFinite(forecast.todayLowC)
      ) {
        throw new Error('Forecast payload was incomplete');
      }

      lastKnownForecast = forecast;

      res.json({
        course: COURSE_INFO,
        forecast,
        forecastStale: false
      });
    } catch (error: any) {
      if (lastKnownForecast) {
        return res.json({
          course: COURSE_INFO,
          forecast: lastKnownForecast,
          forecastStale: true,
          forecastError: `Live refresh failed, showing last known forecast. ${error?.message || ''}`.trim()
        });
      }

      res.json({
        course: COURSE_INFO,
        forecast: null,
        forecastError: error?.message || 'Unable to load forecast'
      });
    }
  });

  app.get('/api/season', requireAuth, (req, res) => {
    const db = readDb();
    const season = resolveSeasonState(db);
    db.season = season;
    writeDb(db);
    res.json(season);
  });

  const kickoffSeason = (req: any, res: any) => {
    const authUser = getSessionUser(req);
    if (!authUser || authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const db = readDb();
    const firstRoundMatchups = buildRoundOneMatchups(db.users);

    db.users = db.users.map((u: any) => ({
      ...u,
      points: 0,
      totalRounds: 0,
      avgScore: 0,
      totalPutts: 0,
      totalFairways: 0,
      totalGIRs: 0,
      matchesWon: 0,
      matchesTied: 0,
      matchesLost: 0
    }));

    db.season = {
      year: UPCOMING_SEASON_YEAR,
      startDate: new Date().toISOString(),
      status: 'active',
      firstRoundDate: UPCOMING_SEASON_FIRST_ROUND_DATE,
      firstRoundMatchups,
      weekNineDefaults: {}
    };

    writeDb(db);
    res.json(db.season);
  };

  app.post('/api/season/kickoff', requireAuth, kickoffSeason);
  app.post('/api/season/kickoff-2026', requireAuth, kickoffSeason);

  app.get('/api/rounds', requireAuth, (req, res) => {
    const db = readDb();
    res.json(db.rounds);
  });

  app.get('/api/history/years', requireAuth, (req, res) => {
    const db = readDb();
    const years = Array.from(new Set((db.rounds || []).map((r: any) => new Date(r.date).getFullYear())))
      .sort((a: any, b: any) => b - a);
    res.json(years);
  });

  app.get('/api/schedule', requireAuth, (req, res) => {
    const db = readDb();
    res.json(buildSchedulePayload(db));
  });

  app.post('/api/schedule/week-default', requireAuth, (req, res) => {
    const authUser = getSessionUser(req);
    if (!authUser || authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const db = readDb();
    db.season = resolveSeasonState(db);
    writeDb(db);
    res.json(buildSchedulePayload(db));
  });

  app.get('/api/history/:year', requireAuth, (req, res) => {
    const db = readDb();
    const year = Number(req.params.year);
    if (!Number.isFinite(year)) {
      return res.status(400).json({ error: 'Invalid year' });
    }
    res.json(buildYearHistory(db, year));
  });

  app.post('/api/rounds', requireAuth, (req, res) => {
    const db = readDb();
    const leagueConfig = db.leagueConfig || DEFAULT_LEAGUE_CONFIG;
    const holePoints = roundToNearestHalf(req.body.holePoints || 0);
    const matchPoints = roundToNearestHalf(
      req.body.matchPoints ??
      (req.body.matchResult === 'win'
        ? leagueConfig.scoring.matchWinPoints
        : req.body.matchResult === 'tie'
          ? leagueConfig.scoring.matchTiePoints
          : 0)
    );
    const avgBonusPoints = roundToNearestHalf(req.body.avgBonusPoints || 0);
    const newRound = {
      ...req.body,
      holePoints,
      matchPoints,
      avgBonusPoints,
      points: roundToNearestHalf(holePoints + matchPoints + avgBonusPoints),
      id: Math.random().toString(36).substring(2, 11),
      date: new Date().toISOString()
    };
    db.rounds.push(newRound);
    
    // Update user stats
    const user = db.users.find((u: any) => u.uid === newRound.playerUid);
    if (user) {
      user.totalRounds += 1;
      user.points = roundToNearestHalf(Number(user.points || 0) + newRound.points);
      user.totalPutts += newRound.stats.putts;
      user.totalFairways += newRound.stats.fairways;
      user.totalGIRs += newRound.stats.girs;
      
      const rollingRounds = Number(leagueConfig?.scoring?.rollingAverageRounds || 8);
      const userRecentRounds = db.rounds
        .filter((r: any) => r.playerUid === user.uid)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, rollingRounds);

      const totalScore = userRecentRounds.reduce((acc: number, r: any) => acc + r.totalScore, 0);
      user.avgScore = userRecentRounds.length
        ? parseFloat((totalScore / userRecentRounds.length).toFixed(1))
        : 0;
      
      // Simple handicap calculation: (Avg Score - Par 36) * 0.96
      // We'll just use a simplified version for now
      user.handicap = parseFloat(((user.avgScore - 36) * 0.96).toFixed(1));
      if (user.handicap < 0) user.handicap = 0;
      
      if (newRound.matchResult === 'win') user.matchesWon += 1;
      else if (newRound.matchResult === 'tie') user.matchesTied += 1;
      else user.matchesLost += 1;
    }

    writeDb(db);
    res.status(201).json(newRound);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
