import React, { useState, useEffect } from "react";
import {
  PenTool,
  History,
  Download,
  AlertTriangle,
  Search,
  User,
  Phone,
  MapPin,
  Check,
  Clock,
  ChevronRight,
  Activity,
  GitPullRequest,
  PauseCircle,
  PlayCircle,
  Lock,
  Monitor,
  Layers,
  BatteryCharging,
  Tag,
  FileText,
  DollarSign,
  FileClock,
  X,
  Loader2,
} from "lucide-react";
import {
  Ticket,
  Customer,
  AppSettings,
  User as AppUser,
  TicketHistory,
} from "../types";
import { jsPDF } from "jspdf";
import { supabase } from "@/lib/supabaseClient";
// Helper to generate IDs
{
  /*const generateId = (prefix: string, list: any[]) => {
  const safeList = list || [];
  const count = safeList.length + 1;
  const padded = count.toString().padStart(3, '0');
  return `${prefix}-${padded}`;
};*/
}

{
  /*interface TicketFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  setCustomers: (c: Customer[]) => void;
  setTickets: (t: Ticket[]) => void;
  tickets: Ticket[];
  settings: AppSettings;
  currentUser: AppUser;
  editingTicket?: Ticket | null;
  onSuccess?: () => void;
}*/
}
interface TicketFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  settings: AppSettings;
  currentUser: AppUser;
  editingTicket?: Ticket | null;
  onSuccess?: () => void;
}

