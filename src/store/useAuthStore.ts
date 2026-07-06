import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Role } from '@/types/roles'
import { getSupabaseClient } from '@/lib/supabase/client'

export type { Role }

export type User = {
  id: string
  name: string
  role: Role
  avatar?: string
  department?: string
  specialization?: string
}

interface AuthState {
  currentUser: User | null
  activeRole: Role
  isRealSession: boolean
  setUser: (user: User) => void
  setRole: (role: Role) => void
  logout: () => void
  hydrateFromSession: () => Promise<void>
}

const DEMO_USERS: Record<Role, User> = {
  // Clinical
  doctor:       { id: 'DR-1012',  name: 'Dr. Priya Nair',       role: 'doctor',       department: 'General Medicine', specialization: 'General Physician' },
  nurse:        { id: 'NR-402',   name: 'Anjali Desai',          role: 'nurse',        department: 'General Ward' },
  pharmacy:     { id: 'PH-301',   name: 'Ritu Sharma',           role: 'pharmacy',     department: 'Pharmacy' },
  lab:          { id: 'LB-992',   name: 'Neha Gupta',            role: 'lab',          department: 'Pathology' },
  radiology:    { id: 'RAD-304',  name: 'Dr. Sameer Khan',       role: 'radiology',    department: 'Radiology' },
  emergency:    { id: 'ER-110',   name: 'Dr. Vikram Rathore',    role: 'emergency',    department: 'Emergency Room' },
  // Operations
  reception:    { id: 'RC-204',   name: 'Sunita Joshi',          role: 'reception' },
  bed_manager:  { id: 'BM-601',   name: 'Aditi Verma',           role: 'bed_manager',  department: 'Admission Desk' },
  discharge:    { id: 'DC-701',   name: 'Meena Agarwal',         role: 'discharge',    department: 'Discharge Desk' },
  // Inpatient Care
  ot:           { id: 'OT-901',   name: 'Dr. Anisha Sharma',     role: 'ot',           department: 'Operation Theater' },
  // Finance
  billing:      { id: 'BL-801',   name: 'Suresh Nair',           role: 'billing',      department: 'Billing Dept' },
  insurance:    { id: 'INS-011',  name: 'Karan Patel',           role: 'insurance',    department: 'TPA Desk' },
  // Management
  admin:        { id: 'ADM-01',   name: 'Rajesh Kulkarni',       role: 'admin' },
  hr:           { id: 'HR-2001',  name: 'Anita Rao',             role: 'hr',           department: 'Human Resources' },
  quality:           { id: 'QA-1101',  name: 'Dr. Lalitha Iyer', role: 'quality',           department: 'Quality & Compliance' },
  feedback_analyst:  { id: 'FA-3001',  name: 'Preethi Menon',    role: 'feedback_analyst',  department: 'Patient Experience' },
  housekeeping: { id: 'HK-1001',  name: 'Ramesh Kumar',          role: 'housekeeping', department: 'Housekeeping' },
  inventory:    { id: 'INV-550',  name: 'Vikram Singh',          role: 'inventory',    department: 'Procurement' },
  vendor_manager: { id: 'VM-2001', name: 'Arun Kapoor',           role: 'vendor_manager', department: 'Procurement & Vendor Management' },
  // Support — 7 new roles
  blood_bank:   { id: 'BB-1201',  name: 'Dr. Pooja Srivastava',  role: 'blood_bank',   department: 'Blood Bank' },
  cssd:         { id: 'CS-1301',  name: 'Shalini Mehta',         role: 'cssd',         department: 'CSSD' },
  dietary:      { id: 'DT-1401',  name: 'Nalini Bose',           role: 'dietary',      department: 'Dietary & Nutrition' },
  bmw:          { id: 'BW-1501',  name: 'Ganesh Rao',            role: 'bmw',          department: 'Bio-Medical Waste' },
  mortuary:     { id: 'MT-1601',  name: 'Shyam Tiwari',          role: 'mortuary',     department: 'Mortuary' },
  ambulance:    { id: 'AM-1701',  name: 'Deepak Pandey',         role: 'ambulance',    department: 'Ambulance Services' },
  audit_officer:{ id: 'AU-1801',  name: 'Preethi Krishnan',      role: 'audit_officer',department: 'Audit & Compliance' },
  // Patient
  patient:      { id: 'PT-20394', name: 'Kiran Patil',           role: 'patient' },
  // Government / District
  cmo:          { id: 'usr_cmo_bhopal_01',     name: 'Dr. Rajesh Sharma',    role: 'cmo',       department: 'CMHO Bhopal' },
  // Government / State
  secretary:    { id: 'usr_secretary_mp_01',   name: 'Smt. Anuradha Verma',  role: 'secretary', department: 'Principal Secretary Health, MP' },
}

export const DEMO_USERS_MAP = DEMO_USERS

export const useAuthStore = create<AuthState>()(persist((set) => ({
  currentUser: DEMO_USERS.doctor,
  activeRole: 'doctor',
  isRealSession: false,
  setUser: (user) => set({ currentUser: user, isRealSession: false }),
  setRole: (role) => set({ activeRole: role, currentUser: DEMO_USERS[role], isRealSession: false }),
  logout: () => {
    set({ currentUser: null, isRealSession: false })
    void getSupabaseClient().auth.signOut()
    void fetch('/api/auth/session', { method: 'DELETE' })
  },
  hydrateFromSession: async () => {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      set({ currentUser: null, isRealSession: false })
      return
    }
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, full_name, department, specialization')
      .eq('id', session.user.id)
      .maybeSingle()
    if (error || !profile) {
      set({ currentUser: null, isRealSession: false })
      return
    }
    set({
      activeRole: profile.role as Role,
      currentUser: {
        id: session.user.id,
        name: profile.full_name,
        role: profile.role as Role,
        department: profile.department ?? undefined,
        specialization: profile.specialization ?? undefined,
      },
      isRealSession: true,
    })
  },
}),
  {
    name: 'agentix-authstore', version: 1,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  },
))
