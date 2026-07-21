import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { Save, Shield, User, Palette, Check, Trash2, RefreshCw, Edit, Lock, Smile, Loader2, CheckCircle2, XCircle, Trophy, Award, Star, Compass, Zap, Rocket, Crown, Plus } from 'lucide-react';
import { themes, getSavedTheme, saveTheme } from '../../lib/theme';
import { useNavigate, useLocation } from 'react-router-dom';
import { Avatar } from '../../components/ui/Avatar';
import { avatarPresets, avatarBgColors, parseAvatar, adjustColorShade, parseColorShade, avatarPresetLevels } from '../../lib/avatar';



const milestones = [
  { lvl: 1, xp: 100, label: 'Initiation', icon: Compass },
  { lvl: 5, xp: 200, label: 'Awakening', icon: Zap },
  { lvl: 10, xp: 500, label: 'Breakthrough', icon: Rocket },
  { lvl: 20, xp: 2000, label: 'Ascent', icon: Award },
  { lvl: 30, xp: 4500, label: 'Mastery', icon: Shield },
  { lvl: 40, xp: 8000, label: 'Eminence', icon: Smile },
  { lvl: 50, xp: 12500, label: 'Supremacy', icon: Trophy },
  { lvl: 60, xp: 18000, label: 'Transcendence', icon: RefreshCw },
  { lvl: 70, xp: 24500, label: 'Immortality', icon: Lock },
  { lvl: 80, xp: 32000, label: 'Infinity', icon: Star },
  { lvl: 90, xp: 40500, label: 'Singularity', icon: Palette },
  { lvl: 100, xp: 50000, label: 'Zenith', icon: Crown },
];

