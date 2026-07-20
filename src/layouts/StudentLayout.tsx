import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import {
  Home,
  BookOpen,
  Trophy,
  Clock,
  LogOut,
  ChevronDown,
  Star,
  Settings,
  Award,
  // Plus,
  // Minus,
  User,
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { toast } from '../components/ui/Toast';

const titles = [
  { xp: 0, title: '🎓 Curious Rookie' },
  { xp: 100, title: '🔍 Fact Finder' },
  { xp: 250, title: '🌿 Seed Sower' },
  { xp: 400, title: '💡 Bright Spark' },
  { xp: 600, title: '🚀 Quiz Cadet' },
  { xp: 800, title: '🎒 Eager Learner' },
  { xp: 1000, title: '📜 Scroll Reader' },
  { xp: 1250, title: '🧭 Path Finder' },
  { xp: 1500, title: '📖 Knowledge Seeker' },
  { xp: 1800, title: '✍️ Star Scribe' },
  { xp: 2100, title: '🧩 Riddle Solver' },
  { xp: 2500, title: '🧠 Brain Booster' },
  { xp: 3000, title: '🔬 Lab Assistant' },
  { xp: 3500, title: '🧙‍♂️ Word Wizard' },
  { xp: 4000, title: '🏹 Chapter Conqueror' },
  { xp: 4600, title: '🗺️ Quest Explorer' },
  { xp: 5200, title: '📊 Data Analyst' },
  { xp: 6000, title: '📝 Smart Scholar' },
  { xp: 7000, title: '🏛️ Academy Member' },
  { xp: 8000, title: '🔑 Truth Keeper' },
  { xp: 9200, title: '🛡️ Wisdom Warrior' },
  { xp: 10500, title: '☄️ Comet Chaser' },
  { xp: 12000, title: '🥷 Quiz Ninja' },
  { xp: 13500, title: '📚 Library Patron' },
  { xp: 15000, title: '♟️ Strategy Master' },
  { xp: 17000, title: '🧪 Science Scout' },
  { xp: 19000, title: '🌌 Star Gazer' },
  { xp: 21500, title: '⚔️ Knowledge Knight' },
  { xp: 24000, title: '🏅 Honor Roll' },
  { xp: 26500, title: '🎨 Creative Genius' },
  { xp: 29000, title: '👑 Academic Ace' },
  { xp: 32000, title: '🔮 Master Mind' },
  { xp: 35000, title: '🤖 Tech Titan' },
  { xp: 38000, title: '🎭 Lore Keeper' },
  { xp: 41000, title: '🔭 Elite Einstein' },
  { xp: 44000, title: '🚀 Galaxy Voyager' },
  { xp: 46500, title: '🏛️ Scholar Supreme' },
  { xp: 48500, title: '⚡ Ultimate Genius' },
  { xp: 49500, title: '🪐 Cosmic Overlord' },
  { xp: 50000, title: '🌟 Quizlee Legend' },
];

const navItems = [
  { to: '/student', icon: Home, label: 'Home', end: true },
  { to: '/student/practice', icon: BookOpen, label: 'Practice', end: false },
  { to: '/student/compete', icon: Trophy, label: 'Compete', end: false },
  { to: '/student/history', icon: Clock, label: 'Recent', end: false },
];

export default function StudentLayout() {
  const { profile, setProfile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /*
  const handleUpdatePoints = async (amount: number) => {
    if (!profile) return;
    const newPoints = Math.max(0, (profile.points || 0) + amount);
    
    setProfile({
      ...profile,
      points: newPoints,
    });

    try {
      await supabase
        .from('profiles')
        .update({ points: newPoints })
        .eq('id', profile.id);
    } catch (err) {
      console.error('Failed to sync points:', err);
    }
  };
  */

  const isPlayPage = location.pathname === '/student/play';

  // Points count animation state
  const [displayedPoints, setDisplayedPoints] = useState(0);

  useEffect(() => {
    if (profile) {
      const target = profile.points || 0;
      if (displayedPoints === 0 && target > 0) {
        setDisplayedPoints(target);
        return;
      }
      if (displayedPoints === target) return;

      const diff = target - displayedPoints;
      if (diff <= 0) {
        setDisplayedPoints(target);
        return;
      }

      const duration = 1200; // 1.2s duration
      const frameRate = 1000 / 60; // 60fps
      const totalFrames = Math.round(duration / frameRate);
      let frame = 0;
      const startVal = displayedPoints;

      const timer = setInterval(() => {
        frame++;
        const progress = frame / totalFrames;
        const easeProgress = progress * (2 - progress); // Ease out quadratic
        const current = Math.round(startVal + diff * easeProgress);

        if (frame >= totalFrames) {
          setDisplayedPoints(target);
          clearInterval(timer);
        } else {
          setDisplayedPoints(current);
        }
      }, frameRate);

      return () => clearInterval(timer);
    }
  }, [profile?.points]);



  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  // Get initials for profile fallback
  const initials = profile?.full_name?.[0]?.toUpperCase() || '?';

  // Level Logic
  const getLevelFromXP = (totalXP: number) => {
    if (totalXP < 20) return 1;
    const level = Math.floor(Math.sqrt(totalXP / 5));
    return Math.min(level, 100);
  };
  const currentLevel = getLevelFromXP(profile?.points || 0);
  const currentTitleObj = [...titles].reverse().find(t => (profile?.points || 0) >= t.xp) || titles[0];
  const currentTitle = profile?.title || currentTitleObj.title;

  const getTodayXPEarned = () => {
    if (!profile) return 0;
    const todayStr = new Date().toLocaleDateString('en-CA');
    return profile.last_xp_earned_date === todayStr ? (profile.daily_xp_earned || 0) : 0;
  };

  const handleResetDailyQuota = async () => {
    if (!profile) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ daily_xp_earned: 0 })
        .eq('id', profile.id);

      if (error) {
        toast(error.message, 'error');
      } else {
        setProfile({
          ...profile,
          daily_xp_earned: 0,
        });
        toast("Daily XP quota reset! You can earn another 200 XP today. ⚡", 'success');
      }
    } catch (err) {
      console.error(err);
      toast("Failed to reset daily quota", 'error');
    }
  };

  return (
    <div className={`min-h-screen ${isPlayPage ? 'bg-white' : 'bg-background'} font-body-md text-on-surface selection:bg-primary-container selection:text-primary relative overflow-x-hidden`}>
      {/* Desktop Header */}
      {!isPlayPage && (
        <header className="sticky top-0 z-50 bg-white border-b border-surface-100 shadow-sm relative">
          <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-4 flex justify-between items-center w-full">
            <div className="flex items-center gap-8">
              <h1 
                onClick={() => navigate('/student')}
                className="font-headline-md text-headline-md font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-600 tracking-tight filter drop-shadow-sm cursor-pointer"
              >
                Quizlee
              </h1>
              <nav className="hidden md:flex gap-6 items-end">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `font-bold pb-1 font-label-md text-label-md border-b-4 transition-all duration-200 ${
                        isActive
                          ? 'text-primary border-primary'
                          : 'text-on-surface-variant border-transparent hover:text-primary hover:border-primary/35'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Increase & Decrease XP buttons (Hidden for now - unhide later) */}
              {/* 
              <button 
                onClick={() => handleUpdatePoints(-100)}
                className="hidden sm:flex p-2 rounded-full hover:bg-white/50 text-on-surface-variant hover:text-red-500 transition-colors items-center justify-center bouncy cursor-pointer shrink-0"
                title="Decrease XP by 100"
              >
                <Minus size={20} />
              </button>

              <button 
                onClick={() => handleUpdatePoints(100)}
                className="hidden sm:flex p-2 rounded-full hover:bg-white/50 text-on-surface-variant hover:text-green-500 transition-colors items-center justify-center bouncy cursor-pointer shrink-0"
                title="Increase XP by 100"
              >
                <Plus size={20} />
              </button>
              */}

              {/* Leaderboard icon */}
              <button 
                onClick={() => navigate('/student/leaderboard')}
                className="p-2 rounded-full hover:bg-white/50 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center bouncy cursor-pointer shrink-0"
                title="Leaderboard"
              >
                <Trophy size={20} />
              </button>

              {/* XP Count with Star Icon */}
              <div 
                onClick={() => navigate('/student/settings', { state: { tab: 'points' } })}
                className="flex items-center gap-1.5 bg-warning-50 hover:bg-warning-100/70 text-warning-700 px-3 py-1.5 rounded-full border border-warning-200 text-sm font-extrabold shadow-sm transition-colors cursor-pointer select-none bouncy shrink-0 whitespace-nowrap"
                title="XP (Experience Points)"
              >
                <Star size={14} className="fill-warning-500 text-warning-500" />
                <span>{displayedPoints} XP</span>
              </div>

              {/* Level Display */}
              <div 
                onClick={() => navigate('/student/settings', { state: { tab: 'level' } })}
                className="flex items-center gap-1.5 bg-primary-50 hover:bg-primary-100/70 text-primary px-3 py-1.5 rounded-full border border-primary-200 text-sm font-extrabold shadow-sm transition-colors cursor-pointer select-none bouncy shrink-0 whitespace-nowrap"
                title="Current Level"
              >
                <Award size={14} className="text-primary fill-primary/10" />
                <span>Level {currentLevel}</span>
              </div>

              {/* Daily Quota Indicator & Reset Button */}
              {profile && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm select-none shrink-0 whitespace-nowrap">
                  <span className="text-slate-500 font-semibold">
                    Daily: <span className="font-extrabold text-slate-800">{getTodayXPEarned()}/200 XP</span>
                  </span>
                  <button
                    onClick={handleResetDailyQuota}
                    className="bg-primary hover:bg-primary/90 text-white px-2 py-0.5 rounded-md text-[10px] font-black transition-colors cursor-pointer uppercase tracking-wider"
                    title="Reset today's quota limit to 0"
                  >
                    Reset
                  </button>
                </div>
              )}

              {/* Profile Dropdown */}
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1.5 focus:outline-none cursor-pointer group shrink-0"
                >
                  <Avatar
                    avatarUrl={profile?.avatar_url || null}
                    initials={initials}
                    className="w-10 h-10 border-2 border-white ring-2 ring-primary/20 text-primary-700 font-bold shrink-0"
                  />
                  <ChevronDown size={14} className="text-on-surface-variant group-hover:text-primary transition-colors shrink-0" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white/95 backdrop-blur-md rounded-2xl border border-surface-100 shadow-xl py-2.5 z-50 animate-fade-in">
                    {/* Header info section */}
                    <div className="px-4 pb-3 border-b border-surface-50">
                      <p className="text-base font-black text-surface-950 font-headline-sm truncate leading-snug">
                        {profile?.full_name || 'Student'}
                      </p>
                      <p className="text-xs text-on-surface-variant font-semibold mt-0.5 truncate leading-none">
                        @{profile?.username || 'username'}
                      </p>
                      <div className="flex flex-col gap-1.5 mt-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-extrabold uppercase text-amber-800 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full leading-none truncate max-w-full">
                            {currentTitle}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Links */}
                    <div className="mt-1.5">
                      <button
                        onClick={() => { setDropdownOpen(false); navigate('/student/settings', { state: { tab: 'profile_view' } }); }}
                        className="w-full px-4 py-2 text-left text-sm text-on-surface-variant hover:bg-primary-50/50 hover:text-primary transition-colors font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <User size={16} />
                        Profile
                      </button>

                      <button
                        onClick={() => { setDropdownOpen(false); navigate('/student/settings'); }}
                        className="w-full px-4 py-2 text-left text-sm text-on-surface-variant hover:bg-primary-50/50 hover:text-primary transition-colors font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <Settings size={16} />
                        Settings
                      </button>

                      <button
                        onClick={() => { setDropdownOpen(false); handleLogout(); }}
                        className="w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger-50 hover:text-danger-700 transition-colors font-semibold flex items-center gap-2 border-t border-surface-50 mt-1 pt-2 cursor-pointer"
                      >
                        <LogOut size={16} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className={isPlayPage ? "relative z-10 min-h-screen flex flex-col" : "relative z-10 max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop pt-8 pb-32"}>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      {!isPlayPage && (
        <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 md:hidden bg-white/85 backdrop-blur-2xl rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.06)] border-t border-white/40">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-4 py-2.5 transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-br from-primary to-indigo-600 text-white rounded-2xl scale-105 shadow-md shadow-primary/20'
                    : 'text-on-surface-variant hover:bg-surface-container-high rounded-2xl'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} className={isActive ? 'stroke-[2.5px]' : ''} />
                  <span className="font-label-md text-[10px] font-bold mt-0.5">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
