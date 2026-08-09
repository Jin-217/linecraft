import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use the database ID specified in the configuration if available
const dbId = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== ''
  ? firebaseConfigJson.firestoreDatabaseId
  : '(default)';

export const db = getFirestore(app, dbId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  lastLoginAt: string;
  role: 'admin' | 'user';
  providerId: string;
}

export interface AdminNotification {
  id: string;
  type: string;
  userEmail: string;
  userDisplayName: string;
  userId: string;
  createdAt: string;
  read: boolean;
}

const ADMIN_EMAIL = 'alibertendless999.ko@gmail.com';

/**
 * Ensures user profile exists in Firestore and updates login timestamps.
 * Creates an admin notification ONLY for first-time registrations.
 */
export async function syncUserProfile(user: User): Promise<{ profile: UserProfile; isNewUser: boolean }> {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const now = new Date().toISOString();
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  if (!userSnap.exists()) {
    // New User Registration!
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      photoURL: user.photoURL || '',
      createdAt: now,
      lastLoginAt: now,
      role: isAdmin ? 'admin' : 'user',
      providerId: user.providerData[0]?.providerId || 'password',
    };

    await setDoc(userRef, newProfile);

    // Create Admin Notification for NEW registration
    try {
      await addDoc(collection(db, 'admin_notifications'), {
        type: 'NEW_USER_REGISTRATION',
        userEmail: newProfile.email,
        userDisplayName: newProfile.displayName,
        userId: newProfile.uid,
        createdAt: now,
        read: false,
      });
    } catch (err) {
      console.warn('Failed to send admin notification:', err);
    }

    return { profile: newProfile, isNewUser: true };
  } else {
    // Returning user
    const existingData = userSnap.data() as UserProfile;
    const updatedProfile: UserProfile = {
      ...existingData,
      lastLoginAt: now,
      displayName: user.displayName || existingData.displayName,
      photoURL: user.photoURL || existingData.photoURL || '',
      role: isAdmin ? 'admin' : existingData.role || 'user',
    };

    await updateDoc(userRef, {
      lastLoginAt: now,
      displayName: updatedProfile.displayName,
      photoURL: updatedProfile.photoURL,
      role: updatedProfile.role,
    });

    return { profile: updatedProfile, isNewUser: false };
  }
}

/**
 * Google OAuth Sign In
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const { profile, isNewUser } = await syncUserProfile(result.user);
  return { user: result.user, profile, isNewUser };
}

/**
 * Logout
 */
export async function logOut() {
  await firebaseSignOut(auth);
}

/**
 * Fetch all registered users for Admin View
 */
export async function fetchAllUsers(): Promise<UserProfile[]> {
  const snapshot = await getDocs(collection(db, 'users'));
  const users: UserProfile[] = [];
  snapshot.forEach(docSnap => {
    users.push(docSnap.data() as UserProfile);
  });
  return users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Fetch admin notifications
 */
export async function fetchAdminNotifications(): Promise<AdminNotification[]> {
  const q = query(collection(db, 'admin_notifications'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const list: AdminNotification[] = [];
  snapshot.forEach(docSnap => {
    list.push({ id: docSnap.id, ...docSnap.data() } as AdminNotification);
  });
  return list;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(id: string) {
  const ref = doc(db, 'admin_notifications', id);
  await updateDoc(ref, { read: true });
}
