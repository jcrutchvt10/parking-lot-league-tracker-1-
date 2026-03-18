import { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { X, Camera, Loader2, Check, AlertCircle, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile, HoleScore, Round } from '../types';
import { analyzeScorecard } from '../services/geminiService';

interface ScoreEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: UserProfile[];
  currentUser: UserProfile | null;
  onSave: (round: Omit<Round, 'id'>) => Promise<void>;
}

const DEFAULT_HOLES: HoleScore[] = Array.from({ length: 9 }, (_, i) => ({
  holeNumber: i + 1,
  par: 4,
  score: 4,
  putts: 2,
  fairwayHit: false,
  gir: false,
}));

export default function ScoreEntryModal({ isOpen, onClose, players, currentUser, onSave }: ScoreEntryModalProps) {
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(currentUser?.uid || '');
  const [roundNum, setRoundNum] = useState(1);
  const [matchResult, setMatchResult] = useState<'win' | 'tie' | 'loss'>('win');
  const [scores, setScores] = useState<HoleScore[]>(DEFAULT_HOLES);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    newScores[index] = { ...newScores[index], [field]: value };
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
    const fairways = scores.filter(h => h.fairwayHit).length;
    const girs = scores.filter(h => h.gir).length;
    const eagles = scores.filter(h => h.score <= h.par - 2).length;
    const birdies = scores.filter(h => h.score === h.par - 1).length;
    const pars = scores.filter(h => h.score === h.par).length;
    const bogeys = scores.filter(h => h.score === h.par + 1).length;
    const doubles = scores.filter(h => h.score === h.par + 2).length;
    const others = scores.filter(h => h.score > h.par + 2).length;

    const roundData: Omit<Round, 'id'> = {
      playerUid: selectedPlayerUid,
      playerName: player.displayName,
      date: new Date().toISOString(),
      roundNum,
      totalScore,
      points: 0, // Will be calculated in handleSaveRound
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
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
                onChange={(e) => setSelectedPlayerUid(e.target.value)}
                disabled={!isAdmin}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all disabled:opacity-50"
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
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Match Result</label>
              <div className="flex gap-2">
                {(['win', 'tie', 'loss'] as const).map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setMatchResult(res)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                      matchResult === res 
                        ? 'bg-emerald-700 text-white border-emerald-700' 
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-emerald-500'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
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
