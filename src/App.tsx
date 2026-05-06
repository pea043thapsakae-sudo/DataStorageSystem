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
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EMPLOYEES, INNOVATION_TYPES, KM_SUBTYPES, ACTIVITY_TYPES, LEAVE_TYPES, LEAVE_DURATIONS } from './constants';
import { AppState, InnovationRecord, ActivityRecord, LeaveRecord, Admin, Employee } from './types';
import imageCompression from 'browser-image-compression';
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
    
    // Normalize Thai numerals to Arabic numerals
    const normalize = (str: string) => str.replace(/[๐-๙]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0E50 + 48));
    
    const cleanUsername = normalize(username.trim());
    const cleanPassword = normalize(password.trim());
    
    // Hardcoded fallback for the primary admin
    const defaultAdmin = { id: '9012844', password: 'PEATSG043', name: 'แอดมินหลัก' };
    
    let admin = admins.find(a => a.id === cleanUsername && a.password === cleanPassword);
    
    if (!admin && cleanUsername === defaultAdmin.id && cleanPassword === defaultAdmin.password) {
      admin = defaultAdmin;
    }
    
    if (admin) {
      try {
        setIsLoggingIn(true);
        // Required for Firestore to work with standard secure rules
        await loginAnonymously();
        onLogin(admin);
        setUsername('');
        setPassword('');
        setError('');
        onClose();
      } catch (err: any) {
        console.error("Auth error:", err);
        setError('ไม่สามารถเปิดระบบบันทึกข้อมูลได้ (Auth Error). กรุณาเปิด "ไม่ระบุตัวตน (Anonymous)" ใน Firebase Console > Authentication > Sign-in method');
      }
    } else {
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    }
    setIsLoggingIn(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center mx-auto">
            <Lock size={32} />
          </div>
          <h3 className="text-2xl font-bold">เข้าสู่ระบบแอดมิน (v2)</h3>
          <p className="text-sm opacity-50">กรุณาเข้าสู่ระบบเพื่อจัดการข้อมูล (หากเข้าไม่ได้กรุณากด Refresh หน้าเว็บบราวเซอร์)</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Admin ID</label>
            <input 
              type="text"
              required
              placeholder="รหัสพนักงาน"
              className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={isLoggingIn}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">รหัสผ่าน</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                required
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500 pr-10"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoggingIn}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/20 hover:text-black/50"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
              <p className="text-xs text-red-500 font-bold text-center">{error}</p>
            </div>
          )}
          <div className="flex flex-col gap-3 pt-2">
            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full p-3 rounded-xl font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/20 disabled:opacity-50"
            >
              {isLoggingIn ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบแอดมิน'}
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isLoggingIn}
              className="w-full p-3 rounded-xl font-bold bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors disabled:opacity-50"
            >
              เข้าชมแบบผู้เยี่ยมชม (Visitor)
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isLoggingIn}
              className="w-full p-2 text-sm font-medium opacity-50 hover:opacity-100 transition-opacity"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'innovation' | 'activity' | 'external' | 'leave' | 'report' | 'admin'>('innovation');
  const [currentUser, setCurrentUser] = useState<Admin | null>(null);
  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser);
  const [showLogin, setShowLogin] = useState(false);
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
    setShowLogin(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold opacity-50">กำลังเชื่อมต่อฐานข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-[#1A1A1A] font-sans">
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
      <div className="flex flex-col md:flex-row min-h-screen">
        <nav className="w-full md:w-64 bg-white border-r border-black/5 p-6 flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white">
              <Users size={24} />
            </div>
              <div>
                <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
                  ระบบบันทึกข้อมูล
                  <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">v2.1</span>
                </h1>
                <p className="text-xs opacity-50 uppercase tracking-wider">Employee Records</p>
              </div>
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
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition-colors"
              >
                <Lock size={18} /> เข้าสู่ระบบแอดมิน
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
        <main className="flex-1 p-4 md:p-10 overflow-y-auto max-h-screen">
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
                  records={state.leaveRecords} 
                  onAdd={addLeave} 
                  onUpdate={updateLeave}
                  onDelete={(id) => deleteRecord('leaveRecords', id)}
                  isAdmin={isAdmin}
                  setToast={setToast}
                />
              </motion.div>
            )}
            {activeTab === 'report' && (
              <motion.div key="report" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <ReportSection state={state} />
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
    return employees.filter(emp => emp.group === activeGroup || emp.group === 'Both');
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
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg">เข้าร่วม: {group.filter(r => r.status === 'เข้าร่วม').length}</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg">สลับคู่: {group.filter(r => r.status === 'สลับคู่').length}</span>
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg">ไม่เข้าร่วม: {group.filter(r => r.status === 'ไม่เข้าร่วม').length}</span>
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
                  {group.map(r => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    const swapEmp = r.swapWithId ? employees.find(e => e.id === r.swapWithId) : null;
                    return (
                      <div key={r.id} className={`p-2 rounded-lg text-[10px] flex flex-col gap-1 ${
                        r.status === 'เข้าร่วม' ? 'bg-green-50 text-green-800' : 
                        r.status === 'ไม่เข้าร่วม' ? 'bg-red-50 text-red-800' : 
                        r.status === 'สลับคู่' ? 'bg-blue-50 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="truncate font-bold">{emp?.name}</span>
                          <span className="shrink-0 ml-1">
                            {r.status === 'เข้าร่วม' ? '✓' : r.status === 'ไม่เข้าร่วม' ? '✗' : r.status === 'สลับคู่' ? '⇄' : '?'}
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
                      <span className="text-green-600">✓ {group.filter(r => r.status === 'เข้าร่วม').length}</span>
                      <span className="text-red-600">✗ {group.filter(r => r.status === 'ไม่เข้าร่วม').length}</span>
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
                        r.status === 'ไม่เข้าร่วม' ? 'bg-red-50 text-red-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="truncate font-bold">{emp?.name}</span>
                          <span className="shrink-0 ml-1">
                            {r.status === 'เข้าร่วม' ? '✓' : r.status === 'ไม่เข้าร่วม' ? '✗' : '?'}
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

function LeaveSection({ employees, records, onAdd, onUpdate, onDelete, isAdmin, setToast }: { employees: Employee[], records: LeaveRecord[], onAdd: (r: any) => Promise<void>, onUpdate: (id: string, r: any) => Promise<void>, onDelete: (id: string) => Promise<void>, isAdmin: boolean, setToast: (t: any) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lateDates, setLateDates] = useState<string[]>([]);
  const [formData, setFormData] = useState({ 
    employeeId: employees[0]?.id || 1, 
    type: 'ลาป่วย' as any, 
    reason: '', 
    startDate: new Date().toISOString().split('T')[0], 
    endDate: new Date().toISOString().split('T')[0],
    duration: '1 วัน'
  });

  const handleAddLateDate = (date: string) => {
    if (date && !lateDates.includes(date)) {
      const newDates = [...lateDates, date].sort();
      setLateDates(newDates);
      setFormData(prev => ({ ...prev, duration: `${newDates.length} วัน` }));
    }
  };

  const handleRemoveLateDate = (index: number) => {
    const newDates = lateDates.filter((_, i) => i !== index);
    setLateDates(newDates);
    setFormData(prev => ({ ...prev, duration: `${newDates.length} วัน` }));
  };

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
    
    // Safety timeout
    const timeout = setTimeout(() => {
      setToast({ message: "การบันทึกอาจใช้เวลานานกว่าปกติ กรุณารอสักครู่...", type: 'info' });
    }, 15000);

    try {
      if (!auth.currentUser) {
        throw new Error(JSON.stringify({ 
          error: "Missing or insufficient permissions: Not logged in with Google",
          operationType: 'write',
          path: 'leaveRecords'
        }));
      }

      if (editingId) {
        const finalData = { ...formData, lateDates: formData.type === 'มาสาย' ? lateDates : [] } as any;
        if (formData.type === 'มาสาย' && lateDates.length > 0) {
          const sorted = [...lateDates].sort();
          finalData.startDate = sorted[0];
          finalData.endDate = sorted[sorted.length - 1];
          // Only append "มาสายวันที่" if it's not already there or if we want to refresh it
          const cleanReason = formData.reason.replace(/^มาสายวันที่: .*? - /, '').replace(/^มาสายวันที่: .*?$/, '');
          finalData.reason = `มาสายวันที่: ${lateDates.map(d => new Date(d).toLocaleDateString('th-TH')).join(', ')}${cleanReason ? ` - ${cleanReason}` : ''}`;
        }
        await onUpdate(editingId, finalData);
        setEditingId(null);
        setToast({ message: 'แก้ไขข้อมูลการลาสำเร็จ', type: 'success' });
      } else {
        const finalData = { ...formData, lateDates: formData.type === 'มาสาย' ? lateDates : [] } as any;
        if (formData.type === 'มาสาย' && lateDates.length > 0) {
          const sorted = [...lateDates].sort();
          finalData.startDate = sorted[0];
          finalData.endDate = sorted[sorted.length - 1];
          finalData.reason = `มาสายวันที่: ${lateDates.map(d => new Date(d).toLocaleDateString('th-TH')).join(', ')}${formData.reason ? ` - ${formData.reason}` : ''}`;
        }
        await onAdd(finalData);
        setToast({ message: 'บันทึกข้อมูลการลาสำเร็จ', type: 'success' });
      }
      setFormData({ 
        employeeId: employees[0]?.id || 1, 
        type: 'ลาป่วย', 
        reason: '', 
        startDate: new Date().toISOString().split('T')[0], 
        endDate: new Date().toISOString().split('T')[0],
        duration: '1 วัน'
      });
      setLateDates([]);
    } catch (err: any) {
      console.error("Leave submit error:", err);
      let msg = "เกิดข้อผิดพลาดในการบันทึกข้อมูลการลา กรุณาลองใหม่อีกครั้ง";
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

  const startEdit = (record: LeaveRecord) => {
    setEditingId(record.id);
    setFormData({
      employeeId: record.employeeId,
      type: record.type,
      reason: record.reason,
      startDate: record.startDate,
      endDate: record.endDate,
      duration: record.duration || '1 วัน'
    });
    setLateDates(record.lateDates || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ConfirmDialog 
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && onDelete(deleteConfirmId)}
        title="ยืนยันการลบข้อมูล"
        message="คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลการลานี้? การกระทำนี้ไม่สามารถย้อนกลับได้"
      />

      <header>
        <h2 className="text-3xl font-bold serif">{editingId ? 'แก้ไขข้อมูลวันหยุดวันลา' : 'วันหยุดวันลา'}</h2>
      </header>

      {isAdmin && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">พนักงาน</label>
              <select 
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                value={formData.employeeId}
                onChange={e => setFormData({ ...formData, employeeId: Number(e.target.value) })}
              >
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">ประเภทการลา / การมาสาย</label>
              <select 
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                value={formData.type}
                onChange={e => {
                  const newType = e.target.value as any;
                  setFormData({ ...formData, type: newType });
                  if (newType === 'มาสาย') {
                    setFormData(prev => ({ ...prev, duration: '0 วัน' }));
                  } else {
                    setFormData(prev => ({ ...prev, duration: '1 วัน' }));
                  }
                }}
              >
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {formData.type === 'มาสาย' ? (
              <div className="md:col-span-2 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 text-violet-600">กดเลือกวันที่มาสาย (ปี/เดือน/วัน)</label>
                  <div className="flex gap-2">
                    <input 
                      type="date"
                      className="flex-1 p-3 rounded-xl bg-slate-100 border-none focus:ring-2 focus:ring-violet-500"
                      onChange={e => handleAddLateDate(e.target.value)}
                      value=""
                    />
                    <div className="px-4 py-3 bg-violet-100 text-violet-700 rounded-xl font-bold">
                      รวม {lateDates.length} วัน
                    </div>
                  </div>
                </div>

                {lateDates.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    {lateDates.map((date, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg shadow-sm font-bold text-xs">
                        <span>{new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveLateDate(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Plus size={14} className="rotate-45" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50">ตั้งแต่วันที่</label>
                  <input 
                    type="date"
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50">ถึงวันที่</label>
                  <input 
                    type="date"
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50">ช่วงเวลา/จำนวนวัน</label>
                  <select 
                    className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                    value={formData.duration}
                    onChange={e => setFormData({ ...formData, duration: e.target.value })}
                  >
                    {LEAVE_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">เหตุผลเพิ่มเติม (ถ้ามี)</label>
              <textarea 
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500 min-h-[100px]"
                placeholder="ระบุรายละเอียดเพิ่มเติม..."
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>
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
                {isSaving ? 'กำลังบันทึก...' : (editingId ? 'บันทึกการแก้ไข' : 'บันทึกการลา')}
              </button>
              {editingId && (
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={() => {
                    setEditingId(null);
                    setLateDates([]);
                    setFormData({ 
                      employeeId: employees[0]?.id || 1, 
                      type: 'ลาป่วย', 
                      reason: '', 
                      startDate: new Date().toISOString().split('T')[0], 
                      endDate: new Date().toISOString().split('T')[0],
                      duration: '1 วัน'
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
            <h3 className="text-xl font-bold">ประวัติการลา</h3>
          </div>
          <div className="flex-1 max-w-md relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
            <input 
              type="text"
              placeholder="ค้นหาชื่อพนักงาน หรือเหตุผลการลา..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-black/5 text-sm focus:ring-2 focus:ring-violet-500 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4">
          {records.length === 0 ? (
            <div className="p-10 text-center opacity-30 italic">ยังไม่มีข้อมูลการลา</div>
          ) : (
            records.filter(r => {
              if (!searchTerm.trim()) return true;
              const term = searchTerm.toLowerCase();
              const emp = employees.find(e => e.id === r.employeeId);
              return (
                emp?.name.toLowerCase().includes(term) || 
                r.reason.toLowerCase().includes(term) || 
                r.type.toLowerCase().includes(term)
              );
            }).slice().reverse().map(record => {
              const emp = employees.find(e => e.id === record.employeeId);
              return (
                <div key={record.id} className="bg-white p-6 rounded-2xl border border-black/5 flex items-center justify-between group">
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          record.type === 'ลาป่วย' ? 'bg-red-100 text-red-700' :
                          record.type === 'ลากิจ' ? 'bg-orange-100 text-orange-700' :
                          record.type === 'มาสาย' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                        }`}>{record.type}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{record.duration || '1 วัน'}</span>
                        <span className="text-xs opacity-50">{record.startDate === record.endDate ? record.startDate : `${record.startDate} ถึง ${record.endDate}`}</span>
                      </div>
                      <h4 className="font-bold text-slate-900">{emp?.name || 'ไม่พบพนักงาน'}</h4>
                      {record.type === 'มาสาย' ? (
                        <p className="text-sm opacity-60 mt-0.5">
                          {record.reason && record.reason.startsWith('มาสายวันที่:') 
                            ? record.reason 
                            : `มาสายวันที่: ${record.startDate === record.endDate ? record.startDate : `${record.startDate} ถึง ${record.endDate}`}${record.reason ? ` - ${record.reason}` : ''}`
                          }
                        </p>
                      ) : (
                        record.reason && <p className="text-sm opacity-60 mt-0.5">{record.reason}</p>
                      )}
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

function ReportSection({ state }: { state: AppState }) {
  const [filterType, setFilterType] = useState<'day' | 'month' | 'range' | 'year' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rangeStart, setRangeStart] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [rangeEnd, setRangeEnd] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

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
      leaves: state.leaveRecords.filter(r => isMatch(r.startDate) || isMatch(r.endDate)),
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
      const official = sumDays('ราชการ');
      
      return { ...emp, sick, business, late, official, total: sick + business + late + official };
    });
  }, [filteredData.leaves, state.employees]);

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
        late: leave?.late || 0,
        official: leave?.official || 0
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
      'กิจกรรมภายนอก': s.external,
      '% ภายนอก': s.externalPercentage + '%',
      'ลาป่วย': s.sick,
      'ลากิจ': s.business,
      'มาสาย': s.late,
      'ราชการ': s.official
    }));
    exportToCSV(data, `สรุปรายบุคคล_${filterType}_${new Date().toLocaleDateString()}`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold serif">รายงานสรุปผล</h2>
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
          
          <div className="flex gap-2">
            <button 
              onClick={handleApplyFilter} 
              className="bg-white text-violet-600 border-2 border-violet-600 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-violet-50 transition-all flex items-center gap-2"
            >
              <Search size={16} /> ประมวลผลข้อมูล
            </button>
            <button onClick={exportComprehensive} className="bg-violet-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/20 flex items-center gap-2">
              <Download size={16} /> ส่งออกข้อมูลสรุป (CSV)
            </button>
          </div>
        </div>
      </header>

      <section className="space-y-4">
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
                  <th className="p-2 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center border-l border-black/5" colSpan={4}>กิจกรรม</th>
                  <th className="p-2 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center border-l border-black/5 font-bold text-red-600" colSpan={4}>วันหยุดวันลา / มาสาย</th>
                </tr>
                <tr className="bg-black/5">
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center border-l border-black/5 bg-black/[0.02]">นวัตกรรม</th>
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-black/[0.02]">OPL</th>
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-black/[0.02]">OPK</th>
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-black/[0.02]">ความคิดสร้างสรรค์</th>
                  
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center border-l border-black/5 bg-blue-50/30">ภายใน</th>
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-blue-50/30">%</th>
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-blue-50/30">ภายนอก</th>
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center bg-blue-50/30">%</th>
                  
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center border-l border-black/5 text-red-600 bg-red-50/30">ลาป่วย</th>
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center text-red-600 bg-red-50/30">ลากิจ</th>
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center text-red-600 bg-red-50/30">มาสาย</th>
                  <th className="px-2 py-3 text-[9px] font-bold uppercase text-center text-red-600 bg-red-50/30">ราชการ</th>
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
                    <td className="p-2 text-center text-sm font-medium bg-blue-50/10">{row.activityPercentage || 0}%</td>
                    <td className="p-2 text-center text-sm font-medium">{row.external || '-'}</td>
                    <td className="p-2 text-center text-sm font-medium bg-blue-50/10">{row.externalPercentage || 0}%</td>
                    
                    <td className="p-2 text-center text-sm border-l border-black/5 text-red-600 font-medium">{row.sick || '-'}</td>
                    <td className="p-2 text-center text-sm text-red-600 font-medium">{row.business || '-'}</td>
                    <td className="p-2 text-center text-sm text-red-600 font-medium">{row.late || '-'}</td>
                    <td className="p-2 text-center text-sm text-red-600 font-medium">{row.official || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
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
