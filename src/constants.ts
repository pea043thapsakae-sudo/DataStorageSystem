import { Employee } from './types';

export const EMPLOYEES: Employee[] = [
  { id: 1, name: 'นายภูศเดช ภักดีพันธ์', position: 'ผจก.', group: 'Both' },
  { id: 2, name: 'ว่าที่ร้อยโทเกษม สังฆารักษ์', position: 'หผ.บค.', group: 'B' },
  { id: 3, name: 'นางจันทนา ตั้งธรรม', position: 'หผ.บง.', group: 'A' },
  { id: 4, name: 'นายธันวา มูลมาก', position: 'ชผ.ปร.', group: 'B' },
  { id: 5, name: 'นายวิศรุต พรมจารี', position: 'ชผ.บค.', group: 'A' },
  { id: 6, name: 'นายบุญธรรม เทศแย้ม', position: 'พชง.7', group: 'B' },
  { id: 7, name: 'นางภัสสร์พร พงษ์อิศราพันธ์', position: 'พบช.7', group: 'A' },
  { id: 8, name: 'นายทวีศักดิ์ สมศรี', position: 'พชง.6', group: 'B' },
  { id: 9, name: 'นายศานติพงศ์ พุ่มพึ่งพุฒ', position: 'พชง.6', group: 'A' },
  { id: 10, name: 'นายศิริศักดิ์ จันทร์คง', position: 'พชง.5', group: 'B' },
  { id: 11, name: 'นายอรรถวุฒิ ผิวงาม', position: 'พชง.5', group: 'A' },
  { id: 12, name: 'นางสาวอภิสรา ผิวนวล', position: 'นบช.4', group: 'A' },
  { id: 13, name: 'นายอัครชัย สุดยอด', position: 'พชง.3', group: 'A' },
  { id: 14, name: 'นางสาวจีรวรรณ ขันชุลีย์', position: 'พบช.4', group: 'B' },
  { id: 15, name: 'นางปวริศา แก้วสอาด', position: 'พบช.3', group: 'B' },
  { id: 16, name: 'นางสาวสอาด ภูบุญเพิ่ม', position: 'ชชง.', group: 'B' },
  { id: 17, name: 'นางสาวลลิตา แก้วเนตร', position: 'ชชง.', group: 'A' },
  { id: 18, name: 'นางสาวชลิตา ปู่ดำ', position: 'ชบช.', group: 'A' },
  { id: 19, name: 'นางสาวดวงพร เหลืองเถลิงพงษ์', position: 'ชบค.', group: 'B' },
];

export const INNOVATION_TYPES = ['นวัตกรรม', 'KM', 'ความคิดสร้างสรรค์'] as const;
export const KM_SUBTYPES = ['OPL', 'OPK'] as const;
export const ACTIVITY_TYPES = ['กิจกรรม', 'กิจกรรมภายนอก'] as const;
export const LEAVE_TYPES = ['ลาป่วย', 'ลากิจ', 'มาสาย', 'ราชการ'] as const;
export const LEAVE_DURATIONS = ['ครึ่งวัน (เช้า)', 'ครึ่งวัน (บ่าย)', '1 วัน', '2 วัน', '3 วัน', 'มากกว่า 3 วัน'] as const;
