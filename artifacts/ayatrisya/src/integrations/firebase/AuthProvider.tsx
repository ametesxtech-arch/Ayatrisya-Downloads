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
function readGuestMode() {
  try { return window.localStorage.getItem(GUEST_MODE_KEY) === "enabled"; } catch { return false; }
}
function writeGuestMode(enabled:boolean) {
  try {
    if (enabled) window.localStorage.setItem(GUEST_MODE_KEY, "enabled");
    else window.localStorage.removeItem(GUEST_MODE_KEY);
  } catch { /* Guest access still works for this page load if storage is unavailable. */ }
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
    if (!firebaseConfigured) {
      const activeGuest = readGuestMode();
      setGuest(activeGuest);
      repository.setOwner(activeGuest ? "guest" : "signed-out");
      return;
    }
    try {
      return onAuthStateChanged(firebaseAuth(),next => {
        const activeGuest = !next && readGuestMode();
        setGuest(activeGuest);
        if (next) writeGuestMode(false);
        switchOwner(next ? `firebase:${next.uid}` : activeGuest ? "guest" : "signed-out");
        setUser(next); setLoading(false);
      },failure => { setError(authError(failure)); setLoading(false); });
    } catch (failure) { setError(authError(failure)); setLoading(false); }
    return undefined;
  },[]);
  async function perform(action:()=>Promise<unknown>) {
    setError(null);
    try { await action(); }
    catch (failure) { const message = authError(failure); setError(message); throw new Error(message,{cause:failure}); }
  }
  const value:AuthState = {
    user,guest,loading,configured:firebaseConfigured,error,
    startGuest:()=>{if(user)return;writeGuestMode(true);setGuest(true);switchOwner("guest");},
    signIn:(email,password)=>perform(async()=>{const result=await signInWithEmailAndPassword(firebaseAuth(),email,password);writeGuestMode(false);setGuest(false);switchOwner(`firebase:${result.user.uid}`);setUser(result.user);}),
    register:(email,password)=>perform(async()=>{
      if(password.length<8) throw Object.assign(new Error("Weak password"),{code:"auth/weak-password"});
      const result=await createUserWithEmailAndPassword(firebaseAuth(),email,password);
      writeGuestMode(false);setGuest(false);
      switchOwner(`firebase:${result.user.uid}`);setUser(result.user);
      await sendEmailVerification(result.user);
    }),
    googleSignIn:()=>perform(async()=>{ const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"}); const result=await signInWithPopup(firebaseAuth(),provider);writeGuestMode(false);setGuest(false);switchOwner(`firebase:${result.user.uid}`);setUser(result.user); }),
    githubSignIn:()=>perform(async()=>{ const result=await signInWithPopup(firebaseAuth(),new GithubAuthProvider());writeGuestMode(false);setGuest(false);switchOwner(`firebase:${result.user.uid}`);setUser(result.user); }),
    resetPassword:(email)=>perform(()=>sendPasswordResetEmail(firebaseAuth(),email)),
    sendVerification:()=>perform(async()=>{const current=firebaseAuth().currentUser;if(!current)throw new Error("Sign in first.");await sendEmailVerification(current);}),
    refreshUser:()=>perform(async()=>{const current=firebaseAuth().currentUser;if(current){await reload(current);setUser(Object.assign(Object.create(Object.getPrototypeOf(current)),current));}}),
    signOut:()=>perform(async()=>{await firebaseSignOut(firebaseAuth());writeGuestMode(false);setGuest(false);switchOwner("signed-out");setUser(null);}),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() {const state=useContext(Context);if(!state)throw new Error("AuthProvider is required.");return state;}
