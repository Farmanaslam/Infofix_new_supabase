export type View =
  | "dashboard"
  | "tickets"
  | "review_reports"
  | "customers"
  | "schedule"
  | "reports"
  | "settings"
  | "supports"
  | "brand_ivoomi"
  | "brand_elista"
  | "laptop_dashboard"
  | "laptop_data"
  | "task_dashboard"
  | "task_my_works"
  | "task_schedule"
  | "task_reports"
  | "task_ratings"
  | "customer_dashboard"
  | "customer_supports"
  | "customer_profile";

export type Role = "ADMIN" | "MANAGER" | "TECHNICIAN" | "CUSTOMER";

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  password?: string; // For staff login, often simulated or matched against phone for customers
  photo?: string;
  experience?: string;
  mobile?: string;
  address?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  mobile: string;
  address: string;
  city?: string;
  pincode?: string;
  notes?: any[];
  photo_url: string | null;
}

export interface TicketHistory {
  id: string;
  date: string;
  timestamp: number;
  actorName: string;
  actorRole: string;
  action: string; // e.g., "Status Change", "Note Added"
  details: string; // e.g., "Changed from New to In Progress"
}
// Old Supabase structure
export interface SupabaseCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  pincode?: string;
  notes?: string[];
  created_at?: string;
 photoUrl: string | null;
}
export interface SupabaseTicket {
  id: string;
  customer_id: string;

  subject: string;
  status: string;

  hold_reason: string | null;
  priority: string;
  assigned_to: string | null;

  created_at: string;
  resolved_at: string | null;

  device: {
    type: string; // ✅ always required
    brand?: string | null; // ✅ optional
    brandService?: string | null; // ✅ optional
    model?: string | null; // ✅ optional
    serialNumber?: string | null; // ✅ optional
    description?: string | null; // ✅ optional
  };

  charger_status: string;
  store: string;

  amount_estimate: number;
  warranty: string;

  bill_number: string | null;
  scheduled_date: string | null;
  internal_progress_reason?: string | null;
  internal_progress_note?: string | null;
}

export interface Ticket {
  id: string;
  ticketId: string; // Display ID (e.g., TKT-IF-001)
  firestoreId?: string; // ✅ ADD THIS

  customerId: string;
  name: string; // Customer Name (denormalized for display)
  number: string; // Customer Mobile
  email: string;
  address: string;
  date: string;

  // Device Details
  deviceType: string;
  brand?: string;
  model?: string;
  serial?: string;
  chargerIncluded?: boolean;
  deviceDescription?: string; // For generic items

  // Ticket Metadata
  store: string;
  status: string; // 'New', 'In Progress', 'Resolved', 'Rejected', 'Pending Approval'
  priority: string;
  issueDescription: string;
  estimatedAmount?: number;

  // Workflow / Progress
  holdReason?: string;
  progressReason?: string;
  progressNote?: string; // Internal note for the progress status (Hidden from customer)

  // Warranty
  warranty: boolean;
  billNumber?: string;

  // Assignment & Scheduling
  assignedToId?: string;
  scheduledDate?: string;

  // Audit
  history?: TicketHistory[];
}

// Schedule Task Type
export interface Task {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  assignedToId?: string;
  type: "general" | "meeting" | "maintenance";
  status: "pending" | "completed";
  priority?: "normal" | "urgent"; // Added priority
  createdById: string;
}

// Laptop Report Types
export interface ChecklistItem {
  id: string;
  label: string;
}

export interface ChecklistCategory {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface ChecklistState {
  [key: string]: "pass" | "fail" | null;
}

export interface BatteryStats {
  chargePercent: string;
  remainingPercent: string;
  duration: string;
  health: "Excellent" | "Good" | "Fair" | "Poor" | "Replace";
}

export interface ReportHistory {
  id: string;
  timestamp: number;
  date: string;
  actor: string;
  action: string;
  details: string;
}

export interface Report {
  id: string;
  date: string;
  deviceInfo: {
    laptopNo: string;
    customerName: string;
    technicianName: string;
  };
  checklist: ChecklistState;
  battery: BatteryStats;
  actionRequired: string | null;
  notes: string;
  status: "Draft" | "Completed";
  progress: number;
  history?: ReportHistory[];
}

// Settings Types
export interface Store {
  id: string;
  name: string;
}
export interface DeviceType {
  id: string;
  name: string;
}
export interface TicketStatus {
  id: string;
  name: string;
  isSystem?: boolean;
}
export interface Priority {
  id: string;
  name: string;
}
export interface HoldReason {
  id: string;
  name: string;
}
export interface ProgressReason {
  id: string;
  name: string;
}
export interface SLAConfig {
  high: number;
  medium: number;
  low: number;
}
export interface Brand {
  id: string;
  name: string;
}
export interface Dealer {
  id: string;
  name: string;
}

// AI Support Types
export interface SupportGuideline {
  id: string;
  title: string;
  category: string;
  content: string; // The pipeline or rules
}

export interface AppSettings {
  stores: Store[];
  deviceTypes: DeviceType[];
  ticketStatuses: TicketStatus[];
  priorities: Priority[];
  holdReasons: HoldReason[];
  progressReasons: ProgressReason[];
  serviceBrands: Brand[];
  laptopDealers: Dealer[];
  sla: SLAConfig;
  teamMembers: User[];
  supportGuidelines: SupportGuideline[];
}
// ✅ Default App Settings (used for initial state)
export const initialSettings: AppSettings = {
  stores: [],
  deviceTypes: [],
  ticketStatuses: [],
  priorities: [],
  holdReasons: [],
  progressReasons: [],
  serviceBrands: [],
  laptopDealers: [],
  teamMembers: [],
  supportGuidelines: [],
  sla: {
    high: 1,
    medium: 3,
    low: 5,
  },
};
