"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { User, UserRole, PermissionCheck } from "./types";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  loginWithCredentials: (
    identifier: string,
    password: string,
    captchaToken?: string
  ) => Promise<User | null>;
  updateProfile: (updates: Pick<User, "name" | "email" | "phone" | "avatarUrl">) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  permissions: PermissionCheck;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeRole(value?: string | null): UserRole {
  if (value === "admin") return "super_admin";
  if (value === "super_admin") return "super_admin";
  if (value === "moderator") return "moderator";
  if (value === "vendor") return "vendor";
  return "general_user";
}

async function mapSupabaseUserWithVendorId(user: SupabaseUser, supabase: ReturnType<typeof createClient>): Promise<User> {
  const appMeta = user.app_metadata as { role?: string; provider?: string } | undefined;
  const userMeta = user.user_metadata as {
    role?: string;
    name?: string;
    full_name?: string;
    avatarUrl?: string;
    avatar_url?: string;
    phone?: string;
  } | undefined;

  const role = normalizeRole(appMeta?.role);
  const name = userMeta?.name ?? userMeta?.full_name ?? (user.email ? user.email.split("@")[0] : "user");
  const avatarUrl = userMeta?.avatarUrl ?? userMeta?.avatar_url;
  const provider = appMeta?.provider ?? "email";
  const phone = userMeta?.phone;

  // vendorsテーブルからvendorIdを取得（user_metadataは改ざん可能なため使用しない）
  let vendorId: string | undefined = undefined;
  if (role === "vendor" && user.id) {
    const { data, error } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.error("[AuthContext] vendors lookup failed:", error.message);
    }
    if (data?.id) {
      vendorId = data.id;
    }
  }

  return {
    id: user.id,
    name,
    email: user.email ?? "",
    phone,
    avatarUrl,
    role,
    vendorId,
    provider,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      if (!supabaseRef.current) {
        try {
          supabaseRef.current = createClient();
        } catch {
          setIsLoading(false);
          return;
        }
      }

      const supabase = supabaseRef.current;
      if (!supabase) return;

      try {
        // getSession() はサーバー検証なし。getUser() でサーバーサイド検証を行う
        const { data, error } = await supabase.auth.getUser();
        // 未ログイン状態では "Auth session missing!" が返るが、これは異常系ではない
        if (error && error.name !== "AuthSessionMissingError") {
          console.error("[AuthContext] getUser failed:", error.message);
        }
        if (!active) return;
        if (data.user) {
          const mapped = await mapSupabaseUserWithVendorId(data.user, supabase);
          if (!active) return;
          setUser(mapped);
          setIsLoggedIn(true);
        } else {
          setUser(null);
          setIsLoggedIn(false);
        }
        setIsLoading(false);
      } catch (err) {
        console.error("[AuthContext] init failed:", err);
        if (active) setIsLoading(false);
        return;
      }

      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        // INITIAL_SESSION は getUser() で処理済みのためスキップ（未検証ローカルトークンによる上書きを防ぐ）
        if (event === "INITIAL_SESSION") return;
        if (session?.user) {
          mapSupabaseUserWithVendorId(session.user, supabase).then((mapped) => {
            if (!active) return;
            setUser(mapped);
            setIsLoggedIn(true);
          }).catch((err) => {
            console.error("[AuthContext] mapSupabaseUserWithVendorId failed:", err);
          });
        } else {
          setUser(null);
          setIsLoggedIn(false);
        }
      });

      unsubscribe = () => sub.subscription.unsubscribe();
      // cleanup が先に走っていた場合は即座に解除する
      if (!active) unsubscribe();
    };

    init();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const permissions: PermissionCheck = {
    isSuperAdmin: user?.role === "super_admin",
    isAdmin: user?.role === "super_admin",
    isModerator: user?.role === "super_admin" || user?.role === "moderator",
    isVendor: user?.role === "vendor",
    isGeneralUser: user?.role === "general_user",

    canEditShop: (shopVendorId: string) => {
      if (user?.role === "super_admin") return true;
      if (user?.role === "vendor" && user.vendorId === shopVendorId) return true;
      return false;
    },

    canManageAllShops: user?.role === "super_admin",
    canModerateContent: user?.role === "super_admin" || user?.role === "moderator",
  };

  const loginWithCredentials = async (
    identifier: string,
    password: string,
    captchaToken?: string
  ) => {
    const email = identifier.trim();
    const supabase = supabaseRef.current ?? createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error || !data.user) return null;
    const mapped = await mapSupabaseUserWithVendorId(data.user, supabase);
    setUser(mapped);
    setIsLoggedIn(true);
    return mapped;
  };

  const updateProfile = async (updates: Pick<User, "name" | "email" | "phone" | "avatarUrl">) => {
    if (!user) return;
    const payload: { data?: Record<string, string>; email?: string } = {
      data: {
        name: updates.name,
        avatarUrl: updates.avatarUrl ?? "",
        phone: updates.phone ?? "",
      },
    };
    if (updates.email && updates.email !== user.email) {
      payload.email = updates.email;
    }
    const supabase = supabaseRef.current ?? createClient();
    const { data, error } = await supabase.auth.updateUser(payload);
    if (error || !data.user) return;
    setUser(await mapSupabaseUserWithVendorId(data.user, supabase));
  };

  const logout = async () => {
    const supabase = supabaseRef.current ?? createClient();
    await supabase.auth.signOut();
    setUser(null);
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        loginWithCredentials,
        updateProfile,
        logout,
        isLoading,
        permissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
