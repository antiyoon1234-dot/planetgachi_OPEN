import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "node:path";
import AutoImport from "unplugin-auto-import/vite";

const base = process.env.BASE_PATH || "/";
const isPreview = process.env.IS_PREVIEW ? true : false;

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BASE_PATH__: JSON.stringify(base),
    __IS_PREVIEW__: JSON.stringify(isPreview),
    __READDY_PROJECT_ID__: JSON.stringify(process.env.PROJECT_ID || ""),
    __READDY_VERSION_ID__: JSON.stringify(process.env.VERSION_ID || ""),
    __READDY_AI_DOMAIN__: JSON.stringify(process.env.READDY_AI_DOMAIN || ""),
  },
  plugins: [
    react(),
    AutoImport({
      imports: [
        {
          react: [
            "React",
            "useState",
            "useEffect",
            "useContext",
            "useReducer",
            "useCallback",
            "useMemo",
            "useRef",
            "useImperativeHandle",
            "useLayoutEffect",
            "useDebugValue",
            "useDeferredValue",
            "useId",
            "useInsertionEffect",
            "useSyncExternalStore",
            "useTransition",
            "startTransition",
            "lazy",
            "memo",
            "forwardRef",
            "createContext",
            "createElement",
            "cloneElement",
            "isValidElement",
          ],
        },
        {
          "react-router-dom": [
            "useNavigate",
            "useLocation",
            "useParams",
            "useSearchParams",
            "Link",
            "NavLink",
            "Navigate",
            "Outlet",
          ],
        },
        // React i18n
        {
          "react-i18next": ["useTranslation", "Trans"],
        },
      ],
      dts: true,
    }),
  ],
  base,
  build: {
    sourcemap: true,
    outDir: "dist",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      // 로컬 개발 환경에서 /api/proxy 요청을 실제 백엔드 또는 프록시 서버로 연결
      '/api/proxy': {
        target: process.env.DEV_PROXY_TARGET || loadEnv(mode, process.cwd(), 'DEV_').DEV_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => {
          // type=auction 파라미터가 있으면 특정 경로로 리다이렉트
          if (path.includes('type=auction')) {
            return '/api/proxy/transactions';
          }
          // 일반 url 파라미터 처리 (필요시)
          try {
            const url = new URL(path, 'http://localhost');
            const targetUrl = url.searchParams.get('url');
            if (targetUrl) {
              const decoded = decodeURIComponent(targetUrl);
              const target = new URL(decoded);
              return target.pathname + target.search;
            }
          } catch {
            // ignore
          }
          return path;
        }
      }
    }
  },
}));
