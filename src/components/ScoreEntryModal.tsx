import { useState, useRef, useEffect, ChangeEvent, FormEvent } from 'react';
import { X, Camera, Loader2, Check, AlertCircle, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile, HoleScore, Round, LeagueConfig } from '../types';
import { analyzeScorecard } from '../services/geminiService';

interface ScoreEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: UserProfile[];
  currentUser: UserProfile | null;
  leagueConfig: LeagueConfig | null;
  weeklyDefaults: Record<number, 'front' | 'back'>;
  onSave: (round: Omit<Round, 'id'>) => Promise<void>;
}

const FALLBACK_HOLES: HoleScore[] = Array.from({ length: 9 }, (_, i) => ({
  holeNumber: i + 1,
  par: [4, 4, 4, 3, 5, 4, 5, 3, 4][i],
  score: 4,
  putts: 2,
  fairwayHit: false,
  gir: false,
}));

function holesForNine(leagueConfig: LeagueConfig | null, ninePlayed: 'front' | 'back'): HoleScore[] {
  const nine = leagueConfig?.nineConfig?.[ninePlayed];
  if (!nine) {
    return FALLBACK_HOLES.map(h => ({ ...h }));
  }
  return nine.holeNumbers.map((holeNumber, idx) => ({
    holeNumber,
    par: nine.pars[idx],
    score: nine.pars[idx],
    putts: 2,
    fairwayHit: false,
    gir: false
  }));
}

function getDefaultNine(week: number, weeklyDefaults: Record<number, 'front' | 'back'>) {
  return weeklyDefaults[week] || (week % 2 === 1 ? 'front' : 'back');
}

