import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ui/Toast';
import {
  Home,
  BookOpen,
  Trophy,
  LogOut,
  ChevronDown,
  Star,
  Settings,
  Award,
  User,
  Users,
  Medal,
  GraduationCap,
  Clock,
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';

function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Ignore audio context errors
  }
}

function sendDeviceNotification(title: string, body: string, onClickHandler?: () => void) {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'quizlee-material-' + Date.now(),
        });
        notif.onclick = () => {
          window.focus();
          if (onClickHandler) onClickHandler();
        };
      } catch (err) {
        console.error('Device notification failed:', err);
      }
    } else if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {}
  }
}

export default function StudentLayout() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [hasConnectedTeacher, setHasConnectedTeacher] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Request browser notification permission once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Fetch pending count for connected teachers
  const fetchPendingCount = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data: relations } = await supabase
        .from('student_teacher_relations')
        .select('teacher_id')
        .eq('student_id', profile.id)
        .eq('status', 'approved');

      if (!relations || relations.length === 0) {
        setHasConnectedTeacher(false);
        setPendingCount(0);
        return;
      }

      setHasConnectedTeacher(true);
      const teacherIds = relations.map((r) => r.teacher_id);

      const { data: sharesData } = await supabase
        .from('teacher_shares')
        .select('id, student_ids')
        .in('teacher_id', teacherIds);

      if (!sharesData || sharesData.length === 0) {
        setPendingCount(0);
        return;
      }

      const relevantShares = sharesData.filter((s) => {
        if (!s.student_ids || !Array.isArray(s.student_ids) || s.student_ids.length === 0) {
          return true;
        }
        return s.student_ids.includes(profile.id);
      });

      if (relevantShares.length === 0) {
        setPendingCount(0);
        return;
      }

      const shareIds = relevantShares.map((s) => s.id);

      const { data: subsData } = await supabase
        .from('student_share_submissions')
        .select('share_id')
        .eq('student_id', profile.id)
        .in('share_id', shareIds);

      const completedShareIds = new Set((subsData || []).map((s) => s.share_id));
      const pending = relevantShares.filter((s) => !completedShareIds.has(s.id)).length;
      setPendingCount(pending);
    } catch (err) {
      console.error('Error calculating pending classroom materials:', err);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  // Listen for realtime changes, BroadcastChannel, storage & custom event updates
  useEffect(() => {
    if (!profile?.id) return;

    const handleCustomUpdate = () => {
      fetchPendingCount();
      useAuthStore.getState().fetchProfile();
    };

    // Custom window event listener
    window.addEventListener('classroom_activity_updated', handleCustomUpdate);

    // Cross-tab storage listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'quizlee_classroom_sync') {
        fetchPendingCount();
        useAuthStore.getState().fetchProfile();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Cross-tab BroadcastChannel listener
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('quizlee_classroom_updates');
      bc.onmessage = (event) => {
        if (event.data?.type === 'MATERIAL_SHARED' || event.data?.type === 'SUBMISSION_UPDATED') {
          fetchPendingCount();
          useAuthStore.getState().fetchProfile();
        }
      };
    } catch {
      // BroadcastChannel fallback
    }

    // 5-second heartbeat poll fallback
    const intervalId = setInterval(() => {
      fetchPendingCount();
    }, 5000);

    // Subscribe to instant Supabase Realtime Broadcast notifications
    const realtimeBroadcastChannel = supabase
      .channel('quizlee-realtime-classroom-broadcast')
      .on(
        'broadcast',
        { event: 'material_shared' },
        (payload) => {
          const data = payload.payload;
          if (!data) return;

          // Target check: filter by student_ids or class_id if specified
          if (data.student_ids && Array.isArray(data.student_ids) && data.student_ids.length > 0) {
            if (!data.student_ids.includes(profile.id)) return;
          }
          if (data.class_id && profile?.class_id && data.class_id !== profile.class_id) {
            return;
          }

          fetchPendingCount();

          const teacherName = data.teacher_name || 'Your teacher';
          const shareTitle = data.title || 'New Material';

          // Pop up native device/browser push notification
          sendDeviceNotification(
            '📚 New Classroom Material!',
            `${teacherName} shared: ${shareTitle}`,
            () => navigate('/student/class-activities')
          );

          // Pop up in-app toast notification
          toast(`📚 New material shared by ${teacherName}: ${shareTitle}`, 'info');

          // Play sound chime
          playNotificationChime();
        }
      )
      .on(
        'broadcast',
        { event: 'submission_verified' },
        (payload) => {
          const data = payload.payload;
          if (data?.student_id && data.student_id !== profile.id) return;

          fetchPendingCount();
          useAuthStore.getState().fetchProfile();
          window.dispatchEvent(new Event('classroom_activity_updated'));

          const xpAmount = data?.xp_amount || 50;
          sendDeviceNotification(
            '🌟 Classroom Activity Verified!',
            `Your teacher verified your activity (+${xpAmount} XP)!`,
            () => navigate('/student/class-activities')
          );
          toast(`🌟 Classroom submission verified! +${xpAmount} XP earned! 🎉`, 'success');
          playNotificationChime();
        }
      )
      .subscribe();

    // Subscribe to teacher_shares INSERT and DELETE
    const sharesChannel = supabase
      .channel('student-layout-shares-v2')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teacher_shares',
        },
        async (payload) => {
          fetchPendingCount();

          if (payload.eventType === 'INSERT') {
            const newShare = payload.new as any;
            if (newShare?.student_ids && Array.isArray(newShare.student_ids) && newShare.student_ids.length > 0) {
              if (!newShare.student_ids.includes(profile.id)) return;
            }

            let teacherName = 'Your teacher';
            if (newShare?.teacher_id) {
              const { data: tProf } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', newShare.teacher_id)
                .maybeSingle();
              if (tProf?.full_name) {
                teacherName = tProf.full_name;
              }
            }

            const shareTitle = newShare?.title || 'New Material';
            sendDeviceNotification(
              '📚 New Classroom Material!',
              `${teacherName} shared: ${shareTitle}`,
              () => navigate('/student/class-activities')
            );
            toast(`📚 New material shared by ${teacherName}: ${shareTitle}`, 'info');
            playNotificationChime();
          }
        }
      )
      .subscribe();

    // Subscribe to student_share_submissions changes
    const subsChannel = supabase
      .channel('student-layout-submissions-v2')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_share_submissions',
          filter: `student_id=eq.${profile.id}`,
        },
        () => {
          fetchPendingCount();
          useAuthStore.getState().fetchProfile();
          window.dispatchEvent(new Event('classroom_activity_updated'));
        }
      )
      .subscribe();

    // Subscribe to profiles changes (to update points / level in real time)
    const profileChannel = supabase
      .channel('student-layout-profile-v2')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profile.id}`,
        },
        () => {
          useAuthStore.getState().fetchProfile();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('classroom_activity_updated', handleCustomUpdate);
      window.removeEventListener('storage', handleStorageChange);
      if (bc) {
        try {
          bc.close();
        } catch {}
      }
      clearInterval(intervalId);
      supabase.removeChannel(realtimeBroadcastChannel);
      supabase.removeChannel(sharesChannel);
      supabase.removeChannel(subsChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [profile?.id, fetchPendingCount, navigate]);

  const dynamicNavItems = [
    { to: '/student', icon: Home, label: 'Home', end: true },
    { to: '/student/practice', icon: BookOpen, label: 'Practice', end: false },
    { to: '/student/competitive', icon: Trophy, label: 'Competitive', end: false },
    { to: '/student/leaderboard', icon: Medal, label: 'Leaderboard', end: false },
    { to: '/student/recent', icon: Clock, label: 'Recent', end: false },
  ];

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
    if (totalXP < 100) return 0;
    if (totalXP < 200) return Math.min(4, Math.floor(1 + (totalXP - 100) / 25));
    if (totalXP < 500) return Math.min(9, Math.floor(5 + (totalXP - 200) / 60));
    return Math.min(100, Math.floor(Math.sqrt(totalXP / 5)));
  };
  const currentLevel = getLevelFromXP(profile?.points || 0);
  const currentTitle = profile?.title || '';

  return (
    <div className={`min-h-screen ${isPlayPage ? 'bg-white' : 'bg-background'} font-body-md text-on-surface selection:bg-primary-container selection:text-primary relative overflow-x-hidden`}>
      {/* Desktop Header */}
      {!isPlayPage && (
        <header className="sticky top-0 z-50 bg-white border-b border-surface-100 shadow-sm relative gpu-layer">
          <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-4 flex justify-between items-center w-full">
            <div className="flex items-center gap-8">
              <h1 
                onClick={() => navigate('/student')}
                className="font-headline-md text-headline-md font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-600 tracking-tight filter drop-shadow-sm cursor-pointer"
              >
                Quizlee
              </h1>
              <nav className="hidden lg:flex gap-6 items-end">
                {dynamicNavItems.map((item) => (
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

            <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4">
              {/* Classroom icon */}
              {hasConnectedTeacher && (
                <button 
                  onClick={() => {
                    if (location.pathname === '/student/class-activities') {
                      window.location.reload();
                    } else {
                      navigate('/student/class-activities');
                    }
                  }}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-surface-100 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center bouncy cursor-pointer shrink-0 relative"
                  title={`Classroom Activities${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`}
                >
                  <GraduationCap size={18} className="sm:w-5 sm:h-5" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] sm:h-5 sm:min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-600 px-1 text-[10px] sm:text-xs font-black text-white ring-2 ring-white animate-pulse shadow-md">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </button>
              )}

              {/* XP Count with Star Icon */}
              <div 
                onClick={() => navigate('/student/settings', { state: { tab: 'points' } })}
                className="flex items-center gap-1 bg-warning-50 hover:bg-warning-100/70 text-warning-700 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border border-warning-200 text-xs sm:text-sm font-extrabold shadow-sm transition-colors cursor-pointer select-none bouncy shrink-0 whitespace-nowrap"
                title="XP (Experience Points)"
              >
                <Star size={12} className="fill-warning-500 text-warning-500 sm:w-3.5 sm:h-3.5" />
                <span>{displayedPoints} XP</span>
              </div>

              {/* Level Display */}
              <div 
                onClick={() => navigate('/student/settings', { state: { tab: 'level' } })}
                className="flex items-center gap-1 bg-primary-50 hover:bg-primary-100/70 text-primary px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border border-primary-200 text-xs sm:text-sm font-extrabold shadow-sm transition-colors cursor-pointer select-none bouncy shrink-0 whitespace-nowrap"
                title="Current Level"
              >
                <Award size={12} className="text-primary fill-primary/10 sm:w-3.5 sm:h-3.5" />
                <span>
                  <span className="hidden sm:inline">Level </span>
                  {currentLevel}
                </span>
              </div>

              {/* Profile Dropdown */}
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1 sm:gap-1.5 focus:outline-none cursor-pointer group shrink-0"
                >
                  <Avatar
                    avatarUrl={profile?.avatar_url || null}
                    initials={initials}
                    className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-white ring-2 ring-primary/20 text-primary-700 font-bold shrink-0"
                  />
                  <ChevronDown size={14} className="hidden sm:block text-on-surface-variant group-hover:text-primary transition-colors shrink-0" />
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
                      {currentTitle && (
                        <div className="flex flex-col gap-1.5 mt-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-extrabold uppercase text-amber-800 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full leading-none truncate max-w-full">
                              {currentTitle}
                            </span>
                          </div>
                        </div>
                      )}
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
                        onClick={() => { setDropdownOpen(false); navigate('/student/friends'); }}
                        className="w-full px-4 py-2 text-left text-sm text-on-surface-variant hover:bg-primary-50/50 hover:text-primary transition-colors font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <Users size={16} />
                        Friends
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
      <main className={isPlayPage ? "relative z-10 min-h-screen flex flex-col" : "relative z-10 max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop pt-8 pb-36"}>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      {!isPlayPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-[60] lg:hidden bg-white/95 backdrop-blur-xl border-t border-surface-200/90 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] px-4 pt-2.5 pb-safe pb-3 sm:pb-4 gpu-layer">
          <div className="max-w-md mx-auto flex items-center justify-around gap-1">
            {dynamicNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-center transition-all duration-300 ease-out cursor-pointer ${
                    isActive
                      ? 'px-3.5 py-2 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-md shadow-primary/25 scale-105'
                      : 'p-2.5 rounded-2xl text-surface-500 hover:text-primary hover:bg-surface-100/70'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} className={isActive ? 'stroke-[2.5px] shrink-0' : 'stroke-[2px] shrink-0'} />
                    {isActive && (
                      <span className="text-xs font-extrabold ml-1.5 whitespace-nowrap animate-fade-in tracking-tight">
                        {item.label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
