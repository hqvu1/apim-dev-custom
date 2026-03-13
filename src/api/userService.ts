/**
 * APIM User Service
 * 
 * Service for managing user profile and subscriptions.
 * Ported from api-management-developer-portal with adaptations for React hooks.
 */

import { useMapiClient, type Page } from "./mapiClient";
import type { UserContract } from "./contracts";

/**
 * React hook for APIM User Service
 */
export const useUserService = () => {
  const mapiClient = useMapiClient();

  /**
   * Get current user profile
   */
  const getCurrentUser = async (): Promise<UserContract | null> => {
    return mapiClient.get<UserContract>("/users/current");
  };

  /**
   * Get user by ID
   */
  const getUser = async (userId: string): Promise<UserContract | null> => {
    if (!userId) {
      throw new Error('Parameter "userId" not specified.');
    }

    const formattedId = userId.startsWith("/users/")
      ? userId
      : `/users/${userId}`;

    return mapiClient.get<UserContract>(formattedId);
  };

  /**
   * Update current user profile
   */
  const updateCurrentUser = async (
    firstName?: string,
    lastName?: string,
    email?: string
  ): Promise<UserContract | null> => {
    const payload: Partial<UserContract> = {};

    if (firstName !== undefined) payload.firstName = firstName;
    if (lastName !== undefined) payload.lastName = lastName;
    if (email !== undefined) payload.email = email;

    return mapiClient.patch<UserContract>("/users/current", payload, {
      "If-Match": "*",
    });
  };

  /**
   * Get users (admin operation)
   */
  const getUsers = async (skip = 0, take = 20): Promise<Page<UserContract>> => {
    const path = `/users?$top=${take}&$skip=${skip}`;
    const result = await mapiClient.get<Page<UserContract>>(path);
    return result || { value: [], count: 0 };
  };

  /**
   * Get user's full name
   */
  const getUserDisplayName = (user: UserContract | null): string => {
    if (!user) return "Unknown User";
    
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    
    return firstName || lastName || user.email || "Unknown User";
  };

  return {
    getCurrentUser,
    getUser,
    updateCurrentUser,
    getUsers,
    getUserDisplayName,
  };
};
