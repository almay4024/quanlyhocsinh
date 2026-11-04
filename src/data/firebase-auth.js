// src/data/firebase-auth.js
// Quản lý xác thực Google Firebase Authentication & Realtime Database qua ES Module CDN

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { 
  getDatabase, 
  ref, 
  get, 
  update, 
  onValue,
  off
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export const firebaseConfig = {
  projectId: "quanlyhocsinh-17d3d",
  appId: "1:667396086547:web:007da84fd8d7470c1b98e6",
  databaseURL: "https://quanlyhocsinh-17d3d-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "quanlyhocsinh-17d3d.firebasestorage.app",
  apiKey: "AIzaSyClIz_VmpAdw7B3uYMJUu_vFuFebySOEl0",
  authDomain: "quanlyhocsinh-17d3d.firebaseapp.com",
  messagingSenderId: "667396086547",
  measurementId: "G-F33NPYEEVG"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getDatabase(firebaseApp);

export { ref, get, update, onValue, off };

export const AUTH_EMAIL_SUFFIX = '.tct@gmail.com';

/**
 * Chuyển đổi Tên đăng nhập / Mã nhân viên thành email chuẩn .tct@gmail.com
 * - "congnt"               => "congnt.tct@gmail.com"
 * - "congnt.tct"           => "congnt.tct@gmail.com"
 * - "congnt.tct@gmail.com" => "congnt.tct@gmail.com"
 * - "AD001"                => "ad001.tct@gmail.com"
 * - "admin@domain.com"     => "admin@domain.com"
 */
export function codeToAuthEmail(codeOrUsername) {
  const input = String(codeOrUsername || '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .trim()
    .toLowerCase();
  
  if (!input) return '';
  if (input.includes('@')) return input;
  if (input.endsWith('.tct')) return `${input}@gmail.com`;
  return `${input}.tct@gmail.com`;
}

/**
 * Đăng nhập bằng Username / Mã nhân viên và Mật khẩu
 */
export async function loginWithStaffCode(codeOrUsername, password) {
  const email = codeToAuthEmail(codeOrUsername);
  if (!email) throw new Error('Vui lòng nhập tên đăng nhập hoặc mã nhân viên.');
  const userCredential = await signInWithEmailAndPassword(auth, email, String(password || ''));
  return userCredential.user;
}

/**
 * Đăng xuất khỏi Firebase Auth
 */
export async function logoutFirebaseAuth() {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Lỗi khi đăng xuất Firebase Auth:', err);
  }
}

/**
 * Lấy ID Token còn hiệu lực
 */
export async function getCurrentAuthToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken(forceRefresh);
}

/**
 * Lắng nghe trạng thái đăng nhập Firebase Auth
 */
export function subscribeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Tạo tài khoản nhân viên mới trên Firebase (dành cho Admin)
 * Sử dụng instance phụ để không làm đăng xuất Admin hiện tại
 */
let secondaryApp = null;
export async function createStaffAuthAccount(codeOrUsername, password) {
  const email = codeToAuthEmail(codeOrUsername);
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, 'SecondaryAuthAdminApp');
  }
  const secondaryAuth = getAuth(secondaryApp);
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, String(password || ''));
  await signOut(secondaryAuth);
  return cred.user;
}
