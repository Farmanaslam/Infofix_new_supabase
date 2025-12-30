import React, { useState } from "react";
import {
  ShieldAlert,
  Save,
  Trash2,
  Plus,
  Edit2,
  Download,
  Users,
  Database,
  Store,
  Smartphone,
  ListOrdered,
  AlertTriangle,
  Check,
  X,
  Clock,
  Briefcase,
  ChevronDown,
  Tag,
  Layout,
  Loader2,
  Laptop,
} from "lucide-react";
import { User, Ticket, Role, SLAConfig, AppSettings } from "../types";

import { supabase } from "@/lib/supabaseClient";

interface SettingsProps {
  currentUser: User;
  tickets: Ticket[];
  onUpdateTickets: (tickets: Ticket[]) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

// --- SUB-COMPONENTS ---

// 1. Access Denied Component
const AccessDenied = () => (
  <div className="flex flex-col items-center justify-center h-full text-center p-8">
    <div className="bg-red-50 p-6 rounded-full mb-6">
      <ShieldAlert size={64} className="text-red-500" />
    </div>
    <h2 className="text-3xl font-bold text-slate-800 mb-4">Access Denied</h2>
    <p className="text-slate-500 max-w-md text-lg">
      You do not have permission to view this page. <br />
      Only administrators can modify application settings.
    </p>
  </div>
);

// 2. Simple List Manager (Generic)
interface SimpleListManagerProps {
  title: string;
  items: { id: string; name: string; isSystem?: boolean }[];
  onAdd: (name: string) => void;
  onEdit: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  placeholder: string;
  dependencyCheck?: (name: string) => boolean;
}

const SimpleListManager: React.FC<SimpleListManagerProps> = ({
  title,
  items,
  onAdd,
  onEdit,
  onDelete,
  placeholder,
  dependencyCheck,
}) => {
  const [newItemName, setNewItemName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newItemName.trim()) return;
    if (
      items.some(
        (i) => i.name.toLowerCase() === newItemName.trim().toLowerCase()
      )
    ) {
      setError("Item already exists");
      return;
    }
    onAdd(newItemName.trim());
    setNewItemName("");
    setError(null);
  };

  const startEdit = (item: { id: string; name: string }) => {
    setEditingId(item.id);
    setEditValue(item.name);
    setError(null);
  };

  const saveEdit = (id: string) => {
    if (!editValue.trim()) return;
    onEdit(id, editValue.trim());
    setEditingId(null);
  };

  const attemptDelete = (item: {
    id: string;
    name: string;
    isSystem?: boolean;
  }) => {
    if (item.isSystem) {
      setError("Cannot delete system default items");
      return;
    }
    if (dependencyCheck && dependencyCheck(item.name)) {
      setError(`Cannot delete "${item.name}" because it is currently in use.`);
      return;
    }
    onDelete(item.id);
    setError(null);
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
        <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
        {title}
      </h3>

      {error && (
        <div className="mb-3 p-2.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
        />
        <button
          onClick={handleAdd}
          className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar min-h-[150px]">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg group border border-transparent hover:border-slate-200 transition-colors"
          >
            {editingId === item.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => saveEdit(item.id)}
                  className="p-1 text-green-600 hover:bg-green-100 rounded"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1 text-red-500 hover:bg-red-100 rounded"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <span className="text-slate-700 font-medium text-sm">
                  {item.name}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(item)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => attemptDelete(item)}
                    className={`p-1.5 rounded ${
                      item.isSystem
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                    }`}
                    disabled={item.isSystem}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-slate-400 text-xs text-center py-4 italic">
            No items added yet.
          </p>
        )}
      </div>
    </div>
  );
};

// 3. Team Member Modal
interface TeamMemberModalProps {
  member?: User;
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: User) => void;
}

