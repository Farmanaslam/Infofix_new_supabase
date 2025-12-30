import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./components/Dashboard";
import TicketList from "./components/TicketList";
import CustomerList from "./components/CustomerList";
import Settings from "./components/Settings";
import Reports from "./components/Reports";
import Supports from "./components/Supports";
import Schedule from "./components/Schedule";
import Login from "./components/Login";
import CustomerPortal from "./components/CustomerPortal";
import ReviewReports from "./components/ReviewReports";
import CustomerProfile from "./components/CustomerProfile";
import CustomerSupportInfo from "./components/CustomerSupportInfo";
import BrandIvoomi from "./components/BrandIvoomi";
import BrandElista from "./components/BrandElista";
import LaptopReports from "./components/LaptopReports";
import TaskManager from "./components/TaskManager";
import { TicketFormModal } from "./components/TicketFormModal";
import {
  View,
  Ticket,
  User,
  AppSettings,
  Customer,
  Task,
  Report,
  initialSettings,
} from "./types";
import { AlertTriangle, ExternalLink, WifiOff } from "lucide-react";
import { db, isFirebaseConfigured } from "./firebaseConfig";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { importCustomersToFirestore } from "./migration/importCustomers";
import { deleteUser } from "firebase/auth";
import {
  importTicketsToFirestore,
  supabaseTickets,
} from "./migration/importTickets";
import { supabase } from "./lib/supabaseClient";
// --- TYPES ---
type SyncStatus = "connected" | "local" | "error";

// --- GLOBAL STATE ---
// Circuit breaker: If true, stops all Firestore attempts for the session to prevent console spam
let isFirestoreGlobalFailure = false;

// --- UTILS ---
// Safe JSON stringify to handle circular references or complex objects that might crash JSON.stringify
const safeStringify = (value: any): string => {
  const seen = new WeakSet();
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) {
        return; // Discard circular reference
      }
      seen.add(val);
    }
    return val;
  });
};

const safeParse = <T,>(json: string | null, fallback: T): T => {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch (e) {
    // console.warn("Failed to parse JSON from storage", e);
    return fallback;
  }
};

// --- PERSISTENCE HOOKS ---

// 1. LocalStorage Hook (For User Session only)
function useSessionStorage<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? safeParse(item, initialValue) : initialValue;
    } catch (error) {
      // console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, safeStringify(valueToStore));
    } catch (error) {
      // console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

// 2. Smart Data Sync Hook (Hybrid: LocalStorage + Firestore)
function useSmartSync<T>(
  docName: string,
  initialValue: T,
  onStatusChange?: (status: SyncStatus, error?: string) => void
): [T, (val: T) => void] {
  // Always load from local storage first for immediate UI
  const [data, setData] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(docName);
      return safeParse(item, initialValue);
    } catch {
      return initialValue;
    }
  });

  const [isSyncEnabled, setIsSyncEnabled] = useState(true);

  // Effect: Connect to Firestore ONLY if configured and enabled
  useEffect(() => {
    // CIRCUIT BREAKER: If we already know the API is disabled, don't try to connect
    if (isFirestoreGlobalFailure) {
      if (isSyncEnabled) setIsSyncEnabled(false);
      onStatusChange?.("local");
      return;
    }

    // If we've already detected a fatal error locally, don't try to reconnect
    if (!isFirebaseConfigured || !db || !isSyncEnabled) {
      if (!isFirebaseConfigured) onStatusChange?.("local");
      return;
    }

    const docRef = doc(db, "app_data", docName);

    // Safety try/catch block around snapshot listener
    let unsub = () => {};
    try {
      unsub = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const remoteData = docSnap.data().data;
            if (remoteData) {
              setData(remoteData);
              // Also update local storage to keep them in sync
              try {
                window.localStorage.setItem(docName, safeStringify(remoteData));
              } catch (e) {
                // Ignore local storage errors
              }
              onStatusChange?.("connected");
            }
          } else {
            // Doc doesn't exist yet, we are connected but empty.
            onStatusChange?.("connected");
          }
        },
        (error) => {
          // --- QUIET ERROR HANDLING ---
          // We intentionally do NOT console.warn here to keep the console clean for the user.
          // We just handle the state logic.

          let errorMsg = error.message;
          let status: SyncStatus = "error";

          // Handle specific errors
          if (
            error.code === "permission-denied" ||
            error.message.includes("API has not been used") ||
            error.code === "failed-precondition"
          ) {
            errorMsg = "Firestore API Not Enabled";
            isFirestoreGlobalFailure = true; // Trip the circuit breaker for other hooks
            setIsSyncEnabled(false); // Stop trying in this hook
            // Fallback to local
            status = "local";
          } else if (error.code === "unavailable") {
            errorMsg = "Offline / Unreachable.";
            status = "local";
          }

          // Update status quietly
          onStatusChange?.(status, errorMsg);
        }
      );
    } catch (err) {
      // Fallback for immediate crashes
      isFirestoreGlobalFailure = true;
      setIsSyncEnabled(false);
      onStatusChange?.("local");
    }

    return () => unsub();
  }, [docName, isSyncEnabled]); // Keep dependency array clean

  const updateData = (newValue: T) => {
    // 1. Update State (Optimistic)
    setData(newValue);

    // 2. Update Local Storage (Always works)
    try {
      window.localStorage.setItem(docName, safeStringify(newValue));
    } catch (e) {
      // console.error("Local Storage Write Error", e);
    }

    // 3. Update Firestore (If Configured AND Enabled AND No Global Failure)
    if (
      isFirebaseConfigured &&
      db &&
      isSyncEnabled &&
      !isFirestoreGlobalFailure
    ) {
      // Use JSON parse/stringify to strip out 'undefined' values which cause Firestore setDoc to throw
      const sanitizedData = JSON.parse(JSON.stringify(newValue));

      setDoc(
        doc(db, "app_data", docName),
        { data: sanitizedData },
        { merge: true }
      ).catch((err) => {
        // Quietly handle write errors
        if (
          err.code === "permission-denied" ||
          err.message.includes("API has not been used")
        ) {
          isFirestoreGlobalFailure = true;
          setIsSyncEnabled(false);
          onStatusChange?.("local", "Firestore API Not Enabled");
        }
      });
    }
  };

  return [data, updateData];
}

