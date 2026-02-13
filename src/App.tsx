import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ErrorBoundary from "./components/ErrorBoundary";
import PrivateRoute from "./components/PrivateRoute";
import AccessDenied from "./pages/AccessDenied";
import Admin from "./pages/Admin";
import ApiCatalog from "./pages/ApiCatalog";
import ApiDetails from "./pages/ApiDetails";
import ApiTryIt from "./pages/ApiTryIt";
import Home from "./pages/Home";
import MyIntegrations from "./pages/MyIntegrations";
import News from "./pages/News";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Register from "./pages/Register";
import Support from "./pages/Support";
import RoleGate from "./components/RoleGate";

const App = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<PrivateRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="apis" element={<ApiCatalog />} />
              <Route path="apis/:apiId" element={<ApiDetails />} />
              <Route path="apis/:apiId/try" element={<ApiTryIt />} />
              <Route path="register" element={<Register />} />
              <Route path="profile/onboarding" element={<Onboarding />} />
              <Route path="my/integrations" element={<MyIntegrations />} />
              <Route path="support" element={<Support />} />
              <Route path="news" element={<News />} />
              <Route
                path="admin"
                element={
                  <RoleGate roles={["Admin", "GlobalAdmin"]}>
                    <Admin />
                  </RoleGate>
                }
              />
            </Route>
          </Route>
          <Route path="access-denied" element={<AccessDenied />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
