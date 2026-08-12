"use client";

import React from "react";
import { UserRole } from "@/lib/types";
import { PermissionGuard } from "./PermissionGuard";
import { useCurrentUser } from "@/hooks/use-current-user";

export interface RoleGuardProps {
  role?: UserRole | UserRole[] | string | string[];
  permission?: string | string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({
  role,
  permission,
  fallback = null,
  children,
}: RoleGuardProps) {
  const { hasRole, isLoading } = useCurrentUser();

  if (isLoading) {
    return null;
  }

  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  return (
    <PermissionGuard permission={permission} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export default RoleGuard;
