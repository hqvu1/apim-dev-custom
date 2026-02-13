import React, { createContext, useCallback, useMemo } from "react";
import { useMsal } from "@azure/msal-react";
import { AccountInfo, InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";

export type AuthContextValue = {
  account: AccountInfo | null;
  roles: string[];
  isAuthenticated: boolean;
  getAccessToken: () => Promise<string | null>;
};

export const AuthContext = createContext<AuthContextValue>({
  account: null,
  roles: [],
  isAuthenticated: false,
  getAccessToken: async () => null
});

const getRolesFromClaims = (account: AccountInfo | null): string[] => {
  const claims = account?.idTokenClaims as Record<string, unknown> | undefined;
  const roles = (claims?.roles as string[]) || [];
  const groups = (claims?.groups as string[]) || [];
  return [...new Set([...roles, ...groups])];
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { instance, accounts } = useMsal();
  const account = accounts[0] ?? null;

  const getAccessToken = useCallback(async () => {
    if (!account) {
      return null;
    }

    try {
      const result = await instance.acquireTokenSilent({
        ...loginRequest,
        account
      });
      return result.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        await instance.acquireTokenRedirect({
          ...loginRequest,
          account
        });
      }
      return null;
    }
  }, [account, instance]);

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      roles: getRolesFromClaims(account),
      isAuthenticated: Boolean(account),
      getAccessToken
    }),
    [account, getAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
