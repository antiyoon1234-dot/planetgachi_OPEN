# 플래닛어스가치 - 플래닛어스 가치표 사이트

마인크래프트 PlanetEarth 서버의 아이템 시세를 **커뮤니티 투표**로 결정하는 웹 애플리케이션.

## 기술 스택

| 영역 | 기술 o|
|------|------|
| 프레임워크 | React 19 + TypeScript |
| 빌드 도구 | Vite 7 (SWC 플러그인) |
| 스타일링 | 테일윈드 CSS 3 |
| 백엔드/DB | Supabase(포스트그레)SQL + 실시간) |
| 서버리스 함수 | 수퍼베이스 엣지 함수 (데노) |
| 라우팅 | 리액트 라우터 v7 |
| 다국어 | i18next (현재 미사용) |
| 기타 | 플러그인 자동 가져오기(React Hooks 자동 가져오기) |

## 프로젝트 구조

```
플래닛어스가치/
├-- src/
│ ├-- App.tsx # 루트 컴포넌트(브라우저라우터 + i18n 공급자)
│ ├── main.tsx # 앱 엔트리포인트
│ ├-- 인덱스.css # 글로벌 스타일 (테일윈드)
│ │
│ ├-- lib/
│ │ └-- supabase.ts # supabase 클라이언트 초기화 + 타입 정의
│   │
│   ├── router/
│   │   ├── config.tsx            # 라우트 설정 (path -> 컴포넌트 매핑)
│   │   └── index.ts              # AppRoutes + 글로벌 navigate 함수
│   │
│   ├── pages/
│   │   ├── home/page.tsx         # 홈 - 아이템 목록, 배너, 실시간 구독
│   │   ├── item/page.tsx         # 아이템 상세 - 가치 변동 차트 (Canvas)
│   │   ├── submit/page.tsx       # 아이템 제출 / 시세 변경 제안
│   │   ├── voting/page.tsx       # 투표 페이지 (찬성/반대)
│   │   ├── results/page.tsx      # 승인된 아이템 결과 목록
│   │   ├── admin/page.tsx        # 관리자 대시보드
│   │   ├── shop/page.tsx         # 체스트샵 대시보드
│   │   ├── shop/detail.tsx       # 체스트샵 디테일
│   │   └── NotFound.tsx          # 404 페이지
│   │
│   ├── mocks/
│   │   └── items.ts              # 개발용 목업 데이터
│   │
│   └── i18n/
│       ├── index.ts              # i18next 초기화
│       └── local/index.ts        # 번역 리소스 로더
│
├── supabase/
│   └── functions/
│       └── admin-auth/
│           └── index.ts          # 관리자 인증 Edge Function (로그인/세션/비밀번호)
│
├── vite.config.ts                # Vite 설정 (포트 3000, auto-import, path alias)
├── tailwind.config.ts            # Tailwind 설정
├── tsconfig.json                 # TypeScript 설정
└── package.json                  # 의존성 및 스크립트
```

## 페이지별 기능

### `/` - 홈
- 승인된 아이템 목록 (가치순/투표순/최신순 정렬, 검색)
- 배너 슬라이드 (5초 자동 전환)
- **Supabase Realtime** 구독 - items, banners, proposals 테이블 실시간 반영
- 방문 통계 기록 (visit_stats)
- 모바일/데스크톱 반응형 (카드뷰 / 테이블뷰)

### `/item/:id` - 아이템 상세
- 아이템 정보 표시
- 가치 변동 히스토리 차트 (Canvas API로 직접 그린 라인 차트)

### `/submit` - 아이템 제출
- **새 아이템 등록**: 코드, 이름, 이미지URL, 단위(개당/16개/64개), 가치, 닉네임
- **시세 변경 제안**: 기존 아이템 선택 -> 새 가치 제안
- 입력값 검증 (XSS 방지, 코드/이름/URL/가치/닉네임 유효성 검사)
- 제출 시 proposals 테이블에 INSERT -> 투표 페이지로 이동

### `/voting` - 투표
- 투표 중인 제안 목록 표시
- 찬성/반대 투표 (브라우저 핑거프린트 기반 1인 1표)
- 찬성 5표 도달 시 자동 승인 (items 테이블 반영 + value_history 기록)
- 반대 5표 도달 시 자동 거부
- Supabase Realtime으로 실시간 업데이트

### `/results` - 결과
- 승인된 아이템 목록 (홈과 유사, 클릭 이벤트 없음)
- 가치순/투표순/최신순 정렬 + 검색

