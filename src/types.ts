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
  ninePlayed?: 'front' | 'back';
  totalScore: number;
  points: number;
  holePoints?: number;
  matchPoints?: number;
  avgBonusPoints?: number;
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
  holePoints?: number;
  matchPoints?: number;
  avgBonusPoints?: number;
  matchesWon: number;
  handicap: number;
  avgScore: number;
  totalPutts: number;
  totalFairways: number;
  totalGIRs: number;
}

export interface Matchup {
  id: string;
  roundNum: number;
  date: string;
  playerAUid: string;
  playerAName: string;
  playerBUid: string | null;
  playerBName: string;
  status: 'scheduled' | 'bye';
}

export interface SeasonInfo {
  year: number;
  startDate: string | null;
  status: 'not_started' | 'active';
  firstRoundDate: string | null;
  firstRoundMatchups: Matchup[];
}

export interface LeagueConfig {
  leagueName: string;
  courseName: string;
  scoring: {
    holeWinPoints: number;
    holeTiePoints: number;
    matchWinPoints: number;
    matchTiePoints: number;
    avgBonusPoints: number;
    rollingAverageRounds: number;
    maxOverParPerHoleRegularSeason: number;
  };
  nineConfig: {
    front: {
      label: string;
      holeNumbers: number[];
      pars: number[];
      handicapRanks: number[];
    };
    back: {
      label: string;
      holeNumbers: number[];
      pars: number[];
      handicapRanks: number[];
    };
    weeklyDefaultPattern: 'alternate';
  };
}

export interface HistoryStanding {
  uid: string;
  displayName: string;
  points: number;
  holePoints: number;
  matchPoints: number;
  avgBonusPoints: number;
  wins: number;
  ties: number;
  losses: number;
  avgScore: number;
  totalRounds: number;
  totalPutts: number;
  totalFairways: number;
  totalGIRs: number;
  birdies: number;
  eagles: number;
  pars: number;
  bogeys: number;
  doubles: number;
  others: number;
}

export interface HistoryData {
  year: number;
  standings: HistoryStanding[];
  players: HistoryStanding[];
  results: Round[];
}

export interface ScheduleWeek {
  week: number;
  explicitDefault: 'front' | 'back' | 'unset';
  resolvedDefault: 'front' | 'back';
  matchups: {
    id: string;
    playerAUid: string;
    playerAName: string;
    playerBUid: string | null;
    playerBName: string;
    status: 'scheduled' | 'bye';
    comment: string;
  }[];
}

export interface ScheduleData {
  weeks: ScheduleWeek[];
  upcomingWeek: number;
  upcomingRoundDate: string;
  upcomingMatchups: ScheduleWeek['matchups'];
  pattern: 'alternate';
  note: string;
}

export interface HandicapWindowRow {
  uid: string;
  displayName: string;
  roundsUsed: number[];
  average: number;
}

export interface CourseInfo {
  name: string;
  location: string;
  reservation: string;
  openedYear: number;
  centennialYear: number;
  roundsSinceOpen: string;
  highlights: string[];
  amenities: string[];
  paceOfPlay: {
    nineHoles: string;
    eighteenHoles: string;
  };
  links: {
    coursePage: string;
    teeTimes: string;
    waitlist: string;
    scorecard: string;
    directions: string;
  };
}

export interface CourseForecast {
  observedAt: string | null;
  condition: string;
  weatherCode: number;
  temperatureC: number;
  feelsLikeC: number;
  windKph: number;
  gustKph: number;
  precipitationMm: number;
  todayHighC: number;
  todayLowC: number;
  precipChancePct: number;
}

export interface CourseConditionsResponse {
  course: CourseInfo;
  forecast: CourseForecast | null;
  forecastError?: string;
}
