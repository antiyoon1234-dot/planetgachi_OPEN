import { useState, useEffect, useCallback } from 'react';
import { supabase, type Proposal } from '../../lib/supabase';
import { Package, Clock } from 'lucide-react';
import { getItemName } from '../../lib/itemNames';

const floorToHundreds = (value: number) => Math.floor(Number(value) / 100) * 100;

const MiniAuctionReference = ({ itemCode, limit = 2 }: { itemCode: string, limit?: number }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemCode || itemCode.length < 2) {
      setTransactions([]);
      return;
    }
    const load = async () => {
      setLoading(true);
      let searchType = itemCode.toLowerCase();
      if (!searchType.startsWith('minecraft:')) {
        searchType = `minecraft:${searchType}`;
      }

      const { data } = await supabase
        .from('auction_transactions')
        .select('*')
        .ilike('item_type', searchType)
        .order('transaction_date', { ascending: false })
        .limit(limit);
      setTransactions(data || []);
      setLoading(false);
    };
    const timer = setTimeout(load, 500);
    return () => clearTimeout(timer);
  }, [itemCode, limit]);

  if (!itemCode || itemCode.length < 2) return null;

  return (
    <div className="bg-stone-900 border-2 border-stone-800 p-3 w-full">
      <h4 className="text-lime-400 font-bold mb-2 flex items-center gap-2 text-xs">
        <Package className="size-3" />
        거래소 최근 거래 시세
      </h4>
      {loading ? (
        <p className="text-stone-500 text-xs py-1">조회 중...</p>
      ) : transactions.length === 0 ? (
        <p className="text-stone-500 text-xs py-1">최근 거래 내역이 없습니다</p>
      ) : (
        <div className="space-y-1.5 flex flex-col md:flex-row gap-2">
          {transactions.map(tx => (
            <div key={tx.id} className="flex-1 flex justify-between items-center text-[11px] bg-stone-800 p-2 border border-stone-700">
              <div>
                <p className="text-white font-bold">{tx.item_info?.displayName || getItemName(tx.item_type)}</p>
                <p className="text-stone-500 flex items-center gap-1 mt-0.5">
                  <Clock className="size-3" />
                  {new Date(tx.transaction_date).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-amber-400 font-bold">{floorToHundreds(tx.price).toLocaleString()} 원</p>
                {tx.item_info?.amount > 1 && <p className="text-[9px] text-stone-500">x{tx.item_info.amount}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// MD5 해시 함수
const md5 = async (str: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
};

// 브라우저 핑거프린트 생성 (MD5 해시 적용)
const generateFingerprint = async (): Promise<string> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
  }
  const canvasData = canvas.toDataURL();

  const fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvas: canvasData,
  };

  const fingerprintString = JSON.stringify(fingerprint);
  return await md5(fingerprintString);
};

export default function VotingPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votedProposals, setVotedProposals] = useState<Map<number, 'up' | 'down'>>(new Map());
  const [fingerprint, setFingerprint] = useState<string>('');
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // ✅ 수정: useEffect보다 먼저 선언해야 TDZ 에러가 발생하지 않음
  const loadProposals = useCallback(async () => {
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
  }, []);

  const loadVotedProposals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('votes')
        .select('proposal_id, vote_type')
        .eq('fingerprint', fingerprint);

      if (error) throw error;
      if (data) {
        const voteMap = new Map<number, 'up' | 'down'>();
        data.forEach(v => voteMap.set(v.proposal_id, v.vote_type || 'up'));
        setVotedProposals(voteMap);
      }
    } catch (error) {
      console.error('투표 기록 로드 오류:', error);
    }
  }, [fingerprint]);

  useEffect(() => {
    const init = async () => {
      const fp = await generateFingerprint();
      setFingerprint(fp);
    };
    init();
  }, []);

  useEffect(() => {
    if (!fingerprint) return;

    loadProposals();
    loadVotedProposals();

    // 실시간 구독 설정
    const channel = supabase
      .channel('proposals-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proposals',
        },
        (payload) => {
          console.log('실시간 업데이트:', payload);

          if (payload.eventType === 'INSERT') {
            const newProposal = payload.new as Proposal;
            if (newProposal.status === 'voting') {
              setProposals(prev => [newProposal, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedProposal = payload.new as Proposal;
            if (updatedProposal.status === 'voting') {
              setProposals(prev =>
                prev.map(p => p.id === updatedProposal.id ? updatedProposal : p)
              );
            } else {
              setProposals(prev => prev.filter(p => p.id !== updatedProposal.id));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: number }).id;
            setProposals(prev => prev.filter(p => p.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fingerprint, loadProposals, loadVotedProposals]);

  const handleVote = async (proposalId: number, voteType: 'up' | 'down') => {
    if (votedProposals.has(proposalId)) {
      alert('이미 투표한 제안입니다.');
      return;
    }

    try {
      console.log('투표 시작:', { proposalId, fingerprint, voteType });

      // 1. 투표 기록 추가
      const { data: voteData, error: voteError } = await supabase
        .from('votes')
        .insert({
          proposal_id: proposalId,
          fingerprint: fingerprint,
          vote_type: voteType
        })
        .select();

      if (voteError) {
        console.error('투표 기록 추가 실패:', voteError);
        alert(`투표 기록 오류: ${voteError.message}`);
        return;
      }

      console.log('투표 기록 성공:', voteData);

      // 2. 제안 정보 가져오기
      const proposal = proposals.find(p => p.id === proposalId);
      if (!proposal) {
        console.error('제안을 찾을 수 없습니다:', proposalId);
        alert('제안을 찾을 수 없습니다.');
        return;
      }

      // 3. 투표 수 업데이트
      const updateData = voteType === 'up'
        ? { current_votes: proposal.current_votes + 1 }
        : { negative_votes: (proposal.negative_votes || 0) + 1 };

      console.log('투표 수 업데이트:', { proposalId, updateData });

      const { error: updateError } = await supabase
        .from('proposals')
        .update(updateData)
        .eq('id', proposalId);

      if (updateError) {
        console.error('투표 수 업데이트 실패:', updateError);
        alert(`투표 수 업데이트 오류: ${updateError.message}`);
        return;
      }

      console.log('투표 수 업데이트 성공');

      // 4. 로컬 상태 업데이트
      const newVotedProposals = new Map(votedProposals);
      newVotedProposals.set(proposalId, voteType);
      setVotedProposals(newVotedProposals);

      const newCurrentVotes = voteType === 'up' ? proposal.current_votes + 1 : proposal.current_votes;
      const newNegativeVotes = voteType === 'down' ? (proposal.negative_votes || 0) + 1 : (proposal.negative_votes || 0);

      setProposals(prev =>
        prev.map(p => p.id === proposalId ? {
          ...p,
          current_votes: newCurrentVotes,
          negative_votes: newNegativeVotes
        } : p)
      );

      // 5. 찬성 5표 도달 시 승인 처리
      if (voteType === 'up' && newCurrentVotes >= proposal.required_votes) {
        console.log('필요 투표 수 도달, 승인 처리 시작');
        await approveProposal(proposal);
      }

      // 6. 반대 5표 도달 시 거부 처리
      if (voteType === 'down' && newNegativeVotes >= 5) {
        console.log('반대 투표 5표 도달, 거부 처리 시작');
        await rejectProposal(proposal);
      }

      alert(voteType === 'up' ? '찬성 투표가 완료되었습니다!' : '반대 투표가 완료되었습니다!');

    } catch (error) {
      console.error('투표 처리 중 예외 발생:', error);
      alert(`투표 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  const rejectProposal = async (proposal: Proposal) => {
    try {
      console.log('거부 처리 시작:', proposal);

      const { error: statusError } = await supabase
        .from('proposals')
        .update({ status: 'rejected' })
        .eq('id', proposal.id);

      if (statusError) {
        console.error('제안 상태 변경 실패:', statusError);
        throw statusError;
      }

      console.log('거부 처리 완료');
    } catch (error) {
      console.error('거부 처리 중 오류:', error);
      alert(`거부 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  const approveProposal = async (proposal: Proposal) => {
    try {
      console.log('승인 처리 시작:', proposal);

      if (proposal.type === 'new') {
        console.log('새 아이템 추가 중...');

        const { data: insertedItem, error: insertError } = await supabase
          .from('items')
          .insert({
            code: proposal.item_code,
            name: proposal.item_name,
            image: proposal.item_image,
            current_value: proposal.proposed_value,
            status: 'approved',
            votes: proposal.current_votes,
            unit_type: proposal.unit_type || 'piece',
          })
          .select()
          .single();

        if (insertError) {
          console.error('아이템 추가 실패:', insertError);
          throw insertError;
        }

        console.log('아이템 추가 성공:', insertedItem);

        if (insertedItem) {
          console.log('초기 히스토리 추가 중...');
          const { error: initialHistoryError } = await supabase
            .from('value_history')
            .insert({
              item_id: insertedItem.id,
              value: proposal.proposed_value,
              previous_value: null,
              reason: '초기 등록',
              votes: 0,
              changed_at: insertedItem.created_at,
            });

          if (initialHistoryError) {
            console.error('초기 히스토리 추가 실패:', initialHistoryError);
          } else {
            console.log('초기 히스토리 추가 성공');
          }

          console.log('투표 승인 히스토리 추가 중...');
          const { error: voteHistoryError } = await supabase
            .from('value_history')
            .insert({
              item_id: insertedItem.id,
              value: proposal.proposed_value,
              previous_value: proposal.proposed_value,
              reason: '커뮤니티 투표',
              votes: proposal.current_votes,
            });

          if (voteHistoryError) {
            console.error('투표 히스토리 추가 실패:', voteHistoryError);
          } else {
            console.log('투표 히스토리 추가 성공');
          }
        }
      } else if (proposal.type === 'update' && proposal.item_id) {
        console.log('아이템 가치 업데이트 중...');

        const { data: item, error: fetchError } = await supabase
          .from('items')
          .select('current_value')
          .eq('id', proposal.item_id)
          .maybeSingle();

        if (fetchError) {
          console.error('아이템 조회 실패:', fetchError);
          throw fetchError;
        }

        if (!item) {
          console.error('아이템을 찾을 수 없음:', proposal.item_id);
          throw new Error('아이템을 찾을 수 없습니다');
        }

        console.log('아이템 조회 성공:', item);

        const { error: updateError } = await supabase
          .from('items')
          .update({
            current_value: proposal.proposed_value,
            last_modified: new Date().toISOString(),
          })
          .eq('id', proposal.item_id);

        if (updateError) {
          console.error('아이템 업데이트 실패:', updateError);
          throw updateError;
        }

        console.log('아이템 업데이트 성공');

        console.log('히스토리 추가 중...');
        const { error: historyError } = await supabase
          .from('value_history')
          .insert({
            item_id: proposal.item_id,
            value: proposal.proposed_value,
            previous_value: item.current_value,
            reason: '커뮤니티 투표',
            votes: proposal.current_votes,
          });

        if (historyError) {
          console.error('히스토리 추가 실패:', historyError);
        } else {
          console.log('히스토리 추가 성공');
        }
      }

      console.log('제안 상태 변경 중...');
      const { error: statusError } = await supabase
        .from('proposals')
        .update({ status: 'approved' })
        .eq('id', proposal.id);

      if (statusError) {
        console.error('제안 상태 변경 실패:', statusError);
        throw statusError;
      }

      console.log('승인 처리 완료');
    } catch (error) {
      console.error('승인 처리 중 오류:', error);
      alert(`승인 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  const getUnitLabel = (unitType?: string) => {
    switch (unitType) {
      case 'stack_64':
      case 'stack':
        return '64개';
      case 'stack_16':
      case 'set':
        return '16개';
      default:
        return '1개';
    }
  };

  const getUnitColor = (unitType?: string) => {
    switch (unitType) {
      case 'stack_64':
      case 'stack':
        return 'bg-purple-900 text-purple-400';
      case 'stack_16':
      case 'set':
        return 'bg-amber-900 text-amber-400';
      default:
        return 'bg-cyan-900 text-cyan-400';
    }
  };

  return (
    <>
      {/* Main Content */}
      <section className="py-10 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <div className="flex items-center justify-center gap-3 mb-3 md:mb-4">
              <h2 className="text-2xl md:text-4xl font-bold text-lime-400 font-pixel">투표하기</h2>
              {/* 실시간 상태 표시 */}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${realtimeStatus === 'connected'
                ? 'bg-emerald-900/50 text-emerald-400'
                : realtimeStatus === 'connecting'
                  ? 'bg-amber-900/50 text-amber-400'
                  : 'bg-red-900/50 text-red-400'
                }`}>
                <span className={`w-2 h-2 rounded-full ${realtimeStatus === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : realtimeStatus === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-red-400'
                  }`}></span>
                {realtimeStatus === 'connected' ? 'LIVE' : realtimeStatus === 'connecting' ? '연결 중' : '오프라인'}
              </div>
            </div>
            <p className="text-base md:text-xl text-stone-300">커뮤니티 제안에 투표하여 아이템 가치를 결정하세요.</p>
          </div>

          {/* Info Box */}
          <div className="mb-6 md:mb-8 bg-stone-900 border-4 border-stone-950 p-4 md:p-6">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-information-line text-xl md:text-2xl text-white"></i>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2 text-sm md:text-base">투표 방법</h3>
                <ul className="text-stone-300 space-y-1 text-xs md:text-sm">
                  <li>• <span className="text-lime-400 font-semibold">찬성 5표</span> 이상 획득 시 자동으로 승인됩니다</li>
                  <li>• <span className="text-red-400 font-semibold">반대 5표</span> 이상 획득 시 자동으로 거부됩니다</li>
                  <li>• 한 제안당 1번만 투표할 수 있습니다 (찬성 또는 반대)</li>
                  <li>• 투표는 취소할 수 없으니 신중하게 결정해주세요</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Proposals List */}
          {proposals.length === 0 ? (
            <div className="text-center py-12 bg-stone-900 border-4 border-stone-950">
              <i className="ri-inbox-line text-5xl md:text-6xl text-stone-600 mb-4"></i>
              <p className="text-base md:text-xl text-stone-400 mb-4">현재 투표 중인 제안이 없습니다</p>
              <a
                href="/submit"
                className="inline-block px-6 py-3 bg-lime-600 text-white font-bold hover:bg-lime-500 transition-colors whitespace-nowrap cursor-pointer"
              >
                새 제안 제출하기
              </a>
            </div>
          ) : (
            <div className="space-y-4 md:space-y-6">
              {proposals.map((proposal) => {
                const voteType = votedProposals.get(proposal.id);
                const hasVoted = votedProposals.has(proposal.id);
                const progress = (proposal.current_votes / proposal.required_votes) * 100;
                const negativeProgress = ((proposal.negative_votes || 0) / 5) * 100;

                return (
                  <div
                    key={proposal.id}
                    className="bg-stone-900 border-4 border-stone-950 p-4 md:p-6"
                  >
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                      {/* Item Image */}
                      <div className="w-24 h-24 md:w-32 md:h-32 bg-stone-800 border-2 border-stone-700 flex items-center justify-center flex-shrink-0 mx-auto md:mx-0">
                        <img
                          src={proposal.item_image}
                          alt={proposal.item_name}
                          className="w-20 h-20 md:w-28 md:h-28 object-contain"
                        />
                      </div>

                      {/* Proposal Info */}
                      <div className="flex-1">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-3 gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="text-lg md:text-xl font-bold text-white">
                                {proposal.item_name}
                              </h3>
                              {proposal.unit_type && (
                                <span className={`px-2 py-0.5 text-xs font-bold ${getUnitColor(proposal.unit_type)}`}>
                                  {getUnitLabel(proposal.unit_type)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs md:text-sm text-stone-400 font-mono">{proposal.item_code}</p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap self-start ${proposal.type === 'new'
                              ? 'bg-lime-600 text-white'
                              : 'bg-amber-600 text-white'
                              }`}
                          >
                            {proposal.type === 'new' ? '신규 아이템' : '가치 변경'}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 md:gap-6 mb-4">
                          {proposal.type === 'update' && proposal.current_value !== null && proposal.current_value !== undefined && (
                            <>
                              <div>
                                <p className="text-xs text-stone-400 mb-1">현재 가치</p>
                                <p className="text-base md:text-lg font-bold text-stone-500 line-through">
                                  {proposal.current_value.toLocaleString()}
                                </p>
                              </div>
                              <i className="ri-arrow-right-line text-stone-400"></i>
                            </>
                          )}
                          <div>
                            <p className="text-xs text-stone-400 mb-1">제안 가치</p>
                            <p className="text-xl md:text-2xl font-bold text-lime-400">
                              {proposal.proposed_value.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* Progress Bars */}
                        <div className="mb-4 space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs md:text-sm text-lime-400 flex items-center gap-1">
                                <i className="ri-thumb-up-fill"></i>
                                찬성: {proposal.current_votes} / {proposal.required_votes}
                              </span>
                              <span className="text-xs md:text-sm font-medium text-lime-400">
                                {Math.round(progress)}%
                              </span>
                            </div>
                            <div className="w-full bg-stone-950 h-2 overflow-hidden">
                              <div
                                className="bg-lime-600 h-full transition-all duration-300"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              ></div>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs md:text-sm text-red-400 flex items-center gap-1">
                                <i className="ri-thumb-down-fill"></i>
                                반대: {proposal.negative_votes || 0} / 5
                              </span>
                              <span className="text-xs md:text-sm font-medium text-red-400">
                                {Math.round(negativeProgress)}%
                              </span>
                            </div>
                            <div className="w-full bg-stone-950 h-2 overflow-hidden">
                              <div
                                className="bg-red-600 h-full transition-all duration-300"
                                style={{ width: `${Math.min(negativeProgress, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Submit Info & Vote Buttons */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <p className="text-xs text-stone-400">
                            제출자: {proposal.submitted_by} • {new Date(proposal.submitted_at).toLocaleDateString('ko-KR')}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleVote(proposal.id, 'up')}
                              disabled={hasVoted}
                              className={`flex-1 md:flex-none px-4 md:px-6 py-2 md:py-3 font-bold transition-all whitespace-nowrap cursor-pointer text-sm md:text-base flex items-center justify-center gap-2 ${hasVoted
                                ? voteType === 'up'
                                  ? 'bg-lime-800 text-lime-300 cursor-not-allowed'
                                  : 'bg-stone-700 text-stone-500 cursor-not-allowed'
                                : 'bg-lime-600 text-white hover:bg-lime-500'
                                }`}
                            >
                              <i className="ri-thumb-up-fill"></i>
                              {hasVoted && voteType === 'up' ? '찬성함' : '찬성'}
                            </button>
                            <button
                              onClick={() => handleVote(proposal.id, 'down')}
                              disabled={hasVoted}
                              className={`flex-1 md:flex-none px-4 md:px-6 py-2 md:py-3 font-bold transition-all whitespace-nowrap cursor-pointer text-sm md:text-base flex items-center justify-center gap-2 ${hasVoted
                                ? voteType === 'down'
                                  ? 'bg-red-800 text-red-300 cursor-not-allowed'
                                  : 'bg-stone-700 text-stone-500 cursor-not-allowed'
                                : 'bg-red-600 text-white hover:bg-red-500'
                                }`}
                            >
                              <i className="ri-thumb-down-fill"></i>
                              {hasVoted && voteType === 'down' ? '반대함' : '반대'}
                            </button>
                          </div>
                        </div>

                        {/* Recent Auction Data */}
                        <div className="mt-4 pt-4 border-t-2 border-stone-950">
                          <MiniAuctionReference itemCode={proposal.item_code} limit={2} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
