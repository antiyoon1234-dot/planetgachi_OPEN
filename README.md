# Planetgachi · 플래닛어스 가치표

PlanetEarth 서버의 아이템 가치표, 커뮤니티 가치투표, 거래소 시세와 체스트샵을 제공하는 웹 애플리케이션입니다.

이 저장소는 [Planetgachi](https://github.com/antiyoon1234-dot/Planetgachi)의 소스에서 운영용 설정과 하드코딩된 자격 증명을 제거한 공개본입니다. **PlanetEarth 공식 서비스가 아닙니다.**

## 이용 조건 — 먼저 읽어주세요

이 프로젝트는 **사용 전 작성자에게 알리고, 비상업적 목적으로만 사용**할 수 있습니다.

- 실행, 수정, 다른 프로젝트에 적용, 서비스 운영 또는 재배포 전에 작성자에게 사용 사실을 알려주세요.
- 사용 알림은 [이 저장소의 GitHub Issues](https://github.com/antiyoon1234-dot/planetgachi_OPEN/issues)에서 작성자 **antiYoon_ (antiyoon1234-dot)**에게 보내주세요.
- 비상업적 이용은 알림을 보낸 뒤 시작할 수 있습니다. 별도의 승인 답변을 기다릴 필요는 없습니다.
- 판매, 유료 서비스, 광고·협찬 수익을 얻는 서비스, 유료 개발 납품 등 상업적 이용은 금지합니다.
- 수정하거나 재배포할 때 원저작자 표시와 [LICENSE](./LICENSE)를 유지하고 변경 사실을 밝혀주세요.
- 단순한 소스 열람과 GitHub 약관에 따른 열람용 포크에는 사용 알림을 요구하지 않습니다.

상업적 이용 제한이 있는 **소스 공개(Source-available) 프로젝트**입니다. 상세 조건과 적용 범위는 [LICENSE](./LICENSE)를 따릅니다. 외부 라이브러리와 이미지·로고 등 제3자 자료에는 해당 권리자의 조건이 별도로 적용됩니다.

### 사용 알림 예시

Issues에 다음 내용을 남기면 됩니다. 비밀번호, API 키, 개인정보는 작성하지 마세요.

```text
제목: [사용 알림] 프로젝트명

사용자 또는 단체: GitHub 닉네임 / 단체명
사용 목적: 개인 학습 / 비영리 커뮤니티 운영 등
사용 범위: 로컬 실행 / 일부 코드 활용 / 수정본 배포 등
공개 주소: 웹사이트 또는 저장소 링크 (있는 경우)
상업적 이용 여부: 없음
사용 조건을 확인했고, 원저작자 표시와 LICENSE를 유지하겠습니다.
```

## 주요 기능

| 페이지 | 주소 | 기능 |
| --- | --- | --- |
| 가치표 | `/` | 아이템 검색·정렬, 단위별 가치, 배너, 데이터 변경 구독 |
| 아이템 상세 | `/item/:id` | 아이템 정보와 가치 변동 이력 |
| 가치 제안 | `/submit` | 새 아이템 제출과 기존 가치 변경 제안 |
| 가치투표 | `/voting` | 제안에 대한 찬성·반대 투표 |
| 승인 결과 | `/results` | 승인된 가치표 품목 조회 |
| 거래소 | `/auction` | 거래 내역과 아이템 시세 조회 |
| 체스트샵 | `/shop`, `/shop/:id` | 상점 목록·상세, 등록 품목과 상점 관리 |
| 관리자 | `/admin` | 아이템·제안·배너·상점 관리, 상한가·평균가 설정, 이상 거래 검토 |

`/admin/site`는 `/admin`으로 이동합니다. 데이터 조회와 관리 기능은 각자의 Supabase 설정에 따라 동작합니다.

## 기술 구성

- React 19, TypeScript, Vite 7
- Tailwind CSS 3, Lucide 아이콘
- React Router 7
- Supabase Database / Realtime
- Supabase Edge Functions, Vercel 서버리스 API

## 로컬 실행

Node.js **22.12 이상**과 npm이 필요합니다. 실제 실행·수정·운영 전에 위 이용 조건에 따라 사용 알림을 보내주세요.

```bash
git clone https://github.com/antiyoon1234-dot/planetgachi_OPEN.git
cd planetgachi_OPEN
npm ci
```

프로젝트 루트에 `.env.local`을 만들고 본인 프로젝트의 공개 설정값을 넣습니다. [환경변수 예시](./.env.example)를 참고하세요.

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_AUCTION_PROXY_URL=https://your-project-ref.supabase.co/functions/v1/auction-proxy

# 선택: 로컬 개발 프록시 대상
DEV_PROXY_TARGET=http://localhost:8080
```

기존 `VITE_PUBLIC_SUPABASE_URL`, `VITE_PUBLIC_SUPABASE_ANON_KEY` 변수명도 지원합니다.

```bash
npm run dev
```

개발 서버 기본 주소는 [http://localhost:3000](http://localhost:3000)입니다.

## Supabase 구성

운영 데이터, 관리자 비밀번호, 세션, 실제 환경 설정은 포함하지 않습니다. **빈 Supabase 프로젝트에 환경변수만 입력하면 모든 기능이 완성되는 설치 패키지는 아닙니다.**

포함된 SQL 파일의 범위는 다음과 같습니다.

| 파일 | 용도 |
| --- | --- |
| [auction_schema.sql](./auction_schema.sql) | 거래 내역·이상 거래 테이블과 평균가 뷰 |
| [market_schema.sql](./market_schema.sql) | 가격 규칙·시세 설정 테이블과 관련 RLS 정책 |
| [admin_auth_schema.sql](./admin_auth_schema.sql) | 기존 관리자 설정 테이블을 사용하는 비밀번호 검증·변경 함수 |

`auction_schema.sql` 이후 `market_schema.sql`을 적용합니다. `admin_auth_schema.sql`은 `admin_config` 테이블과 `extensions.digest` 함수가 준비되어 있어야 하며, 기본 비밀번호를 생성하지 않습니다.

가치표·투표·배너·방문 통계·체스트샵에 필요한 기본 테이블과 일부 RPC는 이 저장소에 전체 생성 스크립트가 포함되어 있지 않습니다. 관리자 화면이 호출하는 `market_admin_login`, `market_admin_validate_session`, `market_admin_logout`, `market_admin_save_settings`와 체스트샵 관련 RPC도 별도로 구성해야 합니다.

[경매 동기화 Edge Function](./supabase/functions/auction-sync/index.ts)은 포함되어 있습니다. 다음 값은 서버 측 환경변수로 사용합니다.

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: 동기화 서버의 Supabase 접근 설정
- `AUCTION_SYNC_SECRET`: 동기화 호출 인증용 비밀값
- `MARKET_API_URL`: 선택적인 거래 데이터 API 주소
- `MARKET_API_TOKEN`: 거래 데이터 API가 인증을 요구할 때 사용하는 토큰

`VITE_AUCTION_PROXY_URL`의 예시 값은 별도의 조회용 `auction-proxy` 함수를 가리킵니다. 해당 함수 구현은 이 공개본에 포함되어 있지 않습니다. 필요한 거래 응답 형식을 제공하는 조회 API를 구성해야 하며, 서버 동기화용 비밀값을 프론트엔드에 넣어 대체하지 마세요.

## Vercel 배포

1. 본인 Supabase의 테이블·RPC·RLS 및 필요한 Edge Function을 준비합니다.
2. Vercel에서 저장소를 연결합니다.
3. 프로젝트 환경변수에 위 `VITE_*` 공개 설정을 추가합니다.
4. 빌드 명령은 `npm run build`, 출력 디렉터리는 `dist`로 설정합니다.
5. 배포 후 조회·투표·관리자 권한을 확인합니다. 환경변수를 바꾸면 다시 배포합니다.

SPA 경로와 API 경로 처리는 [vercel.json](./vercel.json)에 설정되어 있습니다.

## 보안과 운영

- `VITE_*` 값은 브라우저에 공개됩니다. 공개 anon 키 외에 `service_role` 키, 관리자 비밀번호, 서버 API 토큰을 넣지 마세요.
- 브라우저의 관리자 화면만으로 DB 권한이 보호되지는 않습니다. 실제 수정 권한은 서버의 RLS·RPC에서 검증해야 합니다.
- `.env`, `.env.*`과 개인키 파일은 Git에서 제외하며, `.env.example`에는 예시값만 둡니다.
- API 호출 제한과 외부 데이터 제공자의 이용 조건을 준수하세요.
- 운영 전 의존성 취약점과 권한 설정을 점검하세요. 이 공개본은 운영 보안 검증 완료를 보장하지 않습니다.

## 개발 명령

```bash
npm run type-check          # TypeScript 검사
npm run build               # 프로덕션 빌드 → dist/
npm run preview             # 빌드 결과 확인
npm run lint                # ESLint 검사
npm audit --omit=dev        # 운영 의존성 취약점 확인
```

기존 회귀 테스트는 TypeScript를 직접 실행할 수 있는 Node.js 24 환경에서 실행합니다.

```bash
node --test tests/auctionAnomalies.test.mjs tests/catalogAverage.test.mjs
```

## 폴더 구성

```text
src/
  components/       공통 화면 구성
  lib/              Supabase 연결, 시세 계산, 이상 거래 감지
  pages/            가치표·투표·거래소·상점·관리자 화면
  router/           페이지 경로
api/                Vercel API
supabase/functions/ 경매 동기화 Edge Function
tests/              시세 계산 회귀 테스트
*.sql               포함된 DB 구성 스크립트
```

## 라이선스와 문의

Copyright (c) 2026 antiYoon_ (antiyoon1234-dot).

**Planetgachi 비상업적 이용 및 사전 알림 라이선스 v1.0**를 적용합니다. 전문은 [LICENSE](./LICENSE), 사용 알림과 문의는 [GitHub Issues](https://github.com/antiyoon1234-dot/planetgachi_OPEN/issues)를 확인하세요.

PlanetEarth 및 Minecraft의 명칭·로고·게임 자료에 대한 권리는 각 권리자에게 있습니다. 이 저장소의 라이선스가 해당 자료의 사용 권한까지 부여하지는 않습니다.
