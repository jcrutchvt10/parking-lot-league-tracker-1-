export type UserRole = 'admin' | 'player';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  handicap: number;
  totalRounds: number;
  avgScore: number;
  totalPutts: number;
  totalFairways: number;
  totalGIRs: number;
  points: number;
  matchesWon: number;
  matchesTied: number;
  matchesLost: number;
}

export interface HoleScore {
  holeNumber: number;
  par: number;
  score: number;
  putts: number;
  fairwayHit: boolean;
  gir: boolean;
}

export interface Round {
  id: string;
  playerUid: string;
  playerName: string;
  date: string; // ISO string
  roundNum: number;
  totalScore: number;
  points: number;
  matchResult: 'win' | 'tie' | 'loss';
  scores: HoleScore[];
  stats: {
    putts: number;
    fairways: number;
    girs: number;
    birdies: number;
    eagles: number;
    pars: number;
    bogeys: number;
    doubles: number;
    others: number;
  };
}

export interface Standing {
  uid: string;
  displayName: string;
  points: number;
  matchesWon: number;
  handicap: number;
  avgScore: number;
  totalPutts: number;
  totalFairways: number;
  totalGIRs: number;
}
