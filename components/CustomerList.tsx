import React, { useState } from "react";
import {
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  User,
  X,
  LayoutGrid,
  List as ListIcon,
  Edit,
  Trash2,
  StickyNote,
  AlertTriangle,
} from "lucide-react";
import { Customer } from "../types";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { supabase } from "@/lib/supabaseClient";
{
  /*interface CustomerListProps {
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
}
*/
}
// Helper to generate IDs (Duplicate of TicketList helper to keep self-contained)
{
  /*const generateId = (prefix: string, list: any[]) => {
  const count = list.length + 1;
  const padded = count.toString().padStart(3, "0");
  return `${prefix}-${padded}`;
};*/
}

// --- Customer Form Modal ---
const CustomerFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  editingCustomer?: Customer | null;
  existingCustomers: Customer[];
  reloadCustomers: () => void;
}> = ({
  isOpen,
  onClose,
  editingCustomer,
  existingCustomers,
  reloadCustomers,
}) => {
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: "",
    email: "",
    mobile: "",
    address: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      if (editingCustomer) {
        setFormData({ ...editingCustomer });
      } else {
        setFormData({
          name: "",
          email: "",
          mobile: "",
          address: "",
          notes: "",
        });
      }
      setError(null);
    }
  }, [isOpen, editingCustomer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile) {
      setError("Name and Mobile are required.");
      return;
    }

    // Check for duplicates (by email) if creating new
    if (!editingCustomer && formData.email) {
      const exists = existingCustomers.some(
        (c) => c.email.toLowerCase() === formData.email?.toLowerCase()
      );
      if (exists) {
        setError("A customer with this email already exists.");
        return;
      }
    }

    if (editingCustomer) {
      const { error } = await supabase
        .from("customers")
        .update({
          name: formData.name,
          email: formData.email || "",
          mobile: formData.mobile,
          address: formData.address || "",
          notes: formData.notes || [],
        })
        .eq("id", editingCustomer.id);

      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("customers").insert([
        {
          name: formData.name,
          email: formData.email || "",
          mobile: formData.mobile,
          address: formData.address || "",
          notes: formData.notes || [],
          role: "CUSTOMER",
        },
      ]);

      if (error) {
        setError(error.message);
        return;
      }
    }

    onClose();
    await reloadCustomers();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {editingCustomer ? "Edit Customer" : "Add New Customer"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {editingCustomer
                ? "Update contact details"
                : "Create a new client profile"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-slate-50/50">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2 border border-red-100">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

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
                value={formData.name}
                autoFocus={!editingCustomer}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder="e.g. John Doe"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                Mobile Number *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone size={16} />
                </div>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) =>
                    setFormData({ ...formData, mobile: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="555-0123"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="john@example.com"
                />
              </div>
            </div>
          </div>

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
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder="Street Address..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
              Internal Notes
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none text-slate-400">
                <StickyNote size={16} />
              </div>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder="Add any internal notes about this customer..."
              />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform hover:translate-y-[-1px] text-sm"
            >
              {editingCustomer ? "Save Changes" : "Add Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Main CustomerList Component ---
//<CustomerListProps>
const CustomerList: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile.includes(searchTerm)
  );

  {
    /* const handleSave = (customer: Customer) => {
    if (editingCustomer) {
      setCustomers(customers.map((c) => (c.id === customer.id ? customer : c)));
    } else {
      setCustomers([...customers, customer]);
    }
    setEditingCustomer(null);
  };*/
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this customer?"))
      return;

    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) {
      console.error("Delete error:", error.message);
    } else {
      // update UI instantly
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const reloadCustomers = async () => {
    const { data, error } = await supabase.from("customers").select("*");
    if (!error && data) {
      setCustomers(
        data.map((item: any) => ({
          id: item.id,
          name: item.name,
          email: item.email || "",
          mobile: item.mobile || item.phone || "",
          address: item.address || "",
          notes: item.notes || [],
          role: item.role,
          createdAt: item.created_at,
          photo_url: item.photo_url || "",
          legacyId: item.legacy_id || "",
        }))
      );
    }
  };
  React.useEffect(() => {
    reloadCustomers();
  }, []);

  return (
    <div className="relative h-full flex flex-col">
      {/* Header Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search customers by name, email, or mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-slate-700"
          />
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === "grid"
                ? "bg-indigo-50 text-indigo-600 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
            title="Grid View"
          >
            <LayoutGrid size={20} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === "list"
                ? "bg-indigo-50 text-indigo-600 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
            title="List View"
          >
            <ListIcon size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pb-20">
        {filteredCustomers.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative"
                >
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingCustomer(customer);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(customer.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                      {customer.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">
                        {customer.name}
                      </h3>
                      <p className="text-xs text-slate-400">{customer.id}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-slate-400" />{" "}
                      {customer.email || "No email"}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-slate-400" />{" "}
                      {customer.mobile}
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin
                        size={14}
                        className="text-slate-400 mt-1 flex-shrink-0"
                      />
                      <span className="line-clamp-2">
                        {customer.address || "No address provided"}
                      </span>
                    </div>
                  </div>

                  {customer.notes && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-start gap-2 text-xs text-slate-500 italic">
                        <StickyNote
                          size={12}
                          className="mt-0.5 text-yellow-500"
                        />
                        <span className="line-clamp-2">{customer.notes}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        ID
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        Name
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        Contact
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        Address
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        Notes
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-slate-50 group">
                        <td className="px-6 py-4 font-medium text-slate-500">
                          {customer.id}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-800">
                          {customer.name}
                        </td>
                        <td className="px-6 py-4">
                          <div>{customer.mobile}</div>
                          <div className="text-xs text-slate-400">
                            {customer.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                          {customer.address}
                        </td>
                        <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">
                          {customer.notes}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingCustomer(customer);
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(customer.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-20 text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={24} className="text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-700">
              No customers found
            </p>
            <p className="text-sm">Add a new customer to get started</p>
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => {
          setEditingCustomer(null);
          setIsModalOpen(true);
        }}
        className="fixed bottom-8 right-8 lg:bottom-10 lg:right-10 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all transform hover:scale-105 z-40"
      >
        <Plus size={28} />
      </button>

      {/*<CustomerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editingCustomer={editingCustomer}
        existingCustomers={customers}
      />*/}
      <CustomerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingCustomer={editingCustomer}
        existingCustomers={customers}
        reloadCustomers={reloadCustomers}
      />
    </div>
  );
};

export default CustomerList;
