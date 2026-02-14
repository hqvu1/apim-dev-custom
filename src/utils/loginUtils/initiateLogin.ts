const FIELD = {
  TENANT_ID: "tenantId",
  EMAIL: "email"
};

export const initiateLogin = (): string | null => {
  let tenantId = localStorage.getItem(FIELD.TENANT_ID);

  const url = new URL(window.location.href);
  const queryParams = url.searchParams;
  const hashParams = new URLSearchParams(url.hash?.replace(/^#/, ""));

  const incomingTenant = queryParams.get(FIELD.TENANT_ID) ?? hashParams.get(FIELD.TENANT_ID);
  const incomingEmail = queryParams.get(FIELD.EMAIL) ?? hashParams.get(FIELD.EMAIL);

  if (!tenantId && (incomingTenant || incomingEmail)) {
    if (incomingTenant) {
      localStorage.setItem(FIELD.TENANT_ID, incomingTenant);
      tenantId = incomingTenant;
    }
    if (incomingEmail) {
      localStorage.setItem(FIELD.EMAIL, incomingEmail);
    }

    window.history.replaceState({}, "", url.origin + url.pathname);
  }

  if (!tenantId) {
    const kpsUrl = import.meta.env.VITE_KPS_URL || "https://login-uat.komatsu.com/spa";
    const clean = new URL(window.location.href);
    clean.searchParams.delete("action");
    clean.searchParams.delete("signedOut");
    clean.pathname = "/";
    const redirectUri = clean.toString().split("#")[0];

    window.location.href = `${kpsUrl}?redirectUri=${encodeURIComponent(redirectUri)}`;
    return null;
  }

  return tenantId;
};

export default initiateLogin;