// --- DEFAULT DATA ---
const DEFAULT_SETTINGS: AppSettings = {
  stores: [
    { id: "s1", name: "DGP Showroom" },
    { id: "s2", name: "DGP Shop" },
    { id: "s3", name: "Asansol" },
    { id: "s4", name: "Ukhra" },
    { id: "s5", name: "Service Center" },
  ],
  deviceTypes: [
    { id: "d1", name: "Smartphone" },
    { id: "d2", name: "Laptop" },
    { id: "d3", name: "Desktop" },
    { id: "d4", name: "Brand Service" },
    { id: "d5", name: "Accessory" },
    { id: "d6", name: "CCTV" },
    { id: "d7", name: "Other" },
  ],
  ticketStatuses: [
    { id: "st1", name: "New", isSystem: true },
    { id: "st2", name: "In Progress", isSystem: false },
    { id: "st6", name: "On Hold", isSystem: true },
    { id: "st3", name: "Resolved", isSystem: true },
    { id: "st4", name: "Rejected", isSystem: true },
    { id: "st5", name: "Pending Approval", isSystem: true },
  ],
  priorities: [
    { id: "p1", name: "Low" },
    { id: "p2", name: "Medium" },
    { id: "p3", name: "High" },
  ],
  holdReasons: [
    { id: "h1", name: "Waiting for Parts" },
    { id: "h2", name: "Customer Response" },
    { id: "h3", name: "Approval Pending" },
  ],
  progressReasons: [
    { id: "pr1", name: "Diagnostics" },
    { id: "pr2", name: "Repairing" },
    { id: "pr3", name: "Testing" },
  ],
  serviceBrands: [
    { id: "b1", name: "IVOOMI" },
    { id: "b2", name: "ELISTA" },
    { id: "b3", name: "ANT ESPORT" },
    { id: "b4", name: "Samsung" },
    { id: "b5", name: "Apple" },
  ],
  laptopDealers: [
    { id: "ld1", name: "Direct Customer" },
    { id: "ld2", name: "Local Dealer" },
  ],
  sla: { high: 2, medium: 5, low: 10 },
  teamMembers: [],
  supportGuidelines: [
    {
      id: "g1",
      title: "Water Damage Protocol",
      category: "Hardware",
      content:
        "1. Immediately disconnect power.\n2. Do not attempt to turn on.\n3. Disassemble and clean with 99% Isopropyl Alcohol.\n4. Dry for 24 hours.\n5. Test components individually.",
    },
  ],
};

