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
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './components/AuthProvider';
import { Standing, HoleScore, Round, UserProfile } from './types';
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

export default function App() {
  const { user, profile, loading, isAdmin, login, logout, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'standings' | 'players' | 'rounds'>('dashboard');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const fetchData = async () => {
    if (!user) return;
    try {
      const [roundsRes, usersRes] = await Promise.all([
        fetch('/api/rounds'),
        fetch('/api/users')
      ]);
      if (roundsRes.ok) setRounds(await roundsRes.json());
      if (usersRes.ok) setAllUsers(await usersRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

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
    return allUsers.map(u => ({
      uid: u.uid,
      displayName: u.displayName,
      points: u.points,
      matchesWon: u.matchesWon,
      handicap: u.handicap,
      avgScore: u.avgScore,
      totalPutts: u.totalPutts,
      totalFairways: u.totalFairways,
      totalGIRs: u.totalGIRs
    })).sort((a, b) => b.points - a.points);
  }, [allUsers]);

  const selectedPlayer = useMemo(() => 
    selectedPlayerId ? allUsers.find(u => u.uid === selectedPlayerId) : null
  , [selectedPlayerId, allUsers]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-700 font-bold animate-pulse">Loading League Data...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-emerald-900/10 max-w-md w-full text-center border border-gray-100"
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
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
              className="w-full bg-emerald-700 text-white py-4 rounded-2xl font-bold hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              Sign In
            </button>
          </form>
          
          <div className="mt-10 pt-10 border-t border-gray-50">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">2026 Season • Official Tracker</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const top8 = standings.slice(0, 8);
  const userRounds = rounds.filter(r => r.playerUid === user.uid);
  const latestRound = userRounds[0];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex flex-col gap-8 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-700 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-700/20">
            <Target size={24} />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl leading-none">Parking Lot</h1>
            <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold">League Tracker</p>
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
            <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
              <LogOut size={16} />
            </button>
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
                </>
              )}
            </h2>
            <p className="text-gray-500 text-sm">Wednesday, March 18, 2026</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search players..." 
                className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full md:w-64"
              />
            </div>
            <button 
              onClick={() => setIsScoreModalOpen(true)}
              className="bg-emerald-700 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-700/20 flex items-center gap-2"
            >
              <Plus size={16} />
              Add Round
            </button>
          </div>
        </header>

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
                        <h3 className="text-emerald-200 text-xs font-bold uppercase tracking-widest mb-2">Next Match</h3>
                        <div className="flex items-center justify-between mb-6">
                          <div className="text-center">
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-2 font-bold">KY</div>
                            <p className="text-sm font-bold">Kyle</p>
                          </div>
                          <div className="text-emerald-400 font-display italic text-2xl">vs</div>
                          <div className="text-center">
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-2 font-bold">JH</div>
                            <p className="text-sm font-bold">Joe H</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-emerald-200">
                          <Calendar size={14} />
                          <span>Saturday, March 21 • 7:30 AM</span>
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
                          <tr key={player.uid} className="data-row cursor-pointer" onClick={() => setSelectedPlayerId(player.uid)}>
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
                                  <p className="text-[10px] text-gray-400 uppercase tracking-tighter">Season 2025</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-center font-bold text-emerald-700">{player.points}</td>
                            <td className="px-6 py-5 text-center font-mono text-sm">{player.avgScore}</td>
                            <td className="px-6 py-5 text-center text-sm text-gray-600">{player.totalPutts}</td>
                            <td className="px-6 py-5 text-center text-sm text-gray-600">{player.totalFairways}</td>
                            <td className="px-6 py-5 text-center text-sm text-gray-600">{player.totalGIRs}</td>
                            <td className="px-6 py-5 text-center text-sm text-gray-600">{player.matchesWon}</td>
                            <td className="px-6 py-5 text-center text-sm text-gray-600">{player.handicap}</td>
                          </tr>
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
                  {allUsers.map(player => {
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
                            <p className="text-xs text-gray-500">{new Date(round.date).toLocaleDateString()} • {round.matchResult.toUpperCase()}</p>
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
            </>
          )}
        </AnimatePresence>
        <ScoreEntryModal 
          isOpen={isScoreModalOpen}
          onClose={() => setIsScoreModalOpen(false)}
          players={allUsers}
          currentUser={profile}
          onSave={handleSaveRound}
        />
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
        active 
          ? 'bg-emerald-50 text-emerald-700' 
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
    <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
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
