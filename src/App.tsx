import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingScreen from "./components/LoadingScreen";
import PrivateRoute from "./components/PrivateRoute";
import PublicLayout from "./components/PublicLayout";
import RoleGate from "./components/RoleGate";
import { appConfig, ROUTES } from "./config";

// ─── Route-level code-splitting ───────────────────────────────────────────────
// Each page is lazily loaded so the initial bundle stays small.
// Critical shell components (AppShell, Header, SideNav) are eagerly loaded.
// @see docs/ARCHITECTURE_DESIGN.md §2 — Frontend Architecture
const AppShell = lazy(() => import("./components/AppShell"));
const SsoLogoutHandler = lazy(() => import("./utils/loginUtils/SsoLogoutHandler"));
const AccessDenied = lazy(() => import("./pages/AccessDenied"));
const Admin = lazy(() => import("./pages/Admin"));
const ApiCatalog = lazy(() => import("./pages/ApiCatalog"));
const ApiDetails = lazy(() => import("./pages/ApiDetails"));
const ApiTryIt = lazy(() => import("./pages/ApiTryIt"));
const Home = lazy(() => import("./pages/home"));
const MyIntegrations = lazy(() => import("./pages/MyIntegrations"));
const News = lazy(() => import("./pages/News"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Register = lazy(() => import("./pages/Register"));
const Support = lazy(() => import("./pages/Support"));

const App = () => {
  const isPublicHomePage = appConfig.publicHomePage;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen message="Loading page..." />}>
          <Routes>
            <Route path={ROUTES.SSO_LOGOUT} element={<SsoLogoutHandler />} />

            {/* Public home page for demos (when enabled) */}
            {isPublicHomePage && (
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
              </Route>
            )}

            <Route element={<PrivateRoute />}>
              <Route element={<AppShell />}>
                {!isPublicHomePage && <Route index element={<Home />} />}
                <Route path={ROUTES.API_CATALOG} element={<ApiCatalog />} />
                <Route path={ROUTES.API_DETAILS} element={<ApiDetails />} />
                <Route path={ROUTES.API_TRY_IT} element={<ApiTryIt />} />
                <Route path={ROUTES.REGISTER} element={<Register />} />
                <Route path={ROUTES.ONBOARDING} element={<Onboarding />} />
                <Route path={ROUTES.MY_INTEGRATIONS} element={<MyIntegrations />} />
                <Route path={ROUTES.SUPPORT} element={<Support />} />
                <Route path={ROUTES.NEWS} element={<News />} />
                <Route
                  path={ROUTES.ADMIN}
                  element={
                    <RoleGate roles={["Admin", "GlobalAdmin"]}>
                      <Admin />
                    </RoleGate>
                  }
                />
              </Route>
            </Route>

            <Route path={ROUTES.ACCESS_DENIED} element={<AccessDenied />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
