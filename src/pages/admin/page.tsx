import { loadCatalogTransactions } from '../../lib/loadCatalogTransactions';
import { useState, useEffect, useRef } from 'react';
import { detectAuctionAnomalies, buildAuctionBaselines, type AuctionAnomaly } from '../../lib/auctionAnomalies';
import PricingPanel from './pricing';
import { hasSupabaseConfig, supabase, type Item } from '../../lib/supabase';
import { getItemName } from '../../lib/itemNames';
import { getShops, deleteShop } from '../../mocks/shops';
import type { Shop } from '../../types/shop';

interface Proposal {
  id: number;
  item_id?: number;
  item_code: string;
  item_name: string;
  item_image: string;
  proposed_value: number;
  current_value?: number;
  current_votes: number;
  required_votes: number;
  status: string;
  submitted_by: string;
  submitted_at: string;
  type: string;
  unit_type?: string;
}

interface Banner {
  id: number;
  image: string;
  link?: string;
  title: string;
  active: boolean;
  created_at: string;
}

type MarketAdminSession = {
  token: string;
  role: 'super_admin' | 'item_admin';
};

const marketAdminSessionKey = 'market_admin_session';

export default function Admin() {
  const [items, setItems] = useState<Item[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);const [editItemForm, setEditItemForm] = useState({
    code: '',
    name: '',
    image: '',
    value: '',
    unit_type: 'piece' as 'piece' | 'set' | 'stack'
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<'super_admin' | 'item_admin'>('super_admin');
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'approved' | 'submitted' | 'banners' | 'shops' | 'anomalies' | 'settings' | 'caps' | 'average'>('approved');
  const [anomalies, setAnomalies] = useState<AuctionAnomaly[]>([]);
  const [anomalyError, setAnomalyError] = useState('');
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalyScanNotice, setAnomalyScanNotice] = useState('');
  const [newItem, setNewItem] = useState({
    code: '',
    name: '',
    image: '',
    value: '',
    unit_type: 'piece' as 'piece' | 'set' | 'stack'
  });
  const [newBanner, setNewBanner] = useState({
    title: '',
    image: '',
    link: ''
  });


  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  
  // 접속 통계 상태
  const [totalVisits, setTotalVisits] = useState(0);
  const [todayVisits, setTodayVisits] = useState(0);

  // 비밀번호 변경 관련 상태
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [targetRoleToChange, setTargetRoleToChange] = useState<'super_admin' | 'item_admin'>('super_admin');

  useEffect(() => {
    if (adminRole === 'item_admin') {
      setTargetRoleToChange('item_admin');
    } else {
      setTargetRoleToChange('super_admin');
    }
  }, [adminRole]);
  
  // Chart refs
  const donutChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const visitLineChartRef = useRef<HTMLCanvasElement>(null);
  const hourlyBarChartRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    const verifySession = async () => {
      const rawSession = localStorage.getItem(marketAdminSessionKey);
      if (!rawSession || !hasSupabaseConfig) {
        if (active) setIsLoading(false);
        return;
      }
      try {
        const storedSession = JSON.parse(rawSession) as Partial<MarketAdminSession>;
        if (!storedSession.token) return;
        const { data, error } = await supabase.rpc('market_admin_validate_session', {
          input_token: storedSession.token,
        });
        if (error || (data !== 'super_admin' && data !== 'item_admin')) return;
        if (active) {
          setSessionToken(storedSession.token);
          setAdminRole(data);
          setIsAuthenticated(true);
        }
      } catch {
        localStorage.removeItem(marketAdminSessionKey);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void verifySession();
    return () => { active = false; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!hasSupabaseConfig) {
      setLoginError('Supabase 관리자 인증 설정이 필요합니다.');
      return;
    }
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('market_admin_login', {
        input_password: password
      });

      if (error) throw error;

      const login = data as Partial<MarketAdminSession> & { ok?: boolean };
      if (login.ok && login.token && (login.role === 'super_admin' || login.role === 'item_admin')) {
        setIsAuthenticated(true);
        setAdminRole(login.role);
        setSessionToken(login.token);
        setPassword('');
        setActiveTab('approved');
        localStorage.setItem(marketAdminSessionKey, JSON.stringify({ token: login.token, role: login.role }));
      } else {
        setLoginError('비밀번호가 올바르지 않습니다.');
      }
    } catch (err: any) {
      console.error('로그인 오류:', err);
      setLoginError('로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (sessionToken) {
        await supabase.rpc('market_admin_logout', { input_token: sessionToken });
      }
    } finally {
      localStorage.removeItem(marketAdminSessionKey);
      setSessionToken(null);
      setIsAuthenticated(false);
      setAdminRole('super_admin');
      setPassword('');
      setActiveTab('approved');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError('');
    setPasswordChangeSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordChangeError('모든 필드를 입력해주세요.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('새 비밀번호와 확인이 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 3) {
      setPasswordChangeError('새 비밀번호는 최소 3자 이상이어야 합니다.');
      return;
    }

    setIsChangingPassword(true);

    try {
      const { data, error } = await supabase.rpc('change_admin_password', {
        current_password: currentPassword,
        new_password: newPassword,
        target_role: targetRoleToChange
      });

      if (error) throw error;

      if (data === 'SUCCESS') {
        setPasswordChangeSuccess('비밀번호가 성공적으로 변경되었습니다.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else if (data === 'CURRENT_PASSWORD_INCORRECT') {
        setPasswordChangeError('현재 비밀번호가 올바르지 않습니다.');
      } else if (data === 'PERMISSION_DENIED') {
        setPasswordChangeError('비밀번호 변경 권한이 없습니다.');
      } else {
        setPasswordChangeError('비밀번호 변경 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      console.error('비밀번호 변경 오류:', err);
      setPasswordChangeError('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Supabase에서 데이터 불러오기
  useEffect(() => {
    if (isAuthenticated) {
      loadItems();
      loadProposals();
      if (adminRole === "super_admin") {
        loadBanners();
        loadVisitStats();
        loadAnomalies();
        loadShops();
      }
    }
  }, [isAuthenticated, adminRole, activeTab]);
  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setItems(data);
      }
    } catch (error) {
      console.error('아이템 로드 오류:', error);
    }
  };

  const loadProposals = async () => {
    try {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('status', 'voting')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setProposals(data);
      }
    } catch (error) {
      console.error('제안 로드 오류:', error);
    }
  };

  const loadBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setBanners(data);
      }
    } catch (error) {
      console.error('배너 로드 오류:', error);
    }
  };

  const loadAnomalies = async () => {
    setAnomalyLoading(true);
    setAnomalyError('');
    try {
      const [recent, config] = await Promise.all([
        loadCatalogTransactions(),
        supabase.from('market_settings').select('setting_value').eq('setting_key', 'pricing').maybeSingle(),
      ]);
      if (config.error) throw config.error;
      const pricing = config.data?.setting_value ?? {};
      const rate = Number(pricing.anomalyRate ?? 20);
      const baselines = buildAuctionBaselines(recent, rate);
      const detected = detectAuctionAnomalies(recent, baselines, rate, Number(pricing.minimumSamples ?? 3));
      // Recompute from source transactions. Previously stored false positives must
      // not override the corrected reference or reappear in the current results.
      setAnomalies(detected.map(row => ({ ...row, detected: true })).sort((a,b) => Date.parse(b.transaction_date) - Date.parse(a.transaction_date)));
      setAnomalyScanNotice(`최근 7일 ${recent.length}건 재검사 · 동일 품목·수량의 기준 평균 대비 ±${rate}% · 최소 ${pricing.minimumSamples ?? 3}건 정상 표본 · ${detected.length}건 탐지. 과거 저장 기록은 현재 결과에 합치지 않습니다.`);
    } catch (error) {
      setAnomalyError(`이상 거래 조회·검사 실패: ${error instanceof Error ? error.message : (error as { message?: string }).message ?? '연결 오류'}`);
    } finally {
      setAnomalyLoading(false);
    }
  };

  const loadShops = async () => {
    try {
      const data = await getShops();
      setShops(data);
    } catch (error) {
      console.error('상점 로드 오류:', error);
    }
  };

  const loadVisitStats = async () => {
    try {
      const { data, error } = await supabase
        .from('visit_stats')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('방문 통계 로드 오류:', error);
        setTotalVisits(0);
        setTodayVisits(0);
        return;
      }
      
      if (data && data.length > 0) {
        // 안전한 숫자 변환
        const total = data.reduce((sum, stat) => {
          const visits = parseInt(stat.visits) || 0;
          return sum + visits;
        }, 0);
        setTotalVisits(total);
        
        const today = new Date().toISOString().split('T')[0];
        const todayStat = data.find(stat => stat.date === today);
        const todayCount = todayStat ? (parseInt(todayStat.visits) || 0) : 0;
        setTodayVisits(todayCount);
      } else {
        setTotalVisits(0);
        setTodayVisits(0);
      }
    } catch (error) {
      console.error('방문 통계 로드 오류:', error);
      setTotalVisits(0);
      setTodayVisits(0);
    }
  };// Helper function to normalize unit_type values
  const normalizeUnitType = (unitType?: string): 'piece' | 'set' | 'stack' => {
    if (!unitType) return 'piece';
    
    // Normalize various unit type formats to match database constraint
    switch (unitType.toLowerCase()) {
      case 'stack':
      case 'stack_64':
        return 'stack';
      case 'set':
      case 'stack_16':
        return 'set';
      case 'piece':
      default:
        return 'piece';
    }
  };







  const handleAddItem = async () => {
    if (!newItem.code || !newItem.name || !newItem.value) {
      alert('코드, 이름, 가치는 필수 입력 항목입니다.');
      return;
    }

    const valueNum = parseInt(newItem.value);
    if (isNaN(valueNum) || valueNum <= 0) {
      alert('올바른 가치를 입력해주세요.');
      return;
    }

    try {
      const { data: insertedItem, error: insertError } = await supabase
        .from('items')
        .insert({
          code: newItem.code,
          name: newItem.name,
          image: newItem.image || 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/9/9d/Barrier_%28held%29_JE2_BE2.png',
          current_value: valueNum,
          status: 'approved',
          votes: 0,
          unit_type: newItem.unit_type,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (insertedItem) {
        await supabase.from('value_history').insert({
          item_id: insertedItem.id,
          value: valueNum,
          previous_value: null,
          reason: '초기 등록',
          votes: 0,
          changed_at: insertedItem.created_at,
        });
      }

      await loadItems();
      setNewItem({ code: '', name: '', image: '', value: '', unit_type: 'piece' });
      setShowAddModal(false);
      alert('아이템이 추가되었습니다.');
    } catch (error) {
      console.error('아이템 추가 오류:', error);
      alert('아이템 추가 중 오류가 발생했습니다.');
    }
  };

  // 배너 이미지 업로드 핸들러
  const handleBannerImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('이미지 크기는 5MB 이하여야 합니다.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewBanner({ ...newBanner, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddBanner = async () => {
    if (!newBanner.title || !newBanner.image) {
      alert('제목과 이미지는 필수 입력 항목입니다.');
      return;
    }

    try {
      const { error } = await supabase.from('banners').insert({
        title: newBanner.title,
        image: newBanner.image,
        link: newBanner.link || null,
        active: true,
      });
      if (error) throw error;
      await loadBanners();
      setNewBanner({ title: '', image: '', link: '' });
      setShowBannerModal(false);
      alert('배너가 추가되었습니다.');
    } catch (error) {
      console.error('배너 추가 오류:', error);
      alert('배너 추가 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteBanner = async (bannerId: number) => {
    if (!confirm('정말로 이 배너를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const { error } = await supabase.from('banners').delete().eq('id', bannerId);
      if (error) throw error;
      await loadBanners();
      alert('배너가 삭제되었습니다.');
    } catch (error) {
      console.error('배너 삭제 오류:', error);
      alert('배너 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleToggleBannerActive = async (bannerId: number) => {
    try {
      const banner = banners.find(b => b.id === bannerId);
      if (!banner) return;
      const { error } = await supabase.from('banners').update({ active: !banner.active }).eq('id', bannerId);
      if (error) throw error;
      await loadBanners();
    } catch (error) {
      console.error('배너 상태 변경 오류:', error);
      alert('배너 상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('정말로 이 상점을 삭제하시겠습니까?\n모든 판매 목록도 함께 삭제됩니다.')) {
      return;
    }

    try {
      const success = await deleteShop(shopId);
      if (success) {
        await loadShops();
        alert('상점이 삭제되었습니다.');
      } else {
        alert('상점 삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('상점 삭제 오류:', error);
      alert('상점 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm('정말로 이 아이템을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) throw error;
      await loadItems();
      alert('아이템이 삭제되었습니다.');
    } catch (error) {
      console.error('아이템 삭제 오류:', error);
      alert('아이템 삭제 중 오류가 발생했습니다: ' + (error as Error).message);
    }
  };

  const handleDeleteProposal = async (proposalId: number) => {
    if (!confirm('정말로 이 제출을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const { error } = await supabase.from('proposals').delete().eq('id', proposalId);
      if (error) throw error;
      await loadProposals();
      alert('제출이 삭제되었습니다.');
    } catch (error) {
      console.error('제출 삭제 오류:', error);
      alert('제출 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleApproveProposal = async (proposal: Proposal) => {
    if (!confirm(`"${proposal.item_name}"을(를) 승인하시겠습니까?`)) {
      return;
    }

    try {
      if (proposal.type === 'new') {
        const { data: existingItem } = await supabase.from('items').select('id, name').eq('code', proposal.item_code).maybeSingle();
        if (existingItem) {
          alert(`이미 같은 코드(${proposal.item_code})를 가진 아이템이 존재합니다.\n기존 아이템: ${existingItem.name}\n\n중복된 제안을 거절하거나 삭제해주세요.`);
          return;
        }
        const normalizedUnitType = normalizeUnitType(proposal.unit_type);
        const { data: insertedItem, error: insertError } = await supabase.from('items').insert({
          code: proposal.item_code, name: proposal.item_name, image: proposal.item_image,
          current_value: proposal.proposed_value, status: 'approved', votes: proposal.current_votes,
          unit_type: normalizedUnitType,
        }).select().single();
        if (insertError) throw insertError;
        if (insertedItem) {
          await supabase.from('value_history').insert({ item_id: insertedItem.id, value: proposal.proposed_value, previous_value: null, reason: '초기 등록', votes: 0, changed_at: insertedItem.created_at });
          await supabase.from('value_history').insert({ item_id: insertedItem.id, value: proposal.proposed_value, previous_value: proposal.proposed_value, reason: '관리자 승인', votes: proposal.current_votes });
        }
      } else if (proposal.type === 'update') {
        let itemQuery = supabase.from('items').select('id, current_value');
        if (proposal.item_id) itemQuery = itemQuery.eq('id', proposal.item_id);
        else itemQuery = itemQuery.eq('code', proposal.item_code);
        const { data: item, error: fetchError } = await itemQuery.maybeSingle();
        if (fetchError) throw fetchError;
        if (!item) throw new Error('아이템을 찾을 수 없습니다');
        const { error: updateError } = await supabase.from('items').update({ current_value: proposal.proposed_value, last_modified: new Date().toISOString() }).eq('id', item.id);
        if (updateError) throw updateError;
        await supabase.from('value_history').insert({ item_id: item.id, value: proposal.proposed_value, previous_value: item.current_value, reason: '관리자 승인', votes: proposal.current_votes });
      }
      const { error: statusError } = await supabase.from('proposals').update({ status: 'approved' }).eq('id', proposal.id);
      if (statusError) throw statusError;
      await loadItems();
      await loadProposals();
      alert('제안이 승인되었습니다.');
    } catch (error) {
      console.error('승인 처리 오류:', error);
      let errorMessage = '승인 처리 중 오류가 발생했습니다.';
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) errorMessage = '이미 같은 코드를 가진 아이템이 존재합니다.\n중복된 제안을 거절하거나 삭제해주세요.';
        else errorMessage = `오류: ${error.message}`;
      }
      alert(errorMessage);
    }
  };

  const handleRejectProposal = async (proposalId: number) => {
    if (!confirm('이 제출을 거절하시겠습니까?')) {
      return;
    }

    try {
      const { error } = await supabase.from('proposals').update({ status: 'rejected' }).eq('id', proposalId);
      if (error) throw error;
      await loadProposals();
      alert('제출이 거절되었습니다.');
    } catch (error) {
      console.error('거절 처리 오류:', error);
      alert('거절 처리 중 오류가 발생했습니다.');
    }
  };const handleEditItem = (item: Item) => {
    setSelectedItem(item);
    setEditItemForm({
      code: item.code,
      name: item.name,
      image: item.image,
      value: item.current_value.toString(),
      unit_type: item.unit_type
    });
    setShowEditModal(true);
  };

  const handleSaveEditItem = async () => {
    if (!selectedItem) return;
    
    if (!editItemForm.code || !editItemForm.name || !editItemForm.value) {
      alert('코드, 이름, 가치는 필수 입력 항목입니다.');
      return;
    }

    const valueNum = parseInt(editItemForm.value);
    if (isNaN(valueNum) || valueNum <= 0) {
      alert('올바른 가치를 입력해주세요.');
      return;
    }

    try {
      const oldValue = selectedItem.current_value;
      const { error: updateError } = await supabase.from('items').update({
        code: editItemForm.code, name: editItemForm.name,
        image: editItemForm.image || 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/9/9d/Barrier_%28held%29_JE2_BE2.png',
        current_value: valueNum, unit_type: editItemForm.unit_type,
        last_modified: new Date().toISOString(),
      }).eq('id', selectedItem.id);
      if (updateError) throw updateError;
      if (valueNum !== oldValue) {
        await supabase.from('value_history').insert({ item_id: selectedItem.id, value: valueNum, previous_value: oldValue, reason: '관리자 수정', votes: selectedItem.votes });
      }
      await loadItems();
      setShowEditModal(false);
      setSelectedItem(null);
      setEditItemForm({ code: '', name: '', image: '', value: '', unit_type: 'piece' });
      alert('아이템이 수정되었습니다.');
    } catch (error) {
      console.error('아이템 수정 오류:', error);
      alert('아이템 수정 중 오류가 발생했습니다.');
    }
  };

  const handleToggleUnitType = async (itemId: number) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      const unitCycle: { [key: string]: 'piece' | 'set' | 'stack' } = { 'piece': 'set', 'set': 'stack', 'stack': 'piece' };
      const newUnitType = unitCycle[item.unit_type] || 'piece';
      const { error } = await supabase.from('items').update({ unit_type: newUnitType }).eq('id', itemId);
      if (error) throw error;
      await loadItems();
    } catch (error) {
      console.error('단위 변경 오류:', error);
      alert('단위 변경 중 오류가 발생했습니다.');
    }
  };

  // Draw Charts
  const setupCanvas = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    return ctx;
  };
  useEffect(() => {
    if (!isAuthenticated || (activeTab === 'caps' || activeTab === 'average')) return;

    // Donut Chart - 아이템 상태별 분포
    const donutCanvas = donutChartRef.current;
    if (donutCanvas) {
      const ctx = setupCanvas(donutCanvas);
      if (ctx) {
        const rect = donutCanvas.getBoundingClientRect();
        const approved = items.filter(i => i.status === 'approved').length;
        const pending = proposals.length;
        const total = approved + pending || 1;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const radius = Math.min(centerX, centerY) - 20;
        const innerRadius = radius * 0.6;
        
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // 승인됨 (라임)
        const approvedAngle = (approved / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + approvedAngle);
        ctx.arc(centerX, centerY, innerRadius, -Math.PI / 2 + approvedAngle, -Math.PI / 2, true);
        ctx.closePath();
        ctx.fillStyle = '#84cc16';
        ctx.fill();
        
        // 대기중 (앰버)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2 + approvedAngle, -Math.PI / 2 + 2 * Math.PI);
        ctx.arc(centerX, centerY, innerRadius, -Math.PI / 2 + 2 * Math.PI, -Math.PI / 2 + approvedAngle, true);
        ctx.closePath();
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        
        // 중앙 텍스트
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Noto Sans KR';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${total}`, centerX, centerY - 8);
        ctx.font = '12px Noto Sans KR';
        ctx.fillStyle = '#a8a29e';
        ctx.fillText('전체 아이템', centerX, centerY + 14);
      }
    }

    // Bar Chart - 투표 TOP 5
    const barCanvas = barChartRef.current;
    if (barCanvas) {
      const ctx = setupCanvas(barCanvas);
      if (ctx) {
        const rect = barCanvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        const allItems = [...items, ...proposals.map(p => ({ 
          name: p.item_name, 
          votes: p.current_votes 
        }))];
        const sortedItems = allItems.sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 5);
        const maxVotes = Math.max(...sortedItems.map(i => i.votes || 0), 1);
        
        const barHeight = 28;
        const gap = 16;
        const startY = 20;
        const maxBarWidth = rect.width - 120;
        
        sortedItems.forEach((item, index) => {
          const y = startY + index * (barHeight + gap);
          const barWidth = ((item.votes || 0) / maxVotes) * maxBarWidth;
          
          // 바 배경
          ctx.fillStyle = '#292524';
          ctx.fillRect(80, y, maxBarWidth, barHeight);
          
          // 바
          const gradient = ctx.createLinearGradient(80, y, 80 + barWidth, y);
          gradient.addColorStop(0, '#84cc16');
          gradient.addColorStop(1, '#65a30d');
          ctx.fillStyle = gradient;
          ctx.fillRect(80, y, barWidth, barHeight);
          
          // 아이템 이름
          ctx.fillStyle = '#d6d3d1';
          ctx.font = '11px Noto Sans KR';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          const displayName = item.name.length > 6 ? item.name.slice(0, 6) + '..' : item.name;
          ctx.fillText(displayName, 72, y + barHeight / 2);
          
          // 투표 수
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px Noto Sans KR';
          ctx.textAlign = 'left';
          ctx.fillText(`${item.votes || 0}`, 85 + barWidth + 8, y + barHeight / 2);
        });
        
        if (sortedItems.length === 0) {
          ctx.fillStyle = '#78716c';
          ctx.font = '14px Noto Sans KR';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('데이터가 없습니다', barCanvas.width / 2, barCanvas.height / 2);
        }
      }
    }

    // Line Chart - 최근 7일 활동
    const lineCanvas = lineChartRef.current;
    if (lineCanvas) {
      const ctx = setupCanvas(lineCanvas);
      if (ctx) {
        const rect = lineCanvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // 최근 7일 데이터 생성
        const days = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          days.push(date.toISOString().split('T')[0]);
        }
        
        // 일별 제출 수 계산
        const dailyData = days.map(day => {
          const itemCount = items.filter(item => {
            const itemDate = item.created_at;
            return itemDate && itemDate.startsWith(day);
          }).length;
          const proposalCount = proposals.filter(p => {
            const proposalDate = p.submitted_at;
            return proposalDate && proposalDate.startsWith(day);
          }).length;
          return itemCount + proposalCount;
        });
        
        // 샘플 데이터 (실제 데이터가 없을 경우)
        const hasData = dailyData.some(d => d > 0);
        const data = hasData ? dailyData : [2, 5, 3, 8, 4, 6, 3];
        const maxValue = Math.max(...data, 1);
        
        const padding = { top: 20, right: 20, bottom: 40, left: 40 };
        const chartWidth = rect.width - padding.left - padding.right;
        const chartHeight = rect.height - padding.top - padding.bottom;
        
        // 그리드 라인
        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          const y = padding.top + (chartHeight / 4) * i;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(rect.width - padding.right, y);
          ctx.stroke();
        }
        
        // 라인 그리기
        ctx.beginPath();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        data.forEach((value, index) => {
          const x = padding.left + (chartWidth / (data.length - 1)) * index;
          const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        
        // 포인트 그리기
        data.forEach((value, index) => {
          const x = padding.left + (chartWidth / (data.length - 1)) * index;
          const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
          
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#22d3ee';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = '#0e7490';
          ctx.fill();
        });
        
        // X축 레이블
        ctx.fillStyle = '#a8a29e';
        ctx.font = '10px Noto Sans KR';
        ctx.textAlign = 'center';
        days.forEach((day, index) => {
          const x = padding.left + (chartWidth / (days.length - 1)) * index;
          const label = new Date(day).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
          ctx.fillText(label, x, rect.height - 10);
        });
        
        // Y축 레이블
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
          const y = padding.top + (chartHeight / 4) * i;
          const value = Math.round(maxValue - (maxValue / 4) * i);
          ctx.fillText(`${value}`, padding.left - 8, y + 4);
        }
      }
    }

    // 접속 통계 라인 차트 - 최근 7일 방문자
    const visitLineCanvas = visitLineChartRef.current;
    if (visitLineCanvas) {
      const ctx = setupCanvas(visitLineCanvas);
      if (ctx) {
        const rect = visitLineCanvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        const days = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          days.push(date.toISOString().split('T')[0]);
        }
        
        // Supabase에서 실제 방문 데이터 가져오기
        const fetchVisitData = async () => {
          try {
            const { data: visitData } = await supabase
              .from('visit_stats')
              .select('*')
              .gte('date', days[0])
              .lte('date', days[days.length - 1])
              .is('hour', null);
            
            const visitMap: { [key: string]: number } = {};
            if (visitData) {
              visitData.forEach(stat => {
                visitMap[stat.date] = parseInt(stat.visits) || 0;
              });
            }
            
            const data = days.map(day => visitMap[day] || 0);
            const hasData = data.some(d => d > 0);
            const displayData = hasData ? data : [12, 28, 19, 35, 22, 41, 33];
            const maxValue = Math.max(...displayData, 1);
            
            const padding = { top: 20, right: 20, bottom: 40, left: 40 };
            const chartWidth = rect.width - padding.left - padding.right;
            const chartHeight = rect.height - padding.top - padding.bottom;
            
            // 그리드 라인
            ctx.strokeStyle = '#3f3f46';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
              const y = padding.top + (chartHeight / 4) * i;
              ctx.beginPath();
              ctx.moveTo(padding.left, y);
              ctx.lineTo(rect.width - padding.right, y);
              ctx.stroke();
            }
            
            // 영역 채우기
            ctx.beginPath();
            displayData.forEach((value, index) => {
              const x = padding.left + (chartWidth / (displayData.length - 1)) * index;
              const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
              if (index === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            });
            ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
            ctx.lineTo(padding.left, padding.top + chartHeight);
            ctx.closePath();
            const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.05)');
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // 라인 그리기
            ctx.beginPath();
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            displayData.forEach((value, index) => {
              const x = padding.left + (chartWidth / (displayData.length - 1)) * index;
              const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
              if (index === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            });
            ctx.stroke();
            
            // 포인트 그리기
            displayData.forEach((value, index) => {
              const x = padding.left + (chartWidth / (displayData.length - 1)) * index;
              const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
              
              ctx.beginPath();
              ctx.arc(x, y, 5, 0, 2 * Math.PI);
              ctx.fillStyle = '#10b981';
              ctx.fill();
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, 2 * Math.PI);
              ctx.fillStyle = '#065f46';
              ctx.fill();
            });
            
            // X축 레이블
            ctx.fillStyle = '#a8a29e';
            ctx.font = '10px Noto Sans KR';
            ctx.textAlign = 'center';
            days.forEach((day, index) => {
              const x = padding.left + (chartWidth / (days.length - 1)) * index;
              const label = new Date(day).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
              ctx.fillText(label, x, rect.height - 10);
            });
            
            // Y축 레이블
            ctx.textAlign = 'right';
            for (let i = 0; i <= 4; i++) {
              const y = padding.top + (chartHeight / 4) * i;
              const value = Math.round(maxValue - (maxValue / 4) * i);
              ctx.fillText(`${value}`, padding.left - 8, y + 4);
            }
          } catch (error) {
            console.error('방문 차트 데이터 로드 오류:', error);
          }
        };
        
        fetchVisitData();
      }
    }

    // 시간대별 접속 바 차트
    const hourlyBarCanvas = hourlyBarChartRef.current;
    if (hourlyBarCanvas) {
      const ctx = setupCanvas(hourlyBarCanvas);
      if (ctx) {
        const rect = hourlyBarCanvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // 오늘 시간대별 데이터 가져오기
        const fetchHourlyData = async () => {
          try {
            const today = new Date().toISOString().split('T')[0];
            const { data: hourlyData } = await supabase
              .from('visit_stats')
              .select('*')
              .eq('date', today)
              .not('hour', 'is', null)
              .order('hour', { ascending: true });
            
            const hourlyMap: { [key: number]: number } = {};
            if (hourlyData) {
              hourlyData.forEach(stat => {
                const hour = parseInt(stat.hour);
                hourlyMap[hour] = parseInt(stat.visits) || 0;
              });
            }
            
            // 0-23시 데이터 생성
            const hours = Array.from({ length: 24 }, (_, i) => i);
            const data = hours.map(hour => hourlyMap[hour] || 0);
            const hasData = data.some(d => d > 0);
            const displayData = hasData ? data : Array.from({ length: 24 }, () => Math.floor(Math.random() * 10));
            const maxValue = Math.max(...displayData, 1);
            
                        const padding = { top: 20, right: 20, bottom: 40, left: 40 };
            const chartWidth = rect.width - padding.left - padding.right;
            const chartHeight = rect.height - padding.top - padding.bottom;
            const barWidth = chartWidth / displayData.length - 4;
            // 그리드 라인
            ctx.strokeStyle = '#3f3f46';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
              const y = padding.top + (chartHeight / 4) * i;
              ctx.beginPath();
              ctx.moveTo(padding.left, y);
              ctx.lineTo(rect.width - padding.right, y);
              ctx.stroke();
            }
            
            // 바 그리기
            displayData.forEach((value, index) => {
              const x = padding.left + (chartWidth / displayData.length) * index + 2;
              const barHeight = (value / maxValue) * chartHeight;
              const y = padding.top + chartHeight - barHeight;
              
              const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
              gradient.addColorStop(0, '#f59e0b');
              gradient.addColorStop(1, '#d97706');
              ctx.fillStyle = gradient;
              ctx.fillRect(x, y, barWidth, barHeight);
            });
            
            // X축 레이블 (3시간 간격)
            ctx.fillStyle = '#a8a29e';
            ctx.font = '10px Noto Sans KR';
            ctx.textAlign = 'center';
            for (let i = 0; i < 24; i += 3) {
              const x = padding.left + (chartWidth / displayData.length) * i + barWidth / 2;
              ctx.fillText(`${i}시`, x, rect.height - 10);
            }
            
            // Y축 레이블
            ctx.textAlign = 'right';
            for (let i = 0; i <= 4; i++) {
              const y = padding.top + (chartHeight / 4) * i;
              const value = Math.round(maxValue - (maxValue / 4) * i);
              ctx.fillText(`${value}`, padding.left - 8, y + 4);
            }
          } catch (error) {
            console.error('시간대별 차트 데이터 로드 오류:', error);
          }
        };
        
        fetchHourlyData();
      }
    }
  }, [isAuthenticated, items, proposals, totalVisits, todayVisits, activeTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-stone-400">로딩 중...</p>
        </div>
      </div>
    );
  }


  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-800 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-stone-900 border-4 border-stone-950 p-6 md:p-8">
            <div className="text-center mb-6 md:mb-8">
              <img 
                src="https://static.readdy.ai/image/17df2564a108ae0a0e22f6d4f873354f/e749d238aa2e6349f28b4e6c1e98a806.png" 
                alt="Logo" 
                className="w-12 h-12 md:w-16 md:h-16 object-contain mx-auto mb-4"
              />
              <h2 className="text-2xl md:text-3xl font-bold text-red-500 mb-2" style={{ fontFamily: "Minecraft, monospace" }}>관리자 로그인</h2>
              <p className="text-stone-400 text-sm md:text-base">관리자 권한이 필요합니다</p>
            </div>
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-white font-bold mb-2 md:mb-3 text-sm md:text-base">비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="관리자 비밀번호 입력"
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-red-600"
                  disabled={isLoading}
                />
              </div>
              {loginError && (
                <div className="mb-4 p-3 bg-red-900/50 border-2 border-red-600 text-red-400 text-sm">
                  <i className="ri-error-warning-line mr-2"></i>
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-red-600 text-white font-bold hover:bg-red-500 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "로그인 중..." : "로그인"}
              </button>
            </form>
            <div className="mt-4 text-center">
              <a href="/" className="text-stone-400 hover:text-stone-300 transition-colors text-sm md:text-base">← 홈으로 돌아가기</a>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <>
      {/* Main Content */}
      <section className="py-10 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 md:mb-12">
            <div>
              <h2 className="text-2xl md:text-4xl font-bold text-red-500 mb-1 md:mb-2 font-pixel">관리자 패널</h2>
              <p className="text-base md:text-xl text-stone-300">아이템·투표·거래소·사이트 운영을 한곳에서 관리합니다.</p>
            </div>
            <div className="flex gap-2 md:gap-3 flex-wrap">
              {activeTab === 'banners' ? (
                <button
                  onClick={() => setShowBannerModal(true)}
                  className="px-6 py-3 bg-cyan-600 text-white font-bold hover:bg-cyan-500 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-add-line mr-2"></i>새 배너
                </button>
              ) : activeTab === 'approved' ? (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-lime-600 text-white font-bold hover:bg-lime-500 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-add-line mr-2"></i>새 아이템
                </button>
              ) : null}
              <button
                onClick={handleLogout}
                className="px-6 py-3 bg-stone-700 text-white font-bold hover:bg-stone-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-logout-box-line mr-2"></i>로그아웃
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2">
            {(['caps', 'average'] as const).map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} aria-pressed={activeTab === tab}
                className={`px-3 md:px-6 py-2 md:py-3 font-bold whitespace-nowrap text-xs md:text-base flex-shrink-0 ${activeTab === tab ? 'bg-amber-700 text-white' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'}`}>
                {tab === 'caps' ? '아이템별 상한가' : '거래소 평균가 적용'}
              </button>
            ))}
            <button
              onClick={() => setActiveTab('approved')}
              className={`px-3 md:px-6 py-2 md:py-3 font-bold transition-colors whitespace-nowrap cursor-pointer text-xs md:text-base flex-shrink-0 ${
                activeTab === 'approved'
                  ? 'bg-lime-600 text-white'
                  : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
              }`}
            >
              <i className="ri-checkbox-circle-line mr-1 md:mr-2"></i>
              승인됨 ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('submitted')}
              className={`relative px-3 md:px-6 py-2 md:py-3 font-bold transition-colors whitespace-nowrap cursor-pointer text-xs md:text-base flex-shrink-0 ${
                activeTab === 'submitted'
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
              }`}
            >
              <i className="ri-file-list-line mr-1 md:mr-2"></i>
              제출됨 ({proposals.length})
              {proposals.length > 0 && activeTab !== 'submitted' && (
                <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold text-white animate-pulse">
                  !
                </span>
              )}
            </button>
            {adminRole === 'super_admin' && (
              <>
                <button
                  onClick={() => setActiveTab('banners')}
                  className={`px-3 md:px-6 py-2 md:py-3 font-bold transition-colors whitespace-nowrap cursor-pointer text-xs md:text-base flex-shrink-0 ${
                    activeTab === 'banners'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
                  }`}
                >
                  <i className="ri-advertisement-line mr-1 md:mr-2"></i>
                  배너 ({banners.length})
                </button>
                <button
                  onClick={() => setActiveTab('shops')}
                  className={`px-3 md:px-6 py-2 md:py-3 font-bold transition-colors whitespace-nowrap cursor-pointer text-xs md:text-base flex-shrink-0 ${
                    activeTab === 'shops'
                      ? 'bg-lime-700 text-white'
                      : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
                  }`}
                >
                  <i className="ri-store-2-line mr-1 md:mr-2"></i>
                  체스트샵 ({shops.length})
                </button>
                <button
                  onClick={() => setActiveTab('anomalies')}
                  className={`px-3 md:px-6 py-2 md:py-3 font-bold transition-colors whitespace-nowrap cursor-pointer text-xs md:text-base flex-shrink-0 ${
                    activeTab === 'anomalies'
                      ? 'bg-red-600 text-white'
                      : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
                  }`}
                >
                  <i className="ri-error-warning-line mr-1 md:mr-2"></i>
                  이상 거래 ({anomalies.length})
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 md:px-6 py-2 md:py-3 font-bold transition-colors whitespace-nowrap cursor-pointer text-xs md:text-base flex-shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-stone-500 text-white'
                  : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
              }`}
            >
              <i className="ri-settings-4-line mr-1 md:mr-2"></i>
              설정
            </button>
          </div>

          <div hidden={(activeTab === 'caps' || activeTab === 'average')}>
          {/* Stats */}
          <div className={`grid gap-3 md:gap-4 mb-6 md:mb-8 ${adminRole === 'super_admin' ? 'grid-cols-2 md:grid-cols-9' : 'grid-cols-2'}`}>
            <div className="bg-stone-900 border-4 border-stone-950 p-3 md:p-6 text-center">
              <div className="text-xl md:text-3xl font-bold text-lime-400 mb-1 md:mb-2">{items.filter(i => i.status === 'approved').length}</div>
              <div className="text-stone-400 text-xs md:text-sm">승인된 아이템</div>
            </div>
            <div className="bg-stone-900 border-4 border-stone-950 p-3 md:p-6 text-center">
              <div className="text-xl md:text-3xl font-bold text-amber-400 mb-1 md:mb-2">{proposals.length}</div>
              <div className="text-stone-400 text-xs md:text-sm">제출 대기중</div>
            </div>
            {adminRole === 'super_admin' && (
              <>
                <div className="bg-stone-900 border-4 border-stone-950 p-3 md:p-6 text-center">
                  <div className="text-xl md:text-3xl font-bold text-cyan-400 mb-1 md:mb-2">{banners.length}</div>
                  <div className="text-stone-400 text-xs md:text-sm">전체 배너</div>
                </div>
                <div className="bg-stone-900 border-4 border-emerald-900 p-3 md:p-6 text-center">
                  <div className="text-xl md:text-3xl font-bold text-emerald-400 mb-1 md:mb-2">{banners.filter(b => b.active).length}</div>
                  <div className="text-stone-400 text-xs md:text-sm">활성 배너</div>
                </div>
                <div className="bg-stone-900 border-4 border-lime-900 p-3 md:p-6 text-center">
                  <div className="text-xl md:text-3xl font-bold text-lime-500 mb-1 md:mb-2">{shops.length}</div>
                  <div className="text-stone-400 text-xs md:text-sm">체스트샵</div>
                </div>
                <div className="bg-stone-900 border-4 border-amber-900 p-3 md:p-6 text-center">
                  <div className="text-xl md:text-3xl font-bold text-amber-400 mb-1 md:mb-2">{totalVisits}</div>
                  <div className="text-stone-400 text-xs md:text-sm">총 방문자</div>
                </div>
                <div className="bg-stone-900 border-4 border-pink-900 p-3 md:p-6 text-center">
                  <div className="text-xl md:text-3xl font-bold text-pink-400 mb-1 md:mb-2">{todayVisits}</div>
                  <div className="text-stone-400 text-xs md:text-sm">오늘 방문</div>
                </div>
                <div className="col-span-2 bg-stone-900 border-4 border-red-900 p-3 md:p-6 text-center">
                  <div className="text-xl md:text-3xl font-bold text-red-400 mb-1 md:mb-2">{anomalies.length}</div>
                  <div className="text-stone-400 text-xs md:text-sm">감지된 이상 거래</div>
                </div>
              </>
            )}
          </div>

          {/* Charts Section - Row 1 */}
          <div className={`grid grid-cols-1 gap-4 md:gap-6 mb-6 md:mb-8 ${adminRole === 'super_admin' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            {/* 도넛 차트 - 아이템 상태 */}
            <div className="bg-stone-900 border-4 border-stone-950 p-4 md:p-6">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm md:text-base">
                <i className="ri-pie-chart-line text-lime-400"></i>
                아이템 상태 분포
              </h3>
              <div className="flex justify-center">
                <canvas ref={donutChartRef} width={180} height={180} className="max-w-full"></canvas>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-lime-500 rounded-sm"></div>
                  <span className="text-stone-400 text-xs md:text-sm">승인됨</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-sm"></div>
                  <span className="text-stone-400 text-xs md:text-sm">대기중</span>
                </div>
              </div>
            </div>

            {/* 바 차트 - 투표 TOP 5 */}
            <div className="bg-stone-900 border-4 border-stone-950 p-4 md:p-6">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm md:text-base">
                <i className="ri-bar-chart-horizontal-line text-cyan-400"></i>
                투표 TOP 5
              </h3>
              <canvas ref={barChartRef} width={300} height={200} className="w-full"></canvas>
            </div>

            {/* 라인 차트 - 최근 7일 활동 (슈퍼 관리자 전용) */}
            {adminRole === 'super_admin' && (
              <div className="bg-stone-900 border-4 border-stone-950 p-4 md:p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm md:text-base">
                  <i className="ri-line-chart-line text-pink-400"></i>
                  최근 7일 활동
                </h3>
                <canvas ref={lineChartRef} width={300} height={200} className="w-full"></canvas>
              </div>
            )}
          </div>

          {/* Charts Section - Row 2: 접속 통계 (슈퍼 관리자 전용) */}
          {adminRole === 'super_admin' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
              {/* 접속 통계 라인 차트 */}
              <div className="bg-stone-900 border-4 border-emerald-900/50 p-4 md:p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm md:text-base">
                  <i className="ri-user-line text-emerald-400"></i>
                  최근 7일 방문자 추이
                </h3>
                <canvas ref={visitLineChartRef} width={400} height={200} className="w-full"></canvas>
              </div>

              {/* 시간대별 접속 바 차트 */}
              <div className="bg-stone-900 border-4 border-amber-900/50 p-4 md:p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm md:text-base">
                  <i className="ri-time-line text-amber-400"></i>
                  오늘 시간대별 접속
                </h3>
                <canvas ref={hourlyBarChartRef} width={400} height={200} className="w-full"></canvas>
              </div>
            </div>
          )}

          </div>

          <div hidden={activeTab !== 'caps' && activeTab !== 'average'}>
            {sessionToken && <PricingPanel sessionToken={sessionToken} active={activeTab === 'caps' || activeTab === 'average'} mode={activeTab === 'caps' ? 'caps' : 'average'} />}
          </div>

          {/* Shops Management */}
          {activeTab === 'shops' && (
            <div className="space-y-4 md:space-y-6">
              {shops.length === 0 ? (
                <div className="bg-stone-900 border-4 border-stone-950 p-8 md:p-12 text-center">
                  <i className="ri-store-2-line text-5xl md:text-6xl text-stone-600 mb-4"></i>
                  <p className="text-base md:text-xl text-stone-400 mb-4">등록된 체스트샵이 없습니다.</p>
                </div>
              ) : (
                <div className="hidden md:block bg-stone-900 border-4 border-stone-950 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-stone-950">
                        <tr>
                          <th className="px-4 py-4 text-left text-white font-bold">ID</th>
                          <th className="px-4 py-4 text-left text-white font-bold">상점주</th>
                          <th className="px-4 py-4 text-left text-white font-bold">항구</th>
                          <th className="px-4 py-4 text-left text-white font-bold">좌표</th>
                          <th className="px-4 py-4 text-center text-white font-bold">아이템 수</th>
                          <th className="px-4 py-4 text-center text-white font-bold">생성일</th>
                          <th className="px-4 py-4 text-center text-white font-bold">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shops.map((shop) => (
                          <tr key={shop.id} className="border-t-2 border-stone-950 hover:bg-stone-800 transition-colors">
                            <td className="px-4 py-4 text-stone-400 font-mono text-sm">{shop.id}</td>
                            <td className="px-4 py-4 text-white font-semibold">{shop.ownerNickname}</td>
                            <td className="px-4 py-4 text-stone-300">{shop.harborName}</td>
                            <td className="px-4 py-4 text-stone-400 text-sm font-mono">{shop.coordinates}</td>
                            <td className="px-4 py-4 text-center text-white">{shop.items.length}개</td>
                            <td className="px-4 py-4 text-center text-stone-400 text-sm">{new Date(shop.createdAt).toLocaleDateString('ko-KR')}</td>
                            <td className="px-4 py-4 text-center">
                              <button 
                                onClick={() => handleDeleteShop(shop.id)} 
                                className="px-3 py-1 bg-red-600 text-white text-sm hover:bg-red-500 transition-colors cursor-pointer font-bold"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Mobile View for Shops */}
              <div className="md:hidden space-y-4">
                {shops.map((shop) => (
                  <div key={shop.id} className="bg-stone-900 border-4 border-stone-950 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-white font-bold">{shop.ownerNickname}</h4>
                        <p className="text-stone-400 text-xs">{shop.harborName} | {shop.coordinates}</p>
                      </div>
                      <span className="bg-stone-800 text-stone-300 text-xs px-2 py-1 border border-stone-700">
                        {shop.items.length}개 아이템
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-stone-800">
                      <span className="text-stone-500 text-xs">{new Date(shop.createdAt).toLocaleDateString('ko-KR')}</span>
                      <button 
                        onClick={() => handleDeleteShop(shop.id)}
                        className="px-4 py-2 bg-red-600 text-white text-xs font-bold hover:bg-red-500"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anomalies Management */}
          {activeTab === 'anomalies' && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={loadAnomalies} disabled={anomalyLoading} className="px-4 py-2 bg-red-700 text-white font-bold disabled:opacity-50">{anomalyLoading ? '검사 중…' : '최근 거래 다시 검사'}</button>
                <p className="text-sm text-stone-400">{anomalyScanNotice}</p>
              </div>
              {anomalyError && <p role="alert" className="p-3 bg-red-950 text-red-300">{anomalyError}</p>}
              {anomalyLoading ? <p className="text-stone-400">실제 거래 내역을 확인하고 있습니다…</p> : anomalyError ? null : anomalies.length === 0 ? (
                <div className="bg-stone-900 border-4 border-stone-950 p-8 md:p-12 text-center">
                  <i className="ri-shield-check-line text-5xl md:text-6xl text-stone-600 mb-4"></i>
                  <p className="text-base md:text-xl text-stone-400 mb-4">감지된 이상 거래가 없습니다.</p>
                </div>
              ) : (
                <div className="bg-stone-900 border-4 border-stone-950 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px]">
                      <thead className="bg-stone-950">
                        <tr>
                          <th className="px-4 py-4 text-left text-white font-bold">거래 ID</th>
                          <th className="px-4 py-4 text-left text-white font-bold">아이템</th>
                          <th className="px-4 py-4 text-right text-white font-bold">거래가</th>
                          <th className="px-4 py-4 text-right text-white font-bold">동일 수량 기준 평균가</th>
                          <th className="px-4 py-4 text-right text-white font-bold">차이(%)</th>
                          <th className="px-4 py-4 text-center text-white font-bold">거래일시</th>
                          <th className="px-4 py-4 text-center text-white font-bold">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anomalies.map((anomaly) => (
                          <tr key={anomaly.id} className="border-t-2 border-stone-950 hover:bg-stone-800 transition-colors">
                            <td className="px-4 py-4 text-stone-400 font-mono text-sm">{anomaly.id}</td>
                            <td className="px-4 py-4">
                              <span className="text-white font-semibold">{getItemName(anomaly.item_name)}</span>
                              {getItemName(anomaly.item_name) !== anomaly.item_name && (
                                <span className="block text-xs text-stone-500 font-mono mt-0.5">{anomaly.item_name}</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="text-amber-400 font-bold">{Math.round(anomaly.price).toLocaleString()}</span>
                            </td>
                            <td className="px-4 py-4 text-right text-stone-400">{Math.round(anomaly.avg_price).toLocaleString()}</td>
                            <td className="px-4 py-4 text-right">
                              <span className={`font-bold ${anomaly.diff_percent > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                {anomaly.diff_percent > 0 ? '+' : ''}{anomaly.diff_percent}%
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center text-stone-400 text-sm">{new Date(anomaly.transaction_date).toLocaleString('ko-KR')}</td>
                            <td className="px-4 py-4 text-center">
                              {anomaly.detected ? <span className="text-amber-300 text-xs">최근 거래 탐지</span> : <button
                                onClick={async () => {
                                  if(confirm('이 기록을 삭제하시겠습니까?')) {
                                    const { error } = await supabase.from('auction_anomalies').delete().eq('id', anomaly.id);
                                    if (error) setAnomalyError(`삭제 실패: ${error.message}`);
                                    else await loadAnomalies();
                                  }
                                }} 
                                className="px-3 py-1 bg-stone-700 text-white text-sm hover:bg-stone-600 transition-colors cursor-pointer"
                              >
                                삭제
                              </button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approved Items - Mobile Card View */}
          {activeTab === 'approved' && (
            <>
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {items.length === 0 ? (
                  <div className="bg-stone-900 border-4 border-stone-950 p-8 text-center">
                    <i className="ri-inbox-line text-4xl text-stone-600 mb-2"></i>
                    <p className="text-stone-400">승인된 아이템이 없습니다.</p>
                  </div>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="bg-stone-900 border-4 border-stone-950 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-stone-800 border-2 border-stone-700 flex items-center justify-center flex-shrink-0">
                          <img src={item.image} alt={item.name} className="w-8 h-8 object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold truncate">{item.name}</div>
                          <div className="text-stone-400 text-xs font-mono truncate" title={getItemName(item.code)}>{item.code}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-1 text-xs font-bold ${item.status === 'approved' ? 'bg-emerald-900 text-emerald-400' : 'bg-amber-900 text-amber-400'}`}>
                            {item.status === 'approved' ? '승인' : '대기'}
                          </span>
                          <button
                            onClick={() => handleToggleUnitType(item.id)}
                            className={`px-2 py-1 text-xs font-bold cursor-pointer ${
                              item.unit_type === 'stack' 
                                ? 'bg-purple-900 text-purple-400' 
                                : item.unit_type === 'set'
                                ? 'bg-amber-900 text-amber-400'
                                : 'bg-cyan-900 text-cyan-400'
                            }`}
                          >
                            {item.unit_type === 'stack' ? '64개' : item.unit_type === 'set' ? '16개' : '1개'}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3 pt-3 border-t-2 border-stone-800">
                        <div className="text-center">
                          <div className="text-xl font-bold text-lime-400">{item.current_value || 0}</div>
                          <div className="text-xs text-stone-400">가치</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-white">{item.votes}</div>
                          <div className="text-xs text-stone-400">투표</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditItem(item)} 
                          className="flex-1 px-3 py-2 bg-amber-600 text-white text-sm font-bold hover:bg-amber-500 cursor-pointer"
                        >
                          <i className="ri-edit-line mr-1"></i>수정
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)} 
                          className="px-3 py-2 bg-red-600 text-white text-sm font-bold hover:bg-red-500 cursor-pointer"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block bg-stone-900 border-4 border-stone-950 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-stone-950">
                      <tr>
                        <th className="px-4 py-4 text-left text-white font-bold">ID</th>
                        <th className="px-4 py-4 text-left text-white font-bold">이미지</th>
                        <th className="px-4 py-4 text-left text-white font-bold">코드</th>
                        <th className="px-4 py-4 text-left text-white font-bold">이름</th>
                        <th className="px-4 py-4 text-center text-white font-bold">단위</th>
                        <th className="px-4 py-4 text-center text-white font-bold">가치</th>
                        <th className="px-4 py-4 text-center text-white font-bold">투표</th>
                        <th className="px-4 py-4 text-center text-white font-bold">상태</th>
                        <th className="px-4 py-4 text-center text-white font-bold">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center text-stone-400">
                            <i className="ri-inbox-line text-4xl mb-2 block"></i>
                            승인된 아이템이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => (
                          <tr key={item.id} className="border-t-2 border-stone-950 hover:bg-stone-800 transition-colors">
                            <td className="px-4 py-4 text-stone-400 font-mono text-sm">{item.id}</td>
                            <td className="px-4 py-4">
                              <div className="w-10 h-10 bg-stone-800 border-2 border-stone-700 flex items-center justify-center">
                                <img src={item.image} alt={item.name} className="w-8 h-8 object-contain" />
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-stone-300 font-mono text-sm">{item.code}</span>
                              <span className="block text-xs text-stone-500 mt-0.5">{getItemName(item.code)}</span>
                            </td>
                            <td className="px-4 py-4 text-white font-semibold">{item.name}</td>
                            <td className="px-4 py-4 text-center">
                              <button
                                onClick={() => handleToggleUnitType(item.id)}
                                className={`px-3 py-1 text-sm font-bold cursor-pointer transition-colors ${
                                  item.unit_type === 'stack' 
                                    ? 'bg-purple-600 text-white'
                                    : item.unit_type === 'set'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-cyan-600 text-white'
                                }`}
                              >
                                {item.unit_type === 'stack' ? '64개' : item.unit_type === 'set' ? '16개' : '1개'}
                              </button>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-xl font-bold text-lime-400">{item.current_value || 0}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-white font-bold">{item.votes}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`px-3 py-1 text-sm font-bold ${item.status === 'approved' ? 'bg-emerald-900 text-emerald-400' : 'bg-amber-900 text-amber-400'}`}>
                                {item.status === 'approved' ? '승인됨' : '대기중'}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEditItem(item);
                                  }} 
                                  className="px-3 py-2 bg-amber-600 text-white text-sm font-bold hover:bg-amber-500 transition-colors whitespace-nowrap cursor-pointer" 
                                  title="수정"
                                >
                                  <i className="ri-edit-line"></i>
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDelete(item.id);
                                  }} 
                                  className="px-3 py-2 bg-red-600 text-white text-sm font-bold hover:bg-red-500 transition-colors whitespace-nowrap cursor-pointer" 
                                  title="삭제"
                                >
                                  <i className="ri-delete-bin-line"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Submitted Items */}
          {activeTab === 'submitted' && (
            <>
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {proposals.length === 0 ? (
                  <div className="bg-stone-900 border-4 border-stone-950 p-8 text-center">
                    <i className="ri-inbox-line text-4xl text-stone-600 mb-2"></i>
                    <p className="text-stone-400">제출된 아이템이 없습니다.</p>
                  </div>
                ) : (
                  proposals.map((proposal) => (
                    <div key={proposal.id} className="bg-stone-900 border-4 border-stone-950 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-stone-800 border-2 border-stone-700 flex items-center justify-center flex-shrink-0">
                          <img src={proposal.item_image} alt={proposal.item_name} className="w-8 h-8 object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold truncate">{proposal.item_name}</div>
                          <div className="text-stone-400 text-xs font-mono truncate" title={getItemName(proposal.item_code)}>{proposal.item_code}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3 pt-3 border-t-2 border-stone-800">
                        <div className="text-center">
                          <div className="text-xl font-bold text-amber-400">{proposal.proposed_value}</div>
                          <div className="text-xs text-stone-400">제안 가치</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-white">{proposal.current_votes}/{proposal.required_votes}</div>
                          <div className="text-xs text-stone-400">투표</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-stone-300">{proposal.submitted_by}</div>
                          <div className="text-xs text-stone-400">제출자</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveProposal(proposal)} className="flex-1 px-3 py-2 bg-lime-600 text-white text-sm font-bold hover:bg-lime-500 cursor-pointer">
                          <i className="ri-check-line mr-1"></i>승인
                        </button>
                        <button onClick={() => handleRejectProposal(proposal.id)} className="px-3 py-2 bg-amber-600 text-white text-sm font-bold hover:bg-amber-500 cursor-pointer">
                          <i className="ri-close-line"></i>
                        </button>
                        <button onClick={() => handleDeleteProposal(proposal.id)} className="px-3 py-2 bg-red-600 text-white text-sm font-bold hover:bg-red-500 cursor-pointer">
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block bg-stone-900 border-4 border-stone-950 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-stone-950">
                      <tr>
                        <th className="px-4 py-4 text-left text-white font-bold">이미지</th>
                        <th className="px-4 py-4 text-left text-white font-bold">코드</th>
                        <th className="px-4 py-4 text-left text-white font-bold">이름</th>
                        <th className="px-4 py-4 text-center text-white font-bold">제안 가치</th>
                        <th className="px-4 py-4 text-center text-white font-bold">투표</th>
                        <th className="px-4 py-4 text-left text-white font-bold">제출자</th>
                        <th className="px-4 py-4 text-left text-white font-bold">제출일</th>
                        <th className="px-4 py-4 text-center text-white font-bold">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposals.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-stone-400">
                            <i className="ri-inbox-line text-4xl mb-2 block"></i>
                            제출된 아이템이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        proposals.map((proposal) => (
                          <tr key={proposal.id} className="border-t-2 border-stone-950 hover:bg-stone-800 transition-colors">
                            <td className="px-4 py-4">
                              <div className="w-10 h-10 bg-stone-800 border-2 border-stone-700 flex items-center justify-center">
                                <img src={proposal.item_image} alt={proposal.item_name} className="w-8 h-8 object-contain" />
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-stone-300 font-mono text-sm">{proposal.item_code}</span>
                              <span className="block text-xs text-stone-500 mt-0.5">{getItemName(proposal.item_code)}</span>
                            </td>
                            <td className="px-4 py-4 text-white font-semibold">{proposal.item_name}</td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-xl font-bold text-amber-400">{proposal.proposed_value}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-white font-bold">{proposal.current_votes}/{proposal.required_votes}</span>
                            </td>
                            <td className="px-4 py-4 text-stone-300">{proposal.submitted_by}</td>
                            <td className="px-4 py-4 text-stone-400 text-sm">{new Date(proposal.submitted_at).toLocaleDateString('ko-KR')}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleApproveProposal(proposal)} className="px-3 py-2 bg-lime-600 text-white text-sm font-bold hover:bg-lime-500 transition-colors whitespace-nowrap cursor-pointer" title="승인">
                                  <i className="ri-check-line"></i>
                                </button>
                                <button onClick={() => handleRejectProposal(proposal.id)} className="px-3 py-2 bg-amber-600 text-white text-sm font-bold hover:bg-amber-500 transition-colors whitespace-nowrap cursor-pointer" title="거절">
                                  <i className="ri-close-line"></i>
                                </button>
                                <button onClick={() => handleDeleteProposal(proposal.id)} className="px-3 py-2 bg-red-600 text-white text-sm font-bold hover:bg-red-500 transition-colors whitespace-nowrap cursor-pointer" title="삭제">
                                  <i className="ri-delete-bin-line"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Banners Management */}
          {activeTab === 'banners' && (
            <div className="space-y-4 md:space-y-6">
              {banners.length === 0 ? (
                <div className="bg-stone-900 border-4 border-stone-950 p-8 md:p-12 text-center">
                  <i className="ri-advertisement-line text-5xl md:text-6xl text-stone-600 mb-4"></i>
                  <p className="text-base md:text-xl text-stone-400 mb-4">등록된 배너가 없습니다.</p>
                  <button
                    onClick={() => setShowBannerModal(true)}
                    className="px-6 py-3 bg-cyan-600 text-white font-bold hover:bg-cyan-500 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-add-line mr-2"></i>첫 배너 추가하기
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {banners.map((banner) => (
                    <div key={banner.id} className={`bg-stone-900 border-4 ${banner.active ? 'border-cyan-600' : 'border-stone-950'} overflow-hidden`}>
                      <div className="h-24 md:h-32 bg-stone-800 relative">
                        <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
                        {!banner.active && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white font-bold text-base md:text-lg">비활성화됨</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 md:p-4">
                        <div className="flex items-start justify-between mb-2 md:mb-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-white font-bold text-base md:text-lg truncate">{banner.title}</h4>
                            {banner.link && (
                              <a href={banner.link} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs md:text-sm hover:underline truncate block max-w-[200px]">
                                {banner.link}
                              </a>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs font-bold flex-shrink-0 ml-2 ${banner.active ? 'bg-cyan-900 text-cyan-400' : 'bg-stone-700 text-stone-400'}`}>
                            {banner.active ? '활성' : '비활성'}
                          </span>
                        </div>
                        <p className="text-stone-500 text-xs md:text-sm mb-3 md:mb-4">
                          등록일: {new Date(banner.created_at).toLocaleDateString('ko-KR')}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleBannerActive(banner.id)}
                            className={`flex-1 px-3 md:px-4 py-2 font-bold transition-colors cursor-pointer text-sm ${
                              banner.active ? 'bg-stone-700 text-white hover:bg-stone-600' : 'bg-cyan-600 text-white hover:bg-cyan-500'
                            }`}
                          >
                            {banner.active ? '비활성화' : '활성화'}
                          </button>
                          <button
                            onClick={() => handleDeleteBanner(banner.id)}
                            className="px-3 md:px-4 py-2 bg-red-600 text-white font-bold hover:bg-red-500 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Management */}
          {activeTab === 'settings' && (
            <div className="bg-stone-900 border-4 border-stone-950 p-6 md:p-8 max-w-xl mx-auto">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <i className="ri-settings-4-line text-cyan-400"></i>
                관리자 설정
              </h3>

              <div className="border-t-2 border-stone-800 pt-6">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-lock-password-line text-red-500"></i>
                  비밀번호 변경
                </h4>
                
                <form onSubmit={handleChangePassword} className="space-y-4 md:space-y-6">
                  {adminRole === 'super_admin' && (
                    <div>
                      <label className="block text-stone-300 font-bold mb-2 text-sm md:text-base">
                        변경할 관리자 역할
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setTargetRoleToChange('super_admin')}
                          className={`py-3 font-bold transition-colors cursor-pointer text-sm md:text-base border-4 ${
                            targetRoleToChange === 'super_admin'
                              ? 'bg-red-900/40 text-red-400 border-red-600'
                              : 'bg-stone-800 text-stone-400 border-stone-950 hover:bg-stone-750'
                          }`}
                        >
                          슈퍼 관리자 (Super)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetRoleToChange('item_admin')}
                          className={`py-3 font-bold transition-colors cursor-pointer text-sm md:text-base border-4 ${
                            targetRoleToChange === 'item_admin'
                              ? 'bg-red-900/40 text-red-400 border-red-600'
                              : 'bg-stone-800 text-stone-400 border-stone-950 hover:bg-stone-750'
                          }`}
                        >
                          아이템 관리자 (Item)
                        </button>
                      </div>
                    </div>
                  )}

                  {adminRole === 'item_admin' && (
                    <div className="p-3 bg-stone-800 border-l-4 border-amber-500 text-stone-300 text-sm">
                      아이템 관리자 비밀번호만 변경할 수 있습니다.
                    </div>
                  )}

                  <div>
                    <label className="block text-stone-300 font-bold mb-2 text-sm md:text-base">
                      현재 비밀번호
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="현재 비밀번호 입력"
                      className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-red-600"
                      disabled={isChangingPassword}
                    />
                  </div>

                  <div>
                    <label className="block text-stone-300 font-bold mb-2 text-sm md:text-base">
                      새 비밀번호
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="새 비밀번호 입력 (최소 3자)"
                      className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-red-600"
                      disabled={isChangingPassword}
                    />
                  </div>

                  <div>
                    <label className="block text-stone-300 font-bold mb-2 text-sm md:text-base">
                      새 비밀번호 확인
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="새 비밀번호 다시 입력"
                      className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-red-600"
                      disabled={isChangingPassword}
                    />
                  </div>

                  {passwordChangeError && (
                    <div className="p-3 bg-red-900/50 border-2 border-red-600 text-red-400 text-sm">
                      <i className="ri-error-warning-line mr-2"></i>
                      {passwordChangeError}
                    </div>
                  )}

                  {passwordChangeSuccess && (
                    <div className="p-3 bg-lime-900/50 border-2 border-lime-600 text-lime-400 text-sm">
                      <i className="ri-checkbox-circle-line mr-2"></i>
                      {passwordChangeSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="w-full px-6 py-3 bg-red-600 text-white font-bold hover:bg-red-500 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isChangingPassword ? "비밀번호 변경 중..." : "비밀번호 변경 적용"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Edit Modal */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-stone-900 border-4 border-stone-950 p-6 md:p-8 max-w-md w-full my-4">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">
              <i className="ri-edit-line mr-2 text-amber-400"></i>
              아이템 수정
            </h3>
            
            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">아이템 코드 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={editItemForm.code}
                  onChange={(e) => setEditItemForm({ ...editItemForm, code: e.target.value })}
                  placeholder="예: diamond_sword"
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">아이템 이름 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={editItemForm.name}
                  onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })}
                  placeholder="예: 다이아몬드 검"
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">이미지 URL</label>
                <input
                  type="text"
                  value={editItemForm.image}
                  onChange={(e) => setEditItemForm({ ...editItemForm, image: e.target.value })}
                  placeholder="이미지 URL"
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-amber-600"
                />
                {editItemForm.image && (
                  <div className="mt-2 w-16 h-16 bg-stone-800 border-2 border-stone-700 flex items-center justify-center">
                    <img src={editItemForm.image} alt="미리보기" className="w-12 h-12 object-contain" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">가치 <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  value={editItemForm.value}
                  onChange={(e) => setEditItemForm({ ...editItemForm, value: e.target.value })}
                  placeholder="예: 100"
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">단위 설정</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditItemForm({ ...editItemForm, unit_type: 'piece' })}
                    className={`flex-1 px-3 py-3 font-bold transition-colors cursor-pointer text-sm ${
                      editItemForm.unit_type === 'piece'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-stone-800 border-4 border-stone-950 text-stone-400 hover:bg-stone-700'
                    }`}
                  >
                    1개
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditItemForm({ ...editItemForm, unit_type: 'set' })}
                    className={`flex-1 px-3 py-3 font-bold transition-colors cursor-pointer text-sm ${
                      editItemForm.unit_type === 'set'
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-800 border-4 border-stone-950 text-stone-400 hover:bg-stone-700'
                    }`}
                  >
                    16개
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditItemForm({ ...editItemForm, unit_type: 'stack' })}
                    className={`flex-1 px-3 py-3 font-bold transition-colors cursor-pointer text-sm ${
                      editItemForm.unit_type === 'stack'
                        ? 'bg-purple-600 text-white'
                        : 'bg-stone-800 border-4 border-stone-950 text-stone-400 hover:bg-stone-700'
                    }`}
                  >
                    64개
                  </button>
                </div>
                <p className="text-stone-500 text-xs mt-2">
                  {editItemForm.unit_type === 'stack' ? '64개(1스택) 기준 가치' : editItemForm.unit_type === 'set' ? '16개 기준 가치' : '개별 아이템 1개 기준 가치'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveEditItem} className="flex-1 px-6 py-3 bg-amber-600 text-white font-bold hover:bg-amber-500 transition-colors whitespace-nowrap cursor-pointer">
                <i className="ri-check-line mr-2"></i>저장
              </button>
              <button
                onClick={() => { setShowEditModal(false); setSelectedItem(null); setEditItemForm({ code: '', name: '', image: '', value: '', unit_type: 'piece' }); }}
                className="flex-1 px-6 py-3 bg-stone-700 text-white font-bold hover:bg-stone-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-stone-900 border-4 border-stone-950 p-6 md:p-8 max-w-md w-full my-4">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">
              <i className="ri-add-circle-line mr-2 text-lime-400"></i>
              새 아이템 추가
            </h3>
            
            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">아이템 코드 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={newItem.code}
                  onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                  placeholder="예: diamond_sword"
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">아이템 이름 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="예: 다이아몬드 검"
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">이미지 URL</label>
                <input
                  type="text"
                  value={newItem.image}
                  onChange={(e) => setNewItem({ ...newItem, image: e.target.value })}
                  placeholder="이미지 URL (선택사항)"
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">가치 <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  value={newItem.value}
                  onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                  placeholder="예: 100"
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">단위 설정</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewItem({ ...newItem, unit_type: 'piece' })}
                    className={`flex-1 px-3 py-3 font-bold transition-colors cursor-pointer text-sm ${
                      newItem.unit_type === 'piece'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-stone-800 border-4 border-stone-950 text-stone-400 hover:bg-stone-700'
                    }`}
                  >
                    1개
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItem({ ...newItem, unit_type: 'set' })}
                    className={`flex-1 px-3 py-3 font-bold transition-colors cursor-pointer text-sm ${
                      newItem.unit_type === 'set'
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-800 border-4 border-stone-950 text-stone-400 hover:bg-stone-700'
                    }`}
                  >
                    16개
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItem({ ...newItem, unit_type: 'stack' })}
                    className={`flex-1 px-3 py-3 font-bold transition-colors cursor-pointer text-sm ${
                      newItem.unit_type === 'stack'
                        ? 'bg-purple-600 text-white'
                        : 'bg-stone-800 border-4 border-stone-950 text-stone-400 hover:bg-stone-700'
                    }`}
                  >
                    64개
                  </button>
                </div>
                <p className="text-stone-500 text-xs mt-2">
                  {newItem.unit_type === 'stack' ? '64개(1스택) 기준 가치' : newItem.unit_type === 'set' ? '16개 기준 가치' : '개별 아이템 1개 기준 가치'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleAddItem} className="flex-1 px-6 py-3 bg-lime-600 text-white font-bold hover:bg-lime-500 transition-colors whitespace-nowrap cursor-pointer">
                <i className="ri-check-line mr-2"></i>추가
              </button>
              <button
                onClick={() => { setShowAddModal(false); setNewItem({ code: '', name: '', image: '', value: '', unit_type: 'piece' }); }}
                className="flex-1 px-6 py-3 bg-stone-700 text-white font-bold hover:bg-stone-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Banner Modal */}
      {showBannerModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-stone-900 border-4 border-stone-950 p-6 md:p-8 max-w-md w-full my-4">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">
              <i className="ri-image-add-line mr-2 text-cyan-400"></i>
              새 배너 추가
            </h3>
            
            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">배너 제목 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={newBanner.title}
                  onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                  placeholder="예: 신규 이벤트 배너"
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-cyan-600"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">배너 이미지 <span className="text-red-400">*</span></label>
                <input type="file" ref={bannerFileInputRef} accept="image/*" onChange={handleBannerImageUpload} className="hidden" />
                <button
                  onClick={() => bannerFileInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-dashed border-stone-600 text-stone-400 hover:border-cyan-600 hover:text-cyan-400 transition-colors cursor-pointer text-sm md:text-base"
                >
                  <i className="ri-upload-cloud-line mr-2"></i>
                  이미지 업로드 (최대 5MB)
                </button>
              </div>

              <div>
                <label className="block text-white font-bold mb-2 text-sm md:text-base">링크 URL (선택)</label>
                <input
                  type="text"
                  value={newBanner.link}
                  onChange={(e) => setNewBanner({ ...newBanner, link: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 bg-stone-800 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-cyan-600"
                />
              </div>

              {newBanner.image && (
                <div className="border-4 border-stone-700 overflow-hidden">
                  <p className="text-stone-400 text-xs md:text-sm p-2 bg-stone-800">미리보기</p>
                  <div className="h-20 md:h-24 bg-stone-700">
                    <img src={newBanner.image} alt="미리보기" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleAddBanner} className="flex-1 px-6 py-3 bg-cyan-600 text-white font-bold hover:bg-cyan-500 transition-colors whitespace-nowrap cursor-pointer">
                <i className="ri-check-line mr-2"></i>추가
              </button>
              <button
                onClick={() => { setShowBannerModal(false); setNewBanner({ title: '', image: '', link: '' }); }}
                className="flex-1 px-6 py-3 bg-stone-700 text-white font-bold hover:bg-stone-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}



    </>
  );
}
