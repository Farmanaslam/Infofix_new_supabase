import React, { useState, useRef } from "react";
import { User, Customer, Ticket } from "../types";
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Save,
  CheckCircle,
  Smartphone,
  Clock,
  Shield,
  Key,
  Camera,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";

interface CustomerProfileProps {
  currentUser: User;
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  updateCurrentUser: (user: User) => void;
  tickets: Ticket[];
}

export default function CustomerProfile({
  currentUser,
  customers,
  setCustomers,
  updateCurrentUser,
  tickets,
}: CustomerProfileProps) {
  const customerRecord = customers.find(
    (c) => c.email.toLowerCase() === currentUser.email.toLowerCase()
  );

  // Stats
  const myTickets = tickets.filter(
    (t) => t?.email?.toLowerCase() === currentUser?.email?.toLowerCase()
  );
  const totalTickets = myTickets.length;
  const activeTickets = myTickets.filter(
    (t) => t.status !== "Resolved" && t.status !== "Rejected"
  ).length;
  const joinDate =
    myTickets.length > 0
      ? myTickets[myTickets.length - 1].date
      : new Date().toLocaleDateString();

  const [formData, setFormData] = useState({
    name: customerRecord?.name || currentUser.name,
    mobile: customerRecord?.mobile || currentUser.mobile || "",
    address: customerRecord?.address || currentUser.address || "",
    photo: currentUser.photo || "",
  });

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- IMAGE COMPRESSION LOGIC ---
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];

    if (!file) return;

    // 1. Check Input Size (Max 1MB)
    if (file.size > 1024 * 1024) {
      setError("File is too large. Please select an image under 1MB.");
      return;
    }

    setIsCompressing(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // 2. Resize & Compress via Canvas
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 500; // Resizing to 500px ensures size drops significantly
        const MAX_HEIGHT = 500;
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

        // 3. Export as JPEG with 0.7 quality (Usually results in 50KB-100KB)
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

        setFormData((prev) => ({ ...prev, photo: compressedBase64 }));
        setIsCompressing(false);
      };
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // 🔥 1. Update Firestore
      const userRef = doc(db, "customers", currentUser.id);

      await updateDoc(userRef, {
        name: formData.name,
        mobile: formData.mobile,
        address: formData.address,
        photo: formData.photo,
        updatedAt: new Date(),
      });

      // 🔁 2. Update local Customers array
      if (customerRecord) {
        const updatedCustomers = customers.map((c) =>
          c.id === customerRecord.id
            ? {
                ...c,
                name: formData.name,
                mobile: formData.mobile,
                address: formData.address,
              }
            : c
        );
        setCustomers(updatedCustomers);
      }

      // 👤 3. Update current session user
      updateCurrentUser({
        ...currentUser,
        name: formData.name,
        mobile: formData.mobile,
        address: formData.address,
        photo: formData.photo,
      });

      // ✅ 4. UI feedback
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to update profile. Please try again.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      {/* Banner & Header */}
      <div className="relative mb-20">
        <div className="h-48 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <svg
              className="w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
            </svg>
          </div>
        </div>
        <div className="absolute -bottom-16 left-8 flex items-end gap-6">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full bg-white p-1.5 shadow-xl">
              <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                {formData.photo ? (
                  <img
                    src={formData.photo}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-slate-400 font-bold text-4xl">
                    {formData.name.charAt(0)}
                  </span>
                )}
              </div>
            </div>

            {/* Photo Upload Overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className="absolute bottom-2 right-2 p-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-wait"
              title="Change Photo"
            >
              {isCompressing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Camera size={16} />
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handlePhotoUpload}
            />
          </div>

          <div className="mb-4">
            <h1 className="text-3xl font-bold text-slate-800">
              {formData.name}
            </h1>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                Customer
              </span>
              <span className="text-slate-400">•</span>
              <span>{currentUser.email}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Read-Only Info */}
        <div className="space-y-6">
          {/* Stats Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
              Account Overview
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">
                      Total Repairs
                    </p>
                    <p className="font-bold text-slate-800">{totalTickets}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">
                      Active Service
                    </p>
                    <p className="font-bold text-slate-800">{activeTickets}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <Shield size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">
                      First Service
                    </p>
                    <p className="font-bold text-slate-800 text-sm">
                      {joinDate?.split(",")[0]}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Login Info Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
              Login Credentials
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Email ID (Username)
                </label>
                <div className="flex items-center gap-2 text-slate-700 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <Mail size={16} className="text-slate-400" />{" "}
                  {currentUser.email}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Password
                </label>
                <div className="flex items-center gap-2 text-slate-700 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <Key size={16} className="text-slate-400" />
                  <span className="text-slate-500 text-sm italic">
                    Your registered mobile number
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                Edit Personal Details
              </h2>
              <div className="bg-indigo-50 text-indigo-600 p-2 rounded-full">
                <UserIcon size={20} />
              </div>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-2 text-sm animate-in fade-in">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <UserIcon size={18} />
                    </div>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) =>
                        setFormData({ ...formData, mobile: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 ml-1">
                    Note: This will update your login password.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">
                  Shipping / Billing Address
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none text-slate-400">
                    <MapPin size={18} />
                  </div>
                  <textarea
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    rows={4}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all font-medium text-slate-700"
                  />
                </div>
              </div>

              {success && (
                <div className="p-4 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 border border-emerald-100">
                  <CheckCircle
                    size={20}
                    className="fill-current text-emerald-200"
                  />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isCompressing}
                  className="px-8 py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Save size={18} />{" "}
                  {isCompressing ? "Processing..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
