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
  ShieldCheck as ShieldCheckIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EMPLOYEES, INNOVATION_TYPES, KM_SUBTYPES, ACTIVITY_TYPES, LEAVE_TYPES, LEAVE_DURATIONS } from './constants';
import { AppState, InnovationRecord, ActivityRecord, LeaveRecord, Admin, Employee } from './types';
import { db, auth, initAuth, handleFirestoreError, OperationType, storage, loginWithGoogle, loginAnonymously } from './firebase';
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

function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 ${
        type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
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

function LoginModal({ isOpen, onClose, onLogin, admins, setToast }: { isOpen: boolean, onClose: () => void, onLogin: (admin: Admin) => void, admins: Admin[], setToast: (t: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
      setToast({ message: 'เชื่อมต่อระบบฐานข้อมูลด้วย Google สำเร็จ', type: 'success' });
      // We don't call onLogin here because Google Login just satisfies the Firestore rules.
      // The user still needs to login with their Admin ID to see the Admin tab.
      // OR we could auto-login if their email matches an admin, but let's keep it simple.
    } catch (err) {
      console.error("Google login error:", err);
      setToast({ message: 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้', type: 'error' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginAnonymously();
      setToast({ message: 'เชื่อมต่อระบบฐานข้อมูลสำเร็จ', type: 'success' });
    } catch (err) {
      console.error("Anonymous login error:", err);
      setToast({ message: 'ไม่สามารถเชื่อมต่อระบบฐานข้อมูลได้ กรุณาใช้ Google Login แทน', type: 'error' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalize Thai numerals to Arabic numerals
    const normalize = (str: string) => str.replace(/[๐-๙]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0E50 + 48));
    
    const cleanUsername = normalize(username.trim());
    const cleanPassword = normalize(password.trim());
    
    // Hardcoded fallback for the primary admin to ensure access even if DB sync fails
    const defaultAdmin = { id: '9012844', password: 'PEATSG043', name: 'แอดมินหลัก' };
    
    let admin = admins.find(a => a.id === cleanUsername && a.password === cleanPassword);
    
    if (!admin && cleanUsername === defaultAdmin.id && cleanPassword === defaultAdmin.password) {
      admin = defaultAdmin;
    }
    
    if (admin) {
      onLogin(admin);
      setUsername('');
      setPassword('');
      setError('');
      onClose();
    } else {
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    }
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
          <h3 className="text-2xl font-bold">เข้าสู่ระบบแอดมิน</h3>
          <p className="text-sm opacity-50">กรุณาเข้าสู่ระบบเพื่อจัดการข้อมูล</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อผู้ใช้</label>
            <input 
              type="text"
              required
              placeholder="9012844"
              className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
              value={username}
              onChange={e => setUsername(e.target.value)}
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
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/20 hover:text-black/50"
              >
                {showPassword ? <ShieldCheck size={18} /> : <Lock size={18} />}
              </button>
            </div>
          </div>
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
              <p className="text-xs text-red-500 font-bold text-center">{error}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 p-3 rounded-xl font-bold bg-black/5 hover:bg-black/10 transition-colors">ยกเลิก</button>
            <button type="submit" className="flex-1 p-3 rounded-xl font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/20">เข้าสู่ระบบ</button>
          </div>
        </form>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/5"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold opacity-30"><span className="bg-white px-2">หรือแก้ปัญหาการบันทึก</span></div>
        </div>

        <div className="space-y-2">
          <button 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 p-3 rounded-xl border border-black/5 hover:bg-slate-50 transition-colors text-sm font-bold"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            เชื่อมต่อด้วย Google (แนะนำ)
          </button>
          <button 
            onClick={handleAnonymousLogin}
            disabled={isLoggingIn}
            className="w-full p-3 rounded-xl text-xs opacity-50 hover:opacity-100 transition-opacity"
          >
            ลองเชื่อมต่อแบบไม่ระบุตัวตนอีกครั้ง
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'innovation' | 'activity' | 'external' | 'leave' | 'report' | 'admin'>('innovation');
  const [currentUser, setCurrentUser] = useState<Admin | null>(null);
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
    initAuth().then(() => {
      setIsAuthReady(true);
    });
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (!isAuthReady) return;

    // Listen to collections that are public read
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const employees = snapshot.docs.map(doc => doc.data() as Employee).sort((a, b) => a.id - b.id);
      setState(prev => ({ ...prev, employees: employees.length > 0 ? employees : EMPLOYEES }));
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
    if (auth.currentUser) {
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
  }, [isAuthReady, auth.currentUser]);

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
              label="นวัตกรรม / KM"
            />
            <NavButton 
              active={activeTab === 'activity'} 
              onClick={() => setActiveTab('activity')}
              icon={<ShieldCheck size={20} />}
              label="กิจกรรม"
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
  const [formData, setFormData] = useState<{
    employeeId: number;
    participants: number[];
    type: 'นวัตกรรม' | 'KM';
    kmSubtype?: 'OPL' | 'OPK';
    contentId?: string;
    title: string;
    description: string;
    date: string;
  }>({ 
    employeeId: employees.length > 0 ? employees[0].id : 1, 
    participants: [],
    type: 'นวัตกรรม', 
    kmSubtype: 'OPL',
    contentId: '',
    title: '', 
    description: '', 
    date: new Date().toISOString().split('T')[0] 
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
    
    // Safety timeout
    const timeout = setTimeout(() => {
      if (isSaving) {
        setIsSaving(false);
        setToast({ message: "การบันทึกใช้เวลานานเกินไป กรุณาตรวจสอบอินเทอร์เน็ต", type: 'error' });
      }
    }, 15000);

    try {
      const dataToSave = { ...formData };
      if (dataToSave.type !== 'KM') {
        delete dataToSave.kmSubtype;
        delete dataToSave.contentId;
      }
      
      if (editingId) {
        await onUpdate(editingId, dataToSave);
        setEditingId(null);
        setToast({ message: 'แก้ไขข้อมูลสำเร็จ', type: 'success' });
      } else {
        await onAdd(dataToSave);
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
        date: new Date().toISOString().split('T')[0] 
      });
      // Show success feedback if needed, but usually the real-time sync is enough
    } catch (err) {
      console.error("Innovation submit error:", err);
      setToast({ 
        message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง", 
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
      date: record.date
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
        message="คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลการทำนวัตกรรม/KM นี้? การกระทำนี้ไม่สามารถย้อนกลับได้"
      />

      <header>
        <h2 className="text-3xl font-bold serif">{editingId ? 'แก้ไขข้อมูลนวัตกรรม / KM' : 'การทำนวัตกรรม / KM'}</h2>
        <p className="text-[#1A1A1A]/50">บันทึกความคิดสร้างสรรค์ OPL, OPK และการจัดการความรู้</p>
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
        <h3 className="text-xl font-bold">ประวัติการบันทึก</h3>
        <div className="grid gap-4">
          {records.length === 0 ? (
            <div className="p-10 text-center opacity-30 italic">ยังไม่มีข้อมูลบันทึก</div>
          ) : (
            records.slice().reverse().map(record => {
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
  const [headerData, setHeaderData] = useState({ 
    type: 'กิจกรรมภายนอก' as any, 
    title: '', 
    date: new Date().toISOString().split('T')[0] 
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const groupEmployees = useMemo(() => {
    return employees.filter(emp => emp.group === activeGroup || emp.group === 'Both');
  }, [activeGroup, employees]);

  const [attendance, setAttendance] = useState<{ [key: number]: { status: 'เข้าร่วม' | 'ไม่เข้าร่วม' | 'อื่นๆ', reason: string } }>(
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newFiles = [...imageFiles, ...files].slice(0, 3); // Limit to 3 images
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    
    // Safety timeout
    const timeout = setTimeout(() => {
      if (isUploading) {
        setIsUploading(false);
        setToast({ message: "การอัปโหลดใช้เวลานานเกินไป กรุณาตรวจสอบอินเทอร์เน็ต", type: 'error' });
      }
    }, 30000); // Longer for uploads

    try {
      let finalImageUrls = [...imageUrls.filter(url => url.startsWith('http'))];
      
      const newFilesToUpload = imageFiles.filter((_, i) => !imageUrls[i].startsWith('http'));

      if (newFilesToUpload.length > 0) {
        const uploadPromises = newFilesToUpload.map(async (file) => {
          const storageRef = ref(storage, `activities/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          return getDownloadURL(snapshot.ref);
        });
        const uploadedUrls = await Promise.all(uploadPromises);
        finalImageUrls = [...finalImageUrls, ...uploadedUrls];
      }

      const recordsToSave = groupEmployees.map(emp => ({
        employeeId: emp.id,
        type: headerData.type,
        title: headerData.title || headerData.type,
        date: headerData.date,
        status: attendance[emp.id]?.status || 'เข้าร่วม',
        reason: attendance[emp.id]?.reason || '',
        imageUrl: finalImageUrls[0] || '', // Keep for backward compatibility
        imageUrls: finalImageUrls
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
      setAttendance(employees.reduce((acc, emp) => ({ ...acc, [emp.id]: { status: 'เข้าร่วม', reason: '' } }), {}));
    } catch (err) {
      console.error("External activity submit error:", err);
      setToast({ 
        message: "เกิดข้อผิดพลาดในการบันทึกข้อมูลกิจกรรมภายนอก กรุณาลองใหม่อีกครั้ง", 
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
    setImageFiles([]); // Reset files as they are already uploaded
    
    // Determine which group this belongs to
    const groupIds = group.map(r => r.employeeId);
    const groupAIds = employees.filter(e => e.group === 'A' || e.group === 'Both').map(e => e.id);
    const groupBIds = employees.filter(e => e.group === 'B' || e.group === 'Both').map(e => e.id);
    
    if (groupIds.every(id => groupAIds.includes(id)) && groupIds.length === groupAIds.length) setActiveGroup('A');
    else if (groupIds.every(id => groupBIds.includes(id)) && groupIds.length === groupBIds.length) setActiveGroup('B');

    const newAttendance = { ...attendance };
    group.forEach(r => {
      newAttendance[r.employeeId] = { status: r.status, reason: r.reason || '' };
    });
    setAttendance(newAttendance);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateAttendance = (empId: number, status: 'เข้าร่วม' | 'ไม่เข้าร่วม' | 'อื่นๆ', reason?: string) => {
    setAttendance(prev => ({
      ...prev,
      [empId]: { ...prev[empId], status, reason: reason !== undefined ? reason : prev[empId].reason }
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
                <label className="text-xs font-bold uppercase tracking-widest opacity-50">รายละเอียดกิจกรรม</label>
                <input 
                  type="text"
                  placeholder="ระบุชื่อกิจกรรม..."
                  className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                  value={headerData.title}
                  onChange={e => setHeaderData({ ...headerData, title: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">รูปภาพการเข้าร่วมกิจกรรม (สูงสุด 3 รูป)</label>
              <div className="flex flex-wrap gap-4 items-start">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative group/img w-40 h-32 bg-slate-50 rounded-2xl border-2 border-dashed border-black/5 flex items-center justify-center overflow-hidden">
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
                  <div className="relative group/img w-40 h-32 bg-slate-50 rounded-2xl border-2 border-dashed border-black/5 flex items-center justify-center overflow-hidden hover:bg-black/5 transition-colors">
                    <div className="text-center p-4">
                      <Plus size={24} className="mx-auto opacity-20 mb-1" />
                      <p className="text-[10px] opacity-40">เพิ่มรูปภาพ</p>
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
                
                <div className="flex-1 min-w-[200px] text-[10px] opacity-40 space-y-1 py-2">
                  <p>• รองรับไฟล์รูปภาพ (JPG, PNG, WEBP)</p>
                  <p>• สามารถแนบรูปภาพได้สูงสุด 3 รูป</p>
                  <p>• แนะนำขนาดไม่เกิน 5MB ต่อรูป</p>
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
                        <div className="flex gap-2">
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
                        {attendance[emp.id]?.status === 'อื่นๆ' && (
                          <input 
                            type="text"
                            placeholder="ระบุเหตุผล..."
                            className="w-full p-2 text-xs rounded-lg bg-slate-50 border-none focus:ring-1 focus:ring-violet-500"
                            value={attendance[emp.id]?.reason || ''}
                            onChange={e => updateAttendance(emp.id, 'อื่นๆ', e.target.value)}
                          />
                        )}
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
        <h3 className="text-xl font-bold">ประวัติกิจกรรมภายนอก</h3>
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
            ).slice().reverse().map(([key, group]) => (
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
                    </div>
                    <div className="flex gap-2 text-xs font-bold">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg">เข้าร่วม: {group.filter(r => r.status === 'เข้าร่วม').length}</span>
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
                    return (
                      <div key={r.id} className={`p-2 rounded-lg text-[10px] flex items-center justify-between ${
                        r.status === 'เข้าร่วม' ? 'bg-green-50 text-green-800' : 
                        r.status === 'ไม่เข้าร่วม' ? 'bg-red-50 text-red-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        <span className="truncate">{emp?.name}</span>
                        <span className="font-bold shrink-0 ml-1">
                          {r.status === 'เข้าร่วม' ? '✓' : r.status === 'ไม่เข้าร่วม' ? '✗' : '?'}
                        </span>
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
  const [headerData, setHeaderData] = useState({ 
    type: 'กิจกรรม' as any, 
    title: '', 
    date: new Date().toISOString().split('T')[0] 
  });
  
  const [isSaving, setIsSaving] = useState(false);
  
  const [attendance, setAttendance] = useState<{ [key: number]: { status: 'เข้าร่วม' | 'ไม่เข้าร่วม' | 'อื่นๆ', reason: string } }>(
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
      if (isSaving) {
        setIsSaving(false);
        setToast({ message: "การบันทึกใช้เวลานานเกินไป กรุณาตรวจสอบอินเทอร์เน็ต", type: 'error' });
      }
    }, 15000);

    try {
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
    } catch (err) {
      console.error("Activity submit error:", err);
      setToast({ 
        message: "เกิดข้อผิดพลาดในการบันทึกกิจกรรม กรุณาลองใหม่อีกครั้ง", 
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
      newAttendance[r.employeeId] = { status: r.status, reason: r.reason || '' };
    });
    setAttendance(newAttendance);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateAttendance = (empId: number, status: 'เข้าร่วม' | 'ไม่เข้าร่วม' | 'อื่นๆ', reason?: string) => {
    setAttendance(prev => ({
      ...prev,
      [empId]: { ...prev[empId], status, reason: reason !== undefined ? reason : prev[empId].reason }
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
        <h2 className="text-3xl font-bold serif">{editingGroup ? 'แก้ไขกิจกรรม' : 'กิจกรรม'}</h2>
        <p className="text-[#1A1A1A]/50">บันทึกกิจกรรม Safety Talk & KYT, 5ส, Big Cleaning และกิจกรรมองค์กร</p>
      </header>

      {isAdmin && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest opacity-50">กิจกรรม</label>
                <select 
                  className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                  value={headerData.type}
                  onChange={e => setHeaderData({ ...headerData, type: e.target.value as any })}
                >
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
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
                <label className="text-xs font-bold uppercase tracking-widest opacity-50">รายละเอียดเพิ่มเติม (ถ้ามี)</label>
                <input 
                  type="text"
                  placeholder="ระบุรายละเอียด..."
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
                        <div className="flex gap-2">
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
                        {attendance[emp.id]?.status === 'อื่นๆ' && (
                          <input 
                            type="text"
                            placeholder="ระบุเหตุผล..."
                            className="w-full p-2 text-xs rounded-lg bg-slate-50 border-none focus:ring-1 focus:ring-violet-500"
                            value={attendance[emp.id]?.reason || ''}
                            onChange={e => updateAttendance(emp.id, 'อื่นๆ', e.target.value)}
                          />
                        )}
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
        <h3 className="text-xl font-bold">ประวัติกิจกรรมล่าสุด</h3>
        <div className="grid gap-4">
          {records.length === 0 ? (
            <div className="p-10 text-center opacity-30 italic">ยังไม่มีข้อมูลกิจกรรม</div>
          ) : (
            Object.entries(
              records.reduce((acc, r) => {
                const key = `${r.date}_${r.type}_${r.title}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(r);
                return acc;
              }, {} as { [key: string]: ActivityRecord[] })
            ).slice().reverse().slice(0, 10).map(([key, group]) => (
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
                      <div key={r.id} className={`p-2 rounded-lg text-[10px] flex items-center justify-between ${
                        r.status === 'เข้าร่วม' ? 'bg-green-50 text-green-800' : 
                        r.status === 'ไม่เข้าร่วม' ? 'bg-red-50 text-red-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        <span className="truncate">{emp?.name}</span>
                        <span className="font-bold shrink-0 ml-1">
                          {r.status === 'เข้าร่วม' ? '✓' : r.status === 'ไม่เข้าร่วม' ? '✗' : '?'}
                        </span>
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
  const [formData, setFormData] = useState({ 
    employeeId: employees[0]?.id || 1, 
    type: 'ลาป่วย' as any, 
    reason: '', 
    startDate: new Date().toISOString().split('T')[0], 
    endDate: new Date().toISOString().split('T')[0],
    duration: '1 วัน'
  });

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
      if (isSaving) {
        setIsSaving(false);
        setToast({ message: "การบันทึกใช้เวลานานเกินไป กรุณาตรวจสอบอินเทอร์เน็ต", type: 'error' });
      }
    }, 15000);

    try {
      if (editingId) {
        await onUpdate(editingId, formData);
        setEditingId(null);
        setToast({ message: 'แก้ไขข้อมูลการลาสำเร็จ', type: 'success' });
      } else {
        await onAdd(formData);
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
    } catch (err) {
      console.error("Leave submit error:", err);
      setToast({ 
        message: "เกิดข้อผิดพลาดในการบันทึกข้อมูลการลา กรุณาลองใหม่อีกครั้ง", 
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
        <p className="text-[#1A1A1A]/50">จัดการข้อมูลการลาพักร้อน ลาป่วย ลากิจ และอื่นๆ</p>
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
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">ประเภทการลา</label>
              <select 
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
              >
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
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
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">ช่วงเวลา/จำนวนวัน</label>
              <select 
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
                value={formData.duration}
                onChange={e => setFormData({ ...formData, duration: e.target.value })}
              >
                {LEAVE_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="md:col-span-1 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-50">เหตุผลการลา</label>
              <input 
                type="text"
                required
                placeholder="ระบุเหตุผล..."
                className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-violet-500"
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
        <h3 className="text-xl font-bold">ประวัติการลา</h3>
        <div className="grid gap-4">
          {records.length === 0 ? (
            <div className="p-10 text-center opacity-30 italic">ยังไม่มีข้อมูลการลา</div>
          ) : (
            records.slice().reverse().map(record => {
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
                          record.type === 'ลากิจ' ? 'bg-blue-100 text-blue-700' :
                          record.type === 'มาสาย' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'
                        }`}>{record.type}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{record.duration || '1 วัน'}</span>
                        <span className="text-xs opacity-50">{record.startDate === record.endDate ? record.startDate : `${record.startDate} ถึง ${record.endDate}`}</span>
                      </div>
                      <h4 className="font-bold">{record.reason}</h4>
                      <p className="text-xs opacity-50">{emp?.name}</p>
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
  const [filterType, setFilterType] = useState<'day' | 'month' | 'year' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'innovation' | 'activity' | 'leave'>('all');

  const filteredData = useMemo(() => {
    const d = new Date(selectedDate);
    const targetDay = d.getDate();
    const targetMonth = d.getMonth();
    const targetYear = d.getFullYear();

    const isMatch = (dateStr: string) => {
      if (filterType === 'all') return true;
      const recordDate = new Date(dateStr);
      if (filterType === 'year') return recordDate.getFullYear() === targetYear;
      if (filterType === 'month') return recordDate.getFullYear() === targetYear && recordDate.getMonth() === targetMonth;
      if (filterType === 'day') return recordDate.getFullYear() === targetYear && recordDate.getMonth() === targetMonth && recordDate.getDate() === targetDay;
      return true;
    };

    return {
      innovations: state.innovationRecords.filter(r => isMatch(r.date)),
      activities: state.activityRecords.filter(r => isMatch(r.date)),
      leaves: state.leaveRecords.filter(r => isMatch(r.startDate) || isMatch(r.endDate)),
    };
  }, [state, filterType, selectedDate]);

  const innovationSummary = useMemo(() => {
    return state.employees.map(emp => {
      const records = filteredData.innovations.filter(r => 
        r.employeeId === emp.id || (r.participants && r.participants.includes(emp.id))
      );
      const innovation = records.filter(r => r.type === 'นวัตกรรม').length;
      const kmOpl = records.filter(r => r.type === 'KM' && r.kmSubtype === 'OPL').length;
      const kmOpk = records.filter(r => r.type === 'KM' && r.kmSubtype === 'OPK').length;
      return { ...emp, innovation, kmOpl, kmOpk, total: records.length };
    });
  }, [filteredData.innovations, state.employees]);

  const activitySummary = useMemo(() => {
    const uniqueActivities = Array.from(new Set(filteredData.activities.map(r => `${r.date}|${r.type}|${r.title}`)));
    const totalUniqueCount = uniqueActivities.length;

    return state.employees.map(emp => {
      const records = filteredData.activities.filter(r => r.employeeId === emp.id && (r.status === 'เข้าร่วม' || r.status === 'อื่นๆ'));
      const activity = records.filter(r => r.type === 'กิจกรรม').length;
      const external = records.filter(r => r.type === 'กิจกรรมภายนอก').length;
      const percentage = totalUniqueCount > 0 ? Math.round((records.length / totalUniqueCount) * 100) : 0;
      return { ...emp, activity, external, total: records.length, percentage };
    });
  }, [filteredData.activities, state.employees]);

  const leaveSummary = useMemo(() => {
    return state.employees.map(emp => {
      const records = filteredData.leaves.filter(r => r.employeeId === emp.id);
      const sick = records.filter(r => r.type === 'ลาป่วย').length;
      const business = records.filter(r => r.type === 'ลากิจ').length;
      const late = records.filter(r => r.type === 'มาสาย').length;
      const official = records.filter(r => r.type === 'ราชการ').length;
      return { ...emp, sick, business, late, official, total: records.length };
    });
  }, [filteredData.leaves, state.employees]);

  const totalInnovations = filteredData.innovations.length;
  const totalActivitiesJoined = filteredData.activities.filter(r => r.status === 'เข้าร่วม' || r.status === 'อื่นๆ').length;
  const totalLeaves = filteredData.leaves.length;

  const exportInnovation = () => {
    const data = innovationSummary.map(s => ({
      'ชื่อ-นามสกุล': s.name,
      'นวัตกรรม': s.innovation,
      'KM (OPL)': s.kmOpl,
      'KM (OPK)': s.kmOpk,
      'รวม': s.total
    }));
    exportToCSV(data, `รายงานนวัตกรรม_${filterType}_${new Date().toLocaleDateString()}`);
  };

  const exportActivity = () => {
    const data = activitySummary.map(s => ({
      'ชื่อ-นามสกุล': s.name,
      'กิจกรรม': s.activity,
      'กิจกรรมภายนอก': s.external,
      'ร้อยละการเข้าร่วม': s.percentage
    }));
    exportToCSV(data, `รายงานกิจกรรม_${filterType}_${new Date().toLocaleDateString()}`);
  };

  const exportLeave = () => {
    const data = leaveSummary.map(s => ({
      'ชื่อ-นามสกุล': s.name,
      'ลาป่วย': s.sick,
      'ลากิจ': s.business,
      'มาสาย': s.late,
      'ราชการ': s.official,
      'รวม': s.total
    }));
    exportToCSV(data, `รายงานการลา_${filterType}_${new Date().toLocaleDateString()}`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold serif">รายงานสรุปผล</h2>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase opacity-50">ประเภทข้อมูล</label>
            <select 
              className="px-4 py-2 rounded-xl bg-white border border-black/5 text-xs font-bold focus:ring-2 focus:ring-violet-500"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value as any)}
            >
              <option value="all">ทั้งหมด</option>
              <option value="innovation">นวัตกรรม / KM</option>
              <option value="activity">กิจกรรม</option>
              <option value="leave">วันหยุดวันลา</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase opacity-50">ช่วงเวลา</label>
            <div className="flex bg-white border border-black/5 rounded-xl p-1">
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'day', label: 'รายวัน' },
                { id: 'month', label: 'รายเดือน' },
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

          {filterType !== 'all' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase opacity-50">เลือกวันที่</label>
              <input 
                type="date"
                className="px-4 py-2 rounded-xl bg-white border border-black/5 text-xs font-bold focus:ring-2 focus:ring-violet-500"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
          )}
          
          <div className="flex gap-2">
            <button onClick={exportInnovation} className="bg-violet-50 text-violet-600 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-violet-100 transition-all flex items-center gap-2">
              <Download size={16} /> นวัตกรรม
            </button>
            <button onClick={exportActivity} className="bg-violet-50 text-violet-600 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-violet-100 transition-all flex items-center gap-2">
              <Download size={16} /> กิจกรรม
            </button>
            <button onClick={exportLeave} className="bg-violet-50 text-violet-600 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-violet-100 transition-all flex items-center gap-2">
              <Download size={16} /> การลา
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(selectedCategory === 'all' || selectedCategory === 'innovation') && (
          <StatCard label="นวัตกรรมทั้งหมด" value={totalInnovations} icon={<Lightbulb className="text-yellow-500" />} color="bg-yellow-50" />
        )}
        {(selectedCategory === 'all' || selectedCategory === 'activity') && (
          <StatCard label="กิจกรรม (เข้าร่วม/อื่นๆ)" value={totalActivitiesJoined} icon={<ShieldCheck className="text-blue-500" />} color="bg-blue-50" />
        )}
        {(selectedCategory === 'all' || selectedCategory === 'leave') && (
          <StatCard label="การลาทั้งหมด" value={totalLeaves} icon={<Calendar className="text-red-500" />} color="bg-red-50" />
        )}
      </div>

      {/* Part 1: Innovation */}
      {(selectedCategory === 'all' || selectedCategory === 'innovation') && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600">
              <Lightbulb size={20} />
            </div>
            <h3 className="text-xl font-bold">สรุปงานนวัตกรรม / KM</h3>
          </div>
          <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/5">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">นวัตกรรม</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">KM (OPL)</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">KM (OPK)</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center bg-yellow-50/50">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {innovationSummary.map(row => (
                    <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.01]">
                      <td className="p-4 font-bold text-sm">{row.name}</td>
                      <td className="p-4 text-center text-sm">{row.innovation || '-'}</td>
                      <td className="p-4 text-center text-sm">{row.kmOpl || '-'}</td>
                      <td className="p-4 text-center text-sm">{row.kmOpk || '-'}</td>
                      <td className="p-4 text-center font-bold text-sm bg-yellow-50/30">{row.total || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Part 2: Activity */}
      {(selectedCategory === 'all' || selectedCategory === 'activity') && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-xl font-bold">สรุปกิจกรรม</h3>
          </div>
          <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/5">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">กิจกรรม</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">กิจกรรมภายนอก</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center bg-blue-50/50">เข้าร่วม/อื่นๆ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {activitySummary.map(row => (
                    <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.01]">
                      <td className="p-4 font-bold text-sm">{row.name}</td>
                      <td className="p-4 text-center text-sm">{row.activity || '-'}</td>
                      <td className="p-4 text-center text-sm">{row.external || '-'}</td>
                      <td className="p-4 text-center font-bold text-sm bg-blue-50/30">{row.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Part 3: Leave */}
      {(selectedCategory === 'all' || selectedCategory === 'leave') && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
              <Calendar size={20} />
            </div>
            <h3 className="text-xl font-bold">สรุปวันหยุดวันลา / มาสาย</h3>
          </div>
          <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/5">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50">ชื่อ-นามสกุล</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">ลาป่วย</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">ลากิจ</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">มาสาย</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">ราชการ</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest opacity-50 text-center bg-red-50/50">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveSummary.map(row => (
                    <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.01]">
                      <td className="p-4 font-bold text-sm">{row.name}</td>
                      <td className="p-4 text-center text-sm">{row.sick || '-'}</td>
                      <td className="p-4 text-center text-sm">{row.business || '-'}</td>
                      <td className="p-4 text-center text-sm">{row.late || '-'}</td>
                      <td className="p-4 text-center text-sm">{row.official || '-'}</td>
                      <td className="p-4 text-center font-bold text-sm bg-red-50/30">{row.total || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
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
