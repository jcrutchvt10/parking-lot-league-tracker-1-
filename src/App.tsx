import React, { useState, useMemo, ReactNode, useEffect } from 'react';
import { 
  Trophy, 
  Users, 
  Calendar, 
  BarChart3, 
  ChevronRight, 
  Target, 
  Flag, 
  TrendingDown,
  LayoutDashboard,
  Settings as SettingsIcon,
  Search,
  Plus,
  LogOut,
  LogIn,
  Lock,
  User as UserIcon,
  Archive,
  TableProperties,
  ListChecks,
  CloudSun,
  Wind,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './components/AuthProvider';
import { Standing, HoleScore, Round, UserProfile, SeasonInfo, LeagueConfig, HistoryData, HistoryStanding, ScheduleData, HandicapWindowRow, CourseConditionsResponse } from './types';
import ScoreEntryModal from './components/ScoreEntryModal';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// Helper to calculate rolling average of last 5 rounds
const calculateRollingAverage = (rounds: Round[]) => {
  const last5 = rounds.slice(-5);
  if (last5.length === 0) return 0;
  return last5.reduce((a, b) => a + b.totalScore, 0) / last5.length;
};

const cToF = (c: number) => ((c * 9) / 5) + 32;

export default function App() {
  const { user, profile, loading, login, logout, refreshProfile } = useAuth();
  const isReadOnlyMode = profile?.role === 'viewer';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'standings' | 'players' | 'rounds' | 'schedule' | 'handicap-window' | 'history'>('dashboard');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [leagueConfig, setLeagueConfig] = useState<LeagueConfig | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyYears, setHistoryYears] = useState<number[]>([]);
  const [selectedHistoryYear, setSelectedHistoryYear] = useState<number | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [historySubTab, setHistorySubTab] = useState<'standings' | 'results' | 'players'>('standings');
  const [historySortKey, setHistorySortKey] = useState<keyof HistoryStanding>('points');
  const [historySortDir, setHistorySortDir] = useState<'asc' | 'desc'>('desc');
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [courseConditions, setCourseConditions] = useState<CourseConditionsResponse | null>(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [roundsRes, usersRes] = await Promise.all([
        fetch('/api/rounds'),
        fetch('/api/users')
      ]);
      if (roundsRes.ok) setRounds(await roundsRes.json());
      if (usersRes.ok) setAllUsers(await usersRes.json());

      const seasonRes = await fetch('/api/season');
      if (seasonRes.ok) {
        setSeason(await seasonRes.json());
      }

      const configRes = await fetch('/api/league-config');
      if (configRes.ok) {
        setLeagueConfig(await configRes.json());
      }

      const yearsRes = await fetch('/api/history/years');
      if (yearsRes.ok) {
        const years = await yearsRes.json();
        setHistoryYears(years);
      }

      const scheduleRes = await fetch('/api/schedule');
      if (scheduleRes.ok) {
        setScheduleData(await scheduleRes.json());
      }

      const conditionsRes = await fetch('/api/course-conditions');
      if (conditionsRes.ok) {
        setCourseConditions(await conditionsRes.json());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!selectedHistoryYear && historyYears.length > 0) {
      setSelectedHistoryYear(historyYears[0]);
    }
  }, [historyYears, selectedHistoryYear]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user || !selectedHistoryYear || activeTab !== 'history') return;
      try {
        const res = await fetch(`/api/history/${selectedHistoryYear}`);
        if (res.ok) {
          setHistoryData(await res.json());
        }
      } catch (error) {
        console.error('Error fetching history:', error);
      }
    };
    fetchHistory();
  }, [user, selectedHistoryYear, activeTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      await login(loginUsername, loginPassword);
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleSaveRound = async (roundData: Omit<Round, 'id'>) => {
    if (isReadOnlyMode) {
      return;
    }

    try {
      const response = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roundData),
      });

      if (response.ok) {
        setIsScoreModalOpen(false);
        fetchData();
        refreshProfile();
      }
    } catch (error) {
      console.error('Error saving round:', error);
    }
  };

  const standings: Standing[] = useMemo(() => {
    const pointsByUser = rounds.reduce((acc, r) => {
      const current = acc[r.playerUid] || { holePoints: 0, matchPoints: 0, avgBonusPoints: 0 };
      current.holePoints += Number(r.holePoints || 0);
      current.matchPoints += Number(r.matchPoints || 0);
      current.avgBonusPoints += Number(r.avgBonusPoints || 0);
      acc[r.playerUid] = current;
      return acc;
    }, {} as Record<string, { holePoints: number; matchPoints: number; avgBonusPoints: number }>);

    return allUsers.map(u => ({
      uid: u.uid,
      displayName: u.displayName,
      points: u.points,
      holePoints: pointsByUser[u.uid]?.holePoints || 0,
      matchPoints: pointsByUser[u.uid]?.matchPoints || 0,
      avgBonusPoints: pointsByUser[u.uid]?.avgBonusPoints || 0,
      matchesWon: u.matchesWon,
      handicap: u.handicap,
      avgScore: u.avgScore,
      totalPutts: u.totalPutts,
      totalFairways: u.totalFairways,
      totalGIRs: u.totalGIRs
    })).sort((a, b) => b.points - a.points);
  }, [allUsers, rounds]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers;
    const q = searchQuery.toLowerCase();
    return allUsers.filter(u => u.displayName.toLowerCase().includes(q));
  }, [allUsers, searchQuery]);

  const selectedPlayer = useMemo(() => 
    selectedPlayerId ? allUsers.find(u => u.uid === selectedPlayerId) : null
  , [selectedPlayerId, allUsers]);

  const sortedHistoryStandings = useMemo(() => {
    if (!historyData) return [];
    const list = [...historyData.standings];
    list.sort((a, b) => {
      const aVal = a[historySortKey];
      const bVal = b[historySortKey];
      const direction = historySortDir === 'asc' ? 1 : -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * direction;
      }
      return String(aVal).localeCompare(String(bVal)) * direction;
    });
    return list;
  }, [historyData, historySortKey, historySortDir]);

  const toggleHistorySort = (key: keyof HistoryStanding) => {
    if (historySortKey === key) {
      setHistorySortDir(historySortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setHistorySortKey(key);
      setHistorySortDir('desc');
    }
  };

  const setWeekDefault = async (week: number, ninePlayed: 'front' | 'back' | 'unset') => {
    try {
      const response = await fetch('/api/schedule/week-default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week, ninePlayed })
      });
      if (response.ok) {
        setScheduleData(await response.json());
      }
    } catch (error) {
      console.error('Error updating week default:', error);
    }
  };

  const handicapWindowRows: HandicapWindowRow[] = useMemo(() => {
    const rolling = Number(leagueConfig?.scoring?.rollingAverageRounds || 8);
    return allUsers.map((u) => {
      const used = rounds
        .filter((r) => r.playerUid === u.uid)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, rolling)
        .map((r) => r.totalScore);
      const avg = used.length ? Number((used.reduce((a, b) => a + b, 0) / used.length).toFixed(1)) : 0;
      return {
        uid: u.uid,
        displayName: u.displayName,
        roundsUsed: used,
        average: avg
      };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [allUsers, rounds, leagueConfig]);

  if (loading) {
    return (
      <div className="m3-app min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-700 font-bold animate-pulse">Loading League Data...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="m3-app min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="m3-card p-10 rounded-[2rem] max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-emerald-700 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-emerald-700/30 mx-auto mb-8">
            <Target size={40} />
          </div>
          <h1 className="text-3xl font-display font-bold mb-2">Parking Lot League</h1>
          <p className="text-gray-500 mb-8">Sign in to track your rounds and view standings.</p>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="m3-input w-full pl-12 pr-4 py-3"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="m3-input w-full pl-12 pr-4 py-3"
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>
            
            {loginError && (
              <p className="text-red-500 text-xs font-medium ml-1">{loginError}</p>
            )}

            <button 
              type="submit"
              className="m3-filled-button w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              Sign In
            </button>
          </form>
          
          <div className="mt-10 pt-10 border-t border-gray-50">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Official League Tracker</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const top8 = standings.slice(0, 8);
  const userRounds = rounds.filter(r => r.playerUid === user.uid);
  const latestRound = userRounds[0];

  return (
    <div className="m3-app min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <nav className="m3-nav w-full md:w-64 bg-white border-r border-gray-200 p-6 flex flex-col gap-8 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-700 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-700/20">
            <Target size={24} />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl leading-none">Parking Lot</h1>
            <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold">{leagueConfig?.leagueName || 'League Tracker'}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setSelectedPlayerId(null); }}
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
          />
          <NavItem 
            active={activeTab === 'standings'} 
            onClick={() => { setActiveTab('standings'); setSelectedPlayerId(null); }}
            icon={<Trophy size={20} />}
            label="Standings"
          />
          <NavItem 
            active={activeTab === 'players'} 
            onClick={() => { setActiveTab('players'); setSelectedPlayerId(null); }}
            icon={<Users size={20} />}
            label="Players"
          />
          <NavItem 
            active={activeTab === 'rounds'} 
            onClick={() => { setActiveTab('rounds'); setSelectedPlayerId(null); }}
            icon={<Calendar size={20} />}
            label="Rounds"
          />
          <NavItem 
            active={activeTab === 'schedule'} 
            onClick={() => { setActiveTab('schedule'); setSelectedPlayerId(null); }}
            icon={<TableProperties size={20} />}
            label="Schedule"
          />
          <NavItem 
            active={activeTab === 'handicap-window'} 
            onClick={() => { setActiveTab('handicap-window'); setSelectedPlayerId(null); }}
            icon={<ListChecks size={20} />}
            label="Handicap Window"
          />
          <NavItem 
            active={activeTab === 'history'} 
            onClick={() => { setActiveTab('history'); setSelectedPlayerId(null); }}
            icon={<Archive size={20} />}
            label="History"
          />
        </div>

        <div className="mt-auto pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <img 
              src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} 
              alt={profile?.displayName} 
              className="w-8 h-8 rounded-full border border-emerald-200"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{profile?.displayName}</p>
              <p className="text-[10px] text-gray-500 truncate capitalize">{profile?.role}</p>
            </div>
            {!isReadOnlyMode && (
              <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-display font-bold">
              {selectedPlayerId ? `Player: ${selectedPlayer?.displayName}` : (
                <>
                  {activeTab === 'dashboard' && "Season Overview"}
                  {activeTab === 'standings' && "League Standings"}
                  {activeTab === 'players' && "Player Directory"}
                  {activeTab === 'rounds' && "Tournament Rounds"}
                  {activeTab === 'schedule' && "Season Schedule"}
                  {activeTab === 'handicap-window' && "Rolling Handicap Window"}
                  {activeTab === 'history' && "Season History"}
                </>
              )}
            </h2>
            <p className="text-gray-500 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search players..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="m3-input pl-10 pr-4 py-2 rounded-full text-sm w-full md:w-64"
              />
            </div>
            {!isReadOnlyMode && (
              <button 
                onClick={() => setIsScoreModalOpen(true)}
                className="m3-filled-button px-6 py-2 rounded-full text-sm font-medium flex items-center gap-2"
              >
                <Plus size={16} />
                Add Round
              </button>
            )}
          </div>
        </header>

        {isReadOnlyMode && (
          <div className="m3-tonal-banner mb-6 rounded-2xl px-4 py-3 text-sm">
            Public view mode is enabled. Data can be viewed, but edits are disabled for everyone.
          </div>
        )}

        <AnimatePresence mode="wait">
          {selectedPlayerId ? (
            <motion.div
              key="player-detail"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <button 
                onClick={() => setSelectedPlayerId(null)}
                className="text-emerald-700 text-sm font-bold flex items-center gap-1 hover:underline mb-4"
              >
                ← Back to {activeTab}
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
                    <h3 className="font-bold mb-6">Score History</h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={rounds.filter(r => r.playerUid === selectedPlayerId).slice().reverse().map(r => ({ name: `R${r.roundNum}`, score: r.totalScore }))}>
                          <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#059669" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                          <YAxis domain={['dataMin - 5', 'dataMax + 5']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                          />
                          <Area type="monotone" dataKey="score" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {rounds.filter(r => r.playerUid === selectedPlayerId)[0] && (
                    <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="p-6 border-b border-gray-100">
                        <h3 className="font-bold">Latest Scorecard (R{rounds.filter(r => r.playerUid === selectedPlayerId)[0].roundNum})</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-center border-collapse">
                          <thead>
                            <tr className="bg-gray-50 text-[10px] font-bold uppercase text-gray-400">
                              <th className="px-4 py-3 border-r border-gray-100">Hole</th>
                              {[1,2,3,4,5,6,7,8,9].map(h => <th key={h} className="px-4 py-3 border-r border-gray-100">{h}</th>)}
                              <th className="px-4 py-3">OUT</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-gray-50">
                              <td className="px-4 py-4 font-bold text-xs border-r border-gray-100">Par</td>
                              {rounds.filter(r => r.playerUid === selectedPlayerId)[0].scores.map((h, i) => <td key={i} className="px-4 py-4 text-sm border-r border-gray-100">{h.par}</td>)}
                              <td className="px-4 py-4 font-bold text-sm bg-gray-50">
                                {rounds.filter(r => r.playerUid === selectedPlayerId)[0].scores.reduce((a, b) => a + b.par, 0)}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-4 py-4 font-bold text-xs border-r border-gray-100">Score</td>
                              {rounds.filter(r => r.playerUid === selectedPlayerId)[0].scores.map((h, i) => (
                                <td key={i} className={`px-4 py-4 text-sm border-r border-gray-100 ${h.score < h.par ? 'bg-emerald-50 text-emerald-700 font-bold' : ''}`}>
                                  {h.score}
                                </td>
                              ))}
                              <td className="px-4 py-4 font-bold text-sm bg-emerald-700 text-white">
                                {rounds.filter(r => r.playerUid === selectedPlayerId)[0].totalScore}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
                    <h3 className="font-bold mb-4">Season Stats</h3>
                    <div className="space-y-4">
                      <StatRow label="Total Points" value={selectedPlayer?.points} />
                      <StatRow label="Avg Score" value={selectedPlayer?.avgScore} />
                      <StatRow label="Total Putts" value={selectedPlayer?.totalPutts} />
                      <StatRow label="Fairways" value={selectedPlayer?.totalFairways} />
                      <StatRow label="GIRs" value={selectedPlayer?.totalGIRs} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-12"
                >
                  <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Season Status</p>
                        <h3 className="text-xl font-display font-bold text-gray-900">
                          {season?.year ? `Season ${season.year}` : 'Season Not Started'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Round 1 start: {season?.firstRoundDate ? new Date(season.firstRoundDate).toLocaleDateString() : 'Not scheduled'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Course: {leagueConfig?.courseName || 'Big Met Golf Course'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Season Status</p>
                        <p className="text-sm font-bold text-emerald-700">
                          {season?.status === 'active' ? 'Active (automatic)' : 'Waiting for kickoff date'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                      Season activation now happens automatically on {season?.firstRoundDate ? new Date(season.firstRoundDate).toLocaleDateString() : 'the first-round date'}. Dynamic rules still apply: hole points + match points + avg bonus, rolling {leagueConfig?.scoring.rollingAverageRounds || 8}-round average, and front/back nine profiles.
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                      <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[10px] font-bold uppercase tracking-widest">
                          <Flag size={12} />
                          Centennial Spotlight
                        </div>
                        <h3 className="text-2xl font-display font-bold leading-tight">
                          {courseConditions?.course?.name || 'Big Met Golf Course'}
                        </h3>
                        <p className="text-emerald-100 text-sm max-w-2xl">
                          Opened in {courseConditions?.course?.openedYear || 1926}, Big Met has hosted {courseConditions?.course?.roundsSinceOpen || 'millions'} rounds and remains one of Ohio's most-played public courses.
                        </p>
                        <div className="flex items-start gap-2 text-sm text-emerald-100">
                          <MapPin size={16} className="mt-0.5" />
                          <span>{courseConditions?.course?.location || '4811 Valley Parkway, Fairview Park, OH 44126'}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={courseConditions?.course?.links?.teeTimes || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-emerald-800 text-xs font-bold hover:bg-emerald-50"
                          >
                            Book Tee Time <ExternalLink size={14} />
                          </a>
                          <a
                            href={courseConditions?.course?.links?.scorecard || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-white text-xs font-bold hover:bg-white/25"
                          >
                            View Scorecard <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>

                      <div className="min-w-[280px] bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/15">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs uppercase tracking-widest font-bold text-emerald-100">Current Forecast</p>
                          <CloudSun size={18} className="text-amber-200" />
                        </div>

                        {courseConditions?.forecast ? (
                          <>
                            <p className="text-3xl font-bold leading-none">{Math.round(cToF(courseConditions.forecast.temperatureC))}F</p>
                            <p className="text-xs text-emerald-100 mt-1">{courseConditions.forecast.condition} • Feels like {Math.round(cToF(courseConditions.forecast.feelsLikeC))}F</p>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                              <div className="bg-black/15 rounded-xl px-3 py-2">
                                <p className="text-emerald-200 uppercase tracking-wider">High / Low</p>
                                <p className="font-bold">{Math.round(cToF(courseConditions.forecast.todayHighC))}F / {Math.round(cToF(courseConditions.forecast.todayLowC))}F</p>
                              </div>
                              <div className="bg-black/15 rounded-xl px-3 py-2">
                                <p className="text-emerald-200 uppercase tracking-wider">Precip</p>
                                <p className="font-bold">{Math.round(courseConditions.forecast.precipChancePct)}%</p>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-100">
                              <Wind size={14} />
                              <span>{Math.round(courseConditions.forecast.windKph)} kph wind, gusts {Math.round(courseConditions.forecast.gustKph)} kph</span>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-emerald-100">Forecast unavailable right now. {courseConditions?.forecastError || ''}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {(courseConditions?.course?.highlights || []).slice(0, 3).map((item, idx) => (
                        <div key={idx} className="bg-black/15 rounded-xl px-3 py-2 text-emerald-50">{item}</div>
                      ))}
                    </div>
                  </div>

                  {/* Personal Performance */}
                  <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-display font-bold">My Performance</h3>
                        <p className="text-sm text-gray-500">Your recent form and trends</p>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold">Current Handicap</p>
                          <p className="text-xl font-bold text-emerald-700">{profile?.handicap}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold">Season Points</p>
                          <p className="text-xl font-bold text-emerald-700">{profile?.points}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={rounds.filter(r => r.playerUid === user?.uid).slice().reverse().map(r => ({ name: `R${r.roundNum}`, score: r.totalScore, points: r.points }))}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <YAxis yAxisId="left" orientation="left" domain={['dataMin - 5', 'dataMax + 5']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Line yAxisId="left" type="monotone" dataKey="score" stroke="#059669" strokeWidth={3} dot={{ r: 4, fill: '#059669' }} activeDot={{ r: 6 }} />
                            <Line yAxisId="right" type="monotone" dataKey="points" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-6">
                        <div className="p-4 bg-gray-50 rounded-2xl">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Best Round</p>
                          <p className="text-2xl font-bold">{rounds.filter(r => r.playerUid === user?.uid).length > 0 ? Math.min(...rounds.filter(r => r.playerUid === user?.uid).map(r => r.totalScore)) : '---'}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-2xl">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Avg Putts</p>
                          <p className="text-2xl font-bold">{((profile?.totalPutts || 0) / (profile?.totalRounds || 1)).toFixed(1)}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-2xl">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">GIR %</p>
                          <p className="text-2xl font-bold">{Math.round(((profile?.totalGIRs || 0) / ((profile?.totalRounds || 1) * 9)) * 100)}%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Stats Grid */}
                  <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard 
                      label="League Leader" 
                      value={standings[0]?.displayName || "---"} 
                      subValue={`${standings[0]?.points || 0} Points`}
                      icon={<Trophy className="text-amber-500" size={24} />}
                    />
                    <StatCard 
                      label="Best Avg Score" 
                      value={standings.length > 0 ? standings.reduce((prev, curr) => prev.avgScore < curr.avgScore ? prev : curr).displayName : "---"} 
                      subValue={`${standings.length > 0 ? standings.reduce((prev, curr) => prev.avgScore < curr.avgScore ? prev : curr).avgScore : 0} Avg`}
                      icon={<TrendingDown className="text-emerald-500" size={24} />}
                    />
                    <StatCard 
                      label="GIR Leader" 
                      value={standings.length > 0 ? standings.reduce((prev, curr) => prev.totalGIRs > curr.totalGIRs ? prev : curr).displayName : "---"} 
                      subValue={`${standings.length > 0 ? standings.reduce((prev, curr) => prev.totalGIRs > curr.totalGIRs ? prev : curr).totalGIRs : 0} Total`}
                      icon={<Target className="text-blue-500" size={24} />}
                    />

                    {/* Main Standings Table (Mini) */}
                    <div className="md:col-span-3 bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold">Playoff Race (Top 8)</h3>
                        <button onClick={() => setActiveTab('standings')} className="text-emerald-700 text-xs font-bold flex items-center gap-1 hover:underline">
                          View Full <ChevronRight size={14} />
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                              <th className="px-6 py-4">Rank</th>
                              <th className="px-6 py-4">Player</th>
                              <th className="px-6 py-4">Points</th>
                              <th className="px-6 py-4">W-L-T</th>
                              <th className="px-6 py-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {top8.map((player, idx) => (
                              <tr key={player.uid} className="data-row cursor-pointer" onClick={() => setSelectedPlayerId(player.uid)}>
                                <td className="px-6 py-4 font-mono text-sm">{idx + 1}</td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">
                                      {player.displayName.substring(0, 2)}
                                    </div>
                                    <span className="font-bold text-sm">{player.displayName}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-bold text-emerald-700">{player.points}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{player.matchesWon} Wins</td>
                                <td className="px-6 py-4">
                                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                    In Playoffs
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Info */}
                  <div className="flex flex-col gap-8">
                    <div className="bg-emerald-900 text-white rounded-3xl p-8 relative overflow-hidden shadow-2xl shadow-emerald-900/20">
                      <div className="relative z-10">
                        <h3 className="text-emerald-200 text-xs font-bold uppercase tracking-widest mb-2">Round 1 Matchups</h3>
                        {season?.firstRoundMatchups?.length ? (
                          <div className="space-y-3 mb-6">
                            {season.firstRoundMatchups.slice(0, 3).map((m) => (
                              <div key={m.id} className="text-sm font-bold flex items-center justify-between bg-white/10 rounded-xl px-3 py-2">
                                <span>{m.playerAName}</span>
                                <span className="text-emerald-300 text-xs uppercase">vs</span>
                                <span>{m.playerBName}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-emerald-200 mb-6">No matchups generated yet.</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-emerald-200">
                          <Calendar size={14} />
                          <span>
                            {season?.firstRoundDate
                              ? `${new Date(season.firstRoundDate).toLocaleDateString()} • 7:30 AM`
                              : 'Round 1 date not set'}
                          </span>
                        </div>
                      </div>
                      {/* Decorative Circle */}
                      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-800 rounded-full blur-3xl opacity-50"></div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
                      <h3 className="font-bold mb-4 flex items-center gap-2">
                        <BarChart3 size={18} className="text-emerald-700" />
                        League Rules
                      </h3>
                      <ul className="space-y-4">
                        <RuleItem 
                          title="Match Points" 
                          desc="2 pts for Win, 1 pt for Tie" 
                        />
                        <RuleItem 
                          title="Handicap Point" 
                          desc="1 pt for Average or Below" 
                        />
                        <RuleItem 
                          title="Skill Bonuses" 
                          desc="0.25 pt Birdie, 1 pt Eagle" 
                        />
                        <RuleItem 
                          title="Rolling Average" 
                          desc="Based on last 5 rounds" 
                        />
                        <RuleItem 
                          title="Playoff Cut" 
                          desc="Top 8 players qualify" 
                        />
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

              {activeTab === 'standings' && (
                <motion.div 
                  key="standings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                          <th className="px-6 py-6">Rank</th>
                          <th className="px-6 py-6">Player</th>
                          <th className="px-6 py-6 text-center">Points</th>
                          <th className="px-6 py-6 text-center">Hole Pts</th>
                          <th className="px-6 py-6 text-center">Match Pts</th>
                          <th className="px-6 py-6 text-center">Avg Pts</th>
                          <th className="px-6 py-6 text-center">Avg Score</th>
                          <th className="px-6 py-6 text-center">Putts</th>
                          <th className="px-6 py-6 text-center">Fairways</th>
                          <th className="px-6 py-6 text-center">GIRs</th>
                          <th className="px-6 py-6 text-center">Matches Won</th>
                          <th className="px-6 py-6 text-center">HC Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {standings.map((player, idx) => (
                          <React.Fragment key={player.uid}>
                            {idx === 8 && (
                              <tr>
                                <td colSpan={12} className="px-6 py-2 bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-widest text-center">
                                  Playoff Cutoff - Top 8 Advance
                                </td>
                              </tr>
                            )}
                            <tr className="data-row cursor-pointer" onClick={() => setSelectedPlayerId(player.uid)}>
                              <td className="px-6 py-5 font-mono text-sm">
                                <span className={idx < 8 ? "text-emerald-600 font-bold" : "text-gray-400"}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <img 
                                    src={`https://ui-avatars.com/api/?name=${player.displayName}&background=random`} 
                                    alt={player.displayName} 
                                    className="w-10 h-10 rounded-xl border border-gray-100"
                                  />
                                  <div>
                                    <p className="font-bold text-sm">{player.displayName}</p>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-tighter">Season {season?.year || 2026}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-center font-bold text-emerald-700">{player.points}</td>
                              <td className="px-6 py-5 text-center text-sm text-gray-600">{player.holePoints}</td>
                              <td className="px-6 py-5 text-center text-sm text-gray-600">{player.matchPoints}</td>
                              <td className="px-6 py-5 text-center text-sm text-gray-600">{player.avgBonusPoints}</td>
                              <td className="px-6 py-5 text-center font-mono text-sm">{player.avgScore}</td>
                              <td className="px-6 py-5 text-center text-sm text-gray-600">{player.totalPutts}</td>
                              <td className="px-6 py-5 text-center text-sm text-gray-600">{player.totalFairways}</td>
                              <td className="px-6 py-5 text-center text-sm text-gray-600">{player.totalGIRs}</td>
                              <td className="px-6 py-5 text-center text-sm text-gray-600">{player.matchesWon}</td>
                              <td className="px-6 py-5 text-center text-sm text-gray-600">{player.handicap}</td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {activeTab === 'players' && (
                <motion.div 
                  key="players"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                >
                  {filteredUsers.map(player => {
                    const s = standings.find(st => st.uid === player.uid)!;
                    return (
                      <div 
                        key={player.uid} 
                        onClick={() => setSelectedPlayerId(player.uid)}
                        className="bg-white rounded-3xl border border-gray-200 p-6 hover:shadow-xl hover:shadow-emerald-900/5 transition-all group cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-6">
                          <img 
                            src={player.photoURL || `https://ui-avatars.com/api/?name=${player.displayName}&background=random`} 
                            alt={player.displayName} 
                            className="w-14 h-14 rounded-2xl border border-gray-100 group-hover:border-emerald-500 transition-colors"
                          />
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Points</p>
                            <p className="text-2xl font-display font-bold text-emerald-700">{s.points}</p>
                          </div>
                        </div>
                        <h4 className="text-lg font-bold mb-1">{player.displayName}</h4>
                        <p className="text-xs text-gray-500 mb-6">Handicap: {player.handicap}</p>
                        
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Avg Score</p>
                            <p className="font-mono font-bold">{s.avgScore}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Matches Won</p>
                            <p className="font-mono font-bold">{s.matchesWon}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}

              {activeTab === 'rounds' && (
                <motion.div 
                  key="rounds"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {rounds.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center">
                      <Calendar size={48} className="mx-auto text-gray-200 mb-4" />
                      <p className="text-gray-500 font-bold">No rounds recorded yet.</p>
                    </div>
                  ) : (
                    rounds.map(round => (
                      <div key={round.id} className="bg-white rounded-3xl border border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                            {round.totalScore}
                          </div>
                          <div>
                            <h4 className="font-bold">{round.playerName} - Round {round.roundNum}</h4>
                            <p className="text-xs text-gray-500">{new Date(round.date).toLocaleDateString()} • {(round.ninePlayed || 'front').toUpperCase()} 9 • {round.matchResult.toUpperCase()}</p>
                            <p className="text-[10px] text-gray-400">Hole {round.holePoints || 0} + Match {round.matchPoints || 0} + Avg {round.avgBonusPoints || 0} = {round.points}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Putts</p>
                            <p className="font-bold">{round.stats.putts}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400 uppercase font-bold">GIRs</p>
                            <p className="font-bold text-emerald-700">{round.stats.girs}</p>
                          </div>
                          <button className="p-2 rounded-full hover:bg-gray-50 text-gray-400">
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">History Seasons</p>
                      <p className="text-sm text-gray-600">Pick a completed year to view historical standings and results.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {historyYears.length === 0 && (
                        <span className="text-xs text-gray-500">No historical rounds found.</span>
                      )}
                      {historyYears.map((y) => (
                        <button
                          key={y}
                          onClick={() => setSelectedHistoryYear(y)}
                          className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${selectedHistoryYear === y ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {(['standings', 'results', 'players'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setHistorySubTab(tab)}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${historySubTab === tab ? 'bg-emerald-700 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {!historyData ? (
                    <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center text-gray-500 font-bold">Select a history season to load data.</div>
                  ) : (
                    <>
                      {historySubTab === 'standings' && (
                        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                                  <th className="px-6 py-4">Rank</th>
                                  <th className="px-6 py-4 cursor-pointer" onClick={() => toggleHistorySort('displayName')}>Player</th>
                                  <th className="px-6 py-4 text-center cursor-pointer" onClick={() => toggleHistorySort('points')}>Points</th>
                                  <th className="px-6 py-4 text-center cursor-pointer" onClick={() => toggleHistorySort('holePoints')}>Hole</th>
                                  <th className="px-6 py-4 text-center cursor-pointer" onClick={() => toggleHistorySort('matchPoints')}>Match</th>
                                  <th className="px-6 py-4 text-center cursor-pointer" onClick={() => toggleHistorySort('avgBonusPoints')}>Avg</th>
                                  <th className="px-6 py-4 text-center cursor-pointer" onClick={() => toggleHistorySort('birdies')}>Birdies</th>
                                  <th className="px-6 py-4 text-center cursor-pointer" onClick={() => toggleHistorySort('pars')}>Pars</th>
                                  <th className="px-6 py-4 text-center cursor-pointer" onClick={() => toggleHistorySort('bogeys')}>Bogeys</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {sortedHistoryStandings.map((player, idx) => (
                                  <React.Fragment key={player.uid}>
                                    {idx === 8 && (
                                      <tr>
                                        <td colSpan={9} className="px-6 py-2 bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-widest text-center">
                                          Playoff Cutoff - Top 8 Advance
                                        </td>
                                      </tr>
                                    )}
                                    <tr className="data-row">
                                      <td className="px-6 py-4 font-mono text-sm">{idx + 1}</td>
                                      <td className="px-6 py-4 font-bold text-sm">{player.displayName}</td>
                                      <td className="px-6 py-4 text-center font-bold text-emerald-700">{player.points}</td>
                                      <td className="px-6 py-4 text-center text-sm">{player.holePoints}</td>
                                      <td className="px-6 py-4 text-center text-sm">{player.matchPoints}</td>
                                      <td className="px-6 py-4 text-center text-sm">{player.avgBonusPoints}</td>
                                      <td className="px-6 py-4 text-center text-sm">{player.birdies}</td>
                                      <td className="px-6 py-4 text-center text-sm">{player.pars}</td>
                                      <td className="px-6 py-4 text-center text-sm">{player.bogeys}</td>
                                    </tr>
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {historySubTab === 'results' && (
                        <div className="space-y-4">
                          {historyData.results.length === 0 ? (
                            <div className="bg-white rounded-3xl border border-gray-200 p-10 text-center text-gray-500 font-bold">No results found for {historyData.year}.</div>
                          ) : historyData.results.map((round) => (
                            <div key={round.id} className="bg-white rounded-3xl border border-gray-200 p-6 flex items-center justify-between gap-4">
                              <div>
                                <p className="font-bold">{round.playerName} • Round {round.roundNum}</p>
                                <p className="text-xs text-gray-500">{new Date(round.date).toLocaleDateString()} • {(round.ninePlayed || 'front').toUpperCase()} 9 • {round.matchResult.toUpperCase()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-700">{round.points} pts</p>
                                <p className="text-xs text-gray-500">Score {round.totalScore}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {historySubTab === 'players' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {historyData.players.map((player) => (
                            <div key={player.uid} className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
                              <p className="font-bold text-lg mb-2">{player.displayName}</p>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <span className="text-gray-500">Rounds</span><span className="font-bold text-right">{player.totalRounds}</span>
                                <span className="text-gray-500">Avg Score</span><span className="font-bold text-right">{player.avgScore}</span>
                                <span className="text-gray-500">Putts</span><span className="font-bold text-right">{player.totalPutts}</span>
                                <span className="text-gray-500">Fairways</span><span className="font-bold text-right">{player.totalFairways}</span>
                                <span className="text-gray-500">GIRs</span><span className="font-bold text-right">{player.totalGIRs}</span>
                                <span className="text-gray-500">Eagles/Birdies</span><span className="font-bold text-right">{player.eagles}/{player.birdies}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {activeTab === 'schedule' && (
                <motion.div
                  key="schedule"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="bg-white rounded-3xl border border-gray-200 p-6 text-sm text-gray-600">
                    {scheduleData?.note || 'Round 1 starts on the front 9 and rotates every week. Matchups are pre-generated with comments.'}
                  </div>

                  {scheduleData && (
                    <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
                        <h3 className="font-bold text-lg">Upcoming Round Matchups (Week {scheduleData.upcomingWeek})</h3>
                        <span className="text-xs text-gray-500">Scheduled: {new Date(scheduleData.upcomingRoundDate).toLocaleDateString()}</span>
                      </div>
                      <div className="space-y-3">
                        {(scheduleData.upcomingMatchups || []).map((m) => (
                          <div key={m.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-bold text-emerald-900">{m.playerAName} vs {m.playerBName}</p>
                              <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase font-bold">{m.status}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{m.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(scheduleData?.weeks || []).map((w) => (
                      <div key={w.week} className="bg-white rounded-3xl border border-gray-200 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-bold">Week {w.week}</p>
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold uppercase">Default {w.resolvedDefault}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">Rotating format is locked: front/back alternates weekly from Week 1.</p>
                        <div className="space-y-2">
                          {(w.matchups || []).map((m) => (
                            <div key={m.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold text-gray-800">{m.playerAName} vs {m.playerBName}</p>
                                <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase font-bold">{m.status}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{m.comment}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'handicap-window' && (
                <motion.div
                  key="handicap-window"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm"
                >
                  <div className="p-6 border-b border-gray-100">
                    <p className="font-bold">Rolling {leagueConfig?.scoring?.rollingAverageRounds || 8} Rounds Used for Handicap</p>
                    <p className="text-xs text-gray-500 mt-1">Shows the exact gross scores currently used in each player’s handicap window.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                          <th className="px-6 py-4">Player</th>
                          <th className="px-6 py-4">Rounds Used</th>
                          <th className="px-6 py-4 text-center">Average</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {handicapWindowRows.map((row) => (
                          <tr key={row.uid}>
                            <td className="px-6 py-4 font-bold text-sm">{row.displayName}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {row.roundsUsed.length ? row.roundsUsed.join(', ') : 'No rounds yet'}
                            </td>
                            <td className="px-6 py-4 text-center font-mono text-sm">{row.average}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
        {!isReadOnlyMode && (
          <ScoreEntryModal 
            isOpen={isScoreModalOpen}
            onClose={() => setIsScoreModalOpen(false)}
            players={allUsers}
            currentUser={profile}
            leagueConfig={leagueConfig}
            weeklyDefaults={Object.fromEntries((scheduleData?.weeks || []).map((w) => [w.week, w.resolvedDefault])) as Record<number, 'front' | 'back'>}
            onSave={handleSaveRound}
          />
        )}
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
        active 
          ? 'bg-emerald-50 text-emerald-700 shadow-sm' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, subValue, icon }: { label: string, value: string, subValue: string, icon: ReactNode }) {
  return (
    <div className="m3-card p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{label}</p>
        {icon}
      </div>
      <h4 className="text-2xl font-display font-bold mb-1">{value}</h4>
      <p className="text-xs text-emerald-600 font-bold">{subValue}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function RuleItem({ title, desc }: { title: string, desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-700 mt-1.5 shrink-0" />
      <div>
        <p className="text-xs font-bold">{title}</p>
        <p className="text-[10px] text-gray-500">{desc}</p>
      </div>
    </li>
  );
}
