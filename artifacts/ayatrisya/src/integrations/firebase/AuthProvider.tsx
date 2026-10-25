import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createUserWithEmailAndPassword, GithubAuthProvider, GoogleAuthProvider, onAuthStateChanged, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut, type User } from "firebase/auth";
import { repository } from "@/storage/repository";
import { firebaseAuth, firebaseConfigured, authError } from "./client";
import { driveSync } from "@/integrations/google-drive/sync";
interface AuthState {
  user: User | null; guest:boolean; loading:boolean; configured:boolean; error:string|null;
  startGuest():void;
  signIn(email:string,password:string):Promise<void>;
  register(email:string,password:string):Promise<void>;
  googleSignIn():Promise<void>; githubSignIn():Promise<void>; resetPassword(email:string):Promise<void>;
  sendVerification():Promise<void>; refreshUser():Promise<void>; signOut():Promise<void>;
}
const Context = createContext<AuthState|null>(null);
const GUEST_MODE_KEY = "ayatrisya:guest-mode:v1";
const DESKTOP_SESSION_KEY = "ayatrisya:desktop-session:v1";

function readGuestMode() {
  try { return window.localStorage.getItem(GUEST_MODE_KEY) === "enabled"; } catch { return false; }
}
function writeGuestMode(enabled:boolean) {
  try {
    if (enabled) window.localStorage.setItem(GUEST_MODE_KEY, "enabled");
    else window.localStorage.removeItem(GUEST_MODE_KEY);
  } catch { /* Guest access still works for this page load if storage is unavailable. */ }
}

