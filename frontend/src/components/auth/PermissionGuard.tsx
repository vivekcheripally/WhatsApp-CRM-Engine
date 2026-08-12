"use client";

import React from "react";
import { useCurrentUser } from "@/hooks/use-current-user";

export interface PermissionGuardProps {
  permission?: string | string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission, isLoading } = useCurrentUser();

  if (isLoading) {
    return null;
  }

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default PermissionGuard;
