import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { 
  Award, 
  Star, 
  X, 
  Sparkles, 
  Compass,
  UserPlus,
  Share2,
  Copy,
  Check,
  Mail,
  MessageSquare,
  Send,
  Zap,
  Rocket,
  Shield,
  Smile,
  Trophy,
  RefreshCw,
  Lock,
  Palette,
  Crown
} from 'lucide-react';

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

interface FriendProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  points: number;
  title: string | null;
  milestone: string | null;
  class_id: string | null;
  school_id: string | null;
  created_at: string;
  privacy: 'public' | 'private';
}

export default function FriendsPage() {
  const { profile } = useAuthStore();
  const location = useLocation();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'school' | 'class'>('school');
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (location.state?.showInvite) {
      setShowInviteModal(true);
    }
  }, [location]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Join me on Quizlee!',
          text: 'Practice, compete and learn together on Quizlee!',
          url: window.location.origin,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    }
  };

  // Level Logic
  const getLevelFromXP = (totalXP: number) => {
    if (totalXP < 100) return 0;
    if (totalXP < 200) return Math.min(4, Math.floor(1 + (totalXP - 100) / 25));
    if (totalXP < 500) return Math.min(9, Math.floor(5 + (totalXP - 200) / 60));
    return Math.min(100, Math.floor(Math.sqrt(totalXP / 5)));
  };

  useEffect(() => {
    async function fetchData() {
      if (!profile) return;
      setLoading(true);

      try {
        // Fetch friends (other students in the same school)
        if (profile.school_id) {
          const { data: profilesData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('school_id', profile.school_id)
            .eq('role', 'student')
            .neq('id', profile.id)
            .order('points', { ascending: false });

          if (error) throw error;
          setFriends(profilesData || []);
        }
      } catch (err) {
        console.error('Error fetching friends data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [profile]);

  // Filter friends based on selected tab (school vs class)
  const filteredFriends = friends.filter((friend) => {
    if (activeTab === 'class') {
      return friend.class_id === profile?.class_id;
    }
    return true;
  });

  // Sort alphabetically by full name (or username) on any device
  const displayFriends = [...filteredFriends].sort((a, b) => {
    const nameA = (a.full_name || a.username || '').toLowerCase();
    const nameB = (b.full_name || b.username || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl mx-auto pb-16">

      {/* Title & Add Friends Button Header */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-surface-900 font-headline-md tracking-tight">
            Classmates & Friends 🎒
          </h1>
          <p className="text-xs text-surface-500 font-body-md mt-1">
            Compare progress, view profiles and invite friends to join!
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="w-full sm:w-auto bg-primary hover:bg-primary/95 text-white font-extrabold text-sm px-5 py-3 rounded-2xl cursor-pointer shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all bouncy"
        >
          <UserPlus size={18} />
          <span>Add Friends</span>
        </button>
      </div>

      {/* Control panel: Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {/* Tabs and mobile Add Friends row */}
        <div className="flex items-center justify-between gap-2 w-full md:w-auto">
          <div className="flex bg-surface-100 p-1.5 rounded-2xl border border-surface-200 w-fit shrink-0">
            <button
              onClick={() => setActiveTab('school')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'school'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-surface-500 hover:text-surface-900'
              }`}
            >
              All School ({friends.length})
            </button>
            <button
              onClick={() => setActiveTab('class')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'class'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-surface-500 hover:text-surface-900'
              }`}
            >
              My Class ({friends.filter(f => f.class_id === profile?.class_id).length})
            </button>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="md:hidden bg-primary hover:bg-primary/95 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-2xl cursor-pointer shadow-sm flex items-center justify-center gap-1.5 transition-all shrink-0 bouncy"
          >
            <UserPlus size={14} />
            <span>Add Friends</span>
          </button>
        </div>


      </div>

      {/* Friends Grid */}
      {displayFriends.length === 0 ? (
        <Card className="text-center py-16">
          <div className="text-5xl mb-4 select-none">👋</div>
          <h3 className="font-bold text-lg text-surface-900 mb-1">No Friends Found</h3>
          <p className="text-sm text-surface-500 font-body-md max-w-sm mx-auto">
            {activeTab === 'class'
              ? "There are no other students registered in your class yet."
              : "No other students have joined from your school yet."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
          {displayFriends.map((friend) => {
            const friendLevel = getLevelFromXP(friend.points);
            const initials = friend.full_name?.[0]?.toUpperCase() || friend.username?.[0]?.toUpperCase() || '?';
            
            return (
              <Card
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className="group px-3 sm:px-5 py-3.5 hover:shadow-md hover:border-primary-200 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer bg-white relative overflow-hidden"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Avatar logo */}
                  <Avatar
                    avatarUrl={friend.avatar_url}
                    initials={initials}
                    className="w-14 h-14 border-2 border-white ring-2 ring-surface-100 group-hover:ring-primary/20 text-lg font-bold shrink-0"
                  />

                  {/* Profile info details */}
                  <div className="min-w-0 flex-1 flex flex-col justify-center items-start">
                    <h3 className="w-full font-extrabold text-surface-900 truncate leading-snug group-hover:text-primary transition-colors">
                      {friend.privacy === 'public' ? friend.full_name || friend.username : friend.username || 'Hidden Friend'}
                    </h3>
                    
                    {/* Active Equipped Title badge */}
                    {friend.title ? (
                      <span className="inline-block text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-250 px-2 py-0.5 rounded-full mt-1.5 max-w-full truncate leading-none">
                        {friend.title}
                      </span>
                    ) : (
                      <span className="inline-block text-[9px] font-bold text-surface-400 bg-surface-50 border border-surface-200 px-2 py-0.5 rounded-full mt-1.5 leading-none">
                        No Title Equipped
                      </span>
                    )}
                  </div>
                </div>

                {/* Score stats footer */}
                <div className="mt-3.5 pt-2.5 border-t border-surface-100 flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-0.5 text-warning-700 font-extrabold whitespace-nowrap shrink-0">
                    <Star size={12} className="fill-warning-500 text-warning-500 shrink-0" />
                    <span>{friend.points.toLocaleString()} XP</span>
                  </div>

                  <span className="text-[10px] font-bold text-primary bg-primary-50 border border-primary-200/50 px-1.5 py-0.5 rounded-lg whitespace-nowrap shrink-0">
                    <span className="sm:hidden">Lvl </span>
                    <span className="hidden sm:inline">Level </span>
                    {friendLevel}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Friend Detail Drawer Modal */}
      {selectedFriend && (() => {
        const friendLevel = getLevelFromXP(selectedFriend.points);
        
        // Parse equipped badges list from milestone JSON array or legacy string
        let equippedBadgesList: string[] = [];
        if (selectedFriend.milestone) {
          try {
            const parsed = JSON.parse(selectedFriend.milestone);
            if (Array.isArray(parsed)) {
              equippedBadgesList = parsed;
            }
          } catch (e) {
            equippedBadgesList = [selectedFriend.milestone];
          }
        }
        const equippedMilestones = milestones.filter(m => equippedBadgesList.includes(m.label));
        const initials = selectedFriend.full_name?.[0]?.toUpperCase() || selectedFriend.username?.[0]?.toUpperCase() || '?';
        const fullTitle = selectedFriend.title || '';
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              onClick={() => setSelectedFriend(null)}
              className="absolute inset-0 bg-surface-950/40 backdrop-blur-xs animate-fade-in" 
            />

            {/* Modal Box */}
            <div className="bg-white rounded-3xl border border-surface-200 w-full max-w-md shadow-2xl relative overflow-hidden animate-scale-up z-10">
              {/* Top Banner accent color */}
              <div className="h-24 bg-gradient-to-r from-primary via-indigo-600 to-indigo-700 relative">
                <button
                  onClick={() => setSelectedFriend(null)}
                  className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-full backdrop-blur-md transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Avatar position offset */}
              <div className="px-6 pb-6 relative">
                <div className="absolute -top-12 left-6">
                  <div className="relative">
                    <Avatar
                      avatarUrl={selectedFriend.avatar_url}
                      initials={initials}
                      className="w-24 h-24 border-4 border-white shadow-md text-3xl font-extrabold"
                    />
                    <div className="absolute bottom-0 right-0 bg-gradient-to-tr from-primary to-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 border-white shadow-md">
                      {friendLevel}
                    </div>
                  </div>
                </div>

                {/* Profile Title Names */}
                <div className="pt-14">
                  <h2 className="text-2xl font-black text-surface-950 font-headline-md tracking-tight">
                    {selectedFriend.privacy === 'public' ? selectedFriend.full_name || selectedFriend.username : selectedFriend.username || 'Hidden Friend'}
                  </h2>
                  <p className="text-sm font-semibold text-surface-450">
                    @{selectedFriend.username || 'username'}
                  </p>
                </div>

                {/* XP and Level Capsules */}
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-warning-50/70 border border-warning-200 rounded-full text-warning-850 shadow-2xs">
                    <Star size={14} className="text-warning-500 fill-warning-500/10" />
                    <span className="text-xs font-black tracking-tight">{selectedFriend.points.toLocaleString()} XP</span>
                  </div>

                  <div className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-primary-50/70 border border-primary-200 rounded-full text-primary-850 shadow-2xs">
                    <Award size={14} className="text-primary fill-primary/5" />
                    <span className="text-xs font-black tracking-tight">Level {friendLevel}</span>
                  </div>
                </div>

                {/* Main Equipped Title Card */}
                <div className="mt-4 p-4 bg-gradient-to-br from-violet-50/60 to-fuchsia-50/20 border border-violet-200/80 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100/70 text-violet-750 flex items-center justify-center shrink-0 border border-violet-200 text-xl shadow-2xs">
                    {titleEmoji}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-violet-850 leading-none">
                      Equipped Title
                    </span>
                    <h4 className="font-extrabold text-sm text-surface-900 mt-1 leading-none truncate">
                      {titleText}
                    </h4>
                  </div>
                </div>

                {/* Badge Collection */}
                <div className="mt-5 border-t border-surface-100 pt-4">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-surface-400 mb-3 select-none">
                    Badge Collection ({equippedMilestones.length})
                  </span>
                  
                  {equippedMilestones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 px-4 border border-dashed border-surface-200 rounded-2xl bg-surface-50/85 text-center">
                      <Award size={24} className="text-surface-300 stroke-[2] mb-1.5" />
                      <p className="text-xs font-bold text-surface-400">No Badges Equipped Yet</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 p-2">
                      {equippedMilestones.map((m) => (
                        <Badge key={m.label} variant="info" size="sm">{m.label}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Invite Friends Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            onClick={() => setShowInviteModal(false)}
            className="absolute inset-0 bg-surface-950/40 backdrop-blur-xs animate-fade-in" 
          />

          {/* Modal Box */}
          <div className="bg-white rounded-3xl border border-surface-200 w-full max-w-md shadow-2xl relative p-6 overflow-hidden animate-scale-up z-10">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-surface-400 hover:text-surface-600 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-primary-50 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary-100 shadow-2xs">
                <UserPlus size={24} className="stroke-[2.5]" />
              </div>
              <h3 className="font-black text-xl text-surface-950 font-headline-md leading-none">
                Invite Friends & Classmates 🚀
              </h3>
              <p className="text-xs text-surface-500 font-body-md mt-2 max-w-xs mx-auto leading-relaxed">
                Invite your friends to Quizlee to compare progress, complete activities, and climb the ranks together!
              </p>
            </div>

            {/* Link Box */}
            <div className="mb-6">
              <label className="block text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2">
                Share Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={window.location.origin}
                  className="flex-1 bg-surface-50 border border-surface-250 rounded-2xl px-4 py-2.5 text-xs text-surface-650 font-mono focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="bg-primary hover:bg-primary/95 text-white font-bold text-xs px-4 py-2.5 rounded-2xl cursor-pointer shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
                >
                  {copied ? <Check size={14} className="stroke-[3]" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Quick Share Platforms */}
            <div>
              <label className="block text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-3">
                Share via Different Platforms
              </label>
              <div className="grid grid-cols-3 gap-3">
                {/* WhatsApp */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Join me on Quizlee! Let's practice, compete, and learn together! ${window.location.origin}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-2 p-3.5 bg-[#25D366]/5 hover:bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl text-[#25D366] transition-colors text-center cursor-pointer"
                >
                  <MessageSquare size={20} className="fill-[#25D366]/10" />
                  <span className="text-[10px] font-black uppercase tracking-wider">WhatsApp</span>
                </a>

                {/* Telegram */}
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(`Join me on Quizlee! Let's practice, compete, and learn together!`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-2 p-3.5 bg-[#0088cc]/5 hover:bg-[#0088cc]/10 border border-[#0088cc]/20 rounded-2xl text-[#0088cc] transition-colors text-center cursor-pointer"
                >
                  <Send size={20} className="fill-[#0088cc]/10" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Telegram</span>
                </a>

                {/* Email */}
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Join me on Quizlee!`)}&body=${encodeURIComponent(`Hey! Come check out Quizlee: ${window.location.origin}\n\nLet's learn and compete together!`)}`}
                  className="flex flex-col items-center justify-center gap-2 p-3.5 bg-surface-100 hover:bg-surface-200/70 border border-surface-250 rounded-2xl text-surface-650 transition-colors text-center cursor-pointer"
                >
                  <Mail size={20} />
                  <span className="text-[10px] font-black uppercase tracking-wider">Email</span>
                </a>
              </div>
            </div>

            {/* Native Share Fallback Button */}
            {typeof navigator.share === 'function' && (
              <button
                onClick={handleNativeShare}
                className="w-full mt-5 bg-surface-50 hover:bg-surface-100 text-surface-700 border border-surface-250 font-bold text-xs py-3 rounded-2xl cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <Share2 size={14} />
                <span>More Share Options</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
