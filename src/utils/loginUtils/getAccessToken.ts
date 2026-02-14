import { PublicClientApplication, AccountInfo } from "@azure/msal-browser";

export const getAccessToken = async (
  instance: PublicClientApplication,
  account: AccountInfo | null,
  scopes?: string[]
): Promise<string | null> => {
  const request = { account: account ?? undefined, scopes };

  try {
    const silent = await instance.acquireTokenSilent(request);
    return silent.accessToken;
  } catch {
    return null;
  }
};
