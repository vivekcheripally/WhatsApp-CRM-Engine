import { useAuth } from "@/context/AuthContext";
import { User, UserRole, OrganizationInfo } from "@/lib/types";

export interface UseCurrentUserReturn {
  user: User | null;
  permissions: string[];
  assigned_channels: string[];
  organization: OrganizationInfo | null;
  role: UserRole | string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: string | string[]) => boolean;
  hasRole: (role: UserRole | UserRole[] | string | string[]) => boolean;
}

export function useCurrentUser(): UseCurrentUserReturn {
  const { user, permissions, assigned_channels, organization, isLoading } = useAuth();

  const role = user?.role ?? null;
  const isAuthenticated = !!user;

  const hasPermission = (permission: string | string[]): boolean => {
    if (!user) return false;
    // SYSTEM_ADMIN and ORG_ADMIN have master permission bypass
    if (user.role === "SYSTEM_ADMIN" || user.role === "super_admin" || user.role === "ORG_ADMIN") {
      return true;
    }
    const userPerms = permissions || user.permissions || [];
    if (Array.isArray(permission)) {
      return permission.some((p) => userPerms.includes(p));
    }
    return userPerms.includes(permission);
  };

  const hasRole = (targetRole: UserRole | UserRole[] | string | string[]): boolean => {
    if (!user || !user.role) return false;
    if (Array.isArray(targetRole)) {
      return (targetRole as string[]).includes(user.role);
    }
    return user.role === targetRole;
  };

  return {
    user,
    permissions,
    assigned_channels,
    organization,
    role,
    isAuthenticated,
    isLoading,
    hasPermission,
    hasRole,
  };
}

export default useCurrentUser;