function readDesktopSession(): { uid: string; email?: string; token: string; expiresAt: number } | null {
  try {
    const raw = window.localStorage.getItem(DESKTOP_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.uid && parsed.token && parsed.expiresAt > Date.now()) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeDesktopSession(session: { uid: string; email?: string; token: string; expiresAt: number } | null) {
  try {
    if (session) window.localStorage.setItem(DESKTOP_SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(DESKTOP_SESSION_KEY);
  } catch {}
}

export function AuthProvider({children}:{children:ReactNode}) {
  const [user,setUser] = useState<User|null>(null);
  const [guest,setGuest] = useState(false);
  const [loading,setLoading] = useState(firebaseConfigured);
  const [error,setError] = useState<string|null>(null);
  const switchOwner = (owner: string) => {
    if (repository.ownerId !== owner) driveSync.disconnect();
    repository.setOwner(owner);
  };

  useEffect(() => {
    // 1. Check for saved desktop session
    const savedSession = readDesktopSession();
    if (savedSession) {
      const desktopUser = {
        uid: savedSession.uid,
        email: savedSession.email || `${savedSession.uid}@ayatrisya.desktop`,
        emailVerified: true,
        isAnonymous: false,
        displayName: savedSession.email ? savedSession.email.split("@")[0] : "Desktop User",
        getIdToken: async () => savedSession.token,
      } as unknown as User;
      writeGuestMode(false);
      setGuest(false);
      switchOwner(`firebase:${savedSession.uid}`);
      setUser(desktopUser);
      setLoading(false);
      return;
    }

    if (!firebaseConfigured) {
      const activeGuest = readGuestMode();
      setGuest(activeGuest);
      repository.setOwner(activeGuest ? "guest" : "signed-out");
      setLoading(false);
      return;
    }
    try {
      return onAuthStateChanged(firebaseAuth(),next => {
        const activeGuest = !next && readGuestMode();
        setGuest(activeGuest);
        if (next) writeGuestMode(false);
        switchOwner(next ? `firebase:${next.uid}` : activeGuest ? "guest" : "signed-out");
        setUser(next); setLoading(false);
      },_failure => {
        const activeGuest = readGuestMode();
        setGuest(activeGuest);
        switchOwner(activeGuest ? "guest" : "signed-out");
        setLoading(false);
      });
    } catch (_failure) {
      const activeGuest = readGuestMode();
      setGuest(activeGuest);
      switchOwner(activeGuest ? "guest" : "signed-out");
      setLoading(false);
    }
    return undefined;
  },[]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ayatrisyaDesktop?.onAuthCallback) {
      const unsubscribe = window.ayatrisyaDesktop.onAuthCallback((result) => {
        if (result.success && result.session) {
          const { uid, email, token, expiresAt } = result.session;
          writeDesktopSession({ uid, email, token, expiresAt });
          const desktopUser = {
            uid,
            email: email || `${uid}@ayatrisya.desktop`,
            emailVerified: true,
            isAnonymous: false,
            displayName: email ? email.split("@")[0] : "Desktop User",
            getIdToken: async () => token,
          } as unknown as User;
          writeGuestMode(false);
          setGuest(false);
          switchOwner(`firebase:${uid}`);
          setUser(desktopUser);
          setLoading(false);
        } else if (result.error) {
          setError(result.error);
        }
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
    return undefined;
  }, []);

  async function perform(action:()=>Promise<unknown>) {
    setError(null);
    try { await action(); }
    catch (failure) { const message = authError(failure); setError(message); throw new Error(message,{cause:failure}); }
  }
  const value:AuthState = {
    user,guest,loading,configured:firebaseConfigured,error,
    startGuest:()=>{if(user)return;writeGuestMode(true);setGuest(true);switchOwner("guest");},
    signIn:(email,password)=>perform(async()=>{
      const result=await signInWithEmailAndPassword(firebaseAuth(),email,password);
      writeGuestMode(false);
      setGuest(false);
      switchOwner(`firebase:${result.user.uid}`);
      setUser(result.user);
      if (typeof window !== "undefined") {
        try {
          const token = await result.user.getIdToken();
          writeDesktopSession({
            uid: result.user.uid,
            email: result.user.email || undefined,
            token,
            expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
          });
        } catch {}
      }
    }),
    register:(email,password)=>perform(async()=>{
      if(password.length<8) throw Object.assign(new Error("Weak password"),{code:"auth/weak-password"});
      const result=await createUserWithEmailAndPassword(firebaseAuth(),email,password);
      writeGuestMode(false);
      setGuest(false);
      switchOwner(`firebase:${result.user.uid}`);
      setUser(result.user);
      if (typeof window !== "undefined") {
        try {
          const token = await result.user.getIdToken();
          writeDesktopSession({
            uid: result.user.uid,
            email: result.user.email || undefined,
            token,
            expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
          });
        } catch {}
      }
      try {
        await sendEmailVerification(result.user);
      } catch {}
    }),
    googleSignIn:()=>perform(async()=>{ const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"}); const result=await signInWithPopup(firebaseAuth(),provider);writeGuestMode(false);setGuest(false);switchOwner(`firebase:${result.user.uid}`);setUser(result.user); }),
    githubSignIn:()=>perform(async()=>{ const result=await signInWithPopup(firebaseAuth(),new GithubAuthProvider());writeGuestMode(false);setGuest(false);switchOwner(`firebase:${result.user.uid}`);setUser(result.user); }),
    resetPassword:(email)=>perform(()=>sendPasswordResetEmail(firebaseAuth(),email)),
    sendVerification:()=>perform(async()=>{const current=firebaseAuth().currentUser;if(!current)throw new Error("Sign in first.");await sendEmailVerification(current);}),
    refreshUser:()=>perform(async()=>{const current=firebaseAuth().currentUser;if(current){await reload(current);setUser(Object.assign(Object.create(Object.getPrototypeOf(current)),current));}}),
    signOut:()=>perform(async()=>{
      writeDesktopSession(null);
      if (firebaseConfigured) {
        try {
          await firebaseSignOut(firebaseAuth());
        } catch {}
      }
      writeGuestMode(false);
      setGuest(false);
      switchOwner("signed-out");
      setUser(null);
    }),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() {const state=useContext(Context);if(!state)throw new Error("AuthProvider is required.");return state;}