### `/admin` - 통합 관리자
- **비밀번호 인증** (Supabase RPC로 로그인·세션 검증·로그아웃을 한곳에서 처리)
- **아이템별 상한가 / 거래소 평균가 적용**: 두 개의 별도 탭으로 가격 운영 기능 제공
- 기존 아이템·제안·배너·체스트샵·이상 거래·설정 메뉴를 같은 패널에서 제공
- `/admin/site`는 `/admin`으로 자동 이동
- 상한가 탭의 미저장 입력은 다른 탭으로 이동해도 유지 (새로고침·로그아웃 시 초기화)
- 이상 거래 탭: 최근 7일 전체 거래를 페이지별로 조회해 재검사. 같은 품목·표시명별 중앙값 주변 정상 표본으로 평균 단가를 계산하고 거래 수량으로 환산. DB 탐지 비율·최소 표본 수 사용. 과거 저장 오탐은 현재 결과에 합치지 않으며 재검사 자체는 DB에 쓰지 않음.
- 탐지 회귀 검사: `node --test tests/auctionAnomalies.test.mjs` (Node 24)
- 승인된 아이템 CRUD (추가/수정/삭제)
- 투표 중인 제안 관리 (즉시 승인/거부)
- 배너 관리 (추가/활성화·비활성화/삭제, 이미지 업로드)
- 방문 통계 대시보드 (도넛/바/라인 차트 - Canvas)
- 비밀번호 변경

### `/shop` - 체스트샵
- **유저 체스트샵 데이터 제공** (supbase db)
- 유저가 직접 등록해서 사용하는 시스템 (추가/수정/삭제)
- /item의 edge function(api)로 가격데이터 제공

  
## Supabase 테이블 구조

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `items` | 승인된 아이템 | id, code, name, image, current_value, status, votes, unit_type, created_at |
| `proposals` | 투표 중인 제안 | id, item_id, item_code, item_name, proposed_value, current_votes, negative_votes, required_votes, status, type(new/update), unit_type, submitted_by |
| `votes` | 투표 기록 | id, proposal_id, fingerprint, vote_type(up/down) |
| `value_history` | 가치 변동 이력 | id, item_id, value, previous_value, reason, votes, changed_at |
| `banners` | 홈 배너 | id, title, image, link, active |
| `visit_stats` | 방문 통계 | id, date, hour, visits |
| `admin_config` | 관리자 설정 | config_key, config_value |
| `admin_sessions` | 관리자 세션 | session_token, expires_at, ip_address, user_agent |

## 개발 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

프로젝트 루트에 `.env` 파일 생성:

```env
VITE_SUPABASE_URL=<Supabase 프로젝트 URL>
VITE_SUPABASE_ANON_KEY=<Supabase anon public key>
VITE_AUCTION_PROXY_URL=<Supabase auction-proxy 함수 URL>
```

Supabase 대시보드 > Settings > API 에서 확인 가능.

`.env.example`에는 예시값만 있습니다. 실제 값은 무시되는 `.env.local`이나
배포 환경변수에 설정하세요. `VITE_*` 값은 브라우저에 공개되므로 관리자
비밀번호, `service_role` 키, API 비밀 토큰은 넣지 마세요. 서버 비밀값은
Supabase Edge Function의 환경변수로 설정합니다.

`admin_auth_schema.sql`에는 기본 관리자 비밀번호가 없습니다. 관리자 계정
설정은 개인 환경에서 진행하며, 사용 중인 비밀번호나 해시를 SQL 파일에
작성해 커밋하지 마세요.

개발 프록시가 필요하면 `DEV_PROXY_TARGET`을 개발 서버 실행 환경변수로
지정하세요. 기본값은 `http://localhost:8080`입니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

`http://localhost:3000` 에서 확인.

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 (포트 3000) |
| `npm run build` | 프로덕션 빌드 (out/ 디렉토리) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | ESLint 검사 |
| `npm run type-check` | TypeScript 타입 체크 |

## 핵심 로직 요약

### 투표 -> 승인 흐름

```
유저가 아이템 제출 (/submit)
  └─> proposals 테이블에 INSERT (status: 'voting')
        └─> 투표 페이지에서 커뮤니티 투표 (/voting)
              ├─ 찬성 5표 도달 -> approveProposal()
              │    ├─ type='new': items 테이블에 INSERT + value_history 초기 기록
              │    └─ type='update': items 테이블 UPDATE + value_history 기록
              │    └─ proposals status -> 'approved'
              └─ 반대 5표 도달 -> rejectProposal()
                   └─ proposals status -> 'rejected'
```

### 중복 투표 방지

브라우저 핑거프린트(Canvas + UserAgent + 화면해상도 + 타임존 등) 의 SHA-256 해시를 생성하여 votes 테이블의 fingerprint 컬럼으로 중복 체크.

