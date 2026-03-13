import { IPublicClientApplication, AccountInfo, SilentRequest } from "@azure/msal-browser";

export const getAccessToken = async (
  instance: IPublicClientApplication,
  account: AccountInfo | null,
  scopes?: string[]
): Promise<string | null> => {
  try {
    const request: SilentRequest = {
      account: account || undefined,
      scopes: scopes || [],
    };
    const response = await instance.acquireTokenSilent(request);
    return response.accessToken;
  } catch {
    return null;
  }
};
