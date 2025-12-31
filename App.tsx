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
import { deleteUser } from "firebase/auth";

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

  // Suppose oldTickets is your array of tickets

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

const OLD_TICKETS = [
  {
    id: "TKT-IF-001",
    customer_id: "CUST-001",
    subject: "SMPS PROBLEM",
    status: "Delivery",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sukdev Murmu",
    created_at: "2025-12-01T07:21:41.555+00:00",
    resolved_at: null,
    device: {
      type: "DESKTOP",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "ASANSOL -ICS2517",
    scheduled_date: "2025-12-01",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-002",
    customer_id: "CUST-002",
    subject: "I7 , DAMEGE PURPOSE RETURN\n\nASANSOL TO MK INFOTECH",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T07:23:09.917+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "HP ELITEBOOK 850 G1 C-202",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "0",
    scheduled_date: "2025-11-27",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-003",
    customer_id: "CUST-002",
    subject: "I7 PRO -DAMEGE PURPOSE RETURN",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T08:03:40.19+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "HP ELITEBOOK 850 G1 ",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "0",
    scheduled_date: "2025-11-27",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-004",
    customer_id: "CUST-002",
    subject: "I5-PRO DAMAGE PURPOSE RETURN \n\nASANSOL TO MK INFOTECH\n",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T08:07:55.455+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "HP ELITEBOOK 850 G1 ",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "0",
    scheduled_date: "2025-11-27",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-005",
    customer_id: "CUST-002",
    subject: "I5-PRO\n\nASN TO MK INFOTECH",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T08:08:58.091+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "HP ELITEBOOK 850 G1 ",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "0",
    scheduled_date: "2025-11-27",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-006",
    customer_id: "CUST-002",
    subject: "I5-PRO DAMGE ,DUST SCREEN,KEYBOARD",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T08:14:15.606+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL",
      model: "DELL LATITUDE 7480",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "0",
    scheduled_date: "",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-007",
    customer_id: "CUST-002",
    subject: "I5-PRO ISSUE-DAMAGE\n\n27/11/25 GOING ASN SHOP TO MK INFOTECH",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T08:30:41.932+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL",
      model: "DELL LATITUDE 7440",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-008",
    customer_id: "CUST-002",
    subject: "I7-PRO ISSUE-DAMAGE\n\n27/11/25 GOING ASN ASHOP TO MK INFOTECH",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T08:35:29.87+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL ",
      model: "DELL LATITUDE 7440",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-009",
    customer_id: "CUST-002",
    subject: "I7-PRO ISSUE-DAMGE\n\n27/11/25 GOING ASN SHOP TO MK INFOTECH",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T08:37:35.368+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL ",
      model: "DELL LATITUDE 7440",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-010",
    customer_id: "CUST-002",
    subject: "I5-PRO ISSUE-DAMAGE\n\n27/11/25 GOING ASN SHOP TO MK INFOTECH",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T08:56:26.605+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL",
      model: "DELL LATITUDE 7450",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-011",
    customer_id: "CUST-002",
    subject: "I7-PRO ISSUE-DAMAGE\n\n27/11/25 ASN SHOP TO MK INFOTECH",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T09:01:03.223+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL",
      model: "DELL LATITUDE 7450",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-012",
    customer_id: "CUST-002",
    subject: "BATTERY DAMAGE\n \n27/11/25 ASN SHOP TO MK INFOTECH",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T09:04:05.785+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "C-212 BATTERY",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-013",
    customer_id: "CUST-002",
    subject: "ISSUE-MOTHERBOARD\n\n15/10/25 GOING ASN SHOP TO MAX",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T09:08:19.912+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "HP ELITEBOOK 850 G1 D-3182",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-014",
    customer_id: "CUST-002",
    subject: "DISPLAY,NOT ON,BATTERY\n15/10/25 GOING ASN SHOP TO MAX",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T09:10:39.088+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL ",
      model: "DELL LATITUDE 5470 C-68",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-015",
    customer_id: "CUST-002",
    subject: "NO POWER ON,BATTERY\n\n15/10/25 GOING ASN SHOP TO MAX",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T09:11:52.325+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL ",
      model: "DELL LATITUDE 5470 C-71",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-016",
    customer_id: "CUST-002",
    subject:
      "ISSUE-NOT ON ,DISPLAY,BATTERY,KEYBOARD\n\n15/10/25 ASN SHOP TO MAX",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T09:13:27.302+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL ",
      model: "DELL LATITUDE 5470 C-25",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-017",
    customer_id: "CUST-002",
    subject:
      "ISSUE-KEYBOARD NOT WORK ,LIFT CLICK ISSUE,DISPLAY \n\n15/10/25 ASN SHOP TO MAX",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T09:17:35.39+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL",
      model: "DELL LATITUDE 5470 C-63",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-018",
    customer_id: "CUST-002",
    subject: "ISSUE-BATTERY DAMAGE \n\n15/10/25 ASN SHOP TO MAX ",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T09:28:46.556+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "DELL LATITUDE 5470 BATTERY",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-019",
    customer_id: "CUST-002",
    subject: "ISSUE-STUCK PROBLEM\n\n15/10/25 ASN SHOP TO MAX ",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T09:31:59.309+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "HP ELITEBOOK 850 G1 C-102",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-020",
    customer_id: "CUST-002",
    subject: "ISSUE-MOTHERBOARD ISSUE\n\n15/10/25 ASN SHOP TO MAX ",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T09:34:03.916+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL",
      model: "DELL LATITUDE E7470 C-131",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-021",
    customer_id: "CUST-002",
    subject: "ISSUE-MOTHERBOARD PROBLEM\n\n15/10/25 ASN SHOP TO MAX",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T09:35:19.789+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL",
      model: "DELL LATTITUDE E5470 C-23",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: "",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-022",
    customer_id: "CUST-002",
    subject:
      "IVOOMI VIRAT CABINET WITH 450W SMPS, \n SERVICE CENTER SENDING DATE 07/08/2025\nPROBLEM : DAMAGE",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T11:01:23.992+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "VIRAT CABINET WITH 450W SMPS",
      brandService: "IVOOMI",
      serialNumber: "NA",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-023",
    customer_id: "CUST-002",
    subject:
      "EVM H110 MB/ ONE RAM SLOT NOT WORKING        \n          DURGAUR SENDING DATE    03/09/2025\n",
    status: "Internal Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "",
    created_at: "2025-12-01T11:03:19.342+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      brand: "EVM",
      model: "H110",
      description:
        "EVM H110 MB/ ONE RAM SLOT NOT WORKING                               (ASN STOCK )",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-024",
    customer_id: "CUST-002",
    subject:
      "IVOOMI COSMO WIRELESS COMBO , KEY NOT WORKING   ( ASN STOCK )\n\nDURGAPUR SENDING DATE 03/09/2025\n",
    status: "In Progress",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-01T11:07:02.608+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "COSMO",
      brandService: "IVOOMI",
      serialNumber: "NA",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-025",
    customer_id: "CUST-002",
    subject:
      "IVOOMI COSMO , DAMAGE  (ASN STOCK )\n\n\nDURGAPUR SENDING DATE 04/09/2025",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T11:08:57.748+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI COSMO",
      model: "COSMO",
      brandService: "IVOOMI",
      serialNumber: "NA",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-026",
    customer_id: "CUST-002",
    subject:
      "ANT ESPORT KM 1600 COMBO WIRE KEY PROBLEM , (ASN STOCK )\n\nDURGAPU SENDING DATE: 04/09/2025",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T11:10:46.203+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "ANT ESPORT KM 1600 COMBO WIRE (ASN STOCK )",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-027",
    customer_id: "CUST-003",
    subject: "Not on & keyboard change .",
    status: "SERVICE DONE",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-01T11:13:10.451+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "LENOVO THINKPAD",
      model: "Lenovo ThinkPad Yoga 370",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-028",
    customer_id: "CUST-002",
    subject:
      "Ant Esports Ice igital c3 , DISPLAY NOT WORKING  (ASN STOCK ) \n\nDURGAPUR SENDING DATE : 09/09/2025",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T11:13:28.052+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description:
        "Ant Esports Ice igital c3 ,                                                        (ASN STOCK ) ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-029",
    customer_id: "CUST-002",
    subject:
      "IVOOMI 22inch DISPLAY LINE ( TC22CM2504IV003134 )  B  (ASN STOCK )\n\nDURGAPUR SENDING DATE: 25/09/2025",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T11:16:36.562+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "22INCH  B",
      brandService: "IVOOMI",
      serialNumber: "TC22CM2504IV003134",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-030",
    customer_id: "CUST-002",
    subject: "27/11/25 ASANSOL SHOP TO DURGAPUR SERVICE CENTER\n\nISSUE-NOT ON",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T11:18:03.136+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "HP PROBOOK 440 G5 C-122",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-031",
    customer_id: "CUST-002",
    subject:
      "IVOOMI 22inch DISPLAY LINE ( TC22CM2503IV000279 )  B (ASN STOCK )\n\ndgp sending date : 25/09/2025",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T11:18:13.492+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "IVVOMI",
      model: "22inch B",
      serialNumber: "TC22CM2503IV000279",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-032",
    customer_id: "CUST-002",
    subject: "IVOOMI VIRAT DAMAGE (ASN STOCK)\n\nDGP SENDING DATE : 25/09/2025",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T11:20:01.962+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "VIRAT CABINET WITH 450W SMPS",
      brandService: "IVOOMI",
      serialNumber: "NA",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-033",
    customer_id: "CUST-004",
    subject:
      "30/11/25 Asansol shop to DGP Service centre \nIssue -Not on ,no display ",
    status: "SERVICE DONE",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-01T11:21:40.001+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "HP RLITEBOOK 850 G1 D-3180",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-034",
    customer_id: "CUST-005",
    subject: "Not on",
    status: "Delivery",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-01T11:30:48.635+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "Dell",
      model: "Dell Latitude 7450",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-035",
    customer_id: "CUST-002",
    subject:
      "IVOOMI 22inch  ( GW22CMF2502IV01917 )  BL  DisplY LINE  (asn stock ) ",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T11:32:56.531+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "22inch BL",
      brandService: "IVOOMI",
      serialNumber: "GW22CMF2502IV01917",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-036",
    customer_id: "CUST-002",
    subject:
      "IVOOMI IV-R-12A   TONER, (SRI VHINAYAK / 9002878752 )\n\nDGP SENDING 7/09/2025",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T11:53:14.128+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "12A TONER",
      description: "IVOOMI ",
      brandService: "IVOOMI",
      serialNumber: "NA",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-037",
    customer_id: "CUST-002",
    subject:
      "IVOOMI 22inch BL ( GW22CMF2502IV01918 )   ASN STOCK \n\nDISPLAY LINE\n7/9/2025                DGP SENDING",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T12:04:18.382+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: 'MONITOR  22"',
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-038",
    customer_id: "CUST-002",
    subject:
      "I5 4th gen procceor ,     (asn stock )\nDEAD\n7/9/2025         DGP SENDING",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T12:11:31.9+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      brand: "INTEL",
      model: "PROCCESOR   I5 4TH ",
      description: "INTEL I5 4TH PROCCESOR",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-039",
    customer_id: "CUST-006",
    subject: "Dead, confirmation pending from cx side",
    status: "Rejected",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-01T12:13:58.627+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "Lenovo Ideapad",
      model: "Ideapad",
    },
    charger_status: "NO",
    store: "DGP SHOWROOM",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: "2025-11-20",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-040",
    customer_id: "CUST-007",
    subject: "Dead, 21/11/2025 cx came on this date HP 15BS",
    status: "Delivery",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-01T12:22:40.144+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "15BS",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 5500,
    warranty: "NO",
    bill_number: null,
    scheduled_date: "2025-12-01",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-041",
    customer_id: "CUST-002",
    subject:
      "IVOOMI THAR 1 ,  (ASN STOCK )\nDAMAGE, SMPS DEAD\n7/9/2025\nASN TO DGP SENDING",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T12:32:53.912+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "THAR 1 CABINET",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-042",
    customer_id: "CUST-002",
    subject:
      "ivoomi ziggy keyboard\n( ASN STOCK ) key not working\n28/10/2025\nASN TO DGP SENDING",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T12:41:46.194+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "ZIGGY KEYBOARD",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-043",
    customer_id: "CUST-002",
    subject:
      "IVOOMI 22INCH (B)  TC22CM2504IV003231                              (ASN STOCK )\nlineing\n28/10/2025       ANS TO DGP",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T12:45:16+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: '22" MONITOR',
      brandService: "IVOOMI",
      serialNumber: "TC22CM2504IV003231     ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-044",
    customer_id: "CUST-002",
    subject:
      "IVOOMI 22INCH (B) TC22CM2503IV000382                         (ASN STOCK ) DISPLAY LINEING\n28/10/2025\n   ASN TO DGP SENDING",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T12:50:19.971+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: '22" MONITOR',
      brandService: "IVOOMI",
      serialNumber: " TC22CM2503IV000382      ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-045",
    customer_id: "CUST-002",
    subject:
      "IVOOI 22INCH (B) TC22CM2504IV003169                   (ASN STOCK )   DISPLAY LINE\n28/10/2025\nANS TO DGP   SENDING",
    status: "In Progress",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: null,
    created_at: "2025-12-01T12:53:31.595+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: '22" MONITOR',
      brandService: "IVOOMI",
      serialNumber: "TC22CM2504IV003169  ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-046",
    customer_id: "CUST-002",
    subject:
      "IVOOMI 22INCH  (BL) GW22CMF2502IV01972                            (ASN STOCK ) DISPLAY LINE\n28/10/2025\nASN TO DGP   SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-01T12:56:21.84+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: '22" MONITOR',
      brandService: "IVOOMI",
      serialNumber: "GW22CMF2502IV01972  ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-047",
    customer_id: "CUST-002",
    subject:
      "IVOOMI 22INCH (BL)  GW22CMF2502IV02012                        (ASN STOCK ) DISPLAY LINE\n28/10/25\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:02:28.518+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: '22" MONITOR',
      brandService: "IVOOMI",
      serialNumber: " GW22CMF2502IV02012   ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-048",
    customer_id: "CUST-002",
    subject:
      "ivoomi 19inch   ( TC19CM2508IV047945 )                             ( ASN STOCK ) DISPLAY LINE\n6/11/2025\nANS TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:05:28.39+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: '19" MONITOR',
      brandService: "IVOOMI",
      serialNumber: "TC19CM2508IV047945 ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-050",
    customer_id: "CUST-002",
    subject:
      "IVOOMI SORA WIRELESS MOUSE , NOT WORKING                \n06/11/2025\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:11:36.599+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "SORA MOUSE WIRELESS",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-053",
    customer_id: "CUST-009",
    subject: "Sujal Bauri-9749799039,Smps opus only, pending from 26/9/25",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:15:51.697+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "smps opus",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-054",
    customer_id: "CUST-010",
    subject: "Uttam Trivedy-9382518914,Geonix ram 16gb, pending from 7/10/25",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-01T13:18:13.567+00:00",
    resolved_at: "2025-12-09T07:10:00.888+00:00",
    device: {
      type: "ACCESSORY",
      description: "Uttam Trivedy-9382518914,Geonix ram 16gb",
    },
    charger_status: null,
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-055",
    customer_id: "CUST-011",
    subject:
      "Rahul Kumer Das-7602321846,keyboard Antesports mk1450, pending from 9/10/25",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-01T13:19:17.377+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "Rahul Kumer Das-7602321846,keyboard Antesports mk1450",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-056",
    customer_id: "CUST-002",
    subject:
      "IVOOMI CHETAK 1 , CABINET DAMAGE , SMPS PROBLEM  (ASN STOCK )\n19/11/2025\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:19:29.592+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "CHETAK CABINET",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-058",
    customer_id: "CUST-012",
    subject:
      'Nanik kumer Modak-9333131374,uk1060,ivoomi 19" monitor, pending from 16/10/25',
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:21:44.41+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "19 inch monitor",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-061",
    customer_id: "CUST-002",
    subject:
      "IVOOMI BLOAT W HEADPHONE                             (ASN STOCK ) LEFT SPEAKER \n19/11/2025\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:24:57.203+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "BLOAT W HEADPHONE",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-064",
    customer_id: "CUST-013",
    subject: "Roshan Thakur-8637310426,Elista Smps, pending from 26/10/25",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:26:44.532+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "elista",
      model: "smps",
      brandService: "ELISTA",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-065",
    customer_id: "CUST-014",
    subject: "Rupam Das-9083214244,uk1093,Smps opus, pending 1/11/25",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:27:43.783+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "smps opus",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-066",
    customer_id: "CUST-002",
    subject:
      "IVOOMI 22INCH  BL  GWEC22CM2501IV000930 ( ASN STOCK ) DISPLAY LINE\n19/11/2025\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:28:24.273+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: '22" MONITOR',
      brandService: "IVOOMI",
      serialNumber: "GWEC22CM2501IV000930 ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-070",
    customer_id: "CUST-002",
    subject: " IVOOMI SORA MOUSE (DEAD) \n19/11/2025\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:31:50.14+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "SORA MOUSE ",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-071",
    customer_id: "CUST-015",
    subject: "Lenovo thinkpad laptop,uk1134, pending from 23/11/25",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-01T13:33:38.92+00:00",
    resolved_at: "2025-12-15T07:15:55.68+00:00",
    device: {
      type: "LAPTOP",
      brand: "lenovo",
      model: "Lenovo thinkpad laptop,uk1134",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-073",
    customer_id: "CUST-016",
    subject: 'Ivoomi- 20" Monitor Normal, pending from 23/11/25',
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:35:28.348+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "monitor",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-075",
    customer_id: "CUST-017",
    subject: 'Ivoomi-22" Monitor Normal,uk1143, pending from 28/11/25',
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-01T13:38:13.584+00:00",
    resolved_at: "2025-12-09T07:17:12.717+00:00",
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "monitor",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-079",
    customer_id: "CUST-018",
    subject: "Laptop is getting automatically shutdown. ",
    status: "Delivery",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-02T07:23:38.351+00:00",
    resolved_at: "2025-12-02T10:56:27.148+00:00",
    device: {
      type: "LAPTOP",
      brand: "Dell",
      model: "7470",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-080",
    customer_id: "CUST-019",
    subject: "HP Laptop,uk1150,Display problem",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-02T08:53:58.511+00:00",
    resolved_at: "2025-12-14T10:18:38.519+00:00",
    device: {
      type: "LAPTOP",
      brand: "Hp",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-081",
    customer_id: "CUST-020",
    subject: "Dell Laptop,uk1139-Keyboard ",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-02T08:56:14.316+00:00",
    resolved_at: "2025-12-14T10:18:12.328+00:00",
    device: {
      type: "LAPTOP",
      brand: "Dell",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-082",
    customer_id: "CUST-021",
    subject: "Apple Macbook Air-uk1084, OS problem",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-02T09:04:36.497+00:00",
    resolved_at: "2025-12-14T10:17:47.775+00:00",
    device: {
      type: "LAPTOP",
      brand: "Apple ",
      model: "Macbook Air",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-083",
    customer_id: "CUST-022",
    subject: "IVOOMI 22INCH BL ( GW22CMF2502IV01938 )         (ASN STOCK )",
    status: "NEW",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-02T13:36:01.081+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: '22" BL',
      brandService: "IVOOMI",
      serialNumber: "GW22CMF2502IV01938",
    },
    charger_status: null,
    store: "ASANSOL",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-084",
    customer_id: "CUST-022",
    subject:
      "IVOOMI 22INCH BL  ( GW22CMF2502IV02023 )           (ASN STOCK )  \nPENDING FROM 19/11/2025",
    status: "NEW",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-02T13:37:59.726+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: '22" BL',
      brandService: "IVOOMI",
      serialNumber: "GW22CMF2502IV02023",
    },
    charger_status: null,
    store: "ASANSOL",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-085",
    customer_id: "CUST-022",
    subject:
      "IVOOMI 19INCH DREAM 60 ( FK19CM2508IV030792 ) (ASN STOCK ) LINING\n19/11/2025\nASN TO DGP",
    status: "NEW",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sujata Chaterjee",
    created_at: "2025-12-02T13:50:19.608+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: '19"',
      brandService: "IVOOMI",
      serialNumber: "FK19CM2508IV030792",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: "2025-12-02",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-086",
    customer_id: "CUST-022",
    subject:
      "IVOOMI 19INCH V STAND   (TC19CM2508IV048190 ) (ASN STOCK ) LINING\n19/11/2025\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-02T13:58:01.404+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "IVOOMI 19INCH V STAND MONITOR",
      brandService: "IVOOMI",
      serialNumber: "TC19CM2508IV048190 ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-087",
    customer_id: "CUST-022",
    subject:
      "IVOOMI 19INCH V STAND   (TC19CM2508IV048190 )  (ASN STOCK ) LINING\n19/11/2025\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-02T14:03:44.014+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI",
      model: "IVOOMI 19INCH MONITOR V STAND   ",
      brandService: "IVOOMI",
      serialNumber: "TC19CM2508IV048190 ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-088",
    customer_id: "CUST-022",
    subject:
      "ELISTA BOLT W K/M COMBO  (22497713408654101284 )(ASN STOCK ) (without) key not working, mouse scrool\n19/11/2025       ASN TO DGP   SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-02T14:08:52.708+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ELISTA",
      model: "ELISTA BOLT W K/M COMBO ",
      brandService: "ELISTA",
      serialNumber: "22497713408654101284 ",
    },
    charger_status: null,
    store: "DGP SHOWROOM",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-089",
    customer_id: "CUST-022",
    subject:
      "ELISTA BOLT W K/M COMBO   (22497713408654106553 )    (ASN STOCK )   ( without login )key damage, mouse damage\n19/11/25            ASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-02T14:13:31.125+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ELISTA",
      model: "ELISTA BOLT W K/M COMBO ",
      brandService: "ELISTA",
      serialNumber: "22497713408654106553",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-090",
    customer_id: "CUST-022",
    subject:
      "ELISTA BOLT W K/M COMBO (22497713408654106552 )    (ASN STOCK )     ( without login )key not working, mouse scrool\n19/11/2025      ASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-02T14:16:29.256+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ELISTA",
      model: "ELISTA BOLT W K/M COMBO",
      brandService: "ELISTA",
      serialNumber: "22497713408654106552",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-091",
    customer_id: "CUST-022",
    subject:
      "D-2773 DELL 5470 ,     ASN STOCK        Slow Charging   \n25/11/25\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-02T14:19:48.04+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL ",
      model: "DELL 5470",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-092",
    customer_id: "CUST-022",
    subject:
      "ELISTA 22inch   SN : 22327716308654300050 ( without login )    DEAD\n27/11/2025\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-02T14:23:43.697+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ELISTA",
      model: "ELISTA 22inch MONITOR",
      brandService: "ELISTA",
      serialNumber: "22327716308654300050 ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-093",
    customer_id: "CUST-022",
    subject:
      "ZEBRONICS     zeb-asta pro. (black) (ASN STOCK )      \n27/11/2025\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-02T14:26:27.25+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "RGB NOT WORKING",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-094",
    customer_id: "CUST-022",
    subject:
      "D-2793 LENOVO THINKPAD YOGA 370    BRIGHTNEES LOW\n27/11/25\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-02T14:29:12.289+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "LENOVO",
      model: "LENOVO THINKPAD YOGA 370",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-095",
    customer_id: "CUST-022",
    subject:
      "C-122,    HP ELITBOOK      NOT ON\n27/11/2025 \nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-02T14:32:35.701+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: " HP ELITBOOK ",
      model: "HP ELITBOOK ",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-096",
    customer_id: "CUST-022",
    subject:
      "D-3180, HP ELITBOOK 850 G1,    not on, no display     30/11/25\nASN TO DGP SENDING",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-02T14:35:26.532+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP ",
      model: "HP ELITBOOK 850 G1",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-097",
    customer_id: "CUST-022",
    subject: "D-3102 DELL 7450   NOT ON 30/11/25ASN TO DGP SENDING",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-02T14:40:28.026+00:00",
    resolved_at: "2025-12-14T12:01:11.86+00:00",
    device: {
      type: "LAPTOP",
      brand: "DELL",
      model: "DELL 7450",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "NA",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-098",
    customer_id: "CUST-023",
    subject: "Battery change",
    status: "Delivery",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-04T06:06:02.983+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "Lenovo",
      model: "S340 Ideapad",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-099",
    customer_id: "CUST-024",
    subject: "Windows issue",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-04T07:26:05.718+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "Acer",
      model: "Aspire 5",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-100",
    customer_id: "CUST-025",
    subject: "Asus Taf Gaming,uk1158,Bios Problem",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-04T09:41:15.33+00:00",
    resolved_at: "2025-12-14T10:17:29.792+00:00",
    device: {
      type: "LAPTOP",
      brand: "Asus ",
      model: "Asus Taf Gaming",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: "2025-12-04",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-101",
    customer_id: "CUST-026",
    subject: "Acer Laptop,uk983 Not on",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-04T09:44:51.759+00:00",
    resolved_at: "2025-12-14T10:17:18.512+00:00",
    device: {
      type: "LAPTOP",
      brand: "Acer",
      model: "Acer",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: "2025-12-04",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-102",
    customer_id: "CUST-027",
    subject: "Hp Laptop,uk1157- Keyboard Back light Problem",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-04T09:48:48.264+00:00",
    resolved_at: "2025-12-14T10:17:03.296+00:00",
    device: {
      type: "LAPTOP",
      brand: "Hp",
      model: "Hp",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: "2025-12-04",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-103",
    customer_id: "CUST-028",
    subject: "Not getting switched on.",
    status: "NEW",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-05T07:23:23.034+00:00",
    resolved_at: null,
    device: {
      type: "DESKTOP",
      brand: "Assemble",
      model: "Clarion",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-104",
    customer_id: "CUST-029",
    subject: "Dead",
    status: "Delivery",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-05T10:47:53.847+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "Dell",
      model: "Dell Inspirion",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-105",
    customer_id: "CUST-030",
    subject: "Speaker issue",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-07T07:12:18.162+00:00",
    resolved_at: "2025-12-08T10:37:10.729+00:00",
    device: {
      type: "LAPTOP",
      brand: "Dell",
      model: "Dell,7450, C-152",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-106",
    customer_id: "CUST-031",
    subject: "On issue",
    status: "Rejected",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-07T07:14:23.368+00:00",
    resolved_at: null,
    device: {
      type: "DESKTOP",
      brand: "Lenovo",
      model: "Lenovo Ideacenter",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-107",
    customer_id: "CUST-032",
    subject: "Blank screen",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-07T07:26:44.304+00:00",
    resolved_at: "2025-12-10T11:08:42.796+00:00",
    device: {
      type: "LAPTOP",
      brand: "Dell",
      model: "Dell, 5450",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-108",
    customer_id: "CUST-029",
    subject: "Dead",
    status: "Delivery",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-07T07:33:01.853+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP, X360 Probook 11G1",
      model: "HP, X360 Probook 11G1",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-109",
    customer_id: "CUST-031",
    subject: "Not getting on",
    status: "In Progress",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-07T07:36:13.07+00:00",
    resolved_at: null,
    device: {
      type: "DESKTOP",
      brand: "Lenovo Ideacenter, Desktop",
      model: "Lenovo Ideacenter, Desktop",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-110",
    customer_id: "CUST-033",
    subject: "Not getting switched on",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-07T07:40:55.279+00:00",
    resolved_at: "2025-12-08T11:04:21.311+00:00",
    device: {
      type: "DESKTOP",
      brand: "Desktop, Frontech",
      model: "Desktop, Frontech",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-111",
    customer_id: "CUST-029",
    subject: "Dead",
    status: "Delivery",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-07T10:28:55.212+00:00",
    resolved_at: "2025-12-08T10:57:08.779+00:00",
    device: {
      type: "LAPTOP",
      brand: "Dell, 3470 Latitude",
      model: "Dell, 3470 Latitude",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-112",
    customer_id: "CUST-034",
    subject: "NOT ON",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-08T11:05:26.156+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
    },
    charger_status: "NO",
    store: "ASANSOL",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-113",
    customer_id: "CUST-035",
    subject: "charging port not working ",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sribas Das",
    created_at: "2025-12-08T12:42:44.241+00:00",
    resolved_at: "2025-12-08T13:51:18.632+00:00",
    device: {
      type: "LAPTOP",
      brand: "toshiba",
      model: "charging port not working",
      serialNumber: "D-364",
    },
    charger_status: "NO",
    store: "DGP SHOWROOM",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-114",
    customer_id: "CUST-036",
    subject: "Os Install",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-09T07:49:08.265+00:00",
    resolved_at: "2025-12-10T11:07:52.096+00:00",
    device: {
      type: "LAPTOP",
      brand: "Mac book pro, A1278",
      model: "Mac book pro, A1278",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-115",
    customer_id: "CUST-029",
    subject: "TOUCH PAD AND SPEAKER PROBLEM",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-09T08:38:52.747+00:00",
    resolved_at: "2025-12-09T11:47:08.627+00:00",
    device: {
      type: "LAPTOP",
      brand: "HP, PAVILION",
      model: "HP, PAVILION",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-116",
    customer_id: "CUST-037",
    subject:
      "OPUS SMPS IVOOMI    (SANTOSH KURMI  MOBIL NO-9932839015), PENDING FROM 08/09/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:42:11.211+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "opus smps",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-117",
    customer_id: "CUST-038",
    subject:
      "IVOOMI HANK WIRELESS SILENT CLICK MOUSE  (00874)n, PENDING FROM 12/09/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:44:37.757+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "IVOOMI HANK WIRELESS SILENT CLICK MOUSE  (00874)n",
      model: "IVOOMI HANK WIRELESS SILENT CLICK MOUSE  (00874)n",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-118",
    customer_id: "CUST-038",
    subject: "ON ISSUE , PENDING FROM 24/09/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:46:37.871+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL LATITUDE 5470 C-71",
      model: "DELL LATITUDE 5470 C-71",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-119",
    customer_id: "CUST-038",
    subject: "IRVINE 256 GB SATA SSD, PENDING FROM 05/10/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:47:26.407+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "IRVINE 256 GB SATA SSD",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-120",
    customer_id: "CUST-038",
    subject: "IVOOMI AIRY LAPTOP STAND, PENDING FROM 09/10/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:48:21.376+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "IVOOMI AIRY LAPTOP STAND",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-121",
    customer_id: "CUST-038",
    subject: "HP PROBOOK 440 G5 C-112, PENDING FROM 17/10/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:49:25.794+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP PROBOOK 440 G5 C-112",
      model: "HP PROBOOK 440 G5 C-112",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-122",
    customer_id: "CUST-038",
    subject:
      'IVOOMI 19" LED MONITOR V STAND (tc19cm2508iv046500), PENDING FROM 18/10/2025',
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:50:12.642+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: 'IVOOMI 19" LED MONITOR V STAND (tc19cm2508iv046500)',
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-123",
    customer_id: "CUST-038",
    subject: "Irvine 256gb SATA SSD, PENDING FROM 19/10/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:51:01.677+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "Irvine 256gb SATA SSD",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-124",
    customer_id: "CUST-038",
    subject:
      'IVOOMI 19" LED MONITOR V STAND (tc19cm2508iv046477) PENDING FROM 19/10/2025',
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:51:47.87+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: 'IVOOMI 19" LED MONITOR V STAND (tc19cm2508iv046477',
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-125",
    customer_id: "CUST-038",
    subject: "ELISTA CABINET IT-117 W/O SMPS, PENDING FROM 25/10/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:52:33.866+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ELISTA CABINET IT-117 W/O SMPS",
      model: "ELISTA CABINET IT-117 W/O SMPS",
      brandService: "ELISTA",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-126",
    customer_id: "CUST-038",
    subject: "Irvine 256gb SATA SSD, PENDING FROM 25/10/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:53:10.91+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "Irvine 256gb SATA SSD",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-127",
    customer_id: "CUST-038",
    subject: "CONSISTENT CMB - H61, PENDING FROM 30/10/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T10:54:33.341+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "CONSISTENT CMB - H61",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-128",
    customer_id: "CUST-039",
    subject:
      "EVM SSD 256 GB (SL NO-ESBMR032512175 ) CX -BISWAJIT SHIL ,MONO-7319319950, PENDING FROM 15/11/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T11:01:31.13+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description:
        "EVM SSD 256 GB (SL NO-ESBMR032512175 ) CX -BISWAJIT SHIL ,MONO-7319319950",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-129",
    customer_id: "CUST-038",
    subject: "Ivoomi  Ziggy Keyboard , PENDING FROM 28/11/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T11:02:46.654+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "Ivoomi  Ziggy Keyboard ",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-130",
    customer_id: "CUST-038",
    subject: "Ivoomi  Sora Mouse  , PENDING FROM 28/11/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T11:03:21.676+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "Ivoomi  Sora Mouse  ",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-131",
    customer_id: "CUST-038",
    subject: "Ivoomi  opus smps , PENDING FROM 28/11/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T11:04:24.177+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "Ivoomi  opus smps ",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-132",
    customer_id: "CUST-038",
    subject: "Evm H61 motherboard , PENDING FROM 28/11/2025",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-10T11:05:05.006+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "Evm H61 motherboard ",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-133",
    customer_id: "CUST-040",
    subject: "SSD issue ",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-11T08:57:49.029+00:00",
    resolved_at: "2025-12-12T05:31:34.03+00:00",
    device: {
      type: "DESKTOP",
      brand: "ivoomi",
      model: "Ivoomi Virat",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-134",
    customer_id: "CUST-041",
    subject: "Elista Smps ,Uk1167-Ukhra to service Center",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-13T07:02:42.859+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "Elista Smps",
      brandService: "ELISTA",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "4471",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-135",
    customer_id: "CUST-042",
    subject: "On Issue",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-14T06:01:09.321+00:00",
    resolved_at: "2025-12-14T07:24:18.504+00:00",
    device: {
      type: "LAPTOP",
      brand: "Dell, Latitude",
      model: "E7470, C-170",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-136",
    customer_id: "CUST-043",
    subject: "Normal service ",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-14T06:13:16.621+00:00",
    resolved_at: "2025-12-14T06:14:07.26+00:00",
    device: {
      type: "DESKTOP",
      brand: "Frontech",
      model: "Frontech",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-137",
    customer_id: "CUST-044",
    subject: "Lenovo, Ideadpad,uk1169-OS Problem",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-15T08:42:20.745+00:00",
    resolved_at: "2025-12-15T13:08:02.835+00:00",
    device: {
      type: "LAPTOP",
      brand: "Lenovo",
      model: "Lenovo, Ideadpad",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-138",
    customer_id: "CUST-045",
    subject: "Lenovo Thinkpad,uk1166-Dead",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-15T08:44:46.48+00:00",
    resolved_at: "2025-12-16T12:16:12.266+00:00",
    device: {
      type: "LAPTOP",
      brand: "Lenovo",
      model: "Lenovo Thinkpad",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-139",
    customer_id: "CUST-046",
    subject: "Not working",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-15T13:05:09.46+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "opus smps",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-140",
    customer_id: "CUST-047",
    subject: "LENOVO THINKPAD, Screen Change",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-16T12:30:39.344+00:00",
    resolved_at: "2025-12-21T14:08:55.219+00:00",
    device: {
      type: "LAPTOP",
      brand: "LENOVO THINKPAD",
      model: "LENOVO THINKPAD",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-141",
    customer_id: "CUST-048",
    subject: "on problem",
    status: "SERVICE DONE",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sribas Das",
    created_at: "2025-12-17T05:14:30.05+00:00",
    resolved_at: "2025-12-17T05:28:25.385+00:00",
    device: {
      type: "LAPTOP",
      brand: "TOSHIBA",
      model: "ABCD",
      serialNumber: "D-384",
    },
    charger_status: "NO",
    store: "DGP SHOWROOM",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: "2025-12-30",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-142",
    customer_id: "CUST-049",
    subject: "Dell Latop,uk1173-Dead",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-17T07:11:23.556+00:00",
    resolved_at: "2025-12-18T07:16:15.904+00:00",
    device: {
      type: "LAPTOP",
      brand: "Dell",
      model: "Dell Latop",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-143",
    customer_id: "CUST-050",
    subject: "Lenovo Laptop,uk1174-Dim Display",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-17T07:13:44.782+00:00",
    resolved_at: "2025-12-17T12:23:12.426+00:00",
    device: {
      type: "LAPTOP",
      brand: "Lenovo",
      model: "Lenovo",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-144",
    customer_id: "CUST-051",
    subject: "Hp Laptop,uk1176-Display",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-17T07:15:55.193+00:00",
    resolved_at: "2025-12-19T11:50:51.417+00:00",
    device: {
      type: "LAPTOP",
      brand: "Hp",
      model: "HP",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-145",
    customer_id: "CUST-052",
    subject: "HP Laptop,uk1175-Not on",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-17T07:18:03.243+00:00",
    resolved_at: "2025-12-17T12:22:59.134+00:00",
    device: {
      type: "LAPTOP",
      brand: "Hp",
      model: "HP",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-146",
    customer_id: "CUST-046",
    subject: "NOT WORKING",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-17T08:41:56.286+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: "ivoomi",
      model: "smps opus",
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-147",
    customer_id: "CUST-053",
    subject: "NOT STARTING",
    status: "Pending Approval",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: null,
    created_at: "2025-12-17T09:28:50.078+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "Victus",
      serialNumber: "12345",
    },
    charger_status: "YES",
    store: "DGP SHOWROOM",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-148",
    customer_id: "CUST-054",
    subject: "SMPS PROBLEM \n17/12/25 ASN SHOP TO DURGAPUR SERVICE CENTER",
    status: "NEW",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-17T09:46:38.805+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "IVOOMI AMAZ 550W\n",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "DURGAPUR-SR-ICS1192",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-149",
    customer_id: "CUST-055",
    subject:
      "I5-3RD GEN PROCESSOR ISSUE -DEAD 17/12/25 ASN SHOP TO DURGAPUR SERVICE CENTER",
    status: "NEW",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-17T09:49:11.954+00:00",
    resolved_at: null,
    device: {
      type: "ACCESSORY",
      description: "INTEL I5-3RD GEN PROCESSOR",
    },
    charger_status: null,
    store: "ASANSOL",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "IK1T/08946/25-26",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-150",
    customer_id: "CUST-056",
    subject: "On Issue",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-17T10:21:25.833+00:00",
    resolved_at: "2025-12-17T10:22:07.865+00:00",
    device: {
      type: "DESKTOP",
      brand: "Xcess",
      model: "Xcess, On isue",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-151",
    customer_id: "CUST-053",
    subject: "No issue",
    status: "Delivery",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sribas Das",
    created_at: "2025-12-17T10:28:20.827+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
    },
    charger_status: "NO",
    store: "DGP SHOWROOM",
    amount_estimate: 1200,
    warranty: "NO",
    bill_number: null,
    scheduled_date: "2025-12-17",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-152",
    customer_id: "CUST-053",
    subject: "NOT STRAING ON",
    status: "Delivery",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sribas Das",
    created_at: "2025-12-18T06:17:24.162+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "DELL",
      model: "X15",
      serialNumber: "12345",
    },
    charger_status: "YES",
    store: "ASANSOL",
    amount_estimate: 700,
    warranty: "NO",
    bill_number: null,
    scheduled_date: "2025-12-27",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-153",
    customer_id: "CUST-057",
    subject: "CAMERA ISSUE",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-18T08:42:12.852+00:00",
    resolved_at: "2025-12-21T07:19:18.442+00:00",
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "745G6",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-154",
    customer_id: "CUST-058",
    subject: "NOT ON \nASANSOL TO SERVICE CENTER",
    status: "Rejected",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-18T10:45:03.037+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "ACER",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "ASANSOL",
    amount_estimate: 1500,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-155",
    customer_id: "CUST-059",
    subject: "On issue",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-19T05:42:23.842+00:00",
    resolved_at: "2025-12-25T12:20:59.371+00:00",
    device: {
      type: "LAPTOP",
      brand: "Lenovo",
      model: "Lenovo Thinkpad D-1876",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-156",
    customer_id: "CUST-060",
    subject: "Hp laptop,uk1180-Dim display",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-19T06:25:38.224+00:00",
    resolved_at: "2025-12-19T11:49:27.927+00:00",
    device: {
      type: "LAPTOP",
      brand: "Hp",
      model: "HP",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-157",
    customer_id: "CUST-061",
    subject: "Geonix Ssd 256 gb, Uk1081-not work ,Ukhra to service center",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-19T06:28:22.01+00:00",
    resolved_at: "2025-12-27T12:25:40.982+00:00",
    device: {
      type: "ACCESSORY",
      description: "Geonix Ssd 256 gb",
    },
    charger_status: null,
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-158",
    customer_id: "CUST-062",
    subject: "System Format",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-21T06:20:26.043+00:00",
    resolved_at: "2025-12-21T10:37:07.809+00:00",
    device: {
      type: "LAPTOP",
      brand: "Infinix",
      model: "Infinix",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-159",
    customer_id: "CUST-063",
    subject: "Motherboard burnt",
    status: "Rejected",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-21T06:41:14.185+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "Lenovo",
      model: "Lenovo Legion",
    },
    charger_status: "YES",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-160",
    customer_id: "CUST-064",
    subject: "Keyboard change and format",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-21T07:11:54.19+00:00",
    resolved_at: "2025-12-21T10:36:59.496+00:00",
    device: {
      type: "LAPTOP",
      brand: "Dell",
      model: "5559",
    },
    charger_status: "NO",
    store: "DGP SHOWROOM",
    amount_estimate: 1250,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-161",
    customer_id: "CUST-065",
    subject: "Mother board issue ",
    status: "In Progress",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-21T07:14:27.577+00:00",
    resolved_at: null,
    device: {
      type: "DESKTOP",
      brand: "elista",
      model: "Elista",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-162",
    customer_id: "CUST-066",
    subject: "Fan creating sound ",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-21T07:21:55.356+00:00",
    resolved_at: null,
    device: {
      type: "DESKTOP",
      brand: "Frontech",
      model: "Frontech",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-163",
    customer_id: "CUST-067",
    subject: "OS crash everytime",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-21T12:17:12.759+00:00",
    resolved_at: "2025-12-21T14:06:32.254+00:00",
    device: {
      type: "LAPTOP",
      brand: "Dell",
      model: "Dell Latitude 7450 C-150",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-164",
    customer_id: "CUST-068",
    subject: "NOT ON",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-22T10:43:17.885+00:00",
    resolved_at: "2025-12-24T12:44:11.066+00:00",
    device: {
      type: "LAPTOP",
      brand: "DELL",
      model: "DELL LATITUDE 7440",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "ASANSOL",
    amount_estimate: 0,
    warranty: "YES",
    bill_number: "0",
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-165",
    customer_id: "CUST-069",
    subject: "NOT ON",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-22T10:45:41.349+00:00",
    resolved_at: "2025-12-24T12:11:49.361+00:00",
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "HP ELITEBOOK 745 G6 ",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "ASANSOL",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-166",
    customer_id: "CUST-070",
    subject: "TOUCHPAD NOT WORK",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-22T10:47:40.82+00:00",
    resolved_at: "2025-12-25T08:00:21.728+00:00",
    device: {
      type: "LAPTOP",
      brand: "HP",
      model: "HP ELITEBOOK 840 G3",
      serialNumber: "N/A",
    },
    charger_status: "NO",
    store: "ASANSOL",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-167",
    customer_id: "CUST-071",
    subject: "Asus Laptop,uk1185-Hingh Problem",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-23T11:29:22.566+00:00",
    resolved_at: "2025-12-27T07:56:55.193+00:00",
    device: {
      type: "LAPTOP",
      brand: "Asus",
      model: "Asus",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-168",
    customer_id: "CUST-072",
    subject: "Lenovo Thinkpad,uk1186-motherboard change",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-23T11:33:35.711+00:00",
    resolved_at: "2025-12-27T07:56:45.629+00:00",
    device: {
      type: "LAPTOP",
      brand: "Lenovo",
      model: "Lenovo Thinkpad",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-169",
    customer_id: "CUST-073",
    subject: "Apple Macbook Air Laptop,uk1084-Battery.   Os Install isshu",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-24T11:21:57.828+00:00",
    resolved_at: "2025-12-27T14:05:02.149+00:00",
    device: {
      type: "LAPTOP",
      brand: "Apple",
      model: "Apple Macbook Air",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-170",
    customer_id: "CUST-074",
    subject: "Hp Laptop,uk1197-Dim Display",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-26T09:13:58.651+00:00",
    resolved_at: "2025-12-27T12:25:13.198+00:00",
    device: {
      type: "LAPTOP",
      brand: "Hp",
      model: "HP",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-171",
    customer_id: "CUST-075",
    subject: "Life Laptop,uk1198-Not on",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-26T09:16:39.964+00:00",
    resolved_at: "2025-12-27T12:25:07.046+00:00",
    device: {
      type: "LAPTOP",
      brand: "Life",
      model: "Life Laptop",
    },
    charger_status: "NO",
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-172",
    customer_id: "CUST-076",
    subject: 'Ivoomi 22" Monitor,uk1182',
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-26T09:19:00.726+00:00",
    resolved_at: null,
    device: {
      type: "BRAND SERVICE",
      brand: 'Ivoomi 22" Monitor',
      model: 'Ivoomi 22" Monitor',
      brandService: "IVOOMI",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-173",
    customer_id: "CUST-077",
    subject: "Zebronices Speaker,uk1196,Not work,ukhra to service center",
    status: "Resolved",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Sanjay Kr. Mondal",
    created_at: "2025-12-26T09:27:39.932+00:00",
    resolved_at: "2025-12-27T12:24:21.543+00:00",
    device: {
      type: "ACCESSORY",
      description: "Zebronices Speaker,Bass Only",
    },
    charger_status: null,
    store: "UKHRA",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-174",
    customer_id: "CUST-078",
    subject: "Cabinet on off button issue",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-27T05:48:23.368+00:00",
    resolved_at: "2025-12-27T07:58:32.336+00:00",
    device: {
      type: "DESKTOP",
      brand: "Zebronics",
      model: "Zebronics",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-175",
    customer_id: "CUST-079",
    subject: "Auto off and wifi issue",
    status: "Resolved",
    hold_reason: null,
    priority: "HIGH",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-27T07:04:24.735+00:00",
    resolved_at: "2025-12-27T08:14:44.487+00:00",
    device: {
      type: "LAPTOP",
      brand: "Hp",
      model: "Hp Elitebook",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-176",
    customer_id: "CUST-080",
    subject: "WHITE SCREEN",
    status: "HOLD",
    hold_reason: "Awaiting Parts",
    priority: "LOW",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-27T09:08:17.341+00:00",
    resolved_at: null,
    device: {
      type: "DESKTOP",
      brand: "CONSISTENT",
      model: "CONSISTENT",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-177",
    customer_id: "CUST-081",
    subject: "Hp laptop,uk1208-keyboard change",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-30T08:50:44.249+00:00",
    resolved_at: "2025-12-30T13:52:29.994+00:00",
    device: {
      type: "LAPTOP",
      brand: "Hp",
      model: "HP",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-178",
    customer_id: "CUST-082",
    subject: "Lenovo lapotp,uk1207-Display",
    status: "Resolved",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-30T08:52:27.641+00:00",
    resolved_at: "2025-12-31T07:28:32.903+00:00",
    device: {
      type: "LAPTOP",
      brand: "Lenovo",
      model: "Lenovo",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-179",
    customer_id: "CUST-083",
    subject: "Dell Latop,uk1206-charging port problem",
    status: "Rejected",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-30T08:54:51.181+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "Dell",
      model: "Dell Latop",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-180",
    customer_id: "CUST-084",
    subject: "Hp laptop,uk1209-Dead",
    status: "In Progress",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-30T08:56:31.517+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "Hp",
      model: "HP",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-181",
    customer_id: "CUST-085",
    subject: "Password forget and slow issue",
    status: "NEW",
    hold_reason: null,
    priority: "LOW",
    assigned_to: "Ratan Rajbhar",
    created_at: "2025-12-31T06:11:06.67+00:00",
    resolved_at: null,
    device: {
      type: "DESKTOP",
      brand: "Foxin",
      model: "Foxin",
    },
    charger_status: null,
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-182",
    customer_id: "CUST-086",
    subject: "Battery & keyboard issue",
    status: "HOLD",
    hold_reason: "Awaiting Parts",
    priority: "LOW",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-31T06:14:59.897+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "Lenovo",
      model: "Thinkpad, D1734",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-183",
    customer_id: "CUST-087",
    subject: "CPU Fan issue",
    status: "In Progress",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-31T06:17:02.121+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "Asus",
      model: "Asus Vivobook",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: null,
    internal_progress_reason: null,
    internal_progress_note: null,
  },
  {
    id: "TKT-IF-184",
    customer_id: "CUST-088",
    subject: "Power not on",
    status: "NEW",
    hold_reason: null,
    priority: "MEDIUM",
    assigned_to: "Sagar Chakraborty",
    created_at: "2025-12-31T12:10:20.14+00:00",
    resolved_at: null,
    device: {
      type: "LAPTOP",
      brand: "Asus tuff",
    },
    charger_status: "NO",
    store: "SERVICE CENTER",
    amount_estimate: 0,
    warranty: "NO",
    bill_number: null,
    scheduled_date: "2026-01-03",
    internal_progress_reason: null,
    internal_progress_note: null,
  },
];

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