export const TicketFormModal: React.FC<TicketFormModalProps> = ({
  isOpen,
  onClose,
  customers = [],
  settings,
  currentUser,
  editingTicket,
  onSuccess,
}) => {
  // UI State
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);

  // Form State
  const initialFormState = {
    email: "",
    name: "",
    mobile: "",
    address: "",

    deviceType: "Smartphone",
    brand: "",
    model: "",
    serial: "",
    chargerIncluded: "No",
    deviceDescription: "",

    issueDescription: "",
    store: settings?.stores?.[0]?.name || "",
    estimatedAmount: "",
    warranty: "No",
    billNumber: "",
    priority: "Medium",

    // Workflow State
    status: "New",
    holdReason: "",
    progressReason: "",
    progressNote: "",

    scheduledDate: "",
    assignedToId: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [transferNote, setTransferNote] = useState(""); // State for store transfer reason
  const [rejectionNote, setRejectionNote] = useState(""); // New state for rejection reason
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const canEditCustomer =
    currentUser.role === "ADMIN" || currentUser.role === "MANAGER";

  // Detect if store has changed
  const isStoreChanged =
    editingTicket && formData.store !== editingTicket.store;

  // Initialize form when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab("details"); // Reset to details tab on open
      setTransferNote(""); // Reset transfer note
      setRejectionNote(""); // Reset rejection note
      setIsSubmitting(false); // Reset submitting state
      if (editingTicket) {
        setFormData({
          email: editingTicket.email,
          name: editingTicket.name,
          mobile: editingTicket.number,
          address: editingTicket.address,
          deviceType: editingTicket.deviceType,
          brand: editingTicket.brand || "",
          model: editingTicket.model || "",
          serial: editingTicket.serial || "",
          chargerIncluded: editingTicket.chargerIncluded ? "Yes" : "No",
          deviceDescription: editingTicket.deviceDescription || "",
          issueDescription: editingTicket.issueDescription,
          store: editingTicket.store,
          estimatedAmount: editingTicket.estimatedAmount?.toString() || "",
          warranty: editingTicket.warranty ? "Yes" : "No",
          billNumber: editingTicket.billNumber || "",
          priority: editingTicket.priority,

          status: editingTicket.status,
          holdReason: editingTicket.holdReason || "",
          progressReason: editingTicket.progressReason || "",
          progressNote: editingTicket.progressNote || "",

          scheduledDate: editingTicket.scheduledDate || "",
          assignedToId: editingTicket.assignedToId || "",
        });
        const cust = customers.find((c) => c.id === editingTicket.customerId);
        setExistingCustomer(cust || null);
      } else {
        setFormData(initialFormState);
        setExistingCustomer(null);
      }
      setError(null);
    }
  }, [isOpen, editingTicket]);

  // Search Customer on Email Change (Visual feedback only)
  useEffect(() => {
    if (editingTicket) return;

    const timer = setTimeout(() => {
      if (formData.email) {
        const found = customers.find(
          (c) => c.email.toLowerCase() === formData.email.toLowerCase()
        );
        if (found) {
          setExistingCustomer(found);
          setFormData((prev) => ({
            ...prev,
            name: found.name,
            mobile: found.mobile,
            address: found.address,
          }));
        } else {
          setExistingCustomer(null);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.email, customers, editingTicket]);

  // Auto-switch status to 'On Hold' when a hold reason is selected
  useEffect(() => {
    if (formData.holdReason && formData.holdReason !== "") {
      setFormData((prev) => ({ ...prev, status: "On Hold" }));
    }
  }, [formData.holdReason]);

  useEffect(() => {
    const loadAssignableUsers = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, role");

      if (error) {
        console.error("Error loading users:", error);
        return;
      }

      let filteredUsers = data || [];

      // 🔐 ROLE-BASED FILTERING
      if (currentUser.role === "MANAGER") {
        filteredUsers = filteredUsers.filter(
          (u) => u.role === "MANAGER" || u.role === "TECHNICIAN"
        );
      }

      // ADMIN sees everyone → no filter

      setAssignableUsers(filteredUsers);
    };

    if (
      isOpen &&
      (currentUser.role === "ADMIN" || currentUser.role === "MANAGER")
    ) {
      loadAssignableUsers();
    }
  }, [isOpen, currentUser.role]);

  // --- HISTORY LOGIC ---
  const createHistoryEntry = (
    action: string,
    details: string
  ): TicketHistory => {
    return {
      id: Date.now().toString() + Math.random().toString().slice(2, 5),
      date:
        new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
      timestamp: Date.now(),
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action,
      details,
    };
  };

  const handleDownloadHistory = () => {
    if (!editingTicket || !editingTicket.history) return;

    const doc = new jsPDF();
    // (Existing PDF generation logic remains the same)
    // ...
    doc.save(
      `Audit_${editingTicket.ticketId}_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        customer_id: existingCustomer?.id || null,
        subject: formData.issueDescription,
        status: formData.status,
        hold_reason: formData.holdReason || null,
        priority: formData.priority,
        assigned_to:
          assignableUsers.find((u) => u.id === formData.assignedToId)?.name ||
          null,

        device_type: formData.deviceType,
        device_brand: formData.brand || null,
        device_model: formData.model || null,
        device_serial_number: formData.serial || null,
        charger_status: formData.chargerIncluded || null,

        store: formData.store,
        amount_estimate: formData.estimatedAmount || 0,
        warranty: formData.warranty,
        bill_number: formData.billNumber || null,
        scheduled_date: formData.scheduledDate || null,

        internal_progress_reason: formData.progressReason || null,
        internal_progress_note: formData.progressNote || null,
        device_brand_service:
          formData.deviceType === "Brand Service" ? formData.brand : null,
        device_description: formData.deviceDescription || null,
      };

      // ---------------- EDIT TICKET ----------------
      if (editingTicket) {
        const { error } = await supabase
          .from("tickets")
          .update(payload)
          .eq("id", editingTicket.id);
        alert("Ticket Edited Successfully");
        if (error) throw error;
      }

      // ---------------- CREATE TICKET ----------------
      else {
        const { error } = await supabase.from("tickets").insert([
          {
            ...payload,
            created_at: new Date().toISOString(),
          },
        ]);
        alert("Ticket Created Successfully");

        if (error) throw error;
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to save ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAccessoryOrOther =
    formData.deviceType === "Accessory" || formData.deviceType === "Other";
  const isBrandService = formData.deviceType === "Brand Service";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/75 backdrop-blur-sm transition-opacity"
        onClick={() => !isSubmitting && onClose()}
      />

      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white z-10">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                editingTicket
                  ? "bg-amber-100 text-amber-600"
                  : "bg-indigo-100 text-indigo-600"
              }`}
            >
              <PenTool size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                {editingTicket
                  ? `Editing ${editingTicket.ticketId}`
                  : "New Service Ticket"}
              </h2>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                {editingTicket ? "Update job details" : "Create new job card"}
              </p>
            </div>
          </div>

          {/* Tab Switcher (Only visible when editing) */}
          {editingTicket && (
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "details"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Ticket Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${
                  activeTab === "history"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <History size={14} /> History Log
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar relative">
          {isSubmitting && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center">
              <div className="bg-white p-4 rounded-2xl shadow-xl flex flex-col items-center border border-slate-100">
                <Loader2
                  size={32}
                  className="text-indigo-600 animate-spin mb-2"
                />
                <p className="text-sm font-bold text-slate-700">
                  Saving Ticket...
                </p>
              </div>
            </div>
          )}

          {/* --- HISTORY TAB --- */}
          {activeTab === "history" && editingTicket ? (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileClock size={20} className="text-indigo-600" /> Audit
                  Timeline
                </h3>
                <button
                  onClick={handleDownloadHistory}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 hover:bg-slate-800 transition-colors"
                >
                  <Download size={14} /> Download PDF
                </button>
              </div>

              <div className="pl-4">
                {editingTicket.history && editingTicket.history.length > 0 ? (
                  <div className="space-y-0 relative border-l-2 border-slate-200">
                    {[...editingTicket.history]
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .map((log, index) => {
                        const isTransfer = log.action === "Store Transfer";
                        const isCreation = log.action === "Ticket Created";
                        const isRejection = log.details
                          .toLowerCase()
                          .includes("rejected");
                        return (
                          <div
                            key={log.id}
                            className="relative pl-8 pb-8 last:pb-0 group"
                          >
                            {/* Dot */}
                            <div
                              className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${
                                isRejection
                                  ? "bg-red-500"
                                  : isTransfer
                                  ? "bg-amber-500"
                                  : isCreation
                                  ? "bg-green-500"
                                  : "bg-indigo-500"
                              }`}
                            ></div>

                            {/* Content */}
                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
                              <div className="min-w-[140px] shrink-0">
                                <time className="text-xs font-bold text-slate-900">
                                  {log.date.split(" ")[0]}
                                </time>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {log.date.split(" ").slice(1).join(" ")}
                                </div>
                              </div>

                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className={`text-sm font-bold ${
                                      isTransfer
                                        ? "text-amber-700"
                                        : isRejection
                                        ? "text-red-700"
                                        : "text-slate-800"
                                    }`}
                                  >
                                    {log.action}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium border border-slate-200">
                                    by {log.actorName} ({log.actorRole})
                                  </span>
                                </div>
                                <p
                                  className={`text-sm leading-relaxed ${
                                    isTransfer
                                      ? "text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-100"
                                      : isRejection
                                      ? "text-red-800 bg-red-50 p-2 rounded-lg border border-red-100"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {log.details}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400">
                    No history logs found for this ticket.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* --- DETAILS TAB (Main Form) --- */
            <>
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-3 shadow-sm animate-in slide-in-from-top-2">
                  <div className="p-2 bg-red-100 rounded-full shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <span className="font-medium text-sm">{error}</span>
                </div>
              )}

              <form
                id="ticket-form"
                onSubmit={handleSubmit}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                {/* LEFT COLUMN: Customer */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Customer Card */}
                  <div
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                      existingCustomer
                        ? "border-indigo-200 ring-1 ring-indigo-50"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <User size={16} className="text-indigo-500" />
                        Customer Details
                      </h3>
                      {existingCustomer && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-100">
                          <Check size={10} /> EXISTING CUSTOMER
                        </span>
                      )}
                      {!existingCustomer && formData.email && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          NEW CUSTOMER
                        </span>
                      )}
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Email Search */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                          Email (Search)
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Search size={16} />
                          </div>
                          <input
                            type="email"
                            value={formData.email}
                            readOnly={!!editingTicket && !canEditCustomer}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                email: e.target.value,
                              })
                            }
                            className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none transition-all ${
                              !!editingTicket && !canEditCustomer
                                ? "cursor-not-allowed opacity-70"
                                : "focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            }`}
                            placeholder="Search or enter email..."
                            autoFocus={!editingTicket}
                          />
                        </div>
                      </div>

                      {/* Name & Mobile Row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            Full Name *
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <User size={16} />
                            </div>
                            <input
                              type="text"
                              required
                              readOnly={!!existingCustomer && !canEditCustomer}
                              value={formData.name}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  name: e.target.value,
                                })
                              }
                              className={`w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none transition-all ${
                                !!existingCustomer && !canEditCustomer
                                  ? "bg-slate-100/50 cursor-not-allowed text-slate-500"
                                  : "focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              }`}
                              placeholder="John Doe"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            Mobile No *
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <Phone size={16} />
                            </div>
                            <input
                              type="tel"
                              required
                              readOnly={!!existingCustomer && !canEditCustomer}
                              value={formData.mobile}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  mobile: e.target.value,
                                })
                              }
                              className={`w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none transition-all ${
                                !!existingCustomer && !canEditCustomer
                                  ? "bg-slate-100/50 cursor-not-allowed text-slate-500"
                                  : "focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              }`}
                              placeholder="555-0000"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Address */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                          Address
                        </label>
                        <div className="relative">
                          <div className="absolute top-3 left-3 pointer-events-none text-slate-400">
                            <MapPin size={16} />
                          </div>
                          <textarea
                            rows={2}
                            readOnly={!!existingCustomer && !canEditCustomer}
                            value={formData.address}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                address: e.target.value,
                              })
                            }
                            className={`w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none transition-all ${
                              !!existingCustomer && !canEditCustomer
                                ? "bg-slate-100/50 cursor-not-allowed text-slate-500"
                                : "focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            }`}
                            placeholder="Street address, City..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Store & Schedule Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
                      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Clock size={16} className="text-indigo-500" />
                        Logistics
                      </h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                          Store Location *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <MapPin size={16} />
                          </div>
                          <select
                            required
                            value={formData.store}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                store: e.target.value,
                              })
                            }
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
                          >
                            {settings?.stores?.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                            <ChevronRight size={16} className="rotate-90" />
                          </div>
                        </div>
                        {isStoreChanged && (
                          <div className="mt-3 animate-in fade-in slide-in-from-top-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                            <label className="block text-xs font-bold text-amber-800 uppercase tracking-wide mb-1.5 ml-1 flex items-center gap-1">
                              <AlertTriangle size={12} /> Reason for Transfer *
                            </label>
                            <textarea
                              required
                              value={transferNote}
                              onChange={(e) => setTransferNote(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none resize-none text-slate-700 placeholder-amber-300/50"
                              placeholder="Please provide a valid reason for moving this ticket to another store..."
                              rows={2}
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            Scheduled Date
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <Clock size={16} />
                            </div>
                            <input
                              type="date"
                              value={formData.scheduledDate}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  scheduledDate: e.target.value,
                                })
                              }
                              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        {(currentUser.role === "ADMIN" ||
                          currentUser.role === "MANAGER") && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                              Assign To
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <User size={16} />
                              </div>
                              <select
                                value={formData.assignedToId}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    assignedToId: e.target.value,
                                  })
                                }
                                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
                              >
                                <option value="">Unassigned</option>
                                {assignableUsers?.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                <ChevronRight size={16} className="rotate-90" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Device & Service */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
                      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Activity size={16} className="text-indigo-500" />
                        Workflow & Status
                      </h3>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                          Current Status
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <GitPullRequest size={16} />
                          </div>
                          <select
                            value={formData.status}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                status: e.target.value,
                              })
                            }
                            className={`w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none font-semibold ${
                              formData.status === "New"
                                ? "text-blue-600"
                                : formData.status === "Resolved"
                                ? "text-green-600"
                                : formData.status === "On Hold"
                                ? "text-orange-600"
                                : formData.status === "Rejected"
                                ? "text-red-600"
                                : "text-slate-700"
                            }`}
                          >
                            {settings?.ticketStatuses?.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                            <ChevronRight size={16} className="rotate-90" />
                          </div>
                        </div>
                        {formData.status === "Rejected" && (
                          <div className="mt-3 animate-in fade-in slide-in-from-top-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                            <label className="block text-xs font-bold text-red-800 uppercase tracking-wide mb-1.5 ml-1 flex items-center gap-1">
                              <AlertTriangle size={12} /> Rejection Reason *
                            </label>
                            <textarea
                              required
                              value={rejectionNote}
                              onChange={(e) => setRejectionNote(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none text-slate-700 placeholder-red-300/50"
                              placeholder="Please explain why this ticket is being rejected..."
                              rows={2}
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="mb-2">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            Hold Reason
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <PauseCircle size={16} />
                            </div>
                            <select
                              value={formData.holdReason}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  holdReason: e.target.value,
                                })
                              }
                              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none text-slate-600"
                            >
                              <option value="">-- None --</option>
                              {settings?.holdReasons?.map((r) => (
                                <option key={r.id} value={r.name}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                              <ChevronRight size={16} className="rotate-90" />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            Internal Progress
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <PlayCircle size={16} />
                            </div>
                            <select
                              value={formData.progressReason}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  progressReason: e.target.value,
                                })
                              }
                              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none text-slate-600"
                            >
                              <option value="">-- None --</option>
                              {settings?.progressReasons?.map((r) => (
                                <option key={r.id} value={r.name}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                              <ChevronRight size={16} className="rotate-90" />
                            </div>
                          </div>
                          {formData.progressReason && (
                            <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                  <Lock size={14} />
                                </div>
                                <input
                                  type="text"
                                  value={formData.progressNote}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      progressNote: e.target.value,
                                    })
                                  }
                                  placeholder="Internal notes (Hidden from customer)..."
                                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
                      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Monitor size={16} className="text-indigo-500" />
                        Device Information
                      </h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            Device Type
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <Layers size={16} />
                            </div>
                            <select
                              value={formData.deviceType}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  deviceType: e.target.value,
                                })
                              }
                              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
                            >
                              {settings?.deviceTypes?.map((d) => (
                                <option key={d.id} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                              <ChevronRight size={16} className="rotate-90" />
                            </div>
                          </div>
                        </div>
                        {formData.deviceType === "Laptop" && (
                          <div className="animate-in fade-in slide-in-from-left-2">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                              Charger Included?
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <BatteryCharging size={16} />
                              </div>
                              <select
                                value={formData.chargerIncluded}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    chargerIncluded: e.target.value,
                                  })
                                }
                                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
                              >
                                <option>No</option>
                                <option>Yes</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                <ChevronRight size={16} className="rotate-90" />
                              </div>
                            </div>
                          </div>
                        )}
                        {formData.deviceType === "Brand Service" && (
                          <div className="animate-in fade-in slide-in-from-left-2">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                              Brand Selection
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Tag size={16} />
                              </div>
                              <select
                                value={formData.brand}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    brand: e.target.value,
                                  })
                                }
                                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
                              >
                                <option value="">Select Brand...</option>
                                {settings?.serviceBrands?.map((b) => (
                                  <option key={b.id} value={b.name}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                <ChevronRight size={16} className="rotate-90" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      {formData.deviceType === "Accessory" ||
                      formData.deviceType === "Other" ? (
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            Item Description
                          </label>
                          <textarea
                            rows={3}
                            value={formData.deviceDescription}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                deviceDescription: e.target.value,
                              })
                            }
                            placeholder="Detailed description of the item..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-4">
                          {formData.deviceType !== "Brand Service" && (
                            <div className="col-span-1">
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                                Brand
                              </label>
                              <input
                                type="text"
                                value={formData.brand}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    brand: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="e.g. Dell"
                              />
                            </div>
                          )}
                          <div
                            className={
                              formData.deviceType === "Brand Service"
                                ? "col-span-2"
                                : "col-span-1"
                            }
                          >
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                              Model
                            </label>
                            <input
                              type="text"
                              value={formData.model}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  model: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              placeholder="e.g. XPS 13"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                              Serial #
                            </label>
                            <input
                              type="text"
                              value={formData.serial}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  serial: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              placeholder="SN-12345"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
                      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <FileText size={16} className="text-indigo-500" />
                        Service Details
                      </h3>
                    </div>
                    <div className="p-5 space-y-5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                          Issue Description *
                        </label>
                        <textarea
                          required
                          rows={4}
                          value={formData.issueDescription}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              issueDescription: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-colors"
                          placeholder="Please describe the reported issue in detail..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            Priority Level
                          </label>
                          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                            {settings?.priorities?.map((p) => {
                              const isSelected = formData.priority === p.name;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() =>
                                    setFormData({
                                      ...formData,
                                      priority: p.name,
                                    })
                                  }
                                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${
                                    isSelected
                                      ? "bg-white text-slate-800 shadow-sm ring-1 ring-black/5"
                                      : "text-slate-500 hover:text-slate-700"
                                  }`}
                                >
                                  {p.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                            Estimated Cost
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <DollarSign size={16} />
                            </div>
                            <input
                              type="number"
                              value={formData.estimatedAmount}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  estimatedAmount: e.target.value,
                                })
                              }
                              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Tag size={16} className="text-amber-500" />
                            Warranty Claim?
                          </span>
                          <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                            <button
                              type="button"
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  warranty: "No",
                                  billNumber: "",
                                })
                              }
                              className={`px-3 py-1 text-xs font-bold uppercase rounded ${
                                formData.warranty === "No"
                                  ? "bg-slate-100 text-slate-700"
                                  : "text-slate-400 hover:text-slate-600"
                              }`}
                            >
                              No
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData({ ...formData, warranty: "Yes" })
                              }
                              className={`px-3 py-1 text-xs font-bold uppercase rounded ${
                                formData.warranty === "Yes"
                                  ? "bg-amber-100 text-amber-700"
                                  : "text-slate-400 hover:text-slate-600"
                              }`}
                            >
                              Yes
                            </button>
                          </div>
                        </div>
                        {formData.warranty === "Yes" && (
                          <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                              Bill / Invoice Number *
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <FileText size={16} />
                              </div>
                              <input
                                type="text"
                                required
                                value={formData.billNumber}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    billNumber: e.target.value,
                                  })
                                }
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="Enter invoice number..."
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer (Hidden if in History tab) */}
        {activeTab === "details" && (
          <div className="px-6 py-4 border-t border-slate-200 bg-white z-10 flex items-center justify-between">
            <div className="hidden sm:block text-xs text-slate-500 font-medium">
              Fields marked with <span className="text-red-500">*</span> are
              required
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-6 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="ticket-form"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform hover:translate-y-[-1px] text-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting
                  ? "Saving..."
                  : editingTicket
                  ? "Save Changes"
                  : "Create Ticket"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