const titles = [
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

interface SettingsPageProps {
  defaultTab?: 'account' | 'avatar' | 'profile_view' | 'level' | 'points' | 'theme' | 'privacy' | 'version';
}

export default function SettingsPage({ defaultTab = 'account' }: SettingsPageProps) {
  const { profile, user, setProfile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'account' | 'avatar' | 'profile_view' | 'level' | 'points' | 'theme' | 'privacy' | 'version'>(() => {
    if (location.state?.tab) {
      return location.state.tab;
    }
    return defaultTab;
  });

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  // Loading state
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Avatar Tab state
  const googleAvatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const [avatarType, setAvatarType] = useState<'preset' | 'google' | 'initials'>(() => {
    if (profile?.avatar_url) {
      const parsed = parseAvatar(profile.avatar_url);
      if (parsed.type === 'preset') {
        return 'preset';
      }
      return 'google';
    }
    return 'initials';
  });
  const [selectedPreset, setSelectedPreset] = useState<string | null>(() => {
    if (profile?.avatar_url) {
      const parsed = parseAvatar(profile.avatar_url);
      if (parsed.type === 'preset') {
        return parsed.presetKey || null;
      }
    }
    return null;
  });
  const [selectedBgColor, setSelectedBgColor] = useState<string>(() => {
    if (profile?.avatar_url) {
      const parsed = parseAvatar(profile.avatar_url);
      if (parsed.type === 'preset' && parsed.bgColor) {
        const { baseColor } = parseColorShade(parsed.bgColor);
        return baseColor;
      }
    }
    return '#6366f1';
  });
  const [shadeIntensity, setShadeIntensity] = useState<number>(() => {
    if (profile?.avatar_url) {
      const parsed = parseAvatar(profile.avatar_url);
      if (parsed.type === 'preset' && parsed.bgColor) {
        const { intensity } = parseColorShade(parsed.bgColor);
        return intensity;
      }
    }
    return 100;
  });

  // Profile Tab state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [gender, setGender] = useState(profile?.gender?.toLowerCase() || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth || '');
  const [schoolName, setSchoolName] = useState('Loading...');
  const [className, setClassName] = useState('Loading...');

  // Live username check state
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);

  // Theme Tab state
  const [currentTheme, setCurrentTheme] = useState(() => getSavedTheme(user?.id));

  // Privacy Tab state
  const [privacy, setPrivacy] = useState(profile?.privacy || 'public');

  // Version Tab state
  const [currentVersion] = useState(() => localStorage.getItem('quizlee_version') || '1.2.0');
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateChecked, setUpdateChecked] = useState(false);

  // Equipped Badges state for multi-collecting
  const [equippedBadges, setEquippedBadges] = useState<string[]>(() => {
    if (!profile?.id) return [];
    const saved = localStorage.getItem(`equipped_badges_${profile.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const handleToggleEquipBadge = (badgeLabel: string) => {
    if (!profile?.id) return;
    setEquippedBadges((prev) => {
      const isEquipped = prev.includes(badgeLabel);
      const next = isEquipped
        ? prev.filter((b) => b !== badgeLabel)
        : [...prev, badgeLabel];
      localStorage.setItem(`equipped_badges_${profile.id}`, JSON.stringify(next));
      toast(
        isEquipped
          ? `Unequipped badge: ${badgeLabel}`
          : `Equipped badge: ${badgeLabel}! 🏅`,
        'success'
      );
      return next;
    });
  };

  // XP count animation state for points settings tab
  const [displayedXP, setDisplayedXP] = useState(0);

  useEffect(() => {
    if (activeTab === 'points') {
      const target = profile?.points || 0;
      if (target === 0) {
        setDisplayedXP(0);
        return;
      }
      
      const duration = 500; // 0.5s duration for fast animation
      const frameRate = 1000 / 60; // 60fps
      const totalFrames = Math.round(duration / frameRate);
      let frame = 0;
      const startVal = 0;
      const diff = target;

      const timer = setInterval(() => {
        frame++;
        const progress = frame / totalFrames;
        const easeProgress = progress * (2 - progress); // Ease out quadratic
        const current = Math.round(startVal + diff * easeProgress);

        if (frame >= totalFrames) {
          setDisplayedXP(target);
          clearInterval(timer);
        } else {
          setDisplayedXP(current);
        }
      }, frameRate);

      return () => clearInterval(timer);
    } else {
      setDisplayedXP(0);
    }
  }, [activeTab, profile?.points]);

  // Calculate current level and total XP globally for SettingsPage
  const totalXP = profile?.points || 0;
  const currentLevel = (() => {
    if (totalXP < 100) return 0;
    if (totalXP < 200) return Math.min(4, Math.floor(1 + (totalXP - 100) / 25));
    if (totalXP < 500) return Math.min(9, Math.floor(5 + (totalXP - 200) / 60));
    return Math.min(100, Math.floor(Math.sqrt(totalXP / 5)));
  })();

  // Fetch School and Class names for affiliation display
  useEffect(() => {
    async function fetchSchoolAndClass() {
      if (!profile?.school_id) {
        setSchoolName('None');
      } else {
        const { data } = await supabase
          .from('schools')
          .select('name')
          .eq('id', profile.school_id)
          .single();
        if (data) {
          setSchoolName(data.name);
        } else {
          setSchoolName('Unknown School');
        }
      }

      if (!profile?.class_id) {
        setClassName('None');
      } else {
        const { data } = await supabase
          .from('classes')
          .select('name')
          .eq('id', profile.class_id)
          .single();
        if (data) {
          setClassName(data.name);
        } else {
          setClassName('Unknown Class');
        }
      }
    }
    fetchSchoolAndClass();
  }, [profile]);

  // Live username availability check (only active when editing)
  useEffect(() => {
    if (!isEditing || !username) {
      setIsUsernameAvailable(null);
      return;
    }

    if (username.length < 3) {
      setIsUsernameAvailable(false);
      return;
    }

    if (profile?.username === username) {
      setIsUsernameAvailable(true);
      return;
    }

    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const { data: exists, error } = await supabase.rpc('check_username_exists', {
          username_to_check: username,
        });

        if (error) {
          console.error('Error checking username:', error);
          setIsUsernameAvailable(null);
        } else {
          setIsUsernameAvailable(!exists);
        }
      } catch (err) {
        console.error('Failed to verify username availability:', err);
        setIsUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, isEditing, profile?.username]);

  // Handle Account Profile Save
  async function handleAccountSave() {
    if (!profile) return;
    if (isUsernameAvailable === false) {
      toast('Please choose a different username', 'error');
      return;
    }
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        username,
        gender: gender || null,
        date_of_birth: dateOfBirth || null,
      })
      .eq('id', profile.id);

    if (error) {
      toast(error.message, 'error');
    } else {
      setProfile({
        ...profile,
        full_name: fullName,
        username,
        gender: gender || null,
        date_of_birth: dateOfBirth || null,
      });
      toast('Profile updated! 🎉', 'success');
      setIsEditing(false);
      navigate('/student');
    }
    setLoading(false);
  }

  // Handle Avatar Preset Save
  async function handleAvatarSave() {
    if (!profile) return;
    setLoading(true);

    let avatarString: string | null = null;
    if (avatarType === 'preset' && selectedPreset) {
      const finalColor = adjustColorShade(selectedBgColor, shadeIntensity);
      avatarString = `preset:${selectedPreset}:${finalColor}`;
    } else if (avatarType === 'google') {
      avatarString = googleAvatarUrl;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        avatar_url: avatarString,
      })
      .eq('id', profile.id);

    if (error) {
      toast(error.message, 'error');
    } else {
      setProfile({
        ...profile,
        avatar_url: avatarString,
      });
      toast('Avatar updated! 🎉', 'success');
      navigate('/student');
    }
    setLoading(false);
  }

  // Handle Theme Selection
  const handleThemeChange = (themeKey: string) => {
    setCurrentTheme(themeKey);
  };

  // Handle Theme Save
  const handleThemeSave = () => {
    saveTheme(currentTheme, user?.id);
    toast(`Theme updated to ${themes[currentTheme].name}! 🎨`, 'success');
    navigate('/student');
  };



  // Navigation Items
  const tabs = [
    { key: 'account', label: 'Account', icon: User },
    { key: 'avatar', label: 'Avatar', icon: Smile },
    { key: 'profile_view', label: 'User Profile', icon: User },
    { key: 'points', label: 'Points & Titles', icon: Award },
    { key: 'level', label: 'Levels and Badges', icon: Trophy },
    { key: 'theme', label: 'Themes', icon: Palette },
    { key: 'privacy', label: 'Privacy', icon: Shield, locked: true },
    { key: 'version', label: 'App Version', icon: RefreshCw },
  ] as const;

  // Render Account tab content
  const renderAccountSettings = () => {
    const initials = profile?.full_name?.[0]?.toUpperCase() || '?';
    return (
      <div className="flex flex-col gap-6">
        {/* Profile Avatar Card */}
        <Card>
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('avatar')}
              className="cursor-pointer hover:opacity-85 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
              title="Customize Avatar"
            >
              <Avatar
                avatarUrl={profile?.avatar_url || null}
                initials={initials}
                className="w-20 h-20 text-3xl font-bold border-2 border-white ring-4 ring-primary/10 shadow-inner"
              />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-surface-900">{profile?.full_name || 'Student'}</h3>
                {profile?.title && (
                  <span className="text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full shadow-sm leading-none">
                    {profile.title}
                  </span>
                )}
                {profile?.milestone && (
                  <span className="text-[10px] font-extrabold bg-primary-50 text-primary border border-primary-200 px-2 py-0.5 rounded-full shadow-sm leading-none">
                    {profile.milestone}
                  </span>
                )}
              </div>
              <p className="text-sm text-surface-500 mt-0.5">@{profile?.username || 'username'}</p>
              {user?.email && (
                <p className="text-xs text-surface-400 mt-0.5">{user.email}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Profile Details Form */}
        <Card>
          <h3 className="font-bold text-surface-900 mb-4 font-headline-sm">
            {isEditing ? 'Edit Details' : 'Details'}
          </h3>
          <div className="flex flex-col gap-4">
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={!isEditing}
            />
            {isEditing ? (
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                required
                leftElement={<span className="text-surface-400 font-semibold select-none">@</span>}
                rightElement={
                  <div className="flex items-center justify-center">
                    {checkingUsername && (
                      <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                    )}
                    {!checkingUsername && isUsernameAvailable === true && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {!checkingUsername && isUsernameAvailable === false && (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                }
                error={isUsernameAvailable === false ? (username.length < 3 ? 'Username must be at least 3 characters' : 'Username is already taken') : undefined}
                helpText={isUsernameAvailable === true ? 'Username is available' : undefined}
              />
            ) : (
              <Input
                label="Username"
                value={username}
                disabled={true}
                leftElement={<span className="text-surface-400 font-semibold select-none">@</span>}
                rightElement={
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                }
              />
            )}
            <Select
              label="Gender"
              value={gender?.toLowerCase()}
              onChange={(e) => setGender(e.target.value)}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
                { value: 'prefer not to say', label: 'Prefer not to say' },
              ]}
              placeholder="Select Gender"
              disabled={!isEditing}
            />
            <Input
              label="Date of Birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              disabled={!isEditing}
            />
            {!isEditing && (
              <div className="mt-4 pt-4 border-t border-surface-100 flex flex-col gap-2.5 text-sm text-surface-600 font-body-md">
                <div>
                  <strong className="text-surface-700 font-semibold">Member Since:</strong>{' '}
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* School Affiliation display */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🏫</span>
            <h3 className="font-bold text-surface-900 font-headline-sm">Academic Affiliation</h3>
          </div>
          <div className="text-sm text-surface-700 space-y-1 font-body-md">
            <p><strong>School Name:</strong> {schoolName}</p>
            <p><strong>Class:</strong> {className}</p>
          </div>
        </Card>

        <Button
          size="lg"
          className="w-full shadow-lg !bg-primary hover:!bg-primary/95 active:!bg-primary/90 text-white transition-colors"
          icon={isEditing ? <Save size={18} /> : <Edit size={18} />}
          loading={isEditing ? loading || checkingUsername : false}
          disabled={isEditing && isUsernameAvailable === false}
          onClick={isEditing ? handleAccountSave : () => setIsEditing(true)}
        >
          {isEditing ? 'Save Details' : 'Edit'}
        </Button>
      </div>
    );
  };

  // Render Level tab content
  const renderLevelSettings = () => {
    const getXPForLevel = (lvl: number) => {
      if (lvl <= 0) return 0;
      if (lvl === 1) return 100;
      if (lvl < 5) return 100 + (lvl - 1) * 25;
      if (lvl === 5) return 200;
      if (lvl < 10) return 200 + (lvl - 5) * 60;
      return 5 * lvl * lvl;
    };

    const nextLevel = Math.min(currentLevel + 1, 100);
    const currentLevelXP = getXPForLevel(currentLevel);
    const nextLevelXP = getXPForLevel(nextLevel);

    const levelProgressPercentage = (() => {
      if (currentLevel >= 100) return 100;
      const levelXPDiff = nextLevelXP - currentLevelXP;
      const earnedInCurrentLevel = totalXP - currentLevelXP;
      return Math.max(0, Math.min(100, (earnedInCurrentLevel / levelXPDiff) * 100));
    })();

    const xpNeededForNext = currentLevel >= 100 ? 0 : nextLevelXP - totalXP;

    const currentMilestoneObj = [...milestones].reverse().find(m => currentLevel >= m.lvl) || milestones[0];
    const ActiveMilestoneIcon = currentMilestoneObj.icon;

    const currentMilestoneLvl = currentMilestoneObj.lvl;
    const nextMilestoneObj = milestones.find(m => m.lvl > currentLevel) || null;
    const nextMilestoneLvl = nextMilestoneObj ? nextMilestoneObj.lvl : null;

    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Main Level Progress Card */}
        <Card className="p-8 relative overflow-hidden bg-gradient-to-br from-indigo-50/50 via-white to-primary-50/20 border border-primary-100 shadow-md">
          {/* Decorative background circle */}
          <div className="absolute -right-16 -top-16 w-48 h-48 bg-primary-100/30 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            {/* Level Badge Circle */}
            <div className="relative shrink-0 flex items-center justify-center w-36 h-36 rounded-full bg-gradient-to-tr from-primary to-indigo-600 shadow-xl shadow-primary/20 ring-4 ring-white animate-bounce-in">
              <div className="text-center text-white">
                <span className="block text-xs font-bold uppercase tracking-widest opacity-80">Level</span>
                <span className="block text-5xl font-black font-headline-lg leading-none">{currentLevel}</span>
              </div>
            </div>

            {/* Level Info */}
            <div className="flex-grow text-center md:text-left w-full">
              <span className="text-xs font-bold bg-primary-100 text-primary-850 px-3 py-1 rounded-full uppercase tracking-wider select-none">
                Current Milestone
              </span>
              <div className="flex items-center justify-center md:justify-start gap-3 mt-3 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary flex items-center justify-center border border-primary-200 shadow-sm shrink-0">
                  <ActiveMilestoneIcon size={20} />
                </div>
                <h3 className="font-black text-2xl text-surface-950 font-headline-md leading-none">
                  {currentMilestoneObj.label}
                </h3>
              </div>
              <p className="text-sm text-surface-550 mb-6 font-body-md max-w-lg leading-relaxed select-none">
                You achieved Milestone <span className="text-base font-extrabold text-indigo-700">Level {currentMilestoneLvl}</span>.
                {nextMilestoneLvl ? (
                  <> Next Milestones unlocks in <span className="text-base font-extrabold text-primary-700">Level {nextMilestoneLvl}</span>.</>
                ) : (
                  <> 🎉 Max Milestone Reached!</>
                )}
              </p>

              {/* Progress Stats */}
              <div className="flex justify-between items-end text-sm font-semibold text-surface-700 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs bg-primary-50 text-primary px-2.5 py-1 rounded-full font-extrabold shadow-sm">
                    {totalXP} XP Total
                  </span>
                </div>
                {currentLevel < 100 ? (
                  <span className="text-xs text-surface-500 font-bold">
                    {xpNeededForNext} XP to Level {nextLevel}
                  </span>
                ) : (
                  <span className="text-xs text-success-600 font-extrabold uppercase tracking-wide">
                    🎉 Max Level Reached
                  </span>
                )}
              </div>

              {/* Progress Bar Container */}
              <div className="w-full h-4 bg-surface-100 rounded-full overflow-hidden shadow-inner border border-surface-200/50">
                <div
                  className="h-full bg-gradient-to-r from-primary to-indigo-600 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${levelProgressPercentage}%` }}
                />
              </div>

              {/* Bottom labels */}
              <div className="flex justify-between items-center mt-2.5 text-xs text-surface-450 font-bold">
                <span>Level {currentLevel} ({currentLevelXP} XP)</span>
                <span>{levelProgressPercentage.toFixed(0)}% Completed</span>
                <span>Level {nextLevel} ({nextLevelXP} XP)</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Level Path/Guide */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-surface-100 pb-4">
            <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
              <Trophy size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-surface-900 font-headline-sm">Milestones Badges</h3>
              <p className="text-sm text-surface-500 font-body-md">Check the levels required to unlock and equip milestones Badges!</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {milestones.map((m) => {
              const isPassed = currentLevel >= m.lvl;
              const IconComponent = m.icon;
              return (
                <div
                  key={m.lvl}
                  className={`p-5 rounded-2xl border-2 flex flex-col justify-between gap-4 transition-all duration-300 ${
                    isPassed
                      ? 'border-primary-200 bg-gradient-to-br from-primary-50/30 via-white to-primary-50/10 shadow-sm shadow-primary/5'
                      : 'border-surface-200 bg-surface-50/50 opacity-60 shadow-none'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    {/* Icon & Milestone */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                        isPassed
                          ? 'bg-primary-50 border-primary-200 text-primary'
                          : 'bg-surface-100 border-surface-200 text-surface-400'
                      }`}>
                        <IconComponent size={24} className={isPassed ? 'animate-pulse-subtle' : ''} />
                      </div>
                      <div className="min-w-0">
                        <span className={`block text-[10px] font-extrabold uppercase tracking-wider ${
                          isPassed ? 'text-primary' : 'text-surface-400'
                        }`}>
                          Level {m.lvl}
                        </span>
                        <h4 className={`font-black text-sm truncate ${
                          isPassed ? 'text-surface-950' : 'text-surface-550 blur-sm select-none'
                        }`} title={isPassed ? m.label : 'Locked Milestone'}>
                          {m.label}
                        </h4>
                        <span className={`block text-[11px] font-bold mt-0.5 ${
                          isPassed ? 'text-surface-500' : 'text-surface-400'
                        }`}>
                          {m.xp.toLocaleString()} XP
                        </span>
                      </div>
                    </div>

                    {/* Status Badge / Equip Button */}
                    {isPassed ? (
                      equippedBadges.includes(m.label) ? (
                        <button
                          onClick={() => handleToggleEquipBadge(m.label)}
                          className="text-xs font-bold text-success-700 bg-success-50 hover:bg-success-100 border border-success-200 px-3 py-1.5 rounded-xl cursor-pointer transition-colors shadow-sm shrink-0"
                          title="Click to Unequip Badge"
                        >
                          Equipped
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleEquipBadge(m.label)}
                          className="text-xs font-bold text-primary bg-primary-50 hover:bg-primary-100 border border-primary-200 px-3 py-1.5 rounded-xl cursor-pointer transition-colors shadow-sm shrink-0"
                          title="Click to Equip Badge"
                        >
                          Equip
                        </button>
                      )
                    ) : (
                      <div className="text-[10px] font-extrabold bg-surface-100 text-surface-500 border border-surface-200 px-2.5 py-1 rounded-xl flex items-center gap-1 uppercase tracking-wider shrink-0 select-none">
                        <Lock size={10} /> Locked
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  };

  // Render Points & Titles tab content
  const renderPointsSettings = () => {
    
    const currentTitleObj = [...titles].reverse().find(t => totalXP >= t.xp) || titles[0];
    const nextTitleObj = titles.find(t => t.xp > totalXP) || null;

    const handleEquipTitle = async (titleName: string | null) => {
      if (!profile) return;
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ title: titleName })
          .eq('id', profile.id);
        
        if (error) {
          toast(error.message, 'error');
        } else {
          setProfile({
            ...profile,
            title: titleName,
          });
          toast(titleName ? `Equipped title: ${titleName}! 🎓` : 'Unequipped title!', 'success');
        }
      } catch (err) {
        console.error(err);
        toast('Failed to update title', 'error');
      }
    };

    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Current Title Showcase Card */}
        <Card className="p-8 relative overflow-hidden bg-gradient-to-br from-amber-50/50 via-white to-orange-50/20 border border-amber-200 shadow-md">
          {/* Decorative background circle */}
          <div className="absolute -right-16 -top-16 w-48 h-48 bg-amber-100/30 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            {/* Star Icon container with XP count */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-tr from-warning-500 to-amber-500 shadow-lg shadow-warning-500/20 ring-4 ring-white animate-bounce-in">
                <Star size={48} className="text-white fill-white/20 text-warning-100" />
              </div>
              <div className="text-center font-extrabold text-warning-700 bg-warning-50 border border-warning-200 px-4 py-1.5 rounded-2xl text-base shadow-sm select-none animate-fade-in whitespace-nowrap shrink-0">
                {displayedXP.toLocaleString()} XP
              </div>
            </div>

            {/* Level Info */}
            <div className="flex-grow text-center md:text-left w-full">
              <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full uppercase tracking-wider">
                Current Title
              </span>
              <h3 className="font-black text-3xl text-surface-950 font-headline-md mt-2.5 mb-1.5">
                {profile?.title || 'No Title Equipped'}
              </h3>
              <p className="text-sm text-surface-550 mb-4 font-body-md">
                You have accumulated <strong className="text-surface-700">{totalXP} XP</strong>.
                {nextTitleObj ? (
                  <span> Next title unlocks in <strong className="text-surface-750">{nextTitleObj.xp - totalXP} XP</strong>.</span>
                ) : (
                  <span> You have unlocked the ultimate title! You are a true legend.</span>
                )}
              </p>

              {nextTitleObj && (
                <div>
                  <div className="flex justify-between items-center text-xs font-bold text-surface-500 mb-1.5">
                    <span>Progress to Next Title...</span>
                    <span>{((totalXP / nextTitleObj.xp) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-surface-100 rounded-full overflow-hidden shadow-inner border border-surface-200/50">
                    <div
                      className="h-full bg-warning-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(100, (totalXP / nextTitleObj.xp) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Titles Roadmap Grid */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-surface-100 pb-4">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Award size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-surface-900 font-headline-sm">Title Tiers</h3>
              <p className="text-sm text-surface-500 font-body-md">Unlock these titles by earning XP across the platform</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {titles.map((t) => {
              const isUnlocked = totalXP >= t.xp;
              const isNext = nextTitleObj?.xp === t.xp;

              return (
                <div
                  key={t.title}
                  className={`p-4 rounded-2xl border-2 flex items-center justify-between gap-4 transition-all duration-200 ${
                    isUnlocked
                      ? 'border-amber-100 bg-amber-50/20 shadow-sm shadow-amber-500/5'
                      : isNext
                      ? 'border-primary/30 bg-primary-50/10 shadow-sm animate-pulse-subtle'
                      : 'border-surface-200 bg-surface-50/50 opacity-60 shadow-none'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Badge Indicator */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isUnlocked
                        ? 'bg-amber-100 text-amber-700'
                        : isNext
                        ? 'bg-primary-100 text-primary'
                        : 'bg-surface-100 text-surface-400'
                    }`}>
                      {isUnlocked ? (
                        <Check size={18} className="stroke-[3]" />
                      ) : isNext ? (
                        <Award size={18} className="stroke-[2.5]" />
                      ) : (
                        <Lock size={16} />
                      )}
                    </div>
                    <div>
                      <h4 className={`font-extrabold text-surface-900 leading-snug ${
                        isUnlocked ? '' : 'blur-sm select-none'
                      }`} title={isUnlocked ? t.title : 'Locked Title'}>
                        {t.title}
                      </h4>
                      <p className="text-xs text-surface-450 font-bold mt-0.5">
                        {t.xp.toLocaleString()} XP Required
                      </p>
                    </div>
                  </div>

                  <div>
                    {isUnlocked ? (
                      profile?.title === t.title ? (
                        <button
                          onClick={() => handleEquipTitle(null)}
                          className="text-xs font-bold text-success-700 bg-success-50 hover:bg-success-100 border border-success-200 px-3 py-1.5 rounded-xl cursor-pointer transition-colors shadow-sm"
                          title="Click to Unequip"
                        >
                          Equipped
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEquipTitle(t.title)}
                          className="text-xs font-bold text-warning-700 bg-warning-50 hover:bg-warning-100 border border-warning-200 px-3 py-1.5 rounded-xl cursor-pointer transition-colors shadow-sm"
                          title="Click to Equip"
                        >
                          Equip
                        </button>
                      )
                    ) : isNext ? (
                      <span className="text-xs font-bold text-primary bg-primary-50/50 px-3 py-1.5 rounded-xl">
                        Next Up
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-surface-400 bg-surface-50 px-3 py-1.5 rounded-xl border border-surface-150">
                        Locked
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  };

  // Render Avatar tab content
  const renderAvatarSettings = () => {
    const initials = profile?.full_name?.[0]?.toUpperCase() || '?';
    let previewAvatarUrl: string | null = null;
    if (avatarType === 'preset' && selectedPreset) {
      const previewBgColor = adjustColorShade(selectedBgColor, shadeIntensity);
      previewAvatarUrl = `preset:${selectedPreset}:${previewBgColor}`;
    } else if (avatarType === 'google') {
      previewAvatarUrl = googleAvatarUrl;
    }

    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Preview Card */}
        <Card className="flex flex-col items-center justify-center p-8 text-center">
          <Avatar
            avatarUrl={previewAvatarUrl}
            initials={initials}
            className="w-24 h-24 text-4xl font-extrabold border-4 border-white shadow-lg ring-4 ring-primary-100 animate-bounce-in"
          />
          <div className="mt-4">
            <h4 className="font-bold text-surface-900">{profile?.full_name || 'Student'}</h4>
            <p className="text-xs text-surface-500">Previewing your custom avatar</p>
          </div>
          <div className="mt-4">
            {googleAvatarUrl ? (
              avatarType === 'google' ? (
                <button
                  onClick={() => {
                    setAvatarType('initials');
                    setSelectedPreset(null);
                  }}
                  className="text-xs text-danger-600 hover:text-danger-700 hover:underline font-semibold flex items-center gap-1.5 transition-colors cursor-pointer mx-auto"
                >
                  <Trash2 size={12} /> Reset to initials
                </button>
              ) : (
                <button
                  onClick={() => {
                    setAvatarType('google');
                    setSelectedPreset(null);
                  }}
                  className="text-xs text-primary hover:text-primary/90 hover:underline font-semibold flex items-center gap-1.5 transition-colors cursor-pointer mx-auto"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Use Google photo
                </button>
              )
            ) : (
              avatarType === 'preset' && (
                <button
                  onClick={() => {
                    setAvatarType('initials');
                    setSelectedPreset(null);
                  }}
                  className="text-xs text-danger-600 hover:text-danger-700 hover:underline font-semibold flex items-center gap-1.5 transition-colors cursor-pointer mx-auto"
                >
                  <Trash2 size={12} /> Reset to initials
                </button>
              )
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Character Selection */}
          <Card className="flex flex-col h-[380px]">
            <div className="flex items-center gap-3 mb-4 border-b border-surface-100 pb-3 shrink-0">
              <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
                <Smile size={22} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-surface-900 font-headline-sm">Choose Character</h3>
                <p className="text-sm text-surface-500 font-body-md">Pick a preset to represent you!</p>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-4 justify-center sm:justify-start pb-2">
                {Object.entries(avatarPresets).map(([key, emoji]) => {
                  const isSelected = avatarType === 'preset' && selectedPreset === key;
                  const reqLevel = avatarPresetLevels[key] || 1;
                  const isLocked = currentLevel < reqLevel;

                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (isLocked) {
                          toast(`Level ${reqLevel} is required!`, 'error');
                        } else {
                          setSelectedPreset(key);
                          setAvatarType('preset');
                        }
                      }}
                      className={`
                        relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer text-3xl
                        ${
                          isLocked
                            ? 'bg-transparent opacity-40 grayscale-[40%]'
                            : isSelected
                            ? 'bg-primary-50 ring-4 ring-primary/30 scale-110 shadow-sm animate-bounce-in'
                            : 'bg-transparent hover:bg-surface-100 hover:scale-105'
                        }
                      `}
                      title={`${key}${isLocked ? ` (Requires Level ${reqLevel})` : ''}`}
                    >
                      <span className="select-none">{emoji}</span>
                      {isLocked && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-surface-200 text-surface-600 rounded-full border border-white flex items-center justify-center shadow-sm">
                          <Lock size={8} className="stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Background Color Selection */}
          {selectedPreset ? (
            <Card className="flex flex-col h-[380px] animate-fade-in justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4 border-b border-surface-100 pb-3 shrink-0">
                  <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
                    <Palette size={22} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-surface-900 font-headline-sm">Choose Background Color</h3>
                    <p className="text-sm text-surface-500 font-body-md">Pick a background color for your character</p>
                  </div>
                </div>

                {/* Base Color Circles */}
                <div className="flex flex-wrap gap-3.5 justify-center sm:justify-start">
                  {avatarBgColors.map((color) => {
                    const isSelected = selectedBgColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => setSelectedBgColor(color)}
                        className={`
                          w-9 h-9 rounded-full transition-all duration-200 relative cursor-pointer hover:scale-110 flex items-center justify-center shadow-md
                          ${isSelected ? 'ring-4 ring-offset-2 ring-primary scale-105' : ''}
                        `}
                        style={{ backgroundColor: color }}
                      >
                        {isSelected && <Check size={16} className="text-white drop-shadow-md stroke-[3px]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Shade Intensity Slider */}
              <div className="mt-4 pt-4 border-t border-surface-100 flex flex-col gap-3 shrink-0">
                <div className="flex justify-between items-center text-sm font-semibold text-surface-700">
                  <span>Color Shade Intensity</span>
                  <span className="text-xs bg-primary-50 text-primary px-2.5 py-1 rounded-full font-bold">
                    {shadeIntensity === 100 ? 'Normal Shade' : shadeIntensity === 0 ? 'Lightest Shade' : `${shadeIntensity}%`}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-surface-400 font-bold select-none">Light</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={shadeIntensity}
                    onChange={(e) => setShadeIntensity(parseInt(e.target.value))}
                    className="flex-1 accent-primary h-2 bg-surface-100 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-surface-500 font-bold select-none">Normal</span>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="h-[380px] flex flex-col items-center justify-center p-8 text-center text-surface-400 bg-surface-50/50 border-2 border-dashed border-surface-200">
              <Palette size={32} className="mb-3 stroke-[1.5] text-surface-300" />
              <h4 className="font-bold text-sm text-surface-650">Background Colors Locked</h4>
              <p className="text-xs mt-1.5 max-w-[220px] text-surface-500 font-body-md leading-relaxed">
                Please choose a character first to unlock background colors and shading.
              </p>
            </Card>
          )}
        </div>

        <Button
          size="lg"
          className="w-full shadow-lg !bg-primary hover:!bg-primary/95 active:!bg-primary/90 text-white transition-colors"
          icon={<Save size={18} />}
          loading={loading}
          onClick={handleAvatarSave}
        >
          Save Avatar
        </Button>
      </div>
    );
  };

  // Render User Profile tab content
  const renderUserProfileSettings = () => {
    const initials = profile?.full_name?.[0]?.toUpperCase() || '?';
    const fullTitle = profile?.title || '';
    let titleEmoji = '🏷️';
    let titleText = 'No Title Equipped';
    if (fullTitle) {
      const firstSpaceIndex = fullTitle.indexOf(' ');
      if (firstSpaceIndex !== -1) {
        titleEmoji = fullTitle.substring(0, firstSpaceIndex).trim();
        titleText = fullTitle.substring(firstSpaceIndex + 1).trim();
      } else {
        titleText = fullTitle;
      }
    }

    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Main Profile Card (Hero Section) */}
        <Card className="p-8 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg bg-white relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute -right-24 -top-24 w-64 h-64 bg-primary-50/45 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-center gap-8 relative z-10">
            {/* Avatar with neon glowing border */}
            <div className="relative shrink-0 rounded-full ring-4 ring-primary/30 shadow-[0_0_20px_rgba(94,59,219,0.25)] p-0.5 bg-white">
              <Avatar
                avatarUrl={profile?.avatar_url || null}
                initials={initials}
                className="w-24 h-24 text-4xl font-extrabold border-2 border-white"
              />
            </div>

            {/* Profile Info */}
            <div className="text-center sm:text-left">
              <h2 className="text-3xl font-black text-surface-950 font-headline-md tracking-tight">
                {profile?.full_name || 'Student'}
              </h2>
              <p className="text-sm text-surface-500 font-semibold mt-1">
                @{profile?.username || 'username'}
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                <span className="font-extrabold text-sm text-warning-700 bg-warning-50 border border-warning-200 px-3.5 py-1.5 rounded-full shadow-sm select-none">
                  {totalXP.toLocaleString()} XP
                </span>
                <span className="font-extrabold text-sm text-primary bg-primary-50 border border-primary-200 px-3.5 py-1.5 rounded-full shadow-sm select-none">
                  Level {currentLevel}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats & Level Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Experience Title Card */}
          <div 
            onClick={() => setActiveTab('points')}
            className={`p-6 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer relative overflow-hidden flex items-center justify-between gap-4 ${
              fullTitle
                ? 'bg-white border border-surface-200 shadow-sm hover:shadow-md'
                : 'bg-slate-50/90 border-2 border-dashed border-slate-300 shadow-inner hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                fullTitle
                  ? 'bg-amber-50 text-amber-600 border-amber-100 shadow-sm'
                  : 'bg-white text-primary border-2 border-dashed border-primary/50 shadow-xs'
              }`}>
                {fullTitle ? (
                  <span className="text-2xl">{titleEmoji}</span>
                ) : (
                  <Plus size={22} className="stroke-[2.5]" />
                )}
              </div>
              <div className="min-w-0">
                <span className={`inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full select-none mb-1.5 border ${
                  fullTitle
                    ? 'text-amber-800 bg-amber-50 border-amber-200'
                    : 'text-slate-500 bg-slate-200/70 border-slate-300/60'
                }`}>
                  Current Title
                </span>
                <h4 className={`font-black text-lg leading-snug truncate ${
                  fullTitle ? 'text-surface-900' : 'text-slate-500 font-bold'
                }`}>
                  {titleText}
                </h4>
                <p className={`text-xs mt-1 font-body-md ${
                  fullTitle ? 'text-surface-500' : 'text-slate-400 font-semibold'
                }`}>
                  {fullTitle ? 'Equipped Title' : 'Click to equip a title'}
                </p>
              </div>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setActiveTab('points'); }}
              className="text-xs font-bold text-primary hover:underline shrink-0 cursor-pointer"
              title={fullTitle ? 'Change Title' : 'Equip Title'}
            >
              {fullTitle ? 'Change' : 'Equip'}
            </button>
          </div>

          {/* Competitive Rank Arena Widget */}
          <Card className="p-6 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg bg-white relative overflow-hidden flex flex-col justify-center">
            {/* Decorative background element */}
            <div className="absolute -right-12 -bottom-12 w-32 h-32 bg-slate-100/50 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex items-center gap-4 relative z-10 opacity-30 select-none pointer-events-none">
              {/* Diamond Badge */}
              <div className="flex items-center justify-center p-3.5 bg-slate-50 border border-slate-200/60 rounded-2xl shadow-sm shrink-0">
                <svg className="w-12 h-12 drop-shadow-sm" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="silverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="40%" stopColor="#e2e8f0" />
                      <stop offset="70%" stopColor="#cbd5e1" />
                      <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2L3 12L12 21L21 12L12 2z" fill="url(#silverGradient)" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 5L6 12L12 19L18 12L12 5z" fill="#ffffff" opacity="0.4" />
                  <path d="M12 8L9 12L12 16L15 12L12 8z" fill="#94a3b8" opacity="0.3" />
                </svg>
              </div>
              
              {/* Text description */}
              <div className="min-w-0">
                <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full select-none mb-1.5">
                  Current Rank
                </span>
                <h4 className="font-headline-sm font-black text-lg text-surface-900 leading-none">
                  Silver III
                </h4>
                <p className="text-xs font-bold text-slate-700 mt-1 font-body-md truncate">
                  Rank #1 in School
                </p>
              </div>
            </div>

            {/* Glassmorphic coming soon overlay */}
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-auto">
              <div className="flex items-center gap-3 bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-md border border-slate-100 animate-fade-in">
                <div className="w-8 h-8 bg-primary-50 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary-100">
                  <Trophy size={16} className="animate-pulse" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-sm text-surface-900 leading-none">Rank Arena</h4>
                  <span className="text-[9px] font-extrabold text-primary uppercase tracking-wider block mt-1 leading-none">Coming Soon..</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Badges Container */}
        <Card className="p-6 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg bg-white relative overflow-hidden">
          {/* Decorative background flare */}
          <div className="absolute -left-12 -top-12 w-24 h-24 bg-primary-50/20 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider text-primary bg-primary-50 border border-primary-200 px-2.5 py-0.5 rounded-full select-none">
                Badge Collection ({equippedBadges.length})
              </span>
              {equippedBadges.length > 0 && (
                <button
                  onClick={() => setActiveTab('level')}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Manage Badges
                </button>
              )}
            </div>

            {equippedBadges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/80 shadow-inner my-2">
                <button
                  onClick={() => setActiveTab('level')}
                  className="w-14 h-14 rounded-full border-2 border-dashed border-primary/50 bg-white text-primary flex items-center justify-center shadow-xs hover:scale-110 hover:border-primary hover:bg-primary-50 transition-all cursor-pointer group mb-2.5"
                  title="Equip Badges in Levels and Badges"
                >
                  <Plus size={26} className="group-hover:rotate-90 transition-transform duration-300 stroke-[2.5]" />
                </button>
                <p className="text-xs font-extrabold text-slate-500 text-center">No Badges Equipped</p>
                <button
                  onClick={() => setActiveTab('level')}
                  className="text-[11px] font-extrabold text-primary hover:underline mt-1 cursor-pointer uppercase tracking-wider"
                >
                  + Equip Badges in Levels
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-y-6 gap-x-4 items-center justify-items-center">
                {milestones.filter(m => equippedBadges.includes(m.label)).map((m) => {
                  const MilestoneIcon = m.icon;
                  return (
                    <div 
                      key={m.label} 
                      onClick={() => setActiveTab('level')}
                      className="group flex flex-col items-center gap-2 cursor-pointer transition-all duration-300 hover:scale-105"
                      title={`${m.label} (Level ${m.lvl}) - Click to manage`}
                    >
                      <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm relative transition-all duration-300 bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200/60 text-primary">
                        <MilestoneIcon size={20} className="group-hover:animate-bounce-in stroke-[2.5]" />
                        <div className="absolute inset-0 rounded-full border border-primary-400/20 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                      <span className="text-[10px] font-extrabold text-surface-700 font-body-md text-center max-w-[70px] truncate">
                        {m.label}
                      </span>
                    </div>
                  );
                })}

                {/* Dotted circular (+) button to add more */}
                <div 
                  onClick={() => setActiveTab('level')}
                  className="group flex flex-col items-center gap-2 cursor-pointer transition-all duration-300 hover:scale-105"
                  title="Equip more badges from Levels"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-dashed border-primary/40 bg-slate-50 text-primary group-hover:border-primary group-hover:bg-primary-50 transition-all duration-300 shadow-2xs">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 font-body-md text-center">
                    Add
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  };

  // Render Theme tab content
  const renderThemeSettings = () => {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <div className="flex items-center gap-3 mb-6 border-b border-surface-100 pb-4">
            <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
              <Palette size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-surface-900 font-headline-sm">Choose Theme Color</h3>
              <p className="text-sm text-surface-500 font-body-md">Pick a color that inspires you to learn!</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Object.values(themes).map((theme) => {
              const isActive = currentTheme === theme.key;
              return (
                <button
                  key={theme.key}
                  onClick={() => handleThemeChange(theme.key)}
                  className={`relative p-5 rounded-2xl border-2 flex flex-col items-center gap-4 text-center cursor-pointer transition-all duration-300 bouncy ${
                    isActive
                      ? ''
                      : 'border-surface-200 hover:border-[var(--local-primary)] hover:bg-surface-50/50'
                  }`}
                  style={{
                    '--local-primary': theme.primary,
                    ...(isActive
                      ? {
                          borderColor: 'var(--local-primary)',
                          backgroundColor: `${theme.primary}12`,
                          boxShadow: `0 0 0 2px ${theme.primary}33`,
                        }
                      : {}),
                  } as React.CSSProperties}
                >
                  {/* Circle Swatch */}
                  <div
                    className="w-14 h-14 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-105"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {isActive && (
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-md animate-bounce-in">
                        <Check size={14} style={{ color: theme.primary }} className="stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="font-bold text-surface-900 text-sm font-label-md">
                      {theme.name.split(' ')[0]}
                    </span>
                    <span className="block text-lg mt-0.5">
                      {theme.name.split(' ')[1] || '🎨'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Button
          size="lg"
          className="w-full shadow-lg text-white transition-all duration-200 hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: themes[currentTheme]?.primary || 'var(--color-primary)' }}
          icon={<Save size={18} />}
          onClick={handleThemeSave}
        >
          Save Theme
        </Button>
      </div>
    );
  };

  // Render Privacy tab content
  const renderPrivacySettings = () => {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Locked Feature Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-900">
          <Lock className="shrink-0 text-amber-500 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-sm">Privacy settings are locked</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              These settings have been pre-configured and locked by your school administrator.
            </p>
          </div>
        </div>

        <Card>
          <div className="flex items-center gap-3 mb-6 border-b border-surface-100 pb-4">
            <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
              <Shield size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-surface-900 font-headline-sm">Privacy Options</h3>
              <p className="text-sm text-surface-500 font-body-md">Choose how your profile appears to others</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as 'public' | 'private')}
              options={[
                { value: 'public', label: '🌍 Public — Full profile visible to others' },
                { value: 'private', label: '🔒 Private — Only name, picture, and score visible' },
              ]}
              label="Profile Visibility"
              disabled={true}
            />
          </div>
        </Card>

        <Button
          size="lg"
          className="w-full shadow-lg"
          variant="outline"
          disabled={true}
          icon={<Lock size={18} />}
        >
          Privacy Settings Locked
        </Button>
      </div>
    );
  };

  const handleCheckUpdates = () => {
    setCheckingUpdates(true);
    setUpdateChecked(false);
    setTimeout(() => {
      setCheckingUpdates(false);
      setUpdateChecked(true);
      toast('Update check complete! 🔍', 'success');
    }, 1500);
  };

  const renderVersionSettings = () => {
    return (
      <div className="flex flex-col gap-6">
        {/* Current Version Card */}
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-primary-50 text-primary rounded-2xl flex items-center justify-center shadow-inner">
              <RefreshCw size={24} className={checkingUpdates ? 'animate-spin' : ''} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-surface-900 font-headline-sm">System Update & Version</h3>
              <p className="text-sm text-surface-500 font-body-md">Manage app builds and update preferences.</p>
            </div>
          </div>

          <div className="p-5 bg-surface-50 rounded-2xl border border-surface-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">Current Build</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-black text-surface-900 font-headline-sm">v{currentVersion}</span>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-success-50 text-success-700 border border-success-200 rounded-full">
                  Active
                </span>
              </div>
            </div>
            <Button
              onClick={handleCheckUpdates}
              loading={checkingUpdates}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              Check for Updates
            </Button>
          </div>
        </Card>

        {/* Update Selection or Status */}
        {updateChecked && (
          <Card className="animate-fade-in flex flex-col items-center text-center p-8">
            <div className="w-16 h-16 bg-success-50 text-success-600 rounded-full flex items-center justify-center mb-4 shadow-inner animate-bounce-in">
              <Check size={32} className="stroke-[3]" />
            </div>
            <h4 className="font-extrabold text-surface-900 text-lg mb-1 font-headline-sm">
              Current Version is updated
            </h4>
            <p className="text-sm text-surface-500 font-body-md">
              Quizlee v{currentVersion} is currently the latest stable version available.
            </p>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <h1 className="text-2xl font-extrabold text-surface-900 mb-2 font-headline-md">Settings ⚙️</h1>
      <p className="text-surface-500 mb-8 font-body-md">Manage your account, appearance, and privacy</p>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible gap-2 pb-4 md:pb-0 border-b md:border-b-0 border-surface-100">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const isLocked = 'locked' in tab && tab.locked;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl font-bold text-sm transition-all duration-200 text-left bouncy cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                    : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <tab.icon size={18} className={isActive ? 'stroke-[2.5px]' : ''} />
                  <span>{tab.label}</span>
                </div>
                {isLocked && <Lock size={14} className="text-surface-400 ml-2" />}
              </button>
            );
          })}
        </div>

        {/* Right Content Panel */}
        <div className="flex-grow">
          {activeTab === 'account' && renderAccountSettings()}
          {activeTab === 'avatar' && renderAvatarSettings()}
          {activeTab === 'profile_view' && renderUserProfileSettings()}
          {activeTab === 'level' && renderLevelSettings()}
          {activeTab === 'points' && renderPointsSettings()}
          {activeTab === 'theme' && renderThemeSettings()}
          {activeTab === 'privacy' && renderPrivacySettings()}
          {activeTab === 'version' && renderVersionSettings()}
        </div>
      </div>
    </div>
  );
}