export default function ScoreEntryModal({ isOpen, onClose, players, currentUser, leagueConfig, weeklyDefaults, onSave }: ScoreEntryModalProps) {
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(currentUser?.uid || '');
  const [roundNum, setRoundNum] = useState(1);
  const [ninePlayed, setNinePlayed] = useState<'front' | 'back'>('front');
  const [holePoints, setHolePoints] = useState(0);
  const [matchResult, setMatchResult] = useState<'win' | 'tie' | 'loss'>('win');
  const [scores, setScores] = useState<HoleScore[]>(FALLBACK_HOLES);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form state whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      const uid = currentUser?.uid || '';
      setSelectedPlayerUid(uid);
      const player = players.find(p => p.uid === uid);
      const nextRoundNum = (player?.totalRounds ?? 0) + 1;
      setRoundNum(nextRoundNum);
      const defaultNine = getDefaultNine(nextRoundNum, weeklyDefaults);
      setNinePlayed(defaultNine);
      setMatchResult('win');
      setHolePoints(0);
      setScores(holesForNine(leagueConfig, defaultNine));
      setPendingImage(null);
      setError(null);
    }
  }, [isOpen, currentUser, players, leagueConfig, weeklyDefaults]);

  // Update roundNum when player selection changes
  const handlePlayerChange = (uid: string) => {
    setSelectedPlayerUid(uid);
    const player = players.find(p => p.uid === uid);
    const nextRoundNum = (player?.totalRounds ?? 0) + 1;
    setRoundNum(nextRoundNum);
    const defaultNine = getDefaultNine(nextRoundNum, weeklyDefaults);
    setNinePlayed(defaultNine);
    setScores(holesForNine(leagueConfig, defaultNine));
  };

  const handleWeekChange = (nextWeek: number) => {
    setRoundNum(nextWeek);
    const defaultNine = getDefaultNine(nextWeek, weeklyDefaults);
    setNinePlayed(defaultNine);
    setScores(holesForNine(leagueConfig, defaultNine));
  };

  const handleNineChange = (nine: 'front' | 'back') => {
    setNinePlayed(nine);
    setScores(holesForNine(leagueConfig, nine));
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPendingImage(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!pendingImage) return;
    
    setIsAnalyzing(true);
    setError(null);

    try {
      const analyzedScores = await analyzeScorecard(pendingImage);
      if (analyzedScores && analyzedScores.length > 0) {
        setScores(analyzedScores);
        setPendingImage(null);
      } else {
        setError("Could not extract scores from image. Please enter manually.");
      }
    } catch (err) {
      setError("Error processing image with AI.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleScoreChange = (index: number, field: keyof HoleScore, value: any) => {
    const newScores = [...scores];
    if (field === 'score') {
      const par = newScores[index].par;
      const cap = par + Number(leagueConfig?.scoring?.maxOverParPerHoleRegularSeason ?? 3);
      newScores[index] = { ...newScores[index], score: Math.min(Number(value), cap) };
    } else {
      newScores[index] = { ...newScores[index], [field]: value };
    }
    setScores(newScores);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerUid) {
      setError("Please select a player.");
      return;
    }

    const player = players.find(p => p.uid === selectedPlayerUid);
    if (!player) return;

    setIsSaving(true);
    setError(null);

    const totalScore = scores.reduce((sum, h) => sum + h.score, 0);
    const putts = scores.reduce((sum, h) => sum + h.putts, 0);
    const fairways = scores.filter(h => h.par > 3 && h.fairwayHit).length;
    const girs = scores.filter(h => h.gir).length;
    const eagles = scores.filter(h => h.score <= h.par - 2).length;
    const birdies = scores.filter(h => h.score === h.par - 1).length;
    const pars = scores.filter(h => h.score === h.par).length;
    const bogeys = scores.filter(h => h.score === h.par + 1).length;
    const doubles = scores.filter(h => h.score === h.par + 2).length;
    const others = scores.filter(h => h.score > h.par + 2).length;

    const matchPoints = matchResult === 'win'
      ? (leagueConfig?.scoring?.matchWinPoints ?? 2)
      : matchResult === 'tie'
        ? (leagueConfig?.scoring?.matchTiePoints ?? 1)
        : 0;
    let avgBonusPoints = 0;
    const rollingAvg = player.avgScore;
    if (rollingAvg > 0 && totalScore <= rollingAvg) {
      avgBonusPoints = leagueConfig?.scoring?.avgBonusPoints ?? 1;
    }

    const totalPoints = holePoints + matchPoints + avgBonusPoints;

    const roundData: Omit<Round, 'id'> = {
      playerUid: selectedPlayerUid,
      playerName: player.displayName,
      date: new Date().toISOString(),
      roundNum,
      ninePlayed,
      totalScore,
      points: totalPoints,
      holePoints,
      matchPoints,
      avgBonusPoints,
      matchResult,
      scores,
      stats: {
        putts,
        fairways,
        girs,
        birdies,
        eagles,
        pars,
        bogeys,
        doubles,
        others
      }
    };

    try {
      await onSave(roundData);
      onClose();
    } catch (err) {
      setError("Failed to save round. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="m3-modal-surface rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-900 text-white">
          <div>
            <h2 className="text-xl font-display font-bold">Post New Round</h2>
            <p className="text-emerald-200 text-xs">Enter scores manually or upload a photo</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Player</label>
              <select 
                value={selectedPlayerUid}
                onChange={(e) => handlePlayerChange(e.target.value)}
                disabled={!isAdmin}
                className="m3-input w-full p-3 disabled:opacity-50"
                required
              >
                {!isAdmin && <option value={currentUser?.uid}>{currentUser?.displayName}</option>}
                {isAdmin && (
                  <>
                    <option value="">Select Player</option>
                    {players.map(p => (
                      <option key={p.uid} value={p.uid}>{p.displayName}</option>
                    ))}
                  </>
                )}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Week</label>
              <input
                type="number"
                min="1"
                max="30"
                value={roundNum}
                onChange={(e) => handleWeekChange(Number(e.target.value) || 1)}
                className="m3-input w-full p-3"
              />
              <p className="text-[10px] text-gray-400">Default nine auto-fills from schedule; you can override for make-up rounds.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Nine Played</label>
              <div className="flex gap-2">
                {(['front', 'back'] as const).map((nine) => (
                  <button
                    key={nine}
                    type="button"
                    onClick={() => handleNineChange(nine)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                      ninePlayed === nine
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-emerald-500'
                    }`}
                  >
                    {nine === 'front' ? (leagueConfig?.nineConfig.front.label || 'Front 9') : (leagueConfig?.nineConfig.back.label || 'Back 9')}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Match Result</label>
              <div className="flex gap-2">
                {(['win', 'tie', 'loss'] as const).map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setMatchResult(res)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                      matchResult === res 
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' 
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-emerald-500'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Hole Points</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="9"
                value={holePoints}
                onChange={(e) => setHolePoints(Number(e.target.value))}
                className="m3-input w-full p-3"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-50 text-emerald-700 rounded-2xl border-2 border-dashed border-emerald-200 hover:bg-emerald-100 transition-all font-bold"
              >
                <Camera size={20} />
                {pendingImage ? "Change Photo" : "Snap Scorecard"}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
              />
            </div>

            {pendingImage && (
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex flex-col md:flex-row gap-4 items-center">
                <div className="w-full md:w-32 h-32 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                  <img src={pendingImage} alt="Scorecard Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-bold text-gray-700">Photo Attached</p>
                  <p className="text-xs text-gray-500">You can now run AI analysis to extract scores automatically, or just keep the photo for reference.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="flex-1 md:flex-none px-6 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 transition-all flex items-center justify-center gap-2"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="animate-spin" size={14} />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Target size={14} />
                          Run AI Analysis
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingImage(null)}
                      className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600"
                    >
                      Clear Photo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="text-[10px] font-bold uppercase text-gray-400">
                  <th className="p-2">Hole</th>
                  <th className="p-2">Par</th>
                  <th className="p-2">Score</th>
                  <th className="p-2">Putts</th>
                  <th className="p-2">FW</th>
                  <th className="p-2">GIR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {scores.map((hole, idx) => (
                  <tr key={hole.holeNumber}>
                    <td className="p-2 font-bold text-gray-400">{hole.holeNumber}</td>
                    <td className="p-2">
                      <input 
                        type="number" 
                        value={hole.par} 
                        onChange={(e) => handleScoreChange(idx, 'par', parseInt(e.target.value))}
                        className="w-12 p-1 text-center bg-gray-50 border border-gray-100 rounded"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" 
                        value={hole.score} 
                        onChange={(e) => handleScoreChange(idx, 'score', parseInt(e.target.value))}
                        className="w-12 p-1 text-center bg-emerald-50 border border-emerald-100 rounded font-bold text-emerald-700"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" 
                        value={hole.putts} 
                        onChange={(e) => handleScoreChange(idx, 'putts', parseInt(e.target.value))}
                        className="w-12 p-1 text-center bg-gray-50 border border-gray-100 rounded"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="checkbox" 
                        checked={hole.fairwayHit} 
                        onChange={(e) => handleScoreChange(idx, 'fairwayHit', e.target.checked)}
                        className="w-4 h-4 accent-emerald-600"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="checkbox" 
                        checked={hole.gir} 
                        onChange={(e) => handleScoreChange(idx, 'gir', e.target.checked)}
                        className="w-4 h-4 accent-emerald-600"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-8 py-2 bg-emerald-700 text-white rounded-full text-sm font-bold hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Check size={18} />
                Save Round
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