const TeamMemberModal: React.FC<TeamMemberModalProps> = ({
  member,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<User>>(
    member || {
      name: "",
      email: "",
      role: "TECHNICIAN",
      experience: "",
      photo: "",
    }
  );
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setFormData(
        member || {
          name: "",
          email: "",
          role: "TECHNICIAN",
          experience: "",
          photo: "",
        }
      );
      setError(null);
    }
  }, [isOpen, member]);

  // Updated handler with compression logic
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];

    if (!file) return;

    if (file.size > 1024 * 1024) {
      setError("File is too large. Max 1MB.");
      return;
    }

    setIsCompressing(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Resize & Compress
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        setFormData((prev) => ({ ...prev, photo: compressedBase64 }));
        setIsCompressing(false);
      };
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800">
            {member ? "Edit Team Member" : "Add Team Member"}
          </h3>
          <button onClick={onClose}>
            <X size={20} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg flex items-center gap-2">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          <div className="flex items-center gap-5 mb-2">
            <div className="w-20 h-20 rounded-full bg-slate-100 overflow-hidden border-2 border-slate-200 flex items-center justify-center relative group shadow-inner">
              {isCompressing ? (
                <Loader2 size={24} className="text-indigo-500 animate-spin" />
              ) : formData.photo ? (
                <img
                  src={formData.photo}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Users size={32} className="text-slate-300" />
              )}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <label className="cursor-pointer text-white text-xs font-medium px-2 py-1 bg-black/50 rounded hover:bg-black/70 transition-colors">
                  Change
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-slate-700">Profile Photo</h4>
              <p className="text-xs text-slate-400 mt-1">
                Max 1MB. Auto-compressed.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                Full Name
              </label>
              <input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as Role })
                }
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white text-sm"
              >
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="TECHNICIAN">Technician</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Password
            </label>
            <input
              type="password"
              value={formData.password || ""}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="Temporary password"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
              Experience / Bio
            </label>
            <textarea
              value={formData.experience}
              onChange={(e) =>
                setFormData({ ...formData, experience: e.target.value })
              }
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm resize-none"
              rows={3}
            />
          </div>

          <button
            onClick={() => {
              if (formData.name && formData.email) onSave(formData as User);
            }}
            disabled={isCompressing}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 mt-2 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isCompressing ? "Processing Image..." : "Save Member"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN SETTINGS COMPONENT ---

