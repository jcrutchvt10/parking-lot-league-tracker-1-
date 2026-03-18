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

function readDb() {
  const data = fs.readFileSync(dbPath, 'utf-8');
  return JSON.parse(data);
}

function writeDb(data: any) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Helper to hash passwords in db.json if they are not already hashed
function ensureHashedPasswords() {
  const db = readDb();
  let changed = false;
  db.users = db.users.map((user: any) => {
    if (!user.password.startsWith('$2a$')) {
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
  const app = express();
  const PORT = 3000;

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

  app.get('/api/rounds', requireAuth, (req, res) => {
    const db = readDb();
    res.json(db.rounds);
  });

  app.post('/api/rounds', requireAuth, (req, res) => {
    const db = readDb();
    const newRound = {
      ...req.body,
      id: Math.random().toString(36).substring(2, 11),
      date: new Date().toISOString()
    };
    db.rounds.push(newRound);
    
    // Update user stats
    const user = db.users.find((u: any) => u.uid === newRound.playerUid);
    if (user) {
      user.totalRounds += 1;
      user.points += newRound.points;
      user.totalPutts += newRound.stats.putts;
      user.totalFairways += newRound.stats.fairways;
      user.totalGIRs += newRound.stats.girs;
      
      const userRounds = db.rounds.filter((r: any) => r.playerUid === user.uid);
      const totalScore = userRounds.reduce((acc: number, r: any) => acc + r.totalScore, 0);
      user.avgScore = parseFloat((totalScore / userRounds.length).toFixed(1));
      
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
