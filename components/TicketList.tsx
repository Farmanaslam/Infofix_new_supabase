import React, { useState } from "react";
import {
  Plus,
  Search,
  MapPin,
  Phone,
  User,
  LayoutGrid,
  List as ListIcon,
  Edit,
  Trash2,
  Check,
  AlertTriangle,
  Laptop,
  Smartphone,
} from "lucide-react";
import { Ticket, Customer, AppSettings, User as AppUser } from "../types";
import { TicketFormModal } from "./TicketFormModal";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useEffect } from "react";
import { db } from "@/firebaseConfig";
import { supabase } from "@/lib/supabaseClient";

{
  /*interface TicketListProps {
  tickets: Ticket[];
  setTickets: (tickets: Ticket[]) => void;
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  settings: AppSettings;
  currentUser: AppUser;
}*/
}
interface TicketListProps {
  customers: Customer[];
  settings: AppSettings;
  currentUser: AppUser;
}
// --- Delete Confirmation Modal ---
const DeleteConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4 mx-auto">
          <Trash2 size={24} />
        </div>
        <h3 className="text-lg font-bold text-center text-slate-800 mb-2">
          Delete Ticket?
        </h3>
        <p className="text-center text-slate-500 mb-6 text-sm">
          Are you sure you want to delete this ticket? This action cannot be
          undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const TicketList: React.FC<TicketListProps> = ({
  //tickets,
  //setTickets,
  customers,
  //setCustomers,
  settings,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Edit & Delete State
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // --- FILTERING LOGIC ---
  //let displayTickets = tickets.filter((t) => t.status !== "Pending Approval"); // pending tickets are for Review Reports
  let displayTickets = tickets.filter((t) => t.status !== "Pending Approval");

  // If TECHNICIAN, only show assigned tickets
  if (currentUser.role === "TECHNICIAN") {
    displayTickets = displayTickets.filter(
      (t) => t.assignedToId === currentUser.id
    );
  }

  useEffect(() => {
    if (!currentUser) return;

    const fetchTickets = async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching tickets:", error);
        return;
      }

      // Map snake_case to camelCase for React usage
      const mappedData =
        data?.map((t: any) => ({
          id: t.id,
          ticketId: t.ticket_id ?? t.id,

          // ⚠️ tickets table does NOT have customer info
          name: t.customer_name ?? "—",
          number: t.customer_number ?? "—",
          email: t.customer_email ?? "—",

          status: t.status ?? "New",
          priority: t.priority,
          store: t.store,
          deviceType: t.device_type,
          brand: t.brand,
          model: t.model,
          warranty: t.warranty,
          issueDescription: t.issue_description,
          assignedToId: t.assigned_to_id,
          createdAt: t.created_at,
          date: t.created_at, // or format as needed// or format as you want
        })) || [];

      // If TECHNICIAN, filter assigned tickets
      const finalData =
        currentUser.role === "TECHNICIAN"
          ? mappedData.filter((t) => t.assignedToId === currentUser.id)
          : mappedData;
      setTickets(finalData);
    };

    fetchTickets();
  }, [currentUser]);

  const filteredTickets = displayTickets.filter(
    (ticket) =>
      (ticket.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.number ?? "").includes(searchTerm) ||
      (ticket.email ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.ticketId ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    // Permission Check: Only Admin can delete
    if (currentUser.role === "ADMIN") {
      setTicketToDelete(id);
    }
  };

  {
    /*const confirmDelete = () => {
    if (ticketToDelete) {
      setTickets(tickets.filter((t) => t.id !== ticketToDelete));
      setTicketToDelete(null);
    }
  };*/
  }
  const confirmDelete = async () => {
    if (!ticketToDelete) return;

    try {
      await supabase.from("tickets").delete().eq("id", ticketToDelete);
      setTicketToDelete(null);
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const handleOpenNew = () => {
    setEditingTicket(null);
    setIsModalOpen(true);
  };

  const handleTicketCreated = () => {
    setSearchTerm(""); // Clear search so the new ticket is visible
  };

  const canDelete = currentUser.role === "ADMIN";

  return (
    <div className="relative h-full min-h-[calc(100vh-140px)] flex flex-col">
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
            placeholder="Search tickets by ID, name, number, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm text-slate-700"
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
      <div className="pb-20 flex-1">
        {filteredTickets.length > 0 ? (
          viewMode === "grid" ? (
            // GRID VIEW
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative"
                >
                  {/* Card Actions (Hover) */}
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(ticket)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <Edit size={16} />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(ticket.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          ticket.priority === "High"
                            ? "bg-red-100 text-red-600"
                            : "bg-indigo-100 text-indigo-600"
                        }`}
                      >
                        {ticket.deviceType === "Laptop" ? (
                          <Laptop size={20} />
                        ) : ticket.deviceType === "Smartphone" ? (
                          <Smartphone size={20} />
                        ) : (
                          <User size={20} />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          {ticket.deviceType}
                          {ticket.priority === "High" && (
                            <span
                              className="w-2 h-2 rounded-full bg-red-500"
                              title="High Priority"
                            />
                          )}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                          ID: {ticket.ticketId}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`px-2 py-1 text-xs rounded font-bold uppercase tracking-wider ${
                        ticket.status === "New"
                          ? "bg-blue-100 text-blue-700"
                          : ticket.status === "Resolved"
                          ? "bg-green-100 text-green-700"
                          : ticket.status === "Rejected"
                          ? "bg-red-100 text-red-700"
                          : ticket.status === "On Hold"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600 mb-4">
                    <p className="line-clamp-2 text-slate-800 font-medium italic">
                      "{ticket.issueDescription}"
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mt-2">
                      <div className="flex items-center gap-1">
                        <Phone size={12} /> {ticket.number}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin size={12} /> {ticket.store}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>{ticket.date}</span>
                    {ticket.warranty && (
                      <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                        <AlertTriangle size={10} /> Warranty
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // LIST VIEW
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        ID
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        Customer
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        Device
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        Issue
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        Status
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        Priority
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600">
                        Store
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="hover:bg-slate-50 transition-colors group"
                      >
                        <td className="px-6 py-4 font-medium text-indigo-600">
                          {ticket.ticketId}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800">
                            {ticket.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {ticket.number}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-800">
                            {ticket.deviceType}
                          </div>
                          <div className="text-xs text-slate-500">
                            {ticket.brand} {ticket.model}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className="max-w-xs truncate text-slate-600"
                            title={ticket.issueDescription}
                          >
                            {ticket.issueDescription}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold uppercase ${
                              ticket.status === "New"
                                ? "bg-blue-100 text-blue-700"
                                : ticket.status === "Resolved"
                                ? "bg-green-100 text-green-700"
                                : ticket.status === "Rejected"
                                ? "bg-red-100 text-red-700"
                                : ticket.status === "On Hold"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                              ticket.priority === "High"
                                ? "bg-red-50 text-red-700 border-red-100"
                                : ticket.priority === "Medium"
                                ? "bg-yellow-50 text-yellow-700 border-yellow-100"
                                : "bg-green-50 text-green-700 border-green-100"
                            }`}
                          >
                            {ticket.priority === "High" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            )}
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {ticket.store}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(ticket)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <Edit size={16} />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(ticket.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
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
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-700">
              No tickets found
            </p>
            <p className="text-sm">Try adjusting your search terms</p>
          </div>
        )}
      </div>

      {/* Floating Action Button - Only for Admin/Manager */}
      {(currentUser.role === "ADMIN" || currentUser.role === "MANAGER") && (
        <button
          onClick={handleOpenNew}
          className="fixed bottom-8 right-8 lg:bottom-10 lg:right-10 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all transform hover:scale-105 z-40"
        >
          <Plus size={28} />
        </button>
      )}

      {/* New Ticket Modal */}
      {/*} <TicketFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customers={customers}
        setCustomers={setCustomers}
        tickets={tickets}
        setTickets={setTickets}
        settings={settings}
        currentUser={currentUser}
        editingTicket={editingTicket}
        onSuccess={handleTicketCreated}
      />*/}
      <TicketFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customers={customers}
        settings={settings}
        currentUser={currentUser}
        editingTicket={editingTicket}
        onSuccess={handleTicketCreated}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!ticketToDelete}
        onClose={() => setTicketToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default TicketList;