export default function Settings({
  currentUser,
  tickets,
  onUpdateTickets,
  settings,
  onUpdateSettings,
}: SettingsProps) {
  // --- STATE ---
  const [activeSection, setActiveSection] = useState<string>("team");

  // Modal States
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | undefined>(
    undefined
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  React.useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to fetch users", error);
        return;
      }

      onUpdateSettings({
        ...settings,
        teamMembers: data as User[],
      });
    };

    fetchUsers();
  }, []);

  // --- HANDLERS ---

  // Generic List Handlers
  const createListHandlers = (
    listKey: keyof AppSettings,
    dependencyKey?: keyof Ticket
  ) => {
    // We safely cast here because we know which keys we are passing and their array type structure
    const list = settings[listKey] as any[];

    return {
      items: list,
      onAdd: (name: string) => {
        onUpdateSettings({
          ...settings,
          [listKey]: [...list, { id: Date.now().toString(), name }],
        });
      },
      onEdit: (id: string, newName: string) => {
        const oldItem = list.find((i) => i.id === id);
        onUpdateSettings({
          ...settings,
          [listKey]: list.map((item) =>
            item.id === id ? { ...item, name: newName } : item
          ),
        });

        // Update tickets if a store or critical field is renamed
        if (oldItem && dependencyKey) {
          const updatedTickets = tickets.map((t) =>
            t[dependencyKey] === oldItem.name
              ? { ...t, [dependencyKey]: newName }
              : t
          );
          onUpdateTickets(updatedTickets);
        }
      },
      onDelete: (id: string) => {
        onUpdateSettings({
          ...settings,
          [listKey]: list.filter((item) => item.id !== id),
        });
      },
      dependencyCheck: (name: string) =>
        dependencyKey ? tickets.some((t) => t[dependencyKey] === name) : false,
    };
  };

  // Team Handlers
  const handleSaveMember = async (member: User) => {
    try {
      // =========================
      // UPDATE EXISTING USER
      // =========================
      if (member.id) {
        const { error } = await supabase
          .from("users")
          .update({
            name: member.name,
            role: member.role,
            experience: member.experience || "",
            photo: member.photo || "",
          })
          .eq("id", member.id);

        if (error) throw error;

        onUpdateSettings({
          ...settings,
          teamMembers: settings.teamMembers.map((m) =>
            m.id === member.id ? member : m
          ),
        });
      }

      // =========================
      // CREATE NEW USER
      // =========================
      else {
        if (!member.password) {
          throw new Error("Password is required");
        }

        // 1️⃣ Create auth user (FRONTEND SAFE)
        const { data: authData, error: authError } = await supabase.auth.signUp(
          {
            email: member.email,
            password: member.password,
          }
        );

        if (authError || !authData.user) throw authError;

        const userId = authData.user.id;

        // 2️⃣ Insert profile
        const { error: dbError } = await supabase.from("users").insert({
          id: userId,
          name: member.name,
          email: member.email,
          role: member.role,
          experience: member.experience || "",
          photo: member.photo || "",
          created_at: new Date().toISOString(),
        });

        if (dbError) throw dbError;

        onUpdateSettings({
          ...settings,
          teamMembers: [...settings.teamMembers, { ...member, id: userId }],
        });
      }

      setIsTeamModalOpen(false);
      setEditingMember(undefined);
    } catch (err: any) {
      alert(err.message || "Failed to save member");
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      // delete profile
      const { error } = await supabase.from("users").delete().eq("id", id);

      if (error) throw error;

      // delete auth user
      await supabase.auth.admin.deleteUser(id);

      onUpdateSettings({
        ...settings,
        teamMembers: settings.teamMembers.filter((m) => m.id !== id),
      });

      setConfirmDeleteId(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete member");
    }
  };

  const handleSlaUpdate = (key: keyof SLAConfig, value: number) => {
    onUpdateSettings({
      ...settings,
      sla: { ...settings.sla, [key]: value },
    });
  };

  // Data Export
  const handleExportBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      settings,
      tickets,
      auditLog: [], // Placeholder
    };

    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute(
      "download",
      `crm_backup_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Navigation Groups
  const navGroups = [
    {
      title: "General",
      items: [
        { id: "team", label: "Team Members", icon: Users },
        { id: "stores", label: "Store Locations", icon: Store },
      ],
    },
    {
      title: "Service Configuration",
      items: [
        { id: "workflow", label: "Workflow", icon: ListOrdered },
        { id: "devices", label: "Device Types", icon: Smartphone },
        { id: "brands", label: "Service Brands", icon: Tag },
      ],
    },
    {
      title: "Modules",
      items: [{ id: "laptop", label: "Laptop Reports", icon: Laptop }],
    },
    {
      title: "Rules & Data",
      items: [
        { id: "sla", label: "SLA Config", icon: Clock },
        { id: "data", label: "Data & Backup", icon: Database },
      ],
    },
  ];

  // --- RENDER ---

  if (currentUser.role !== "ADMIN") return <AccessDenied />;

  const activeTitle = navGroups
    .flatMap((g) => g.items)
    .find((i) => i.id === activeSection)?.label;

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-140px)]">
      {/* Sidebar Navigation */}
      <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-4">
        {/* Mobile Horizontal Nav */}
        <div className="lg:hidden overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-2">
            {navGroups
              .flatMap((g) => g.items)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap text-sm font-bold border transition-all ${
                    activeSection === item.id
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                      : "bg-white text-slate-600 border-slate-200 shadow-sm"
                  }`}
                >
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
          </div>
        </div>

        {/* Desktop Vertical Nav */}
        <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                <Layout size={18} />
              </div>
              Settings
            </h2>
            <p className="text-xs text-slate-500 mt-1 pl-10">
              Manage your workspace
            </p>
          </div>
          <nav className="p-3 space-y-6 overflow-y-auto max-h-[calc(100vh-250px)] custom-scrollbar">
            {navGroups.map((group, idx) => (
              <div
                key={idx}
                className="animate-in slide-in-from-left-2 duration-300"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <h3 className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                        activeSection === item.id
                          ? "bg-indigo-50 text-indigo-600 shadow-sm"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <item.icon
                        size={18}
                        className={
                          activeSection === item.id
                            ? "text-indigo-600"
                            : "text-slate-400"
                        }
                      />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
          {/* Content Header */}
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {activeTitle}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Configure your {activeTitle?.toLowerCase()} settings
              </p>
            </div>
            {activeSection === "team" && (
              <button
                onClick={() => {
                  setEditingMember(undefined);
                  setIsTeamModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center gap-2 font-medium shadow-lg shadow-indigo-200 transition-all active:scale-95"
              >
                <Plus size={18} />{" "}
                <span className="hidden sm:inline">Add Member</span>
              </button>
            )}
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar bg-white">
            <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
              {/* TEAM SECTION */}
              {activeSection === "team" && (
                <div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {settings.teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all p-5 relative group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-lg overflow-hidden border border-slate-200">
                            {member.photo ? (
                              <img
                                src={member.photo}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              member.name?.charAt(0) || "?"
                            )}
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                              member.role === "ADMIN"
                                ? "bg-purple-100 text-purple-700"
                                : member.role === "MANAGER"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {member.role}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">
                          {member.name}
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                          {member.email}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mb-5 bg-slate-50 p-2 rounded-lg">
                          <Briefcase size={14} />
                          <span className="truncate">
                            {member.experience || "No experience listed"}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-auto">
                          <button
                            onClick={() => {
                              setEditingMember(member);
                              setIsTeamModalOpen(true);
                            }}
                            className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors uppercase tracking-wide"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(member.id)}
                            className="flex-1 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors uppercase tracking-wide"
                          >
                            Delete
                          </button>
                        </div>

                        {/* Inline Confirm Delete */}
                        {confirmDeleteId === member.id && (
                          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 text-center z-10 animate-in fade-in duration-200">
                            <p className="text-sm font-semibold text-slate-800 mb-3">
                              Delete {member.name}?
                            </p>
                            <div className="flex gap-2 w-full">
                              <button
                                onClick={() => handleDeleteMember(member.id)}
                                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <TeamMemberModal
                    isOpen={isTeamModalOpen}
                    onClose={() => setIsTeamModalOpen(false)}
                    member={editingMember}
                    onSave={handleSaveMember}
                  />
                </div>
              )}

              {/* DATA SECTION */}
              {activeSection === "data" && (
                <div className="max-w-2xl mx-auto pt-4 space-y-6">
                  {/* Export Card */}
                  <div className="bg-slate-50 rounded-3xl border border-slate-200 p-10 text-center">
                    <div className="w-20 h-20 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <Download size={32} className="text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">
                      Export System Data
                    </h2>
                    <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
                      Create a complete portable backup of your workspace. This
                      includes all settings, team members, tickets, and customer
                      logs.
                    </p>
                    <button
                      onClick={handleExportBackup}
                      className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-3 mx-auto transition-all transform hover:-translate-y-1 shadow-xl shadow-slate-200"
                    >
                      <Save size={20} />
                      Download Full Backup (.json)
                    </button>
                    <p className="mt-6 text-xs text-slate-400">
                      Safe for archival and migration purposes. Data is
                      persisted in Local Storage.
                    </p>
                  </div>
                </div>
              )}

              {/* STORES SECTION */}
              {activeSection === "stores" && (
                <div className="grid gap-6 md:grid-cols-2">
                  <SimpleListManager
                    title="Store Locations"
                    {...createListHandlers("stores", "store")}
                    placeholder="e.g. Downtown Branch"
                  />
                  <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 text-sm text-amber-800 h-fit">
                    <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                      <AlertTriangle size={18} /> Important Note
                    </h4>
                    <p className="opacity-90 leading-relaxed">
                      Renaming a store here will automatically update all
                      historical tickets associated with that store to maintain
                      data integrity. Deleting a store is only possible if no
                      tickets are currently assigned to it.
                    </p>
                  </div>
                </div>
              )}

              {/* DEVICES SECTION */}
              {activeSection === "devices" && (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  <SimpleListManager
                    title="Device Types"
                    {...createListHandlers("deviceTypes", "deviceType")}
                    placeholder="e.g. Smart Watch"
                  />
                </div>
              )}

              {/* BRANDS SECTION */}
              {activeSection === "brands" && (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  <SimpleListManager
                    title="Service Brands"
                    {...createListHandlers("serviceBrands", "brand")}
                    placeholder="e.g. Samsung"
                  />
                </div>
              )}

              {/* LAPTOP REPORTS SECTION (NEW) */}
              {activeSection === "laptop" && (
                <div className="grid gap-6 md:grid-cols-2">
                  <SimpleListManager
                    title="Laptop Dealers"
                    {...createListHandlers("laptopDealers")}
                    placeholder="e.g. ABC Computers"
                  />
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-sm text-slate-600 h-fit">
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                      <Users size={18} /> Dealer Management
                    </h4>
                    <p className="opacity-90 leading-relaxed mb-4">
                      Manage the list of dealers available in the Laptop QC
                      Report form. Technicians are managed in the main 'Team
                      Members' section.
                    </p>
                  </div>
                </div>
              )}

              {/* WORKFLOW SECTION */}
              {activeSection === "workflow" && (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
                  <SimpleListManager
                    title="Ticket Statuses"
                    {...createListHandlers("ticketStatuses", "status")}
                    placeholder="e.g. Awaiting Approval"
                  />
                  <SimpleListManager
                    title="Priorities"
                    {...createListHandlers("priorities", "priority")}
                    placeholder="e.g. Urgent"
                  />
                  <SimpleListManager
                    title="Hold Reasons"
                    {...createListHandlers("holdReasons")}
                    placeholder="e.g. Customer Unresponsive"
                  />
                  <SimpleListManager
                    title="Internal Progress Reasons"
                    {...createListHandlers("progressReasons")}
                    placeholder="e.g. Cleaning"
                  />
                </div>
              )}

              {/* SLA SECTION */}
              {activeSection === "sla" && (
                <div className="max-w-xl mx-auto">
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8">
                    <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-200">
                      <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                        <Clock size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">
                          SLA & Past Due Configuration
                        </h3>
                        <p className="text-sm text-slate-500">
                          Set thresholds for ticket overdue flags
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {[
                        {
                          label: "High Priority",
                          key: "high",
                          color: "text-red-600 bg-red-50 border-red-100",
                        },
                        {
                          label: "Medium Priority",
                          key: "medium",
                          color: "text-amber-600 bg-amber-50 border-amber-100",
                        },
                        {
                          label: "Low Priority",
                          key: "low",
                          color:
                            "text-emerald-600 bg-emerald-50 border-emerald-100",
                        },
                      ].map((p) => (
                        <div
                          key={p.key}
                          className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${p.color}`}
                            >
                              {p.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-400">
                              Due in
                            </span>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                value={settings.sla[p.key as keyof SLAConfig]}
                                onChange={(e) =>
                                  handleSlaUpdate(
                                    p.key as keyof SLAConfig,
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="w-20 pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                d
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 p-4 bg-indigo-50 rounded-xl flex gap-3 text-indigo-800 text-sm">
                      <Briefcase size={18} className="flex-shrink-0 mt-0.5" />
                      <p>
                        Tickets exceeding these day limits will automatically be
                        flagged with a visual "Overdue" indicator in the ticket
                        list.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
