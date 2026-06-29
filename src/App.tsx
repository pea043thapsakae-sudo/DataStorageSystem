/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Lightbulb, 
  ShieldCheck, 
  Calendar, 
  BarChart3, 
  Plus, 
  Trash2, 
  Download,
  ChevronRight,
  UserCircle,
  Lock,
  Unlock,
  Settings,
  LogOut,
  Shield,
  Edit2,
  Eye,
  EyeOff,
  ShieldCheck as ShieldCheckIcon,
  RefreshCw,
  Search,
  FileText,
  ExternalLink,
  X,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  Briefcase,
  Check,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EMPLOYEES, INNOVATION_TYPES, KM_SUBTYPES, ACTIVITY_TYPES, LEAVE_TYPES, LEAVE_DURATIONS } from './constants';
import { AppState, InnovationRecord, ActivityRecord, LeaveRecord, Admin, Employee } from './types';
import imageCompression from 'browser-image-compression';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { db, auth, initAuth, handleFirestoreError, OperationType, storage, loginWithGoogle, loginAnonymously, onAuthStateChanged, uploadBytesResumable } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  writeBatch,
  getDocs,
  query
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const STORAGE_KEY = 'employee_records_v1';

function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, type === 'info' ? 10000 : 3000); // Info stays longer
    return () => clearTimeout(timer);
  }, [onClose, type]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 ${
        type === 'success' ? 'bg-green-600 text-white' : 
        type === 'error' ? 'bg-red-600 text-white' : 
        'bg-blue-600 text-white'
      }`}
    >
      <div className="text-sm font-bold">{message}</div>
    </motion.div>
  );
}

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
      >
        <div className="space-y-2">
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-sm opacity-60">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 p-3 rounded-xl font-bold bg-black/5 hover:bg-black/10 transition-colors">ยกเลิก</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 p-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors">ยืนยันการลบ</button>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: string | number, color: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-black/5 flex items-center gap-4">
      <div className={`p-4 rounded-2xl ${color}`}>
        {typeof Icon === 'function' ? <Icon size={24} /> : Icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest opacity-40">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function LoginModal({ isOpen, onClose, onLogin, admins, firebaseUser, setToast }: { isOpen: boolean, onClose: () => void, onLogin: (admin: Admin) => void, admins: Admin[], firebaseUser: any, setToast: (t: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');
    
    const normalize = (str: string) => str.replace(/[๐-๙]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0E50 + 48));
    const cleanUsername = normalize(username.trim());
    const cleanPassword = normalize(password.trim());
    
    const defaultAdmin = { id: '9012844', password: 'PEATSG043', name: 'แอดมินหลัก' };
    let admin = admins.find(a => a.id === cleanUsername && a.password === cleanPassword);
    
    if (!admin && cleanUsername === defaultAdmin.id && cleanPassword === defaultAdmin.password) {
      admin = defaultAdmin;
    }
    
    if (admin) {
      try {
        setIsLoggingIn(true);
        await loginAnonymously();
        onLogin(admin);
        setUsername('');
        setPassword('');
        setError('');
        onClose();
      } catch (err: any) {
        console.error("Auth error:", err);
        setError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง');
      }
    } else {
      setError('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
    }
    setIsLoggingIn(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-violet-950/40 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-white rounded-[2.5rem] overflow-hidden max-w-md w-full shadow-[0_32px_64px_-16px_rgba(46,16,101,0.3)] relative"
      >
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-100 rounded-full -mr-16 -mt-16 opacity-50 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-100 rounded-full -ml-16 -mb-16 opacity-50 blur-2xl" />
        
        <div className="p-8 md:p-10 relative">
          <div className="text-center space-y-4 mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-600 to-violet-800 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-violet-200 rotate-6 hover:rotate-0 transition-transform duration-300">
              <Shield size={40} className="drop-shadow-lg" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-violet-900 tracking-tight leading-tight">
                ระบบบันทึกข้อมูลพนักงาน
                <span className="block text-violet-500 text-lg font-bold">(Employee Record System)</span>
              </h3>
              <p className="text-orange-500 font-bold text-base">การไฟฟ้าส่วนภูมิภาคสาขาทับสะแก</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-[0.15em] text-violet-400 pl-1">รหัสพนักงาน (Admin ID)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-violet-300 group-focus-within:text-violet-600 transition-colors">
                  <UserCircle size={20} />
                </div>
                <input 
                  type="text"
                  required
                  placeholder="ป้อนรหัสพนักงาน 7 หลัก"
                  className="w-full pl-11 pr-4 py-4 rounded-2xl bg-violet-50 border-2 border-transparent focus:border-violet-500 focus:bg-white focus:ring-0 transition-all outline-none text-violet-900 font-medium placeholder:text-violet-300"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={isLoggingIn}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-[0.15em] text-violet-400 pl-1">รหัสผ่าน</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-violet-300 group-focus-within:text-violet-600 transition-colors">
                  <Lock size={20} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-4 rounded-2xl bg-violet-50 border-2 border-transparent focus:border-violet-500 focus:bg-white focus:ring-0 transition-all outline-none text-violet-900 font-medium placeholder:text-violet-300"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLoggingIn}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-violet-300 hover:text-violet-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0">
                  <AlertCircle size={18} />
                </div>
                <p className="text-xs text-rose-600 font-bold leading-tight">{error}</p>
              </motion.div>
            )}

            <div className="flex flex-col gap-4 pt-4">
              <button 
                type="submit" 
                disabled={isLoggingIn}
                className="w-full py-4 rounded-2xl font-black bg-gradient-to-r from-violet-600 to-violet-800 text-white hover:from-violet-700 hover:to-violet-900 transition-all shadow-xl shadow-violet-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    <span>กำลังเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <>
                    <Unlock size={20} />
                    <span>เข้าใช้งานระบบ (ADMIN)</span>
                  </>
                )}
              </button>
              
              <button 
                type="button" 
                onClick={onClose} 
                disabled={isLoggingIn}
                className="group w-full py-4 rounded-2xl font-bold bg-white text-violet-700 border-2 border-violet-100 hover:bg-violet-50 hover:border-violet-200 transition-all flex items-center justify-center gap-2"
              >
                <User size={20} className="group-hover:scale-110 transition-transform" />
                <span>เข้าชมข้อมูล (VISTOR)</span>
              </button>
            </div>
            
            <p className="text-[10px] text-center text-violet-300 font-medium pt-4">
              © 2026 การไฟฟ้าส่วนภูมิภาคสาขาทับสะแก · v2.4.0
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'innovation' | 'activity' | 'external' | 'leave' | 'report' | 'admin'>('innovation');
  const [currentUser, setCurrentUser] = useState<Admin | null>(() => {
    const saved = localStorage.getItem('admin_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser);
  const [showLogin, setShowLogin] = useState(() => {
    const saved = localStorage.getItem('admin_session');
    return !saved;
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [state, setState] = useState<AppState>({ 
    employees: EMPLOYEES,
    innovationRecords: [], 
    activityRecords: [], 
    leaveRecords: [], 
    admins: [{ id: '9012844', password: 'PEATSG043', name: 'แอดมินหลัก' }] 
  });

  // Initialize Firebase Auth
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);
    });
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (!isAuthReady) return;

    // Listen to collections that are public read
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const firestoreEmployees = snapshot.docs.map(doc => doc.data() as Employee);
      const fsIds = new Set(firestoreEmployees.map(e => e.id));
      
      // Merge: Firestore records take precedence. 
      // If an ID from default EMPLOYEES is not in Firestore, include it.
      const merged = [
        ...firestoreEmployees,
        ...EMPLOYEES.filter(e => !fsIds.has(e.id))
      ].sort((a, b) => a.id - b.id);
      
      setState(prev => ({ ...prev, employees: merged }));
    }, (err) => console.error("Employees listener error:", err));

    const unsubInnovation = onSnapshot(collection(db, 'innovationRecords'), (snapshot) => {
      const records = snapshot.docs.map(doc => doc.data() as InnovationRecord);
      setState(prev => ({ ...prev, innovationRecords: records }));
    }, (err) => console.error("Innovation listener error:", err));

    const unsubActivity = onSnapshot(collection(db, 'activityRecords'), (snapshot) => {
      const records = snapshot.docs.map(doc => doc.data() as ActivityRecord);
      setState(prev => ({ ...prev, activityRecords: records }));
    }, (err) => console.error("Activity listener error:", err));

    const unsubLeave = onSnapshot(collection(db, 'leaveRecords'), (snapshot) => {
      const records = snapshot.docs.map(doc => doc.data() as LeaveRecord);
      setState(prev => ({ ...prev, leaveRecords: records }));
    }, (err) => console.error("Leave listener error:", err));

    // Only listen to admins if authenticated, otherwise use default
    let unsubAdmins = () => {};
    if (firebaseUser) {
      unsubAdmins = onSnapshot(collection(db, 'admins'), (snapshot) => {
        const admins = snapshot.docs.map(doc => doc.data() as Admin);
        const defaultAdmins = [{ id: '9012844', password: 'PEATSG043', name: 'แอดมินหลัก' }];
        
        const finalAdmins = [...admins];
        defaultAdmins.forEach(def => {
          const idx = finalAdmins.findIndex(a => a.id === def.id);
          if (idx === -1) {
            finalAdmins.push(def);
          } else {
            finalAdmins[idx] = { ...finalAdmins[idx], password: def.password };
          }
        });
        
        setState(prev => ({ ...prev, admins: finalAdmins }));
      }, (err) => console.error("Admins listener error:", err));
    }

    return () => {
      unsubAdmins();
      unsubEmployees();
      unsubInnovation();
      unsubActivity();
      unsubLeave();
    };
  }, [isAuthReady, firebaseUser]);

  const isAdmin = !!currentUser;

  const handleLogin = (admin: Admin) => {
    setCurrentUser(admin);
    localStorage.setItem('admin_session', JSON.stringify(admin));
    setShowLogin(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('admin_session');
    if (activeTab === 'admin') setActiveTab('innovation');
  };

  const addAdmin = async (admin: Admin) => {
    if (state.admins.find(a => a.id === admin.id)) return false;
    try {
      await setDoc(doc(db, 'admins', admin.id), admin);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${admin.id}`);
      return false;
    }
  };

  const updateAdminPassword = async (id: string, newPass: string) => {
    const admin = state.admins.find(a => a.id === id);
    if (admin) {
      try {
        const updated = { ...admin, password: newPass };
        await setDoc(doc(db, 'admins', id), updated);
        if (currentUser?.id === id) {
          setCurrentUser(updated);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `admins/${id}`);
      }
    }
  };

  const deleteAdmin = async (id: string) => {
    if (id === '9012844') return;
    try {
      await deleteDoc(doc(db, 'admins', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `admins/${id}`);
    }
  };

  const addEmployee = async (emp: { name: string, position: string, group?: 'A' | 'B' | 'Both' }) => {
    const newId = state.employees.length > 0 ? Math.max(...state.employees.map(e => e.id)) + 1 : 1;
    const newEmp = { ...emp, id: newId };
    try {
      await setDoc(doc(db, 'employees', newId.toString()), newEmp);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `employees/${newId}`);
    }
  };

  const updateEmployee = async (id: number, emp: { name: string, position: string, group?: 'A' | 'B' | 'Both' }) => {
    try {
      await setDoc(doc(db, 'employees', id.toString()), { ...emp, id });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `employees/${id}`);
    }
  };

  const deleteEmployee = async (id: number) => {
    try {
      await deleteDoc(doc(db, 'employees', id.toString()));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
    }
  };

  const addInnovation = async (record: Omit<InnovationRecord, 'id'>) => {
    const id = crypto.randomUUID();
    try {
      await setDoc(doc(db, 'innovationRecords', id), { ...record, id });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `innovationRecords/${id}`);
    }
  };

  const updateInnovation = async (id: string, record: Omit<InnovationRecord, 'id'>) => {
    try {
      await setDoc(doc(db, 'innovationRecords', id), { ...record, id });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `innovationRecords/${id}`);
    }
  };

  const addActivities = async (records: Omit<ActivityRecord, 'id'>[]) => {
    const batch = writeBatch(db);
    records.forEach(r => {
      const id = crypto.randomUUID();
      batch.set(doc(db, 'activityRecords', id), { ...r, id });
    });
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'activityRecords (batch)');
    }
  };

  const updateActivities = async (oldGroup: { date: string, type: string, title: string }, newRecords: Omit<ActivityRecord, 'id'>[]) => {
    const batch = writeBatch(db);
    
    // Find and delete old records
    const oldRecords = state.activityRecords.filter(r => 
      r.date === oldGroup.date && r.type === oldGroup.type && r.title === oldGroup.title
    );
    oldRecords.forEach(r => {
      batch.delete(doc(db, 'activityRecords', r.id));
    });

    // Add new records
    newRecords.forEach(r => {
      const id = crypto.randomUUID();
      batch.set(doc(db, 'activityRecords', id), { ...r, id });
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'activityRecords (update batch)');
    }
  };

  const addLeave = async (record: Omit<LeaveRecord, 'id'>) => {
    const id = crypto.randomUUID();
    try {
      await setDoc(doc(db, 'leaveRecords', id), { ...record, id });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `leaveRecords/${id}`);
    }
  };

  const updateLeave = async (id: string, record: Omit<LeaveRecord, 'id'>) => {
    try {
      await setDoc(doc(db, 'leaveRecords', id), { ...record, id });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `leaveRecords/${id}`);
    }
  };

  const deleteRecord = async (type: keyof AppState, id: string) => {
    const collectionName = type === 'innovationRecords' ? 'innovationRecords' : 
                          type === 'activityRecords' ? 'activityRecords' : 
                          type === 'leaveRecords' ? 'leaveRecords' : '';
    if (!collectionName) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  const clearAllLeaveRecords = async () => {
    if (!isAdmin) return;
    const batch = writeBatch(db);
    state.leaveRecords.forEach(record => {
      batch.delete(doc(db, 'leaveRecords', record.id));
    });
    try {
      await batch.commit();
      setToast({ message: 'ลบข้อมูลวันลาทั้งหมดเรียบร้อยแล้ว', type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'leaveRecords (batch)');
    }
  };

  const deleteActivitiesByGroup = async (date: string, type: string, title: string) => {
    const batch = writeBatch(db);
    const recordsToDelete = state.activityRecords.filter(r => 
      r.date === date && r.type === type && r.title === title
    );
    recordsToDelete.forEach(r => {
      batch.delete(doc(db, 'activityRecords', r.id));
    });
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'activityRecords (group delete)');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-700 via-violet-800 to-violet-950 flex items-center justify-center relative overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-700" />
        
        <div className="text-center space-y-6 relative z-10">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-violet-950/50">
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="space-y-2">
            <h2 className="text-white font-black text-xl tracking-wide">กำลังเตรียมข้อมูล...</h2>
            <p className="text-violet-200 text-xs font-bold uppercase tracking-[0.2em] opacity-60">Employee Record System (PEA)</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-violet-50/50 text-[#1A1A1A] font-sans">
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {authError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-full max-w-md px-4">
          <div className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-bold">{authError}</p>
              <button onClick={() => setAuthError(null)} className="p-1 hover:bg-white/20 rounded-lg shrink-0">
                <Plus size={18} className="rotate-45" />
              </button>
            </div>
            <button 
              onClick={() => {
                setAuthError(null);
                setShowLogin(true);
              }}
              className="w-full py-2 bg-white text-red-600 rounded-xl font-bold text-xs hover:bg-white/90 transition-colors"
            >
              ไปที่หน้าเข้าสู่ระบบเพื่อแก้ไข
            </button>
          </div>
        </div>
      )}

      {/* Sidebar / Navigation */}
      <div className="flex flex-col md:flex-row min-h-screen print:block">
        <nav className="w-full md:w-72 bg-white border-r border-violet-100 p-6 flex flex-col gap-8 shadow-[1px_0_10px_rgba(139,92,246,0.05)] print:hidden">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 group cursor-default">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-200 group-hover:rotate-6 transition-transform">
                <Users size={32} />
              </div>
              <div className="flex flex-col">
                <h1 className="font-black text-base text-violet-950 leading-tight">
                  ระบบบันทึกข้อมูล
                </h1>
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">EMPLOYEE RECORD SYSTEM</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[9px] font-bold text-violet-400">PEA THAP SAKAE</span>
                </div>
              </div>
            </div>
            
            {!isAdmin && (
              <div className="p-4 rounded-2xl bg-orange-50 border border-orange-100 space-y-2">
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">โหมดผู้เยี่ยมชม</p>
                <p className="text-[11px] text-orange-800/70 font-medium leading-relaxed">
                  คุณกำลังเข้าชมข้อมูลในโหมด Visitor หากต้องการบันทึกข้อมูลกรุณาเข้าสู่ระบบ
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <NavButton 
              active={activeTab === 'innovation'} 
              onClick={() => setActiveTab('innovation')}
              icon={<Lightbulb size={20} />}
              label="นวัตกรรม / KM/ความคิดสร้างสรรค์"
            />
            <NavButton 
              active={activeTab === 'activity'} 
              onClick={() => setActiveTab('activity')}
              icon={<ShieldCheck size={20} />}
              label="กิจกรรมภายใน"
            />
            <NavButton 
              active={activeTab === 'external'} 
              onClick={() => setActiveTab('external')}
              icon={<Users size={20} />}
              label="กิจกรรมภายนอก"
            />
            <NavButton 
              active={activeTab === 'leave'} 
              onClick={() => setActiveTab('leave')}
              icon={<Calendar size={20} />}
              label="วันหยุดวันลา"
            />
            <div className="h-px bg-black/5 my-2" />
            <NavButton 
              active={activeTab === 'report'} 
              onClick={() => setActiveTab('report')}
              icon={<BarChart3 size={20} />}
              label="รายงานสรุปผล"
            />
            {isAdmin && (
              <NavButton 
                active={activeTab === 'admin'} 
                onClick={() => setActiveTab('admin')}
                icon={<Settings size={20} />}
                label="จัดการแอดมิน"
              />
            )}
          </div>

          <div className="mt-auto pt-6 border-t border-black/5">
            {isAdmin ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-100">
                  <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white">
                    <Shield size={16} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate">{currentUser.name}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 p-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors font-bold text-sm"
                >
                  <LogOut size={18} /> ออกจากระบบ
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowLogin(true)}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-800 text-white font-black hover:from-violet-700 hover:to-violet-900 transition-all shadow-xl shadow-violet-200 active:scale-[0.98] border border-violet-400/20"
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Lock size={18} />
                </div>
                <span>เข้าสู่ระบบ ADMIN</span>
              </button>
            )}
          </div>
        </nav>

        {/* Login Modal */}
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={handleLogin} 
          admins={state.admins}
          firebaseUser={firebaseUser}
          setToast={setToast}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-10 overflow-y-auto max-h-screen print:overflow-visible print:max-h-none print:p-0 print:bg-white">
          <AnimatePresence mode="wait">
            {activeTab === 'innovation' && (
              <motion.div key="innovation" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <InnovationSection 
                  employees={state.employees}
                  records={state.innovationRecords} 
                  onAdd={addInnovation} 
                  onUpdate={updateInnovation}
                  onDelete={(id) => deleteRecord('innovationRecords', id)}
                  isAdmin={isAdmin}
                  setToast={setToast}
                />
              </motion.div>
            )}
            {activeTab === 'activity' && (
              <motion.div key="activity" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <ActivitySection 
                  employees={state.employees}
                  records={state.activityRecords} 
                  onAdd={addActivities} 
                  onUpdate={updateActivities}
                  onDeleteGroup={deleteActivitiesByGroup}
                  isAdmin={isAdmin}
                  setToast={setToast}
                />
              </motion.div>
            )}
            {activeTab === 'external' && (
              <motion.div key="external" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <ExternalActivitySection 
                  employees={state.employees}
                  records={state.activityRecords} 
                  onAdd={addActivities} 
                  onUpdate={updateActivities}
                  onDeleteGroup={deleteActivitiesByGroup}
                  isAdmin={isAdmin}
                  setToast={setToast}
                />
              </motion.div>
            )}
            {activeTab === 'leave' && (
              <motion.div key="leave" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <LeaveSection 
                  employees={state.employees}
                  records={state.leaveRecords.filter(r => r.type !== 'ราชการ' as any)} 
                  onAdd={addLeave} 
                  onUpdate={updateLeave}
                  onDelete={(id) => deleteRecord('leaveRecords', id)}
                  onDeleteAll={clearAllLeaveRecords}
                  isAdmin={isAdmin}
                  setToast={setToast}
                />
              </motion.div>
            )}
            {activeTab === 'report' && (
              <motion.div key="report" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <ReportSection state={state} setToast={setToast} />
              </motion.div>
            )}
            {activeTab === 'admin' && isAdmin && (
              <motion.div key="admin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <AdminSection 
                  admins={state.admins}
                  employees={state.employees}
                  currentUser={currentUser}
                  onAddAdmin={addAdmin}
                  onUpdatePassword={updateAdminPassword}
                  onDeleteAdmin={deleteAdmin}
                  onAddEmployee={addEmployee}
                  onUpdateEmployee={updateEmployee}
                  onDeleteEmployee={deleteEmployee}
                  setToast={setToast}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
        active 
          ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' 
          : 'hover:bg-black/5 text-[#1A1A1A]/70 hover:text-[#1A1A1A]'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {active && <ChevronRight size={16} className="ml-auto opacity-50" />}
    </button>
  );
}

// --- Sections ---

function InnovationSection({ employees, records, onAdd, onUpdate, onDelete, isAdmin, setToast }: { employees: Employee[], records: InnovationRecord[], onAdd: (r: any) => Promise<void>, onUpdate: (id: string, r: any) => Promise<void>, onDelete: (id: string) => Promise<void>, isAdmin: boolean, setToast: (t: any) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'ทั้งหมด' | typeof INNOVATION_TYPES[number]>('ทั้งหมด');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<{
    employeeId: number;
    participants: number[];
    type: 'นวัตกรรม' | 'KM' | 'ความคิดสร้างสรรค์';
    kmSubtype?: 'OPL' | 'OPK';
    contentId?: string;
    title: string;
    description: string;
    date: string;
    pdfUrl?: string;
    pdfName?: string;
    pdfFile?: File | null;
    linkUrl?: string;
  }>({ 
    employeeId: employees.length > 0 ? employees[0].id : 1, 
    participants: [],
    type: 'นวัตกรรม', 
    kmSubtype: 'OPL',
    contentId: '',
    title: '', 
    description: '', 
    date: new Date().toISOString().split('T')[0],
    pdfUrl: '',
    pdfName: '',
    pdfFile: null,
    linkUrl: ''
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (employees.length > 0 && !editingId) {
      setFormData(prev => ({
        ...prev,
        employeeId: prev.employeeId === 1 && employees.every(e => e.id !== 1) ? employees[0].id : prev.employeeId
      }));
    }
  }, [employees, editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Safety warning timeout
    const timeout = setTimeout(() => {
      setToast({ message: "การอัปโหลดไฟล์อาจใช้เวลานาน กรุณารอสักครู่...", type: 'info' });
    }, 10000);

    try {
      let dataToSave = { ...formData };
      
      // Handle PDF upload if any
      if (dataToSave.pdfFile && (dataToSave.type === 'KM' || dataToSave.type === 'ความคิดสร้างสรรค์')) {
        setToast({ message: "กำลังอัปโหลดเอกสาร PDF...", type: 'info' });
        const fileRef = ref(storage, `innovation_pdfs/${Date.now()}_${dataToSave.pdfFile.name}`);
        const uploadTask = uploadBytesResumable(fileRef, dataToSave.pdfFile);
        
        const url = await new Promise<string>((resolve, reject) => {
          uploadTask.on('state_changed', 
            null,
            (error) => reject(error),
            async () => {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadUrl);
            }
          );
        });
        
        dataToSave.pdfUrl = url;
        dataToSave.pdfName = dataToSave.pdfFile.name;
      }
      
      // Remove file object before saving to Firestore
      const { pdfFile, ...finalData } = dataToSave;
      
      if (finalData.type !== 'KM') {
        delete finalData.kmSubtype;
        delete finalData.contentId;
      }
      
      if (editingId) {
        await onUpdate(editingId, finalData);
        setEditingId(null);
        setToast({ message: 'แก้ไขข้อมูลสำเร็จ', type: 'success' });
      } else {
        await onAdd(finalData);
        setToast({ message: 'บันทึกข้อมูลสำเร็จ', type: 'success' });
      }
      
      setFormData({ 
        employeeId: employees.length > 0 ? employees[0].id : 1, 
        participants: [],
        type: 'นวัตกรรม', 
        kmSubtype: 'OPL',
        contentId: '',
        title: '', 
        description: '', 
        date: new Date().toISOString().split('T')[0],
        pdfUrl: '',
        pdfName: '',
        pdfFile: null,
        linkUrl: ''
      });
      // Show success feedback if needed, but usually the real-time sync is enough
    } catch (err: any) {
      console.error("Innovation submit error:", err);
      let msg = "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง";
      try {
        const errInfo = JSON.parse(err.message);
        if (errInfo.error && (errInfo.error.includes("permission") || errInfo.error.includes("insufficient"))) {
          msg = "สิทธิ์ไม่เพียงพอ: กรุณาเข้าสู่ระบบแอดมินใหม่อีกครั้งเพื่อรีเซ็ตการเชื่อมต่อ";
        } else if (errInfo.error && errInfo.error.includes("Quota")) {
          msg = "โควตาฐานข้อมูลเต็ม (Spark Plan) กรุณารอรีเซ็ตในวันถัดไป";
        }
      } catch (e) { /* use default msg */ }
      
      setToast({ 
        message: msg, 
        type: 'error' 
      });
    } finally {
      clearTimeout(timeout);
      setIsSaving(false);
    }
  };

  const startEdit = (record: InnovationRecord) => {
    setEditingId(record.id);
    setFormData({
      employeeId: record.employeeId,
      participants: record.participants || [],
      type: record.type as any,
      kmSubtype: record.kmSubtype,
      contentId: record.contentId || '',
      title: record.title,
      description: record.description || '',
      date: record.date,
      pdfUrl: record.pdfUrl || '',
      pdfName: record.pdfName || '',
      pdfFile: null,
      linkUrl: record.linkUrl || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ConfirmDialog 
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && onDelete(deleteConfirmId)}
        title="ยืนยันการลบข้อมูล"
        message="คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลการทำนวัตกรรม/KM/ความคิดสร้างสรรค์ นี้? การกระทำนี้ไม่สามารถย้อนกลับได้"
      />

      <header>
        <h2 className="text-3xl font-bold serif">{editingId ? 'แก้ไขข้อมูลนวัตกรรม / KM/ความคิดสร้างสรรค์' : 'การทำนวัตกรรม / KM/ความคิดสร้างสรรค์'}</h2>
      </header>

      {isAdmin && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">ผู้จัดทำหลัก</label>
              <select 
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                value={formData.employeeId}
                onChange={e => setFormData({ ...formData, employeeId: Number(e.target.value) })}
              >
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">ประเภท</label>
              <select 
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
              >
                {INNOVATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">ผู้เข้าร่วมเพิ่มเติม</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4 bg-slate-50 rounded-xl max-h-48 overflow-y-auto">
                {employees.filter(e => e.id !== formData.employeeId).map(emp => (
                  <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-black/5 p-1 rounded transition-colors">
                    <input 
                      type="checkbox"
                      className="rounded text-violet-600 focus:ring-violet-500"
                      checked={formData.participants.includes(emp.id)}
                      onChange={e => {
                        const newParticipants = e.target.checked 
                          ? [...formData.participants, emp.id]
                          : formData.participants.filter(id => id !== emp.id);
                        setFormData({ ...formData, participants: newParticipants });
                      }}
                    />
                    <span>{emp.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {formData.type === 'KM' && (
              <>
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50">ประเภท KM ย่อย</label>
                  <select 
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    value={formData.kmSubtype}
                    onChange={e => setFormData({ ...formData, kmSubtype: e.target.value as any })}
                  >
                    {KM_SUBTYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </motion.div>
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50">Content ID</label>
                  <input 
                    type="text"
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    placeholder="ระบุ Content ID..."
                    value={formData.contentId}
                    onChange={e => setFormData({ ...formData, contentId: e.target.value })}
                  />
                </motion.div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">วันที่</label>
              <input 
                type="date"
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">หัวข้อ</label>
              <input 
                type="text"
                required
                placeholder="ระบุหัวข้อ..."
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">รายละเอียด</label>
              <textarea 
                rows={3}
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {(formData.type === 'KM' || formData.type === 'ความคิดสร้างสรรค์') && (
              <div className="md:col-span-2 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50">แนบลิงก์เอกสาร (เช่น Google Drive / Canva)</label>
                  <input 
                    type="url"
                    className="w-full p-4 bg-white rounded-xl border-2 border-slate-100 focus:border-violet-500 transition-all font-bold text-sm"
                    placeholder="https://drive.google.com/..."
                    value={formData.linkUrl}
                    onChange={e => setFormData({ ...formData, linkUrl: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-500">* แนะนำวิธีนี้สำหรับโปรไฟล์ขนาดใหญ่หรือเน็ตช้า จะช่วยให้บันทึกได้เร็วขึ้นมาก</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50">หรือ อัปโหลดไฟล์ PDF (ดั้งเดิม)</label>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <input 
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      id="pdf-upload"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormData({ ...formData, pdfFile: file, pdfName: file.name });
                        }
                      }}
                    />
                    <label 
                      htmlFor="pdf-upload"
                      className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <FileText size={20} className="text-violet-600" />
                      <span className="text-sm font-bold">{formData.pdfName || 'เลือกไฟล์ PDF'}</span>
                    </label>
                    {formData.pdfName && (
                      <button 
                        type="button"
                        onClick={() => setFormData({ ...formData, pdfFile: null, pdfName: '', pdfUrl: '' })}
                        className="text-xs text-red-500 font-bold hover:underline"
                      >
                        ลบไฟล์
                      </button>
                    )}
                    {formData.pdfUrl && !formData.pdfFile && (
                      <span className="text-[10px] opacity-40">(มีไฟล์ที่อัปโหลดไว้แล้ว)</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="md:col-span-2 flex gap-3">
              <button 
                type="submit" 
                disabled={isSaving}
                className="flex-1 bg-violet-600 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  editingId ? <ShieldCheck size={20} /> : <Plus size={20} />
                )} 
                {isSaving ? 'กำลังบันทึก...' : (editingId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล')}
              </button>
              {editingId && (
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ 
                      employeeId: employees.length > 0 ? employees[0].id : 1, 
                      participants: [],
                      type: 'นวัตกรรม', 
                      kmSubtype: 'OPL',
                      title: '', 
                      description: '', 
                      date: new Date().toISOString().split('T')[0] 
                    });
                  }}
                  className="px-6 bg-black/5 text-black/50 p-4 rounded-xl font-bold hover:bg-black/10 transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Search size={20} className="text-violet-600" />
            <h3 className="text-xl font-bold">ประวัติการบันทึก</h3>
          </div>
          <div className="flex-1 max-w-md relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
            <input 
              type="text"
              placeholder="ค้นหาชื่อหัวข้อ, รายละเอียด หรือชื่อผู้จัดทำ..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-black/5 text-sm focus:ring-2 focus:ring-violet-500 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-white border border-black/5 rounded-xl p-1 shrink-0 overflow-x-auto">
            {['ทั้งหมด', ...INNOVATION_TYPES].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  filterType === type ? 'bg-violet-600 text-white shadow-sm' : 'hover:bg-black/5 opacity-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid gap-4">
          {records.length === 0 ? (
            <div className="p-10 text-center opacity-30 italic">ยังไม่มีข้อมูลบันทึก</div>
          ) : (
            records
              .filter(r => filterType === 'ทั้งหมด' || r.type === filterType)
              .filter(r => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                const emp = employees.find(e => e.id === r.employeeId);
                const hasParticipant = r.participants?.some(pid => employees.find(e => e.id === pid)?.name.toLowerCase().includes(term));
                return (
                  r.title.toLowerCase().includes(term) || 
                  r.description?.toLowerCase().includes(term) || 
                  emp?.name.toLowerCase().includes(term) ||
                  hasParticipant
                );
              })
              .sort((a, b) => a.type.localeCompare(b.type)) // Sort by type as requested
              .slice().reverse() // Show newest first within type groups or total
              .map(record => {
              const emp = employees.find(e => e.id === record.employeeId);
              return (
                <div key={record.id} className="bg-white p-6 rounded-2xl border border-black/5 flex items-start justify-between group">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center text-violet-600">
                      <Lightbulb size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full">
                          {record.type}{record.kmSubtype ? ` (${record.kmSubtype})` : ''}
                        </span>
                        {record.contentId && (
                          <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded-full">
                            ID: {record.contentId}
                          </span>
                        )}
                        <span className="text-xs opacity-50">{record.date}</span>
                      </div>
                      <h4 className="font-bold">{record.title}</h4>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <p className="text-sm opacity-70">โดย: {emp?.name}</p>
                        {record.participants && record.participants.length > 0 && (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] opacity-40">และ</span>
                            {record.participants.map(pid => {
                              const p = employees.find(e => e.id === pid);
                              return <span key={pid} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{p?.name}</span>;
                            })}
                          </div>
                        )}
                      </div>
                      {record.description && <p className="text-sm mt-2 p-3 bg-slate-50 rounded-lg italic">{record.description}</p>}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {record.linkUrl && (
                          <a 
                            href={record.linkUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                          >
                            <ExternalLink size={14} />
                            ลิงก์เอกสาร/ผลงาน
                          </a>
                        )}
                        {record.pdfUrl && (
                          <a 
                            href={record.pdfUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-100 transition-colors"
                          >
                            <FileText size={14} />
                            ไฟล์ PDF
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => startEdit(record)} 
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                        title="แก้ไข"
                      >
                        <Plus size={18} className="rotate-45" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirmId(record.id)} 
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        title="ลบ"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  // Convert objects to CSV rows
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const val = row[header] === null || row[header] === undefined ? '' : row[header];
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');

  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function ExternalActivitySection({ employees, records, onAdd, onUpdate, onDeleteGroup, isAdmin, setToast }: { employees: Employee[], records: ActivityRecord[], onAdd: (r: any[]) => Promise<void>, onUpdate: (oldGroup: { date: string, type: string, title: string }, newRecords: any[]) => Promise<void>, onDeleteGroup: (date: string, type: string, title: string) => Promise<void>, isAdmin: boolean, setToast: (t: any) => void }) {
  const [editingGroup, setEditingGroup] = useState<{ date: string, type: string, title: string } | null>(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<{ date: string, type: string, title: string } | null>(null);
  const [activeGroup, setActiveGroup] = useState<'A' | 'B'>('A');
  const [searchTerm, setSearchTerm] = useState('');
  const [headerData, setHeaderData] = useState({ 
    type: 'กิจกรรมภายนอก' as any, 
    title: '', 
    date: new Date().toISOString().split('T')[0] 
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [linkUrls, setLinkUrls] = useState<string[]>(['']);
  const [isUploading, setIsUploading] = useState(false);
  
  const groupEmployees = useMemo(() => {
    return employees.filter(emp => (emp.group === activeGroup || emp.group === 'Both') && emp.id !== 1);
  }, [activeGroup, employees]);

  const [attendance, setAttendance] = useState<{ [key: number]: { status: 'เข้าร่วม' | 'ไม่เข้าร่วม' | 'อื่นๆ' | 'สลับคู่', reason: string, swapWithId?: number } }>(
    employees.reduce((acc, emp) => ({ ...acc, [emp.id]: { status: 'เข้าร่วม', reason: '' } }), {})
  );

  useEffect(() => {
    if (employees.length > 0) {
      setAttendance(prev => {
        const next = { ...prev };
        let changed = false;
        employees.forEach(emp => {
          if (!next[emp.id]) {
            next[emp.id] = { status: 'เข้าร่วม', reason: '' };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [employees]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setToast({ message: "กำลังย่อขนาดรูปภาพเพื่อความรวดเร็ว...", type: 'info' });
      
      const compressedFiles = await Promise.all(files.map(async (file: File) => {
        if (!file.type.startsWith('image/')) return file;
        try {
          const options = {
            maxSizeMB: 0.2, // Aggressive compression (200KB)
            maxWidthOrHeight: 1024,
            useWebWorker: true,
            initialQuality: 0.6
          };
          return await imageCompression(file, options) as File;
        } catch (error) {
          console.error("Compression error:", error);
          return file;
        }
      })) as File[];

      const newFiles = [...imageFiles, ...compressedFiles].slice(0, 3); // Limit to 3 images
      setImageFiles(newFiles);
      
      const newUrls = newFiles.map(file => URL.createObjectURL(file));
      setImageUrls(newUrls);
    }
  };

  const removeImage = (index: number) => {
    const newFiles = [...imageFiles];
    newFiles.splice(index, 1);
    setImageFiles(newFiles);

    const newUrls = [...imageUrls];
    newUrls.splice(index, 1);
    setImageUrls(newUrls);
  };

  const handleAddLink = () => {
    if (linkUrls.length < 3) {
      setLinkUrls([...linkUrls, '']);
    }
  };

  const handleLinkChange = (index: number, value: string) => {
    const newLinks = [...linkUrls];
    newLinks[index] = value;
    setLinkUrls(newLinks);
  };

  const handleRemoveLink = (index: number) => {
    const newLinks = linkUrls.filter((_, i) => i !== index);
    setLinkUrls(newLinks.length ? newLinks : ['']);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    
    // Safety timeout
    const timeout = setTimeout(() => {
      // We check a ref or just rely on the fact that if it finishes, we'll clear it.
      // If it takes too long, we notify the user but we don't necessarily 'stop' the execution
      // unless we use an AbortController.
      setToast({ message: "การบันทึกอาจใช้เวลานานกว่าปกติเนื่องจากขนาดรูปภาพหรือจำนวนพนักงาน กรุณารอสักครู่...", type: 'info' });
    }, 15000); 

    try {
      if (!auth.currentUser) {
        throw new Error(JSON.stringify({ 
          error: "Missing or insufficient permissions: Not logged in with Google",
          operationType: 'write',
          path: 'activityRecords (external)'
        }));
      }

      let finalImageUrls = [...imageUrls.filter(url => url.startsWith('http'))];
      
      const newFilesToUpload = imageFiles.filter((_, i) => !imageUrls[i].startsWith('http'));

      if (newFilesToUpload.length > 0) {
        setToast({ message: `เริ่มการอัปโหลดรูปภาพ (0/${newFilesToUpload.length})...`, type: 'info' });
        
        const uploadedUrls: string[] = [];
        for (let i = 0; i < newFilesToUpload.length; i++) {
          const file = newFilesToUpload[i];
          const storageRef = ref(storage, `activities/${Date.now()}_${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          
          setToast({ message: `กำลังอัปโหลดรูปภาพที่ ${i + 1}/${newFilesToUpload.length}...`, type: 'info' });
          
          const url = await new Promise<string>((resolve, reject) => {
            uploadTask.on('state_changed', 
              null,
              (error) => reject(error),
              async () => {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadUrl);
              }
            );
          });
          uploadedUrls.push(url);
        }
        finalImageUrls = [...finalImageUrls, ...uploadedUrls];
      }

      const finalLinkUrls = linkUrls.filter(url => url.trim() !== '');

      const recordsToSave = groupEmployees.map(emp => ({
        employeeId: emp.id,
        type: headerData.type,
        title: headerData.title || headerData.type,
        date: headerData.date,
        status: attendance[emp.id]?.status || 'เข้าร่วม',
        reason: attendance[emp.id]?.reason || '',
        imageUrl: finalImageUrls[0] || '', // Keep for backward compatibility
        imageUrls: finalImageUrls,
        linkUrls: finalLinkUrls,
        swapWithId: attendance[emp.id]?.status === 'สลับคู่' ? attendance[emp.id]?.swapWithId || null : null
      }));

      if (editingGroup) {
        await onUpdate(editingGroup, recordsToSave);
        setEditingGroup(null);
        setToast({ message: 'แก้ไขกิจกรรมภายนอกสำเร็จ', type: 'success' });
      } else {
        await onAdd(recordsToSave);
        setToast({ message: 'บันทึกกิจกรรมภายนอกสำเร็จ', type: 'success' });
      }

      setHeaderData({ 
        type: 'กิจกรรมภายนอก',
        title: '', 
        date: new Date().toISOString().split('T')[0] 
      });
      setImageFiles([]);
      setImageUrls([]);
      setLinkUrls(['']);
      setAttendance(employees.reduce((acc, emp) => ({ ...acc, [emp.id]: { status: 'เข้าร่วม', reason: '' } }), {}));
    } catch (err: any) {
      console.error("External activity submit error:", err);
      let msg = "เกิดข้อผิดพลาดในการบันทึกข้อมูลกิจกรรมภายนอก กรุณาลองใหม่อีกครั้ง";
      try {
        const errInfo = JSON.parse(err.message);
        if (errInfo.error && (errInfo.error.includes("permission") || errInfo.error.includes("insufficient"))) {
          msg = "สิทธิ์ไม่เพียงพอ: กรุณาเข้าสู่ระบบแอดมินใหม่อีกครั้งเพื่อรีเซ็ตการเชื่อมต่อ";
        } else if (errInfo.error && errInfo.error.includes("Quota")) {
          msg = "โควตาฐานข้อมูลเต็ม (Spark Plan) กรุณารอรีเซ็ตในวันถัดไป";
        }
      } catch (e) { /* use default msg */ }
      
      setToast({ 
        message: msg, 
        type: 'error' 
      });
    } finally {
      clearTimeout(timeout);
      setIsUploading(false);
    }
  };

  const startEdit = (group: ActivityRecord[]) => {
    const first = group[0];
    const groupInfo = { date: first.date, type: first.type, title: first.title };
    setEditingGroup(groupInfo);
    setHeaderData(groupInfo);
    
    const initialUrls = first.imageUrls || (first.imageUrl ? [first.imageUrl] : []);
    setImageUrls(initialUrls);
    const initialLinkUrls = first.linkUrls || [''];
    setLinkUrls(initialLinkUrls);
    setImageFiles([]); // Reset files as they are already uploaded
    
    // Determine which group this belongs to
    const groupIds = group.map(r => r.employeeId);
    const groupAIds = employees.filter(e => e.group === 'A' || e.group === 'Both').map(e => e.id);
    const groupBIds = employees.filter(e => e.group === 'B' || e.group === 'Both').map(e => e.id);
    
    if (groupIds.every(id => groupAIds.includes(id)) && groupIds.length === groupAIds.length) setActiveGroup('A');
    else if (groupIds.every(id => groupBIds.includes(id)) && groupIds.length === groupBIds.length) setActiveGroup('B');

    const newAttendance = { ...attendance };
    group.forEach(r => {
      newAttendance[r.employeeId] = { status: r.status, reason: r.reason || '', swapWithId: r.swapWithId };
    });
    setAttendance(newAttendance);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateAttendance = (empId: number, status: 'เข้าร่วม' | 'ไม่เข้าร่วม' | 'อื่นๆ' | 'สลับคู่', reason?: string, swapWithId?: number) => {
    setAttendance(prev => ({
      ...prev,
      [empId]: { 
        ...prev[empId], 
        status, 
        reason: reason !== undefined ? reason : prev[empId].reason,
        swapWithId: swapWithId !== undefined ? swapWithId : prev[empId].swapWithId
      }
    }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <ConfirmDialog 
        isOpen={!!deleteConfirmGroup}
        onClose={() => setDeleteConfirmGroup(null)}
        onConfirm={() => deleteConfirmGroup && onDeleteGroup(deleteConfirmGroup.date, deleteConfirmGroup.type, deleteConfirmGroup.title)}
        title="ยืนยันการลบกิจกรรม"
        message="คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลกิจกรรมนี้ทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้"
      />

      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold serif">{editingGroup ? 'แก้ไขกิจกรรมภายนอก' : 'กิจกรรมภายนอก'}</h2>
          <p className="text-[#1A1A1A]/50">บันทึกกิจกรรมภายนอกแยกตามกลุ่ม A และ B</p>
        </div>
        <div className="flex bg-white border border-black/5 rounded-xl p-1">
          <button 
            onClick={() => setActiveGroup('A')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeGroup === 'A' ? 'bg-violet-600 text-white' : 'hover:bg-black/5'}`}
          >
            กลุ่ม A
          </button>
          <button 
            onClick={() => setActiveGroup('B')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeGroup === 'B' ? 'bg-violet-600 text-white' : 'hover:bg-black/5'}`}
          >
            กลุ่ม B
          </button>
        </div>
      </header>

      {isAdmin && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest opacity-50">วันที่</label>
                <input 
                  type="date"
                  className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                  value={headerData.date}
                  onChange={e => setHeaderData({ ...headerData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest opacity-50">ชื่อกิจกรรม</label>
                <input 
                  type="text"
                  placeholder="ระบุชื่อกิจกรรม..."
                  className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                  value={headerData.title}
                  onChange={e => setHeaderData({ ...headerData, title: e.target.value })}
                />
              </div>
            </div>

            <div className="md:col-span-1 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest opacity-50">รูปภาพการเข้าร่วมกิจกรรม (สูงสุด 3 รูป)</label>
                <div className="flex flex-wrap gap-4 items-start">
                  {imageUrls.map((url, index) => (
                    <div key={index} className="relative group/img w-32 h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-black/5 flex items-center justify-center overflow-hidden">
                      <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button 
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"
                      >
                        <Plus size={14} className="rotate-45" />
                      </button>
                    </div>
                  ))}
                  
                  {imageUrls.length < 3 && (
                    <div className="relative group/img w-32 h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-black/5 flex items-center justify-center overflow-hidden hover:bg-black/5 transition-colors">
                      <div className="text-center p-4">
                        <Plus size={20} className="mx-auto opacity-20 mb-1" />
                        <p className="text-[8px] opacity-40">เพิ่มรูปภาพ</p>
                      </div>
                      <input 
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest opacity-50">หรือ วางลิงก์รูปภาพกิจกรรม (แนะนำสำหรับเน็ตช้า)</label>
                <div className="space-y-2">
                  {linkUrls.map((url, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input 
                        type="url"
                        className="flex-1 p-3 bg-white rounded-xl border-2 border-slate-100 focus:border-violet-500 transition-all font-bold text-[10px]"
                        placeholder="วางลิงก์รูปภาพจาก Google Drive..."
                        value={url}
                        onChange={e => handleLinkChange(idx, e.target.value)}
                      />
                      {linkUrls.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => handleRemoveLink(idx)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                        >
                          <Plus size={18} className="rotate-45" />
                        </button>
                      )}
                    </div>
                  ))}
                  {linkUrls.length < 3 && (
                    <button 
                      type="button"
                      onClick={handleAddLink}
                      className="text-[10px] font-bold text-violet-600 hover:underline flex items-center gap-1"
                    >
                      + เพิ่มอีกลิงก์
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/5">
                    <th className="p-4 text-xs font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-widest opacity-50">สถานะการเข้าร่วม</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-widest opacity-50">หมายเหตุ/เหตุผล</th>
                  </tr>
                </thead>
                <tbody>
                  {groupEmployees.map(emp => (
                    <tr key={emp.id} className="border-b border-black/[0.02]">
                      <td className="p-4">
                        <div className="font-bold">{emp.name}</div>
                        <div className="text-[10px] opacity-50 uppercase">{emp.position}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {['เข้าร่วม', 'ไม่เข้าร่วม', 'อื่นๆ', 'สลับคู่'].map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => updateAttendance(emp.id, status as any)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                attendance[emp.id]?.status === status
                                  ? 'bg-violet-600 text-white'
                                  : 'bg-black/5 text-black/50 hover:bg-black/10'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-2">
                          {attendance[emp.id]?.status === 'สลับคู่' && (
                            <select
                              className="w-full p-2 text-xs rounded-lg bg-slate-50 border-none focus:ring-1 focus:ring-violet-500"
                              value={attendance[emp.id]?.swapWithId || ''}
                              onChange={e => updateAttendance(emp.id, 'สลับคู่', undefined, Number(e.target.value))}
                            >
                              <option value="">เลือกพนักงานที่สลับคู่...</option>
                              {employees.filter(e => e.id !== emp.id).map(e => (
                                <option key={e.id} value={e.id}>{e.name} ({e.position})</option>
                              ))}
                            </select>
                          )}
                          {attendance[emp.id]?.status === 'อื่นๆ' && (
                            <input 
                              type="text"
                              placeholder="ระบุเหตุผล..."
                              className="w-full p-2 text-xs rounded-lg bg-slate-50 border-none focus:ring-1 focus:ring-violet-500"
                              value={attendance[emp.id]?.reason || ''}
                              onChange={e => updateAttendance(emp.id, 'อื่นๆ', e.target.value)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              {editingGroup && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingGroup(null);
                    setHeaderData({ type: 'กิจกรรมภายนอก', title: '', date: new Date().toISOString().split('T')[0] });
                    setAttendance(employees.reduce((acc, emp) => ({ ...acc, [emp.id]: { status: 'เข้าร่วม', reason: '' } }), {}));
                  }}
                  className="px-8 bg-black/5 text-black/50 py-4 rounded-xl font-bold hover:bg-black/10 transition-colors"
                >
                  ยกเลิก
                </button>
              )}
              <button 
                type="submit" 
                disabled={isUploading}
                className="bg-violet-600 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-violet-700 transition-shadow shadow-lg shadow-violet-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  editingGroup ? <ShieldCheck size={20} /> : <Plus size={20} />
                )} 
                {isUploading ? 'กำลังอัปโหลด...' : (editingGroup ? 'บันทึกการแก้ไข' : `บันทึกกิจกรรมกลุ่ม ${activeGroup} (${groupEmployees.length} คน)`)}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Search size={20} className="text-violet-600" />
            <h3 className="text-xl font-bold">ประวัติกิจกรรมภายนอก</h3>
          </div>
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
            <input 
              type="text"
              placeholder="ค้นหาตามชื่อกิจกรรม, วันที่ หรือชื่อพนักงาน..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-black/5 text-sm focus:ring-2 focus:ring-violet-500 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4">
          {records.filter(r => r.type === 'กิจกรรมภายนอก').length === 0 ? (
            <div className="p-10 text-center opacity-30 italic">ยังไม่มีข้อมูลกิจกรรมภายนอก</div>
          ) : (
            Object.entries(
              records.filter(r => r.type === 'กิจกรรมภายนอก').reduce((acc, r) => {
                const key = `${r.date}_${r.type}_${r.title}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(r);
                return acc;
              }, {} as { [key: string]: ActivityRecord[] })
            ).filter(([key, group]) => {
              if (!searchTerm.trim()) return true;
              const term = searchTerm.toLowerCase();
              const hasEmployee = group.some(r => {
                const emp = employees.find(e => e.id === r.employeeId);
                return emp?.name.toLowerCase().includes(term);
              });
              return key.toLowerCase().includes(term) || hasEmployee;
            }).reverse().map(([key, group]) => (
              <div key={key} className="bg-white p-6 rounded-2xl border border-black/5 space-y-4 group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-violet-600">{group[0].type}</span>
                      <span className="text-xs opacity-50">• {group[0].date}</span>
                    </div>
                    <h4 className="font-bold">{group[0].title}</h4>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      {(group[0].imageUrls || (group[0].imageUrl ? [group[0].imageUrl] : [])).map((url, idx) => (
                        <a 
                          key={idx}
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-12 h-12 rounded-lg overflow-hidden border border-black/5 hover:scale-105 transition-transform"
                        >
                          <img src={url} alt={`Activity ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </a>
                      ))}
                      {(group[0].linkUrls || []).map((url, idx) => (
                        <a 
                          key={`link-${idx}`}
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors"
                          title="ดูลิงก์รูปภาพภายนอก"
                        >
                          <ExternalLink size={18} />
                        </a>
                      ))}
                    </div>
                    <div className="flex gap-2 text-xs font-bold">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg">เข้าร่วม: {group.filter(r => r.employeeId !== 1 && r.status === 'เข้าร่วม').length}</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg">สลับคู่: {group.filter(r => r.employeeId !== 1 && r.status === 'สลับคู่').length}</span>
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg">อื่นๆ: {group.filter(r => r.employeeId !== 1 && r.status === 'อื่นๆ').length}</span>
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg">ไม่เข้าร่วม: {group.filter(r => r.employeeId !== 1 && r.status === 'ไม่เข้าร่วม').length}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => startEdit(group)} 
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                          title="แก้ไขกิจกรรมนี้"
                        >
                          <Plus size={18} className="rotate-45" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmGroup({ date: group[0].date, type: group[0].type, title: group[0].title })}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="ลบกิจกรรมนี้ทั้งหมด"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {group.filter(r => r.employeeId !== 1).map(r => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    const swapEmp = r.swapWithId ? employees.find(e => e.id === r.swapWithId) : null;
                    return (
                      <div key={r.id} className={`p-2 rounded-lg text-[10px] flex flex-col gap-1 ${
                        r.status === 'เข้าร่วม' ? 'bg-green-50 text-green-800' : 
                        r.status === 'ไม่เข้าร่วม' ? 'bg-red-50 text-red-800' : 
                        r.status === 'สลับคู่' ? 'bg-blue-50 text-blue-800' : 
                        r.status === 'อื่นๆ' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="truncate font-bold">{emp?.name}</span>
                          <span className="shrink-0 ml-1">
                            {r.status === 'เข้าร่วม' ? '✓' : r.status === 'ไม่เข้าร่วม' ? '✗' : r.status === 'สลับคู่' ? '⇄' : r.status === 'อื่นๆ' ? '◌' : '?'}
                          </span>
                        </div>
                        {r.status === 'สลับคู่' && swapEmp && (
                          <div className="text-[8px] opacity-70 italic border-t border-blue-200 mt-1 pt-1">
                            คู่สลับ: {swapEmp.name}
                          </div>
                        )}
                        {r.status === 'อื่นๆ' && r.reason && (
                          <div className="text-[8px] opacity-70 italic border-t border-gray-200 mt-1 pt-1 truncate">
                            {r.reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ActivitySection({ employees, records, onAdd, onUpdate, onDeleteGroup, isAdmin, setToast }: { employees: Employee[], records: ActivityRecord[], onAdd: (r: any[]) => Promise<void>, onUpdate: (oldGroup: { date: string, type: string, title: string }, newRecords: any[]) => Promise<void>, onDeleteGroup: (date: string, type: string, title: string) => Promise<void>, isAdmin: boolean, setToast: (t: any) => void }) {
  const [editingGroup, setEditingGroup] = useState<{ date: string, type: string, title: string } | null>(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<{ date: string, type: string, title: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [headerData, setHeaderData] = useState({ 
    type: 'กิจกรรม' as any, 
    title: '', 
    date: new Date().toISOString().split('T')[0] 
  });
  
  const [isSaving, setIsSaving] = useState(false);
  
  const [attendance, setAttendance] = useState<{ [key: number]: { status: 'เข้าร่วม' | 'ไม่เข้าร่วม' | 'อื่นๆ' | 'สลับคู่', reason: string, swapWithId?: number } }>(
    employees.reduce((acc, emp) => ({ ...acc, [emp.id]: { status: 'เข้าร่วม', reason: '' } }), {})
  );

  useEffect(() => {
    if (employees.length > 0) {
      setAttendance(prev => {
        const next = { ...prev };
        let changed = false;
        employees.forEach(emp => {
          if (!next[emp.id]) {
            next[emp.id] = { status: 'เข้าร่วม', reason: '' };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Safety timeout
    const timeout = setTimeout(() => {
      setToast({ message: "การบันทึกอาจใช้เวลานานกว่าปกติ กรุณารอสักครู่...", type: 'info' });
    }, 15000);

    try {
      if (!auth.currentUser) {
        throw new Error(JSON.stringify({ 
          error: "Missing or insufficient permissions: Not logged in with Google",
          operationType: 'write',
          path: 'activityRecords'
        }));
      }

      const recordsToSave = employees.map(emp => ({
        employeeId: emp.id,
        type: headerData.type,
        title: headerData.title || headerData.type,
        date: headerData.date,
        status: attendance[emp.id]?.status || 'เข้าร่วม',
        reason: attendance[emp.id]?.reason || ''
      }));

      if (editingGroup) {
        await onUpdate(editingGroup, recordsToSave);
        setEditingGroup(null);
        setToast({ message: 'แก้ไขกิจกรรมสำเร็จ', type: 'success' });
      } else {
        await onAdd(recordsToSave);
        setToast({ message: 'บันทึกกิจกรรมสำเร็จ', type: 'success' });
      }

      setHeaderData({ 
        type: 'กิจกรรม',
        title: '', 
        date: new Date().toISOString().split('T')[0] 
      });
      setAttendance(employees.reduce((acc, emp) => ({ ...acc, [emp.id]: { status: 'เข้าร่วม', reason: '' } }), {}));
    } catch (err: any) {
      console.error("Activity submit error:", err);
      let msg = "เกิดข้อผิดพลาดในการบันทึกกิจกรรม กรุณาลองใหม่อีกครั้ง";
      try {
        const errInfo = JSON.parse(err.message);
        if (errInfo.error && (errInfo.error.includes("permission") || errInfo.error.includes("insufficient"))) {
          msg = "สิทธิ์ไม่เพียงพอ: กรุณาเข้าสู่ระบบแอดมินใหม่อีกครั้งเพื่อรีเซ็ตการเชื่อมต่อ";
        } else if (errInfo.error && errInfo.error.includes("Quota")) {
          msg = "โควตาฐานข้อมูลเต็ม (Spark Plan) กรุณารอรีเซ็ตในวันถัดไป";
        }
      } catch (e) { /* use default msg */ }
      
      setToast({ 
        message: msg, 
        type: 'error' 
      });
    } finally {
      clearTimeout(timeout);
      setIsSaving(false);
    }
  };

  const startEdit = (group: ActivityRecord[]) => {
    const first = group[0];
    const groupInfo = { date: first.date, type: first.type, title: first.title };
    setEditingGroup(groupInfo);
    setHeaderData(groupInfo);
    
    const newAttendance = { ...attendance };
    group.forEach(r => {
      newAttendance[r.employeeId] = { status: r.status, reason: r.reason || '', swapWithId: r.swapWithId };
    });
    setAttendance(newAttendance);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateAttendance = (empId: number, status: 'เข้าร่วม' | 'ไม่เข้าร่วม' | 'อื่นๆ' | 'สลับคู่', reason?: string, swapWithId?: number) => {
    setAttendance(prev => ({
      ...prev,
      [empId]: { 
        ...prev[empId], 
        status, 
        reason: reason !== undefined ? reason : prev[empId].reason,
        swapWithId: swapWithId !== undefined ? swapWithId : prev[empId].swapWithId
      }
    }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <ConfirmDialog 
        isOpen={!!deleteConfirmGroup}
        onClose={() => setDeleteConfirmGroup(null)}
        onConfirm={() => deleteConfirmGroup && onDeleteGroup(deleteConfirmGroup.date, deleteConfirmGroup.type, deleteConfirmGroup.title)}
        title="ยืนยันการลบกิจกรรม"
        message="คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลกิจกรรมนี้ทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้"
      />

      <header>
        <h2 className="text-3xl font-bold serif">{editingGroup ? 'แก้ไขกิจกรรมภายใน' : 'กิจกรรมภายใน'}</h2>
      </header>

      {isAdmin && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest opacity-50">วันที่</label>
                <input 
                  type="date"
                  className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                  value={headerData.date}
                  onChange={e => setHeaderData({ ...headerData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest opacity-50">ชื่อกิจกรรม</label>
                <input 
                  type="text"
                  placeholder="ระบุชื่อกิจกรรม..."
                  className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                  value={headerData.title}
                  onChange={e => setHeaderData({ ...headerData, title: e.target.value })}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/5">
                    <th className="p-4 text-xs font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-widest opacity-50">สถานะการเข้าร่วม</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-widest opacity-50">หมายเหตุ/เหตุผล</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id} className="border-b border-black/[0.02]">
                      <td className="p-4">
                        <div className="font-bold">{emp.name}</div>
                        <div className="text-[10px] opacity-50 uppercase">{emp.position}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {['เข้าร่วม', 'ไม่เข้าร่วม', 'อื่นๆ'].map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => updateAttendance(emp.id, status as any)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                attendance[emp.id]?.status === status
                                  ? 'bg-violet-600 text-white'
                                  : 'bg-black/5 text-black/50 hover:bg-black/10'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-2">
                          {attendance[emp.id]?.status === 'อื่นๆ' && (
                            <input 
                              type="text"
                              placeholder="ระบุเหตุผล..."
                              className="w-full p-2 text-xs rounded-lg bg-slate-50 border-none focus:ring-1 focus:ring-violet-500"
                              value={attendance[emp.id]?.reason || ''}
                              onChange={e => updateAttendance(emp.id, 'อื่นๆ', e.target.value)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              {editingGroup && (
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={() => {
                    setEditingGroup(null);
                    setHeaderData({ type: 'กิจกรรม', title: '', date: new Date().toISOString().split('T')[0] });
                    setAttendance(employees.reduce((acc, emp) => ({ ...acc, [emp.id]: { status: 'เข้าร่วม', reason: '' } }), {}));
                  }}
                  className="px-8 bg-black/5 text-black/50 py-4 rounded-xl font-bold hover:bg-black/10 transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
              )}
              <button 
                type="submit" 
                disabled={isSaving}
                className="bg-violet-600 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-violet-700 transition-shadow shadow-lg shadow-violet-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  editingGroup ? <ShieldCheck size={20} /> : <Plus size={20} />
                )} 
                {isSaving ? 'กำลังบันทึก...' : (editingGroup ? 'บันทึกการแก้ไข' : `บันทึกกิจกรรมทั้งหมด (${employees.length} คน)`)}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Search size={20} className="text-violet-600" />
            <h3 className="text-xl font-bold">ประวัติกิจกรรมล่าสุด</h3>
          </div>
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
            <input 
              type="text"
              placeholder="ค้นหาตามชื่อกิจกรรม, วันที่ หรือชื่อพนักงาน..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-black/5 text-sm focus:ring-2 focus:ring-violet-500 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4">
          {records.filter(r => r.type === 'กิจกรรม').length === 0 ? (
            <div className="p-10 text-center opacity-30 italic">ยังไม่มีข้อมูลกิจกรรม</div>
          ) : (
            Object.entries(
              records.filter(r => r.type === 'กิจกรรม').reduce((acc, r) => {
                const key = `${r.date}_${r.type}_${r.title}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(r);
                return acc;
              }, {} as { [key: string]: ActivityRecord[] })
            ).filter(([key, group]) => {
              if (!searchTerm.trim()) return true;
              const term = searchTerm.toLowerCase();
              const hasEmployee = group.some(r => {
                const emp = employees.find(e => e.id === r.employeeId);
                return emp?.name.toLowerCase().includes(term);
              });
              return key.toLowerCase().includes(term) || hasEmployee;
            }).reverse().map(([key, group]) => (
              <div key={key} className="bg-white p-6 rounded-2xl border border-black/5 space-y-4 group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-violet-600">{group[0].type}</span>
                      <span className="text-xs opacity-50">• {group[0].date}</span>
                    </div>
                    <h4 className="font-bold">{group[0].title}</h4>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2 text-xs font-bold">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg">เข้าร่วม: {group.filter(r => r.status === 'เข้าร่วม').length}</span>
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg">อื่นๆ: {group.filter(r => r.status === 'อื่นๆ').length}</span>
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg">ไม่เข้าร่วม: {group.filter(r => r.status === 'ไม่เข้าร่วม').length}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(group)} className="p-2 hover:bg-violet-50 text-violet-600 rounded-lg transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => setDeleteConfirmGroup(group[0])} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {group.map(r => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    return (
                      <div key={r.id} className={`p-2 rounded-lg text-[10px] flex flex-col gap-1 ${
                        r.status === 'เข้าร่วม' ? 'bg-green-50 text-green-800' : 
                        r.status === 'ไม่เข้าร่วม' ? 'bg-red-50 text-red-800' : 
                        r.status === 'อื่นๆ' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="truncate font-bold">{emp?.name}</span>
                          <span className="shrink-0 ml-1">
                            {r.status === 'เข้าร่วม' ? '✓' : r.status === 'ไม่เข้าร่วม' ? '✗' : r.status === 'อื่นๆ' ? '◌' : '?'}
                          </span>
                        </div>
                        {r.status === 'อื่นๆ' && r.reason && (
                          <div className="text-[8px] opacity-70 italic border-t border-gray-200 mt-1 pt-1 truncate">
                            {r.reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LeaveSection({ employees, records, onAdd, onUpdate, onDelete, onDeleteAll, isAdmin, setToast }: { employees: Employee[], records: LeaveRecord[], onAdd: (r: any) => Promise<void>, onUpdate: (id: string, r: any) => Promise<void>, onDelete: (id: string) => Promise<void>, onDeleteAll: () => Promise<void>, isAdmin: boolean, setToast: (t: any) => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState<string | null>(null); // employeeId being saved
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ empId: number, type: string } | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const sortedHistory = useMemo(() => {
    return [...records].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [records]);

  const filteredHistory = useMemo(() => {
    return sortedHistory.filter(r => {
      // Exclude 'ราชการ' and only include types that are currently active
      if (r.type === 'ราชการ' as any) return false;
      
      const emp = employees.find(e => e.id === r.employeeId);
      const searchMatch = emp?.name.toLowerCase().includes(historySearch.toLowerCase()) || 
                         r.type.toLowerCase().includes(historySearch.toLowerCase());
      return searchMatch;
    }).slice(0, 30);
  }, [sortedHistory, employees, historySearch]);

  // Daily attendance for selected date
  const dailyAttendance = useMemo(() => {
    return employees.reduce((acc, emp) => {
      const record = records.find(r => r.employeeId === emp.id && r.startDate === selectedDate);
      acc[emp.id] = record || null;
      return acc;
    }, {} as { [key: number]: LeaveRecord | null });
  }, [employees, records, selectedDate]);

  const handleStatusChange = async (empId: number, type: typeof LEAVE_TYPES[number]) => {
    if (!isAdmin) return;

    if (confirmAction?.empId !== empId || confirmAction?.type !== type) {
      setConfirmAction({ empId, type });
      // Auto clear confirmation after 3 seconds
      setTimeout(() => {
        setConfirmAction(prev => (prev?.empId === empId && prev?.type === type) ? null : prev);
      }, 3000);
      return;
    }

    setConfirmAction(null);
    setIsSaving(empId.toString());
    
    try {
      const existingRecord = records.find(r => r.employeeId === empId && r.startDate === selectedDate);
      
      const recordData = {
        employeeId: empId,
        type,
        startDate: selectedDate,
        endDate: selectedDate,
        duration: '1 วัน',
        reason: type,
        lateDates: type === 'มาสาย' ? [selectedDate] : []
      };

      if (existingRecord) {
        if (existingRecord.type === type) {
          // Toggle off if same type is clicked
          await onDelete(existingRecord.id);
          setToast({ message: `ลบสถานะ ${type} ของพนักงานแล้ว`, type: 'success' });
          return;
        }
        await onUpdate(existingRecord.id, recordData);
        setToast({ message: `เปลี่ยนสถานะเป็น ${type} แล้ว`, type: 'success' });
      } else {
        await onAdd(recordData);
        setToast({ message: `บันทึกสถานะ ${type} แล้ว`, type: 'success' });
      }
    } catch (err: any) {
      console.error("Attendance change error:", err);
      setToast({ message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล", type: 'error' });
    } finally {
      setIsSaving(null);
    }
  };

  const handleDurationChange = async (empId: number, record: LeaveRecord, duration: string) => {
    if (!isAdmin) return;
    setIsSaving(empId.toString());
    try {
      const recordData = {
        employeeId: empId,
        type: record.type,
        startDate: record.startDate,
        endDate: record.endDate,
        duration: duration,
        reason: record.type,
        lateDates: record.type === 'มาสาย' ? [record.startDate] : []
      };
      await onUpdate(record.id, recordData);
      setToast({ message: `ปรับระยะเวลาลาเป็น ${duration === '1 วัน' ? 'เต็มวัน' : duration} สำเร็จ`, type: 'success' });
    } catch (err: any) {
      console.error("Change duration error:", err);
      setToast({ message: "เกิดข้อผิดพลาดในการเปลี่ยนระยะเวลา", type: 'error' });
    } finally {
      setIsSaving(null);
    }
  };

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'มาสาย': return <Clock size={16} />;
      case 'ลาป่วย': return <AlertCircle size={16} />;
      case 'ลากิจ': return <User size={16} />;
      default: return <Calendar size={16} />;
    }
  };

  const getStatusStyle = (type: string, active: boolean) => {
    if (!active) return "bg-slate-50 text-slate-400 hover:bg-slate-100";
    
    switch (type) {
      case 'มาสาย': return "bg-amber-50 text-amber-600 border-amber-100 ring-1 ring-amber-200";
      case 'ลาป่วย': return "bg-green-50 text-green-600 border-green-100 ring-1 ring-green-200";
      case 'ลากิจ': return "bg-green-50 text-green-600 border-green-100 ring-1 ring-green-200";
      default: return "bg-violet-50 text-violet-600";
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold serif">บันทึกวันหยุดวันลา / การมาทำงาน</h2>
          <p className="text-slate-500 text-xs mt-1">เลือกวันที่และระบุสถานะรายบุคคล (คลิกที่ปุ่มเพื่อบันทึก)</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
            <input 
              type="text"
              placeholder="ค้นหาชื่อพนักงาน..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-black/5 text-xs focus:ring-2 focus:ring-violet-500 transition-all font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="flex items-center gap-1">
                {confirmReset ? (
                  <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-xl border border-rose-200">
                    <button
                      onClick={() => {
                        onDeleteAll();
                        setConfirmReset(false);
                      }}
                      className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-bold rounded-lg hover:bg-rose-700 transition-colors cursor-pointer"
                    >
                      ยืนยันล้างข้อมูล
                    </button>
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="px-3 py-1.5 bg-white text-rose-600 text-[10px] font-bold rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-xl transition-all shadow-lg shadow-rose-200 cursor-pointer shrink-0"
                  >
                    <Trash2 size={18} />
                    <span className="text-xs font-bold whitespace-nowrap">ล้างข้อมูลทั้งหมด</span>
                  </button>
                )}
              </div>
            )}
            <div className="bg-white p-1 rounded-xl border border-black/5 flex items-center gap-2 pr-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white shrink-0">
                <Calendar size={16} />
              </div>
              <input 
                type="date"
                className="border-none focus:ring-0 font-bold text-xs bg-transparent p-0"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-2">
        {filteredEmployees.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl text-center border border-dashed border-slate-200">
            <p className="text-slate-400 text-sm italic">ไม่พบรายชื่อพนักงานที่ค้นหา</p>
          </div>
        ) : (
          filteredEmployees.map(emp => {
            const currentRecord = dailyAttendance[emp.id];
            const isActive = isSaving === emp.id.toString();

            return (
              <motion.div 
                layout
                key={emp.id} 
                className={`bg-white p-3 md:p-4 rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4 ${isActive ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-base relative shrink-0">
                    {emp.name.charAt(0)}
                    {currentRecord?.type === 'มาปกติ' && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center border-2 border-white">
                        <Check size={10} strokeWidth={4} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{emp.name}</h4>
                    <p className="text-[10px] text-slate-400">{emp.position}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0 items-end">
                  <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                    {LEAVE_TYPES.map(type => {
                      const isSelected = currentRecord?.type === type;
                      const isConfirming = confirmAction?.empId === emp.id && confirmAction?.type === type;
                      
                      return (
                        <button
                          key={type}
                          onClick={() => handleStatusChange(emp.id, type)}
                          className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${isConfirming ? 'bg-orange-500 text-white ring-2 ring-orange-200' : getStatusStyle(type, isSelected)}`}
                          disabled={!isAdmin || isActive}
                        >
                          {isConfirming ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 size={12} className="text-white" />
                              <span className="whitespace-nowrap">คลิกยืนยัน</span>
                            </div>
                          ) : (
                            <>
                              {getStatusIcon(type)}
                              <span>{type}</span>
                            </>
                          )}
                          {isSelected && !isConfirming && (
                            <motion.div 
                              layoutId={`active-dot-${emp.id}`}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-white border-2 border-green-500 rounded-full flex items-center justify-center z-10"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                            >
                              <Check size={10} className="text-green-500" strokeWidth={4} />
                            </motion.div>
                          )}
                        </button>
                      );
                    })}
                    
                    {currentRecord && isAdmin && (
                      <button
                        onClick={() => handleStatusChange(emp.id, currentRecord.type)}
                        className="w-8 h-8 rounded-xl border border-rose-100 text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                        title="ลบข้อมูลการมาทำงานของวันนี้"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Duration Selector for leave types */}
                  {currentRecord && (currentRecord.type === 'ลาป่วย' || currentRecord.type === 'ลากิจ') && isAdmin && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 p-1 rounded-xl"
                    >
                      <span className="text-[10px] text-slate-500 px-1.5 font-bold">ระยะเวลาลา:</span>
                      <button
                        onClick={() => handleDurationChange(emp.id, currentRecord, '1 วัน')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${currentRecord.duration === '1 วัน' ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/10' : 'bg-white hover:bg-slate-100 text-slate-600'}`}
                      >
                        เต็มวัน
                      </button>
                      <button
                        onClick={() => handleDurationChange(emp.id, currentRecord, 'ครึ่งวัน (เช้า)')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${currentRecord.duration === 'ครึ่งวัน (เช้า)' ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/10' : 'bg-white hover:bg-slate-100 text-slate-600'}`}
                      >
                        ครึ่งวันเช้า
                      </button>
                      <button
                        onClick={() => handleDurationChange(emp.id, currentRecord, 'ครึ่งวัน (บ่าย)')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${currentRecord.duration === 'ครึ่งวัน (บ่าย)' ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/10' : 'bg-white hover:bg-slate-100 text-slate-600'}`}
                      >
                        ครึ่งวันบ่าย
                      </button>
                    </motion.div>
                  )}

                  {/* Read-only duration indicator if not admin */}
                  {currentRecord && (currentRecord.type === 'ลาป่วย' || currentRecord.type === 'ลากิจ') && !isAdmin && (
                    <div className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-bold">
                      ระยะเวลา: {currentRecord.duration === '1 วัน' ? 'เต็มวัน' : currentRecord.duration === 'ครึ่งวัน (เช้า)' ? 'ครึ่งวันเช้า' : 'ครึ่งวันบ่าย'}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="bg-violet-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-lg font-bold">สรุปสถานะประจำวันที่ {new Date(selectedDate).toLocaleDateString('th-TH', { dateStyle: 'full' })}</h3>
            <p className="opacity-60 text-[10px]">ตรวจสอบความถูกต้องของการลงบันทึกในวันนี้</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: 'มาสาย', color: 'bg-amber-400', count: (Object.values(dailyAttendance) as (LeaveRecord | null)[]).filter(r => r?.type === 'มาสาย').length },
              { label: 'ลากิจ', color: 'bg-green-400', count: (Object.values(dailyAttendance) as (LeaveRecord | null)[]).filter(r => r?.type === 'ลากิจ').length },
              { label: 'ลาป่วย', color: 'bg-green-400', count: (Object.values(dailyAttendance) as (LeaveRecord | null)[]).filter(r => r?.type === 'ลาป่วย').length },
            ].map(stat => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${stat.color}`} />
                <span className="text-[10px] font-medium opacity-80">{stat.label}</span>
                <span className="text-sm font-bold">{stat.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recording History Section */}
      <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-black/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">ประวัติการลงบันทึกข้อมูล (ล่าสุด 30 รายการ)</h3>
            <p className="text-slate-400 text-xs">ค้นหาเพื่อแก้ไขหรือลบข้อมูลที่ระบุผิดพลาด</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
            <input 
              type="text"
              placeholder="ค้นหาชื่อ หรือประเภท..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border-none text-xs focus:ring-2 focus:ring-violet-500 font-medium"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-black/5">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">วันที่</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">ประเภท</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-xs italic">ไม่พบประวัติการลงบันทึก</td>
                </tr>
              ) : (
                filteredHistory.map(record => {
                  const emp = employees.find(e => e.id === record.employeeId);
                  if (!emp) return null;
                  
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-600">
                          {new Date(record.startDate).toLocaleDateString('th-TH', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: '2-digit' 
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{emp.name}</span>
                          <span className="text-[10px] text-slate-400">{emp.position}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            record.type === 'มาสาย' ? 'bg-amber-100 text-amber-600' :
                            'bg-green-100 text-green-600'
                          }`}>
                            {getStatusIcon(record.type)}
                            {record.type}
                          </span>
                          {record.type !== 'มาสาย' && record.duration && (
                            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                              {record.duration === '1 วัน' ? 'เต็มวัน' : record.duration === 'ครึ่งวัน (เช้า)' ? 'ครึ่งวันเช้า' : record.duration === 'ครึ่งวัน (บ่าย)' ? 'ครึ่งวันบ่าย' : record.duration}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-2">
                            {deleteConfirmId === record.id ? (
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => {
                                    onDelete(record.id);
                                    setToast({ message: 'ลบข้อมูลเรียบร้อยแล้ว', type: 'success' });
                                    setDeleteConfirmId(null);
                                  }}
                                  className="px-2 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-lg"
                                >
                                  ยืนยันลบ
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setDeleteConfirmId(record.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportSection({ 
  state, 
  setToast 
}: { 
  state: AppState; 
  setToast: (toast: { message: string, type: 'success' | 'error' } | null) => void;
}) {
  const [filterType, setFilterType] = useState<'day' | 'month' | 'range' | 'year' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rangeStart, setRangeStart] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [rangeEnd, setRangeEnd] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [reportTab, setReportTab] = useState<'individual' | 'external'>('individual');

  // Print states
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [isPrintViewMode, setIsPrintViewMode] = useState(false);

  // Signatures State
  const [recorderName, setRecorderName] = useState(() => localStorage.getItem('sig_recorder_name') || '');
  const [recorderPosition, setRecorderPosition] = useState(() => localStorage.getItem('sig_recorder_position') || '');
  
  const [checkerName, setCheckerName] = useState(() => localStorage.getItem('sig_checker_name') || '');
  const [checkerPosition, setCheckerPosition] = useState(() => localStorage.getItem('sig_checker_position') || '');
  
  const [approverName, setApproverName] = useState(() => localStorage.getItem('sig_approver_name') || '');
  const [approverPosition, setApproverPosition] = useState(() => localStorage.getItem('sig_approver_position') || '');

  const [isInIframe, setIsInIframe] = useState(false);
  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  useEffect(() => {
    localStorage.setItem('sig_recorder_name', recorderName);
    localStorage.setItem('sig_recorder_position', recorderPosition);
    localStorage.setItem('sig_checker_name', checkerName);
    localStorage.setItem('sig_checker_position', checkerPosition);
    localStorage.setItem('sig_approver_name', approverName);
    localStorage.setItem('sig_approver_position', approverPosition);
  }, [recorderName, recorderPosition, checkerName, checkerPosition, approverName, approverPosition]);

  // State to hold the filters that are currently showing in the UI
  const [activeFilter, setActiveFilter] = useState({
    type: filterType,
    selectedDate,
    rangeStart,
    rangeEnd
  });

  // Sync activeFilter with initial state or when state data changes if needed
  // However, usually it's better to just update it on button click or mount
  const handleApplyFilter = () => {
    setActiveFilter({
      type: filterType,
      selectedDate,
      rangeStart,
      rangeEnd
    });
  };

  const filteredData = useMemo(() => {
    const { type, selectedDate: selDate, rangeStart: rs, rangeEnd: re } = activeFilter;
    const d = new Date(selDate);
    const targetDay = d.getDate();
    const targetMonth = d.getMonth();
    const targetYear = d.getFullYear();

    const isMatch = (dateStr: string) => {
      if (type === 'all') return true;
      if (!dateStr) return false;

      const recMonth = dateStr.substring(0, 7); // Get "YYYY-MM" from "YYYY-MM-DD"
      
      if (type === 'range') {
        return recMonth >= rs && recMonth <= re;
      }

      const recordDate = new Date(dateStr);
      const recYear = recordDate.getFullYear();
      const recMonthIdx = recordDate.getMonth();

      if (type === 'year') return recYear === targetYear;
      if (type === 'month') return recYear === targetYear && recMonthIdx === targetMonth;
      if (type === 'day') return recYear === targetYear && recMonthIdx === targetMonth && recordDate.getDate() === targetDay;
      
      return true;
    };

    return {
      innovations: state.innovationRecords.filter(r => isMatch(r.date)),
      activities: state.activityRecords.filter(r => isMatch(r.date)),
      leaves: state.leaveRecords.filter(r => (isMatch(r.startDate) || isMatch(r.endDate)) && r.type !== 'ราชการ' as any),
    };
  }, [state.innovationRecords, state.activityRecords, state.leaveRecords, activeFilter]);

  const innovationSummary = useMemo(() => {
    return state.employees.map(emp => {
      const records = filteredData.innovations.filter(r => 
        r.employeeId === emp.id || (r.participants && r.participants.includes(emp.id))
      );
      const innovation = records.filter(r => r.type === 'นวัตกรรม').length;
      const kmOpl = records.filter(r => r.type === 'KM' && r.kmSubtype === 'OPL').length;
      const kmOpk = records.filter(r => r.type === 'KM' && r.kmSubtype === 'OPK').length;
      const creativity = records.filter(r => r.type === 'ความคิดสร้างสรรค์').length;
      return { ...emp, innovation, kmOpl, kmOpk, creativity, total: records.length };
    });
  }, [filteredData.innovations, state.employees]);

  const activitySummary = useMemo(() => {
    const internalActivities = filteredData.activities.filter(r => r.type === 'กิจกรรม');
    const externalActivities = filteredData.activities.filter(r => r.type === 'กิจกรรมภายนอก');

    const uniqueInternalCount = Array.from(new Set(internalActivities.map(r => `${r.date}|${r.title}`))).length;
    const uniqueExternalCount = Array.from(new Set(externalActivities.map(r => `${r.date}|${r.title}`))).length;

    return state.employees.map(emp => {
      const records = filteredData.activities.filter(r => 
        (r.employeeId === emp.id && (r.status === 'เข้าร่วม' || r.status === 'อื่นๆ')) ||
        (r.status === 'สลับคู่' && r.swapWithId === emp.id)
      );
      const activityCount = records.filter(r => r.type === 'กิจกรรม').length;
      const externalCount = records.filter(r => r.type === 'กิจกรรมภายนอก').length;
      
      const activityPercentage = uniqueInternalCount > 0 ? Math.round((activityCount / uniqueInternalCount) * 100) : 0;
      const externalPercentage = uniqueExternalCount > 0 ? Math.round((externalCount / uniqueExternalCount) * 100) : 0;
      
      return { 
        ...emp, 
        activity: activityCount, 
        external: externalCount, 
        activityPercentage,
        externalPercentage
      };
    });
  }, [filteredData.activities, state.employees]);

  const leaveSummary = useMemo(() => {
    const getDays = (durationStr: string) => {
      if (!durationStr) return 0;
      if (durationStr.includes('ครึ่งวัน')) return 0.5;
      const match = durationStr.match(/(\d+(\.\d+)?)/);
      return match ? parseFloat(match[1]) : 1;
    };

    return state.employees.map(emp => {
      const records = filteredData.leaves.filter(r => r.employeeId === emp.id);
      
      const sumDays = (type: string) => 
        records.filter(r => r.type === type)
          .reduce((sum, r) => sum + getDays(r.duration), 0);

      const sick = sumDays('ลาป่วย');
      const business = sumDays('ลากิจ');
      const late = sumDays('มาสาย');
      
      return { ...emp, sick, business, late, total: sick + business + late };
    });
  }, [filteredData.leaves, state.employees]);

  const groupActivitySummary = useMemo(() => {
    const externalActivities = filteredData.activities.filter(r => r.type === 'กิจกรรมภายนอก');
    
    const calculateGroup = (groupName: 'A' | 'B') => {
      const groupMembers = state.employees.filter(e => (e.group === groupName || e.group === 'Both') && e.id !== 1);
      const memberIds = new Set(groupMembers.map(e => e.id));
      
      const groupRecords = externalActivities.filter(r => memberIds.has(r.employeeId));
      
      // Total unique activity events where at least one member of this group was assigned
      const uniqueActivitiesCount = new Set(groupRecords.map(r => `${r.date}|${r.title}`)).size;
      
      // Total participations by members of this group
      const participations = groupRecords.filter(r => r.status === 'เข้าร่วม' || r.status === 'อื่นๆ').length;
      
      // The denominator should be the actual records count (assignments) for this group
      const totalAssignments = groupRecords.length;
      const percentage = totalAssignments > 0 ? Math.round((participations / totalAssignments) * 100) : 0;
      
      return {
        groupName,
        uniqueActivitiesCount,
        participations,
        totalAssignments,
        memberCount: groupMembers.length,
        percentage
      };
    };

    return {
      A: calculateGroup('A'),
      B: calculateGroup('B')
    };
  }, [filteredData.activities, state.employees]);


  const comprehensiveSummary = useMemo(() => {
    return state.employees.map(emp => {
      const innov = innovationSummary.find(s => s.id === emp.id);
      const active = activitySummary.find(s => s.id === emp.id);
      const leave = leaveSummary.find(s => s.id === emp.id);
      return {
        ...emp,
        innovation: innov?.innovation || 0,
        kmOpl: innov?.kmOpl || 0,
        kmOpk: innov?.kmOpk || 0,
        creativity: innov?.creativity || 0,
        activity: active?.activity || 0,
        activityPercentage: active?.activityPercentage || 0,
        external: active?.external || 0,
        externalPercentage: active?.externalPercentage || 0,
        sick: leave?.sick || 0,
        business: leave?.business || 0,
        late: leave?.late || 0
      };
    });
  }, [innovationSummary, activitySummary, leaveSummary, state.employees]);

  const totalInnovations = filteredData.innovations.length;
  const totalActivitiesJoined = filteredData.activities.filter(r => r.status === 'เข้าร่วม' || r.status === 'อื่นๆ' || r.status === 'สลับคู่').length;
  const totalLeaves = filteredData.leaves.length;

  const exportComprehensive = () => {
    const data = comprehensiveSummary.map(s => ({
      'ชื่อ-นามสกุล': s.name,
      'ตำแหน่ง': s.position,
      'นวัตกรรม': s.innovation,
      'KM (OPL)': s.kmOpl,
      'KM (OPK)': s.kmOpk,
      'ความคิดสร้างสรรค์': s.creativity,
      'กิจกรรมภายใน': s.activity,
      '% ภายใน': s.activityPercentage + '%',
      'ลาป่วย': s.sick,
      'ลากิจ': s.business,
      'มาสาย': s.late
    }));
    exportToCSV(data, `สรุปรายบุคคล_${filterType}_${new Date().toLocaleDateString()}`);
  };

  if (isPrintViewMode) {
    return (
      <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-md z-[9990] flex flex-col overflow-y-auto bg-slate-100 print:static print:bg-white print:p-0">
        {/* Print Style Tag inside Print View */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page {
              size: landscape;
              margin: 15mm;
            }
            body {
              background-color: white !important;
              color: black !important;
            }
            .overflow-x-auto, .overflow-y-auto {
              overflow: visible !important;
              max-height: none !important;
            }
            .sticky {
              position: static !important;
              background-color: transparent !important;
            }
            .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl, .shadow-2xl {
              box-shadow: none !important;
            }
            tr {
              page-break-inside: avoid !important;
            }
          }
        `}} />

        {/* Sticky Header inside Print View */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-950 text-white py-4 px-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl z-[9999] print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold">
              <FileText size={20} />
            </div>
            <div className="text-left">
              <h3 className="font-black text-sm text-white">มุมมองพรีวิวตัวอย่างก่อนพิมพ์ (Print Preview Mode)</h3>
              <p className="text-[10px] text-slate-300">ตารางรายงานสรุปถูกจัดหน้าแบบแนวนอน (Landscape) เพื่อความสวยงามสูงสุด</p>
            </div>
          </div>
          <div className="flex gap-2 items-center shrink-0 flex-wrap">
            {isInIframe && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-500/20"
              >
                <ExternalLink size={14} /> เปิดระบบในแท็บใหม่เพื่อพิมพ์ (แนะนำ 👍)
              </a>
            )}
            <button
              onClick={() => {
                if (isInIframe) {
                  alert("⚠️ ไม่สามารถพิมพ์จากตรงนี้ได้ เนื่องจากเบราว์เซอร์บล็อกคำสั่งพิมพ์ภายใต้หน้าต่างย่อย (iFrame)\n\nกรุณาคลิกปุ่ม 'เปิดระบบในแท็บใหม่' สีน้ำเงินด้านข้าง เพื่อไปสั่งพิมพ์อย่างถูกต้อง 100% ในแท็บใหม่นะคะ");
                } else {
                  window.print();
                }
              }}
              className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <FileText size={14} /> สั่งพิมพ์ด้วยเบราว์เซอร์ / บันทึก PDF
            </button>
            <button
              onClick={() => setIsPrintViewMode(false)}
              className="bg-white/10 hover:bg-white/20 active:scale-95 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <X size={14} /> ออกจากหน้าพรีวิว
            </button>
          </div>
        </div>

        {/* The Content itself */}
        <div className="flex-1 p-6 md:p-12 w-full max-w-[1200px] mx-auto print:p-0 print:max-w-none">
          {isInIframe && (
            <div className="mb-6 p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 text-amber-800 shadow-sm print:hidden">
              <div className="flex gap-3 text-left">
                <AlertCircle size={24} className="shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-amber-900">⚠️ ตรวจพบระบบทำงานภายใต้หน้าต่างจำลอง (iFrame Sandbox)</h4>
                  <p className="text-xs leading-relaxed opacity-95 font-medium text-amber-800">
                    เบราว์เซอร์ปกติจะบล็อกการกดดาวน์โหลด PDF และการสั่งพิมพ์ผ่านหน้าต่างย่อยนี้ กรุณากดเปิดระบบในแท็บใหม่ด้านขวานี้เพื่อแก้ไข และพิมพ์รายงานได้สำเร็จราบรื่น 100% ทันทีค่ะ ข้อมูลของท่านจะไม่หายแน่นอนค่ะ!
                  </p>
                </div>
              </div>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-600/10 animate-pulse"
              >
                <ExternalLink size={14} /> เปิดระบบในแท็บใหม่ (พิมพ์ได้ 100%)
              </a>
            </div>
          )}
          <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/50 shadow-xl space-y-8 print:border-none print:shadow-none print:p-0">
            {/* Print & PDF Title Header Block */}
            <div className="text-center space-y-3 pb-6 border-b border-black/10">
              <h1 className="text-2xl font-black text-black">รายงานสรุปสถิติผลการปฏิบัติงาน</h1>
              <p className="text-sm font-bold text-slate-700">
                {reportTab === 'individual' ? 'ตารางสรุปสถิติจำแนกรายบุคคล' : 'วิเคราะห์กิจกรรมภายนอกแยกตามกลุ่ม'}
              </p>
              <p className="text-xs font-medium text-slate-500">
                ช่วงสถิติที่เลือก: {
                  activeFilter.type === 'all' ? 'ข้อมูลทั้งหมดที่มีในระบบ' :
                  activeFilter.type === 'day' ? `สถิติรายวัน ประจำวันที่ ${new Date(activeFilter.selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}` :
                  activeFilter.type === 'month' ? `สถิติรายเดือน ประจำเดือน ${new Date(activeFilter.selectedDate).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}` :
                  activeFilter.type === 'range' ? `สถิติช่วงรายเดือน ตั้งแต่ ${activeFilter.rangeStart} ถึง ${activeFilter.rangeEnd}` :
                  `สถิติรายปี ประจำปี พ.ศ. ${new Date(activeFilter.selectedDate).getFullYear() + 543}`
                }
              </p>
            </div>

            {reportTab === 'individual' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 print:hidden">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
                    <Users size={20} />
                  </div>
                  <h3 className="text-xl font-bold">ตารางสรุปสถิติจำแนกรายบุคคล</h3>
                </div>
                
                <div className="bg-white rounded-3xl border border-black/5 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead>
                        <tr className="bg-black/5">
                          <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 sticky left-0 bg-black/10 z-20" rowSpan={2}>ชื่อ-นามสกุล</th>
                          <th className="p-2 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center border-l border-black/5" colSpan={4}>งานนวัตกรรม / KM</th>
                          <th className="p-2 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center border-l border-black/5" colSpan={2}>กิจกรรม</th>
                          <th className="p-2 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center border-l border-black/5 font-bold text-slate-600" colSpan={3}>วันหยุดวันลา / มาสาย</th>
                        </tr>
                        <tr className="bg-black/5">
                          <th className="px-2 py-3 text-[9px] font-bold uppercase text-center border-l border-black/5 bg-black/[0.02]">นวัตกรรม</th>
                          <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-black/[0.02]">OPL</th>
                          <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-black/[0.02]">OPK</th>
                          <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-black/[0.02]">ความคิดสร้างสรรค์</th>
                          
                          <th className="px-2 py-3 text-[9px] font-bold uppercase text-center border-l border-black/5 bg-blue-50/30">ภายใน</th>
                          <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-blue-50/30 font-bold text-blue-600">%</th>
                          
                          <th className="px-2 py-3 text-[9px] font-bold uppercase text-center border-l border-black/5 text-green-600 bg-green-50/30">ลาป่วย</th>
                          <th className="px-2 py-3 text-[9px] font-bold uppercase text-center text-green-600 bg-green-50/30">ลากิจ</th>
                          <th className="px-2 py-3 text-[9px] font-bold uppercase text-center text-red-600 bg-red-50/30">มาสาย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comprehensiveSummary.map(row => (
                          <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.01] transition-colors">
                            <td className="p-4 font-bold text-sm sticky left-0 bg-white z-10 border-r border-black/5">{row.name}</td>
                            
                            <td className="p-2 text-center text-sm border-l border-black/5">{row.innovation || '-'}</td>
                            <td className="p-2 text-center text-sm">{row.kmOpl || '-'}</td>
                            <td className="p-2 text-center text-sm">{row.kmOpk || '-'}</td>
                            <td className="p-2 text-center text-sm">{row.creativity || '-'}</td>
                            
                            <td className="p-2 text-center text-sm border-l border-black/5 font-medium">{row.activity || '-'}</td>
                            <td className="p-2 text-center text-sm font-bold bg-blue-50/10 text-blue-600">{row.activityPercentage || 0}%</td>
                            
                            <td className="p-2 text-center text-sm border-l border-black/5 text-green-600 font-medium">{row.sick || '-'}</td>
                            <td className="p-2 text-center text-sm text-green-600 font-medium">{row.business || '-'}</td>
                            <td className="p-2 text-center text-sm text-red-600 font-medium">{row.late || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3 print:hidden">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                    <ShieldCheckIcon size={20} />
                  </div>
                  <h3 className="text-xl font-bold">วิเคราะห์กิจกรรมภายนอกแยกตามกลุ่ม</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Table Group A */}
                  <div className="bg-white rounded-3xl border border-black/5 overflow-hidden flex flex-col">
                    <div className="p-4 bg-violet-600 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield size={18} />
                        <h4 className="font-bold">สรุปรายบุคคล กลุ่ม A</h4>
                      </div>
                      <span className="text-[10px] font-bold opacity-75">กิจกรรมภายนอก</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</th>
                            <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">เข้าร่วม</th>
                            <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comprehensiveSummary
                            .filter(emp => (emp.group === 'A' || emp.group === 'Both') && emp.id !== 1)
                            .map(row => (
                            <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.01] transition-colors">
                              <td className="p-3 font-bold text-sm">{row.name}</td>
                              <td className="p-3 text-center text-sm font-medium">{row.external || '-'}</td>
                              <td className="p-3 text-center text-sm font-black text-violet-600 bg-violet-50/30">{row.externalPercentage || 0}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table Group B */}
                  <div className="bg-white rounded-3xl border border-black/5 overflow-hidden flex flex-col">
                    <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheckIcon size={18} />
                        <h4 className="font-bold">สรุปรายบุคคล กลุ่ม B</h4>
                      </div>
                      <span className="text-[10px] font-bold opacity-75">กิจกรรมภายนอก</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</th>
                            <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">เข้าร่วม</th>
                            <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comprehensiveSummary
                            .filter(emp => (emp.group === 'B' || emp.group === 'Both') && emp.id !== 1)
                            .map(row => (
                            <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.01] transition-colors">
                              <td className="p-3 font-bold text-sm">{row.name}</td>
                              <td className="p-3 text-center text-sm font-medium">{row.external || '-'}</td>
                              <td className="p-3 text-center text-sm font-black text-blue-600 bg-blue-50/30">{row.externalPercentage || 0}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Signature Block */}
            <div className="pt-8 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                {/* Recorder Column */}
                <div className="flex flex-col items-center justify-between min-h-[140px] space-y-4">
                  <div className="text-sm font-bold text-slate-600">
                    ลงชื่อ.......................................................... ผู้บันทึกข้อมูล
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-slate-800">
                      ( {recorderName ? recorderName : '..........................................................'} )
                    </span>
                    <span className="text-xs text-slate-500 font-medium mt-1">
                      ตำแหน่ง {recorderPosition ? recorderPosition : '..........................................................'}
                    </span>
                  </div>
                </div>

                {/* Checker Column */}
                <div className="flex flex-col items-center justify-between min-h-[140px] space-y-4">
                  <div className="text-sm font-bold text-slate-600">
                    ลงชื่อ.......................................................... ผู้ตรวจสอบ
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-slate-800">
                      ( {checkerName ? checkerName : '..........................................................'} )
                    </span>
                    <span className="text-xs text-slate-500 font-medium mt-1">
                      ตำแหน่ง {checkerPosition ? checkerPosition : '..........................................................'}
                    </span>
                  </div>
                </div>

                {/* Approver Column */}
                <div className="flex flex-col items-center justify-between min-h-[140px] space-y-4">
                  <div className="text-sm font-bold text-slate-600">
                    ลงชื่อ.......................................................... ผู้บังคับบัญชาหน่วยงาน
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-slate-800">
                      ( {approverName ? approverName : '..........................................................'} )
                    </span>
                    <span className="text-xs text-slate-500 font-medium mt-1">
                      ตำแหน่ง {approverPosition ? approverPosition : '..........................................................'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">

      {/* Embedded CSS Style Tag for flawless Print/PDF layout */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: landscape;
            margin: 15mm;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
          /* Ensure containers expand and do not clip or have scrolls */
          .overflow-x-auto, .overflow-y-auto {
            overflow: visible !important;
            max-height: none !important;
          }
          /* Ensure full width */
          .max-w-6xl {
            max-width: 100% !important;
            width: 100% !important;
            padding-bottom: 0 !important;
          }
          /* Disable sticky positioning so table columns align correctly in PDF */
          .sticky {
            position: static !important;
            background-color: transparent !important;
          }
          /* Remove interactive shadows */
          .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl, .shadow-2xl {
            box-shadow: none !important;
          }
          /* Prevent page breaks inside cards or tables if possible */
          tr {
            page-break-inside: avoid !important;
          }
        }

        /* High-quality rendering styles specifically for html2canvas to PDF */
        .pdf-generating {
          width: 1120px !important;
          max-width: 1120px !important;
          background-color: white !important;
          color: black !important;
          padding: 40px !important;
          border-radius: 0px !important;
          box-shadow: none !important;
        }
        .pdf-generating .overflow-x-auto {
          overflow: visible !important;
          max-height: none !important;
        }
        .pdf-generating .sticky {
          position: static !important;
          background-color: transparent !important;
        }
        .pdf-generating table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        .pdf-generating th {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
          font-weight: bold !important;
          border: 1px solid #cbd5e1 !important;
        }
        .pdf-generating td {
          border: 1px solid #e2e8f0 !important;
          background-color: white !important;
          color: #1e293b !important;
        }
        .pdf-generating .bg-white {
          background-color: white !important;
        }
        .pdf-generating .bg-slate-50 {
          background-color: #f8fafc !important;
        }
        .pdf-generating .shadow-sm {
          box-shadow: none !important;
        }
      `}} />

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-3xl font-bold serif">รายงานสรุปผล</h2>
          <div className="flex bg-white border border-black/5 rounded-xl p-1 mt-4 inline-flex">
            <button 
              onClick={() => setReportTab('individual')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${reportTab === 'individual' ? 'bg-violet-600 text-white shadow-sm' : 'hover:bg-black/5 opacity-50'}`}
            >
              สรุปรายบุคคล
            </button>
            <button 
              onClick={() => setReportTab('external')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${reportTab === 'external' ? 'bg-violet-600 text-white shadow-sm' : 'hover:bg-black/5 opacity-50'}`}
            >
              สรุปกิจกรรมภายนอก
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase opacity-50">เลือกช่วงสถิติ</label>
            <div className="flex bg-white border border-black/5 rounded-xl p-1">
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'day', label: 'รายวัน' },
                { id: 'month', label: 'รายเดือน' },
                { id: 'range', label: 'ช่วงรายเดือน' },
                { id: 'year', label: 'รายปี' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterType === f.id ? 'bg-violet-600 text-white shadow-sm' : 'hover:bg-black/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filterType === 'range' ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase opacity-50">ตั้งแต่เดือน</label>
                <input 
                  type="month"
                  className="px-4 py-2 rounded-xl bg-white border border-black/5 text-xs font-bold focus:ring-2 focus:ring-violet-500"
                  value={rangeStart}
                  onChange={e => setRangeStart(e.target.value)}
                />
              </div>
              <div className="mt-4 opacity-30">—</div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase opacity-50">ถึงเดือน</label>
                <input 
                  type="month"
                  className="px-4 py-2 rounded-xl bg-white border border-black/5 text-xs font-bold focus:ring-2 focus:ring-violet-500"
                  value={rangeEnd}
                  onChange={e => setRangeEnd(e.target.value)}
                />
              </div>
            </div>
          ) : filterType !== 'all' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase opacity-50">
                {filterType === 'day' ? 'เลือกวันที่' : filterType === 'month' ? 'เลือกเดือน/ปี' : 'เลือกปี'}
              </label>
              <input 
                type={filterType === 'day' ? 'date' : filterType === 'month' ? 'month' : 'number'}
                min={filterType === 'year' ? '2020' : undefined}
                max={filterType === 'year' ? '2100' : undefined}
                className="px-4 py-2 rounded-xl bg-white border border-black/5 text-xs font-bold focus:ring-2 focus:ring-violet-500 min-w-[150px]"
                value={filterType === 'year' ? new Date(selectedDate).getFullYear() : (filterType === 'month' ? selectedDate.substring(0, 7) : selectedDate)}
                onChange={e => {
                  if (filterType === 'year') {
                    const year = e.target.value;
                    setSelectedDate(`${year}-01-01`);
                  } else if (filterType === 'month') {
                    setSelectedDate(`${e.target.value}-01`);
                  } else {
                    setSelectedDate(e.target.value);
                  }
                }}
              />
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={handleApplyFilter} 
              className="bg-white text-violet-600 border-2 border-violet-600 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-violet-50 transition-all flex items-center gap-2"
            >
              <Search size={16} /> ประมวลผลข้อมูล
            </button>
            <button onClick={exportComprehensive} className="bg-violet-600/10 text-violet-700 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-violet-100 transition-all flex items-center gap-2">
              <Download size={16} /> ส่งออกข้อมูลสรุป (CSV)
            </button>
            <button 
              onClick={() => {
                if (isInIframe) {
                  setShowPrintOptions(true);
                } else {
                  setIsPrintViewMode(true);
                }
              }} 
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
            >
              <Printer size={16} /> พิมพ์รายงานสรุป
            </button>
          </div>
        </div>
      </header>


      <div id="report-pdf-content" className="space-y-8 p-1">
        {/* Print Title Header Block */}
        <div className="hidden print:block text-center space-y-3 pb-6 border-b border-black/10">
          <h1 className="text-2xl font-black text-black">รายงานสรุปสถิติผลการปฏิบัติงาน</h1>
          <p className="text-sm font-bold text-slate-700">
            {reportTab === 'individual' ? 'ตารางสรุปสถิติจำแนกรายบุคคล' : 'วิเคราะห์กิจกรรมภายนอกแยกตามกลุ่ม'}
          </p>
          <p className="text-xs font-medium text-slate-500">
            ช่วงสถิติที่เลือก: {
              activeFilter.type === 'all' ? 'ข้อมูลทั้งหมดที่มีในระบบ' :
              activeFilter.type === 'day' ? `สถิติรายวัน ประจำวันที่ ${new Date(activeFilter.selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}` :
              activeFilter.type === 'month' ? `สถิติรายเดือน ประจำเดือน ${new Date(activeFilter.selectedDate).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}` :
              activeFilter.type === 'range' ? `สถิติช่วงรายเดือน ตั้งแต่ ${activeFilter.rangeStart} ถึง ${activeFilter.rangeEnd}` :
              `สถิติรายปี ประจำปี พ.ศ. ${new Date(activeFilter.selectedDate).getFullYear() + 543}`
            }
          </p>
        </div>

      <AnimatePresence mode="wait">
        {reportTab === 'individual' ? (
          <motion.section 
            key="individual"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
                <Users size={20} />
              </div>
              <h3 className="text-xl font-bold">ตารางสรุปสถิติจำแนกรายบุคคล</h3>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-black/5">
                      <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 sticky left-0 bg-black/10 z-20" rowSpan={2}>ชื่อ-นามสกุล</th>
                      <th className="p-2 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center border-l border-black/5" colSpan={4}>งานนวัตกรรม / KM</th>
                      <th className="p-2 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center border-l border-black/5" colSpan={2}>กิจกรรม</th>
                      <th className="p-2 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center border-l border-black/5 font-bold text-slate-600" colSpan={3}>วันหยุดวันลา / มาสาย</th>
                    </tr>
                    <tr className="bg-black/5">
                      <th className="px-2 py-3 text-[9px] font-bold uppercase text-center border-l border-black/5 bg-black/[0.02]">นวัตกรรม</th>
                      <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-black/[0.02]">OPL</th>
                      <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-black/[0.02]">OPK</th>
                      <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-black/[0.02]">ความคิดสร้างสรรค์</th>
                      
                      <th className="px-2 py-3 text-[9px] font-bold uppercase text-center border-l border-black/5 bg-blue-50/30">ภายใน</th>
                      <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-blue-50/30 font-bold text-blue-600">%</th>
                      
                      <th className="px-2 py-3 text-[9px] font-bold uppercase text-center border-l border-black/5 text-green-600 bg-green-50/30">ลาป่วย</th>
                      <th className="px-2 py-3 text-[9px] font-bold uppercase text-center text-green-600 bg-green-50/30">ลากิจ</th>
                      <th className="px-2 py-3 text-[9px] font-bold uppercase text-center text-red-600 bg-red-50/30">มาสาย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comprehensiveSummary.map(row => (
                      <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.01] transition-colors">
                        <td className="p-4 font-bold text-sm sticky left-0 bg-white z-10 border-r border-black/5">{row.name}</td>
                        
                        <td className="p-2 text-center text-sm border-l border-black/5">{row.innovation || '-'}</td>
                        <td className="p-2 text-center text-sm">{row.kmOpl || '-'}</td>
                        <td className="p-2 text-center text-sm">{row.kmOpk || '-'}</td>
                        <td className="p-2 text-center text-sm">{row.creativity || '-'}</td>
                        
                        <td className="p-2 text-center text-sm border-l border-black/5 font-medium">{row.activity || '-'}</td>
                        <td className="p-2 text-center text-sm font-bold bg-blue-50/10 text-blue-600">{row.activityPercentage || 0}%</td>
                        
                        <td className="p-2 text-center text-sm border-l border-black/5 text-green-600 font-medium">{row.sick || '-'}</td>
                        <td className="p-2 text-center text-sm text-green-600 font-medium">{row.business || '-'}</td>
                        <td className="p-2 text-center text-sm text-red-600 font-medium">{row.late || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.section 
            key="external"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <ShieldCheckIcon size={20} />
              </div>
              <h3 className="text-xl font-bold">วิเคราะห์กิจกรรมภายนอกแยกตามกลุ่ม</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Table Group A */}
              <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden flex flex-col">
                <div className="p-4 bg-violet-600 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={18} />
                    <h4 className="font-bold">สรุปรายบุคคล กลุ่ม A</h4>
                  </div>
                  <span className="text-[10px] font-bold opacity-75">กิจกรรมภายนอก</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</th>
                        <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">เข้าร่วม</th>
                        <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comprehensiveSummary
                        .filter(emp => (emp.group === 'A' || emp.group === 'Both') && emp.id !== 1)
                        .map(row => (
                        <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.01] transition-colors">
                          <td className="p-3 font-bold text-sm">{row.name}</td>
                          <td className="p-3 text-center text-sm font-medium">{row.external || '-'}</td>
                          <td className="p-3 text-center text-sm font-black text-violet-600 bg-violet-50/30">{row.externalPercentage || 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table Group B */}
              <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden flex flex-col">
                <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheckIcon size={18} />
                    <h4 className="font-bold">สรุปรายบุคคล กลุ่ม B</h4>
                  </div>
                  <span className="text-[10px] font-bold opacity-75">กิจกรรมภายนอก</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</th>
                        <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">เข้าร่วม</th>
                        <th className="p-3 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comprehensiveSummary
                        .filter(emp => (emp.group === 'B' || emp.group === 'Both') && emp.id !== 1)
                        .map(row => (
                        <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.01] transition-colors">
                          <td className="p-3 font-bold text-sm">{row.name}</td>
                          <td className="p-3 text-center text-sm font-medium">{row.external || '-'}</td>
                          <td className="p-3 text-center text-sm font-black text-blue-600 bg-blue-50/30">{row.externalPercentage || 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </motion.section>
        )}
      </AnimatePresence>

      {/* Signature Configuration Inputs */}
      <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm space-y-4 print:hidden">
        <div className="flex items-center gap-2 pb-2 border-b border-black/5">
          <FileText size={18} className="text-violet-600" />
          <h3 className="text-sm font-bold">กรอกข้อมูลผู้ลงนามท้ายรายงาน</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recorder */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <label className="text-xs font-bold text-violet-700 block">1. ผู้บันทึกข้อมูล</label>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ชื่อ-นามสกุล</label>
              <input 
                type="text" 
                placeholder="เช่น นายสมชาย ดีใจ" 
                value={recorderName} 
                onChange={e => setRecorderName(e.target.value)} 
                className="w-full mt-1 px-3 py-2 bg-white border border-black/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตำแหน่ง</label>
              <input 
                type="text" 
                placeholder="เช่น วิศวกรระดับ 6" 
                value={recorderPosition} 
                onChange={e => setRecorderPosition(e.target.value)} 
                className="w-full mt-1 px-3 py-2 bg-white border border-black/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          
          {/* Checker */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <label className="text-xs font-bold text-violet-700 block">2. ผู้ตรวจสอบ</label>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ชื่อ-นามสกุล</label>
              <input 
                type="text" 
                placeholder="เช่น นางสาวรักเรียน วงศ์ดี" 
                value={checkerName} 
                onChange={e => setCheckerName(e.target.value)} 
                className="w-full mt-1 px-3 py-2 bg-white border border-black/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตำแหน่ง</label>
              <input 
                type="text" 
                placeholder="เช่น หัวหน้าแผนกบริการลูกค้า" 
                value={checkerPosition} 
                onChange={e => setCheckerPosition(e.target.value)} 
                className="w-full mt-1 px-3 py-2 bg-white border border-black/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {/* Approver */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <label className="text-xs font-bold text-violet-700 block">3. ผู้บังคับบัญชาหน่วยงาน</label>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ชื่อ-นามสกุล</label>
              <input 
                type="text" 
                placeholder="เช่น นายพีระศักดิ์ ยิ่งใหญ่" 
                value={approverName} 
                onChange={e => setApproverName(e.target.value)} 
                className="w-full mt-1 px-3 py-2 bg-white border border-black/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตำแหน่ง</label>
              <input 
                type="text" 
                placeholder="เช่น ผู้จัดการไฟฟ้าอำเภอทับสะแก" 
                value={approverPosition} 
                onChange={e => setApproverPosition(e.target.value)} 
                className="w-full mt-1 px-3 py-2 bg-white border border-black/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Beautiful Signature Boxes for Screen Preview & Printing */}
      <div className="bg-white rounded-3xl p-8 border border-black/5 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0 print:mt-12">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-black/5 print:hidden">
          ตัวอย่างส่วนลงชื่อท้ายรายงาน
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center pt-4">
          {/* Recorder Column */}
          <div className="flex flex-col items-center justify-between min-h-[140px] space-y-4">
            <div className="text-sm font-bold text-slate-600">
              ลงชื่อ.......................................................... ผู้บันทึกข้อมูล
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-slate-800">
                ( {recorderName ? recorderName : '..........................................................'} )
              </span>
              <span className="text-xs text-slate-500 font-medium mt-1">
                ตำแหน่ง {recorderPosition ? recorderPosition : '..........................................................'}
              </span>
            </div>
          </div>

          {/* Checker Column */}
          <div className="flex flex-col items-center justify-between min-h-[140px] space-y-4">
            <div className="text-sm font-bold text-slate-600">
              ลงชื่อ.......................................................... ผู้ตรวจสอบ
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-slate-800">
                ( {checkerName ? checkerName : '..........................................................'} )
              </span>
              <span className="text-xs text-slate-500 font-medium mt-1">
                ตำแหน่ง {checkerPosition ? checkerPosition : '..........................................................'}
              </span>
            </div>
          </div>

          {/* Approver Column */}
          <div className="flex flex-col items-center justify-between min-h-[140px] space-y-4">
            <div className="text-sm font-bold text-slate-600">
              ลงชื่อ.......................................................... ผู้บังคับบัญชาหน่วยงาน
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-slate-800">
                ( {approverName ? approverName : '..........................................................'} )
              </span>
              <span className="text-xs text-slate-500 font-medium mt-1">
                ตำแหน่ง {approverPosition ? approverPosition : '..........................................................'}
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Modal Selection for Print and PDF Options */}
      {/* Modal Selection for Print Options */}
      <AnimatePresence>
        {showPrintOptions && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-black/5"
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                    <Printer size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">เตรียมพิมพ์รายงานสรุป</h3>
                    <p className="text-[10px] text-white/70">สำหรับรายงานสถิติผลการปฏิบัติงาน</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPrintOptions(false)} 
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {isInIframe ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3 text-amber-800">
                      <AlertCircle size={24} className="shrink-0 mt-0.5 text-amber-600" />
                      <div className="space-y-1">
                        <p className="text-xs font-black text-amber-900">⚠️ พบข้อจำกัดของหน้าต่างจำลอง (iFrame Sandbox)</p>
                        <p className="text-[11px] leading-relaxed opacity-90 font-medium text-amber-700">
                          ขณะนี้หน้าต่างระบบกำลังแสดงผลภายใต้ iFrame จำลองของ Google AI Studio ซึ่งเบราว์เซอร์จะบล็อกคำสั่งพิมพ์ไว้โดยอัตโนมัติค่ะ เพื่อให้ท่านสั่งพิมพ์รายงานเป็นรูปเล่มได้อย่างถูกต้องสมบูรณ์แบบ 100% กรุณาเปิดแอปในแท็บเต็มจอด้านล่างนี้นะคะ ข้อมูลงานของท่านจะอยู่ครบแน่นอนค่ะ!
                        </p>
                      </div>
                    </div>

                    <div className="p-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-lg animate-pulse">
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowPrintOptions(false)}
                        className="w-full text-left p-4 rounded-[14px] bg-white hover:bg-slate-50 transition-all flex items-start gap-4 group cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                          <ExternalLink size={20} />
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">วิธีที่ถูกต้อง 💡</span>
                          </div>
                          <p className="text-sm font-black text-slate-800 group-hover:text-blue-700 transition-colors">
                            คลิกเปิดหน้าแอปในแท็บใหม่เต็มจอ (สำคัญมาก)
                          </p>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            ระบบจะเปิดหน้านี้ในแท็บแยกใหม่ทันที โดยที่ข้อมูลทั้งหมดจะยังอยู่ครบ เพื่อให้ท่านสั่งพิมพ์หรือพรีวิวก่อนพิมพ์ได้ตามใจชอบโดยไม่มีสิ่งกีดขวางค่ะ
                          </p>
                        </div>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex gap-3 text-emerald-800">
                    <CheckCircle2 size={20} className="shrink-0 mt-0.5 text-emerald-600" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-emerald-900">เปิดแอปเต็มจอเรียบร้อยแล้ว ✨</p>
                      <p className="text-[11px] leading-relaxed opacity-95 font-medium text-emerald-700">
                        พร้อมทำงานร่วมกับเครื่องพิมพ์เต็มที่ สามารถเข้าสู่โหมดเตรียมพิมพ์และกดสั่งพิมพ์ได้อย่างราบรื่น 100% เลยค่ะ
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                    เลือกดำเนินการ:
                  </div>

                  {/* Option 1: Print View Mode (Overlay) */}
                  <button
                    onClick={() => {
                      if (isInIframe) {
                        alert("⚠️ แนะนำให้ท่านกดปุ่มสีน้ำเงิน 'เปิดหน้าแอปในแท็บใหม่เต็มจอ' ด้านบนสุดก่อนนะคะ เพื่อระบบสามารถพิมพ์เอกสารได้สำเร็จอย่างสมบูรณ์โดยไม่ถูกระบบจำลองบล็อกคำสั่งค่ะ");
                      } else {
                        setShowPrintOptions(false);
                        setIsPrintViewMode(true);
                      }
                    }}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-4 group cursor-pointer ${
                      isInIframe 
                        ? 'border-slate-100 bg-slate-50/50 opacity-75 hover:border-amber-300 hover:bg-amber-50/20' 
                        : 'border-emerald-100 hover:border-emerald-600 hover:bg-emerald-50/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                      isInIframe 
                        ? 'bg-slate-200 text-slate-500 group-hover:bg-amber-500 group-hover:text-white' 
                        : 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
                    }`}>
                      <Eye size={20} />
                    </div>
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors flex items-center gap-2">
                        <span>เปิดโหมดเตรียมพิมพ์ / พรีวิวรายงานสรุป (แนวนอน Landscape)</span>
                        {isInIframe && <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">เปิดในแท็บใหม่เท่านั้น</span>}
                      </p>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        เปิดแสดงหน้าพรีวิวจัดตารางแนวนอนที่สวยงามและเป็นระเบียบ พร้อมปุ่มพิมพ์เอกสารและบันทึกข้อมูลของท่านอย่างเรียบร้อย
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowPrintOptions(false)}
                  className="px-5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </div>
  );
}
function AdminSection({ 
  admins, 
  employees,
  currentUser, 
  onAddAdmin, 
  onUpdatePassword, 
  onDeleteAdmin,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  setToast
}: { 
  admins: Admin[], 
  employees: Employee[],
  currentUser: Admin | null, 
  onAddAdmin: (a: Admin) => Promise<boolean>, 
  onUpdatePassword: (id: string, pass: string) => Promise<void>, 
  onDeleteAdmin: (id: string) => Promise<void>,
  onAddEmployee: (e: any) => Promise<void>,
  onUpdateEmployee: (id: number, e: any) => Promise<void>,
  onDeleteEmployee: (id: number) => Promise<void>,
  setToast: (t: any) => void
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ id: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [showChangePass, setShowChangePass] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Employee Management State
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [newEmployee, setNewEmployee] = useState({ id: 0, name: '', position: '' });
  const [deleteEmployeeConfirmId, setDeleteEmployeeConfirmId] = useState<number | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const success = await onAddAdmin(newAdmin);
      if (success) {
        setNewAdmin({ id: '', password: '', name: '' });
        setShowAdd(false);
        setError('');
        setToast({ message: 'เพิ่มแอดมินสำเร็จ', type: 'success' });
      } else {
        setError('ชื่อผู้ใช้นี้เป็นแอดมินอยู่แล้ว');
      }
    } catch (err) {
      console.error("Add admin error:", err);
      setToast({ message: "เกิดข้อผิดพลาดในการเพิ่มแอดมิน", type: 'error' });
    }
  };

  const handleChangePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser && newPass) {
      try {
        await onUpdatePassword(currentUser.id, newPass);
        setNewPass('');
        setShowChangePass(false);
        setToast({ message: 'เปลี่ยนรหัสผ่านสำเร็จ', type: 'success' });
      } catch (err) {
        console.error("Change pass error:", err);
        setToast({ message: "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน", type: 'error' });
      }
    }
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await onUpdateEmployee(editingEmployee.id, newEmployee);
        setEditingEmployee(null);
        setToast({ message: 'แก้ไขข้อมูลพนักงานสำเร็จ', type: 'success' });
      } else {
        await onAddEmployee(newEmployee);
        setToast({ message: 'เพิ่มพนักงานสำเร็จ', type: 'success' });
      }
      setNewEmployee({ id: 0, name: '', position: '' });
      setShowAddEmployee(false);
    } catch (err) {
      console.error("Employee submit error:", err);
      setToast({ message: "เกิดข้อผิดพลาดในการบันทึกข้อมูลพนักงาน", type: 'error' });
    }
  };

  const startEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setNewEmployee(emp);
    setShowAddEmployee(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <ConfirmDialog 
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && onDeleteAdmin(deleteConfirmId)}
        title="ยืนยันการลบแอดมิน"
        message="คุณแน่ใจหรือไม่ว่าต้องการลบสิทธิ์แอดมินของบุคคลนี้?"
      />

      <ConfirmDialog 
        isOpen={!!deleteEmployeeConfirmId}
        onClose={() => setDeleteEmployeeConfirmId(null)}
        onConfirm={() => deleteEmployeeConfirmId && onDeleteEmployee(deleteEmployeeConfirmId)}
        title="ยืนยันการลบพนักงาน"
        message="คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลพนักงานคนนี้? ข้อมูลที่เกี่ยวข้องอาจได้รับผลกระทบ"
      />

      <section className="space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold serif">จัดการแอดมิน</h2>
            <p className="text-[#1A1A1A]/50">จัดการสิทธิ์ผู้ดูแลระบบและแอดมินสำรอง</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={async () => {
                try {
                  const batch = writeBatch(db);
                  EMPLOYEES.forEach(emp => {
                    batch.set(doc(db, 'employees', emp.id.toString()), emp);
                  });
                  await batch.commit();
                  setToast({ message: 'คืนค่าข้อมูลพนักงานทั้งหมดสำเร็จ', type: 'success' });
                } catch (err) {
                  setToast({ message: 'เกิดข้อผิดพลาดในการคืนค่าข้อมูล', type: 'error' });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 text-green-600 border border-green-100 text-sm font-bold hover:bg-green-100 transition-colors"
            >
              <RefreshCw size={16} /> คืนค่ารายชื่อพนักงานทั้งหมด
            </button>
            <button 
              onClick={() => setShowChangePass(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-black/5 text-sm font-bold hover:bg-black/5 transition-colors"
            >
              <Unlock size={16} /> เปลี่ยนรหัสผ่านตัวเอง
            </button>
            <button 
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors"
            >
              <Plus size={16} /> เพิ่มแอดมินสำรอง
            </button>
          </div>
        </header>

        <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/5">
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50">สถานะ</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(admin => (
                <tr key={admin.id} className="border-b border-black/5">
                  <td className="p-4 font-bold text-sm">{admin.name}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${admin.id === '9012844' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {admin.id === '9012844' ? 'แอดมินหลัก' : 'แอดมินสำรอง'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {admin.id !== '9012844' && admin.id !== currentUser?.id && (
                      <button 
                        onClick={() => setDeleteConfirmId(admin.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold serif">จัดการพนักงาน</h2>
            <p className="text-[#1A1A1A]/50">เพิ่ม แก้ไข หรือลบรายชื่อพนักงานในระบบ</p>
          </div>
          <button 
            onClick={() => {
              setEditingEmployee(null);
              setNewEmployee({ id: employees.length > 0 ? Math.max(...employees.map(e => e.id)) + 1 : 1, name: '', position: '' });
              setShowAddEmployee(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors"
          >
            <Plus size={16} /> เพิ่มพนักงาน
          </button>
        </header>

        <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/5">
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50">ตำแหน่ง</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className="border-b border-black/5 hover:bg-black/[0.01]">
                  <td className="p-4 font-bold text-sm">{emp.name}</td>
                  <td className="p-4 text-sm opacity-60">{emp.position}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => startEditEmployee(emp)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Plus size={18} className="rotate-45" />
                      </button>
                      <button 
                        onClick={() => setDeleteEmployeeConfirmId(emp.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showChangePass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <h3 className="text-xl font-bold">เปลี่ยนรหัสผ่าน</h3>
              <form onSubmit={handleChangePass} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">รหัสผ่านใหม่</label>
                  <input 
                    type="password"
                    required
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowChangePass(false)} className="flex-1 p-3 rounded-xl font-bold bg-black/5">ยกเลิก</button>
                  <button type="submit" className="flex-1 p-3 rounded-xl font-bold bg-violet-600 text-white">บันทึก</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Admin Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <h3 className="text-xl font-bold">เพิ่มแอดมินสำรอง</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อผู้ใช้ (Login ID)</label>
                  <input 
                    type="text"
                    required
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    value={newAdmin.id}
                    onChange={e => setNewAdmin({ ...newAdmin, id: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</label>
                  <input 
                    type="text"
                    required
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    value={newAdmin.name}
                    onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">รหัสผ่านเริ่มต้น</label>
                  <input 
                    type="password"
                    required
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    value={newAdmin.password}
                    onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  />
                </div>
                {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 p-3 rounded-xl font-bold bg-black/5">ยกเลิก</button>
                  <button type="submit" className="flex-1 p-3 rounded-xl font-bold bg-violet-600 text-white">เพิ่มแอดมิน</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Employee Modal */}
      <AnimatePresence>
        {showAddEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <h3 className="text-xl font-bold">{editingEmployee ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}</h3>
              <form onSubmit={handleEmployeeSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</label>
                  <input 
                    type="text"
                    required
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    value={newEmployee.name}
                    onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">ตำแหน่ง</label>
                  <input 
                    type="text"
                    required
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    value={newEmployee.position}
                    onChange={e => setNewEmployee({ ...newEmployee, position: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">กลุ่มกิจกรรมภายนอก</label>
                  <select 
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    value={newEmployee.group || ''}
                    onChange={e => setNewEmployee({ ...newEmployee, group: e.target.value as any })}
                  >
                    <option value="">ไม่ระบุ</option>
                    <option value="A">กลุ่ม A</option>
                    <option value="B">กลุ่ม B</option>
                    <option value="Both">ทั้งกลุ่ม A และ B</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowAddEmployee(false)} className="flex-1 p-3 rounded-xl font-bold bg-black/5">ยกเลิก</button>
                  <button type="submit" className="flex-1 p-3 rounded-xl font-bold bg-violet-600 text-white">
                    {editingEmployee ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