const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: "CUST-001",
    name: "John Doe",
    email: "john@example.com",
    mobile: "555-0123",
    address: "123 Main St, Springfield",
    notes: ["VIP Customer"],
    photo_url: null,
  },
];

function App() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isBannerVisible, setIsBannerVisible] = useState(true);

  // Connection State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [syncError, setSyncError] = useState<string | null>(null);

  // Global Modal State
  const [isGlobalTicketModalOpen, setIsGlobalTicketModalOpen] = useState(false);

  // Status Handler - Wrapped in useCallback to act as a stable dependency
  const handleSyncStatus = useCallback(
    (status: SyncStatus, errorMsg?: string) => {
      setSyncStatus((prevStatus) => {
        // Prioritize error state: if we are in error, we stay in error until manually fixed (reloaded)
        if (prevStatus === "error") return "error";

        // If getting an error, switch to local mode gracefully
        if (errorMsg?.includes("API") || errorMsg?.includes("Permission")) {
          setSyncError(errorMsg);
          return "local"; // Treat API not enabled as just "Local Mode" for the user interface
        }

        // If connected, show connected
        if (status === "connected") {
          setSyncError(null);
          return "connected";
        }

        // Default to what was passed (likely 'local')
        return status;
      });

      if (
        errorMsg &&
        (errorMsg.includes("API") || errorMsg.includes("Permission"))
      ) {
        setSyncError(errorMsg);
      }
    },
    []
  );

  // --- PERSISTENT STATE ---
  //const [appSettings, setAppSettings] = useSmartSync<AppSettings>('settings', DEFAULT_SETTINGS, handleSyncStatus);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  {
    /* 
    useEffect(() => {
      // Call the import function once on app load
      const importData = async () => {
        try {
          await importCustomersToFirestore();
        } catch (error) {
          console.error("Error importing customers:", error);
        }
      };

      importData();
    }, []);
*/
  }
  {
    /* useEffect(() => {
    async function deleteTodaysCustomers() {
      try {
        const customersRef = collection(db, "customers");

        // Get today's date in UTC
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const q = query(customersRef); // get all customers
        const snap = await getDocs(q);

        let deletedCount = 0;

        snap.forEach(async (doc) => {
          const data: any = doc.data();
          const createdAt = data.createdAt?.toDate?.(); // Firestore timestamp
          if (!createdAt) return;

          const createdDate = new Date(createdAt);
          createdDate.setHours(0, 0, 0, 0);

          if (createdDate.getTime() === today.getTime()) {
            await deleteDoc(doc.ref);
            deletedCount++;
          }
        });
        console.log(`✅ Deleted ${deletedCount} customers created today.`);
      } catch (err) {
        console.error("❌ Error deleting today's customers:", err);
      }
    }

    // Run once
    deleteTodaysCustomers();
  }, []);*/
  }
  useEffect(() => {
    const loadUsers = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, role");

      if (!error && data) {
        setAppSettings((prev) => ({
          ...prev,
          teamMembers: data.map((u: any) => ({
            id: u.id,
            name: u.name,
            role: u.role,
          })),
        }));
      }
    };

    loadUsers();
  }, []);

  const [customers, setCustomers] = useSmartSync<Customer[]>(
    "customers",
    DEFAULT_CUSTOMERS,
    handleSyncStatus
  );
  const fetchCustomers = async () => {
    const snapshot = await getDocs(collection(db, "customers"));

    console.log("🔥 TOTAL DOCS:", snapshot.size); // IMPORTANT

    const data: Customer[] = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name ?? "",
        email: d.email ?? "",
        mobile: d.mobile ?? "",
        address: d.address ?? "",
        photo_url: d.photo_url ?? null,
      };
    });

    console.log(" MAPPED CUSTOMERS:", data.length);

    setCustomers(data);
  };
  useEffect(() => {
    fetchCustomers();
  }, []);

  const [tickets, setTickets] = useSmartSync<Ticket[]>(
    "tickets",
    [],
    handleSyncStatus
  );
  //const [tickets, setTickets] = useState<Ticket[]>([]);

  //const [tasks, setTasks] = useSmartSync<Task[]>("tasks", [], handleSyncStatus);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [laptopReports, setLaptopReports] = useSmartSync<Report[]>(
    "laptop_reports",
    [],
    handleSyncStatus
  ); // Lifted state

  const [currentUser, setCurrentUser] = useSessionStorage<User | null>(
    "nexus_current_user_v1",
    null
  );
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Ticket[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Ticket, "id">),
        }));

        setTickets(list);
        setSyncStatus("connected");
      },
      (error) => {
        console.error("Tickets listener error:", error);
        setSyncStatus("local");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadTasks = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTasks(
          data.map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            date: t.date,
            time: t.time,
            type: t.type,
            status: t.status,
            assignedToId: t.assigned_to_id,
            createdById: t.created_by_id,
          }))
        );
      }
    };

    loadTasks();
  }, []);

  // --- HANDLERS ---
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === "CUSTOMER") {
      setCurrentView("customer_dashboard");
    } else {
      setCurrentView("dashboard");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView("dashboard");
  };

  const handleAction = (action: string) => {
    if (action === "new_ticket") {
      // Open the global modal, do NOT navigate yet. Navigation happens on success.
      setIsGlobalTicketModalOpen(true);
    }
  };

  // --- ROUTING / RENDER ---
  const renderContent = () => {
    if (!currentUser) return null;

    if (currentUser.role === "CUSTOMER") {
      switch (currentView) {
        case "customer_dashboard":
          return (
            <CustomerPortal
              currentUser={currentUser}
              tickets={tickets}
              setTickets={setTickets}
              settings={appSettings}
            />
          );
        case "customer_profile":
          return (
            <CustomerProfile
              currentUser={currentUser}
              customers={customers}
              setCustomers={setCustomers}
              updateCurrentUser={setCurrentUser}
              tickets={tickets}
            />
          );
        case "customer_supports":
          return <CustomerSupportInfo settings={appSettings} />;
        default:
          return (
            <CustomerPortal
              currentUser={currentUser}
              tickets={tickets}
              setTickets={setTickets}
              settings={appSettings}
            />
          );
      }
    }

    const handleUpdateSettings = (
      update: AppSettings | ((prev: AppSettings) => AppSettings)
    ) => {
      setAppSettings((prev: AppSettings) =>
        typeof update === "function" ? update(prev) : update
      );
    };

    switch (currentView) {
      case "dashboard":
        return (
          <Dashboard
            tickets={tickets}
            customers={customers}
            settings={appSettings}
            currentUser={currentUser}
            onNavigate={setCurrentView}
            onAction={handleAction}
          />
        );
      case "tickets":
        return (
          <TicketList
            tickets={tickets}
            setTickets={setTickets}
            customers={customers}
            setCustomers={setCustomers}
            settings={appSettings}
            currentUser={currentUser}
          />
        );
      case "review_reports":
        return (
          <ReviewReports
            tickets={tickets}
            setTickets={setTickets}
            currentUser={currentUser}
          />
        );

      // New Task Manager Views - Passed savedReports
      case "task_dashboard":
        return (
          <TaskManager
            activeTab="dashboard"
            tasks={tasks}
            setTasks={setTasks}
            teamMembers={teamMembers}
            currentUser={currentUser}
            savedReports={laptopReports}
          />
        );
      case "task_my_works":
        return (
          <TaskManager
            activeTab="my_works"
            tasks={tasks}
            setTasks={setTasks}
            teamMembers={appSettings.teamMembers}
            currentUser={currentUser}
            savedReports={laptopReports}
          />
        );
      case "task_schedule":
        return (
          <Schedule
            tasks={tasks}
            setTasks={setTasks}
            tickets={tickets}
            settings={appSettings}
            currentUser={currentUser}
          />
        );
      case "task_reports":
        return (
          <TaskManager
            activeTab="reports"
            tasks={tasks}
            setTasks={setTasks}
            teamMembers={appSettings.teamMembers}
            currentUser={currentUser}
            savedReports={laptopReports}
          />
        );
      case "task_ratings":
        return (
          <TaskManager
            activeTab="ratings"
            tasks={tasks}
            setTasks={setTasks}
            teamMembers={appSettings.teamMembers}
            currentUser={currentUser}
            savedReports={laptopReports}
          />
        );

      // Laptop Reports - Passed reports & setReports
      case "laptop_dashboard":
        return (
          <LaptopReports
            activeTab="dashboard"
            settings={appSettings}
            currentUser={currentUser}
            reports={laptopReports}
            setReports={setLaptopReports}
          />
        );
      case "laptop_data":
        return (
          <LaptopReports
            activeTab="data"
            settings={appSettings}
            currentUser={currentUser}
            reports={laptopReports}
            setReports={setLaptopReports}
          />
        );

      case "customers":
        return (
          <CustomerList customers={customers} setCustomers={setCustomers} />
        );
      case "brand_ivoomi":
        return <BrandIvoomi />;
      case "brand_elista":
        return <BrandElista />;
      case "schedule":
        return (
          <Schedule
            tasks={tasks}
            setTasks={setTasks}
            tickets={tickets}
            settings={appSettings}
            currentUser={currentUser}
          />
        );
      case "reports":
        return <Reports tickets={tickets} settings={appSettings} />;
      case "supports":
        return (
          <Supports
            tickets={tickets}
            customers={customers}
            tasks={tasks}
            settings={appSettings}
            onUpdateSettings={setAppSettings}
          />
        );
      case "settings":
        return (
          <Settings
            currentUser={currentUser}
            tickets={tickets}
            onUpdateTickets={setTickets}
            settings={appSettings}
            onUpdateSettings={handleUpdateSettings}
          />
        );
      default:
        return (
          <Dashboard
            tickets={tickets}
            customers={customers}
            settings={appSettings}
            currentUser={currentUser}
            onNavigate={setCurrentView}
            onAction={handleAction}
          />
        );
    }
  };

  if (!currentUser) {
    return (
      <Login
        onLogin={handleLogin}
        teamMembers={appSettings.teamMembers}
        customers={customers}
        setCustomers={setCustomers}
      />
    );
  }

  const isFullWidthView = false;

  return (
    <div className="flex h-screen bg-slate-50 relative">
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        currentUser={currentUser}
        onLogout={handleLogout}
        syncStatus={syncStatus} // Pass status to Sidebar
      />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header
          onMenuClick={() => setIsMobileOpen(true)}
          title={
            currentView === "customers"
              ? "Customer Database"
              : currentView.replace(/_/g, " ")
          }
          currentUser={currentUser}
        />

        {/* OFFLINE / LOCAL MODE BANNER */}
        {syncStatus === "local" && isBannerVisible && (
          <div className="bg-slate-800 text-white px-6 py-2 flex items-center justify-between shadow-sm z-50">
            <div className="flex items-center gap-3">
              <WifiOff size={16} className="text-slate-400" />
              <div className="flex gap-2 items-center">
                <p className="text-xs font-medium text-slate-300">
                  Offline Mode Active
                </p>
                <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                <p className="text-xs text-slate-500">
                  Changes saved to this device
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {syncError?.includes("API") && (
                <a
                  href="https://console.firebase.google.com/project/infofix-services/firestore"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  Enable Cloud <ExternalLink size={10} />
                </a>
              )}
              <button
                onClick={() => setIsBannerVisible(false)}
                className="text-slate-500 hover:text-white transition-colors text-xs font-bold"
              >
                DISMISS
              </button>
            </div>
          </div>
        )}

        {/* CRITICAL ERROR BANNER (Only for fatal config errors that stop the app) */}
        {syncStatus === "error" && (
          <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-between shadow-lg z-50 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <AlertTriangle size={20} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-sm">Connection Error</p>
                <p className="text-xs text-red-100">
                  {syncError || "Unknown connection issue"}
                </p>
              </div>
            </div>
          </div>
        )}

        <main
          className={`flex-1 overflow-x-hidden overflow-y-auto ${
            isFullWidthView ? "p-0" : "p-4 md:p-6 lg:p-8"
          }`}
        >
          <div className={isFullWidthView ? "h-full" : "max-w-7xl mx-auto"}>
            {renderContent()}
          </div>
        </main>

        {/* Global Ticket Form Modal */}
        <TicketFormModal
          isOpen={isGlobalTicketModalOpen}
          onClose={() => setIsGlobalTicketModalOpen(false)}
          customers={customers}
          setCustomers={setCustomers}
          tickets={tickets}
          setTickets={setTickets}
          settings={appSettings}
          currentUser={currentUser}
          editingTicket={null} // Always null for new tickets
          onSuccess={() => {
            setIsGlobalTicketModalOpen(false);
            setCurrentView("tickets"); // Navigate to tickets list on success
          }}
        />
      </div>
    </div>
  );
}

export default App;
