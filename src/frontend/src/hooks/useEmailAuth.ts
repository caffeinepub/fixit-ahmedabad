import { Ed25519KeyIdentity } from "@dfinity/identity";
import type { Identity } from "@icp-sdk/core/agent";
import {
  type PropsWithChildren,
  type ReactNode,
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createActorWithConfig } from "../config";

const ADMIN_EMAIL = "tanayshah265@gmail.com";
const SESSION_KEY = "fixit_session";

interface Session {
  email: string;
  /** 32-byte seed as hex — always use Ed25519KeyIdentity.generate(seed) to restore */
  seedHex: string;
}

export interface EmailAuthContext {
  email: string | null;
  identity: Identity | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Derives identity from email+password without verifying against backend */
  deriveIdentity: (
    email: string,
    password: string,
  ) => Promise<{ identity: Ed25519KeyIdentity; seedHex: string }>;
  /** Stores session after a successful registration */
  loginAfterRegister: (
    email: string,
    identity: Ed25519KeyIdentity,
    seedHex: string,
  ) => void;
}

async function pbkdf2Derive(
  email: string,
  password: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(email.toLowerCase().trim()),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToUint8Array(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

async function buildIdentityFromCredentials(
  email: string,
  password: string,
): Promise<{ identity: Ed25519KeyIdentity; seedHex: string }> {
  const seed = await pbkdf2Derive(email, password);
  const identity = Ed25519KeyIdentity.generate(seed);
  const seedHex = uint8ArrayToHex(seed);
  return { identity, seedHex };
}

const EmailAuthReactContext = createContext<EmailAuthContext | undefined>(
  undefined,
);

export function useEmailAuth(): EmailAuthContext {
  const ctx = useContext(EmailAuthReactContext);
  if (!ctx) throw new Error("useEmailAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({
  children,
}: PropsWithChildren<{ children: ReactNode }>) {
  const [email, setEmail] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const session: Session = JSON.parse(raw);
          // Support legacy sessions that stored privateKeyHex instead of seedHex
          const hexValue = session.seedHex ?? (session as any).privateKeyHex;
          if (hexValue) {
            const seed = hexToUint8Array(hexValue);
            // Always restore using generate(seed) to get the same principal as at registration
            const restored = Ed25519KeyIdentity.generate(seed);
            if (!cancelled) {
              setEmail(session.email);
              setIdentity(restored);
            }
          }
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const deriveIdentity = useCallback(
    async (
      em: string,
      pw: string,
    ): Promise<{ identity: Ed25519KeyIdentity; seedHex: string }> => {
      return buildIdentityFromCredentials(em, pw);
    },
    [],
  );

  const loginAfterRegister = useCallback(
    (em: string, id: Ed25519KeyIdentity, seedHex: string) => {
      const session: Session = { email: em, seedHex };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setEmail(em);
      setIdentity(id);
    },
    [],
  );

  const login = useCallback(async (em: string, pw: string): Promise<void> => {
    const { identity: id, seedHex } = await buildIdentityFromCredentials(
      em,
      pw,
    );

    // Verify the identity exists in the backend by calling getMyProfile
    const actor = await createActorWithConfig({
      agentOptions: { identity: id },
    });

    // For admin email, skip provider verification
    if (em.toLowerCase().trim() === ADMIN_EMAIL) {
      try {
        await actor.isCallerAdmin(); // just verify connection works
      } catch {
        // ignore — admin login always succeeds on the frontend
      }
      const session: Session = { email: em, seedHex };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setEmail(em);
      setIdentity(id);
      return;
    }

    // For providers, verify they exist in the backend
    try {
      await actor.getMyProfile();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.toLowerCase().includes("not found") ||
        msg.toLowerCase().includes("no provider")
      ) {
        throw new Error(
          "No account found with this email/password combination",
        );
      }
      throw new Error(`Login failed: ${msg}`);
    }

    const session: Session = { email: em, seedHex };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setEmail(em);
    setIdentity(id);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setEmail(null);
    setIdentity(null);
  }, []);

  const isAdmin = email?.toLowerCase().trim() === ADMIN_EMAIL;

  const value = useMemo<EmailAuthContext>(
    () => ({
      email,
      identity,
      isLoggedIn: !!identity,
      isAdmin,
      isInitializing,
      login,
      logout,
      deriveIdentity,
      loginAfterRegister,
    }),
    [
      email,
      identity,
      isAdmin,
      isInitializing,
      login,
      logout,
      deriveIdentity,
      loginAfterRegister,
    ],
  );

  return createElement(EmailAuthReactContext.Provider, { value, children });
}
