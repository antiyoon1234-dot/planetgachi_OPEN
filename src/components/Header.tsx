import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const navItems = [
  { path: '/', label: '홈' },
  { path: '/submit', label: '아이템 제출' },
  { path: '/voting', label: '투표', badge: true },
  { path: '/results', label: '결과' },
  { path: '/shop', label: '체스트샵' },
  { path: '/auction', label: '거래소' },
];

export default function Header() {
  const location = useLocation();
  const [pendingVotesCount, setPendingVotesCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    const loadPendingVotes = async () => {
      const { data } = await supabase.from('proposals').select('id').eq('status', 'pending');
      setPendingVotesCount(data?.length ?? 0);
    };
    void loadPendingVotes();
    const channel = supabase.channel('header-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, () => void loadPendingVotes())
      .subscribe((status) => setRealtimeStatus(status === 'SUBSCRIBED' ? 'connected' : status === 'CLOSED' || status === 'CHANNEL_ERROR' ? 'disconnected' : 'connecting'));
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);
  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const stateColor = realtimeStatus === 'connected' ? 'bg-emerald-900/50 text-emerald-400' : realtimeStatus === 'connecting' ? 'bg-amber-900/50 text-amber-400' : 'bg-red-900/50 text-red-400';
  const dotColor = realtimeStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : realtimeStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400';

  const links = (mobile = false) => navItems.map((item) => (
    <a key={item.path} href={item.path} className={`relative px-4 ${mobile ? 'py-3 text-center' : 'py-2'} font-semibold transition-colors whitespace-nowrap cursor-pointer ${isActive(item.path) ? 'bg-lime-600 text-white' : 'bg-stone-700 text-white hover:bg-stone-600'}`}>
      {item.label}
      {item.badge && pendingVotesCount > 0 && <span className={`absolute ${mobile ? 'top-2 right-4' : '-top-1 -right-1'} w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white`}>!</span>}
    </a>
  ));

  return <header className="bg-stone-900 border-b-4 border-stone-950 sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 py-3 md:py-4">
      <div className="flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 md:gap-3">
          <img src="https://static.readdy.ai/image/17df2564a108ae0a0e22f6d4f873354f/e749d238aa2e6349f28b4e6c1e98a806.png" alt="PlanetGachi 로고" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
          <div className="flex flex-col"><div className="flex items-center gap-2"><h1 className="text-lg md:text-2xl font-bold text-lime-400 font-pixel">플래닛어스</h1><span className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${stateColor}`}><i className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />{realtimeStatus === 'connected' ? 'LIVE' : realtimeStatus === 'connecting' ? '연결 중' : '오프라인'}</span></div><p className="text-[10px] md:text-xs text-stone-400 hidden sm:block">가치표 사이트</p></div>
        </a>
        <div className="flex items-center gap-2 md:hidden"><span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${stateColor}`}><i className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />{realtimeStatus === 'connected' ? 'LIVE' : '연결'}</span><button onClick={() => setMobileMenuOpen((open) => !open)} className="p-2 text-white cursor-pointer" aria-label="메뉴"><i className={`ri-${mobileMenuOpen ? 'close' : 'menu'}-line text-2xl`} /></button></div>
        <nav className="hidden md:flex gap-2">{links()}<a href="/admin" className={`px-4 py-2 font-semibold transition-colors whitespace-nowrap cursor-pointer ${isActive('/admin') ? 'bg-red-700 text-white' : 'bg-red-900 text-white hover:bg-red-800'}`}>관리자</a></nav>
      </div>
      {mobileMenuOpen && <nav className="md:hidden mt-4 pb-2 flex flex-col gap-2">{links(true)}<a href="/admin" className={`px-4 py-3 font-semibold text-center cursor-pointer ${isActive('/admin') ? 'bg-red-700 text-white' : 'bg-red-900 text-white'}`}>관리자</a></nav>}
    </div>
  </header>;
}
