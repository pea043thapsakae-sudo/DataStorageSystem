export interface Employee {
  id: number;
  name: string;
  position: string;
  group?: 'A' | 'B' | 'Both';
}

export type RecordType = 'innovation' | 'activity' | 'leave';

export interface InnovationRecord {
  id: string;
  employeeId: number; // Primary author
  participants: number[]; // Additional members
  date: string;
  type: 'นวัตกรรม' | 'KM' | 'ความคิดสร้างสรรค์';
  kmSubtype?: 'OPL' | 'OPK';
  contentId?: string;
  title: string;
  description: string;
  pdfUrl?: string;
  pdfName?: string;
  linkUrl?: string;
}

export interface ActivityRecord {
  id: string;
  employeeId: number;
  date: string;
  type: 'กิจกรรม' | 'กิจกรรมภายนอก';
  title: string;
  status: 'เข้าร่วม' | 'ไม่เข้าร่วม' | 'อื่นๆ' | 'สลับคู่';
  reason?: string;
  imageUrl?: string;
  imageUrls?: string[];
  linkUrls?: string[];
  swapWithId?: number;
}

export interface LeaveRecord {
  id: string;
  employeeId: number;
  startDate: string;
  endDate: string;
  type: 'มาปกติ' | 'มาสาย' | 'ลาป่วย' | 'ลากิจ' | 'ราชการ';
  reason: string;
  duration: string;
  lateDates?: string[];
}

export interface Admin {
  id: string; // The username/ID like 9012844
  password: string;
  name: string;
}

export interface AppState {
  employees: Employee[];
  innovationRecords: InnovationRecord[];
  activityRecords: ActivityRecord[];
  leaveRecords: LeaveRecord[];
  admins: Admin[];
}
