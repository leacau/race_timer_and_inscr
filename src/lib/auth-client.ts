"use client";

import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { Timestamp, addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, clientDb } from "./firebase-client";
import type { Role, UserProfile } from "./types";

export type EntryType = "organization" | "visitor";

export async function registerWithEmail(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(credential.user);
  return credential.user;
}

export async function loginWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(credential.user);
  return credential.user;
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  await ensureUserProfile(credential.user);
  return credential.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export async function ensureUserProfile(user: User) {
  if (!user?.uid) return;
  const userRef = doc(clientDb, "users", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName ?? "",
      role: "unassigned",
      entryType: "organization",
      provider: user.providerData?.[0]?.providerId || "password",
      createdAt: serverTimestamp(),
    });
  }
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(clientDb, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<UserProfile, "id">;
  return { id: snap.id, ...data, role: (data.role as Role) ?? "unassigned" };
}

export async function recordVisitor(email: string) {
  await addDoc(collection(clientDb, "visitors"), {
    email,
    createdAt: Timestamp.now(),
  });
}

export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
