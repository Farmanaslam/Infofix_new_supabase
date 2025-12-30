import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Calendar as CalendarIcon,
  User,
  CheckCircle2,
  X,
  MapPin,
  Briefcase,
  Wrench,
  MoreHorizontal,
  Trash2,
  Tag,
  Users,
  AlignLeft,
  Edit,
  Save,
  AlertTriangle,
} from "lucide-react";
import { Ticket, Task, AppSettings, User as AppUser } from "../types";
import { supabase } from "@/lib/supabaseClient";

interface ScheduleProps {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  tickets: Ticket[];
  settings: AppSettings;
  currentUser: AppUser;
}

// Unified Event Interface for Display
interface CalendarEvent {
  id: string;
  type: "ticket" | "task";
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  status: string;
  assignee?: AppUser;
  originalData: Ticket | Task;
}

// --- DELETE CONFIRMATION MODAL ---
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
          Delete Task?
        </h3>
        <p className="text-center text-slate-500 mb-6 text-sm">
          Are you sure you want to delete this task? This action cannot be
          undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Schedule({
  tasks,
  setTasks,
  tickets,
  settings,
  currentUser,
}: ScheduleProps) {
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Modal & Editing State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Delete State
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Calendar Logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const visibleTasks = useMemo(() => {
    // ADMIN sees:
    // 1. Tasks created by them
    // 2. Tasks assigned by them (to manager or technician)
    if (currentUser.role === "ADMIN") {
      return tasks.filter(
        (t) =>
          t.createdById === currentUser.id || t.assignedToId === currentUser.id
      );
    }
    // MANAGER sees:
    // 1. Tasks created by them
    // 2. Tasks assigned by them (to technicians)
    if (currentUser.role === "MANAGER") {
      return tasks.filter(
        (t) =>
          t.createdById === currentUser.id || t.assignedToId === currentUser.id
      );
    }
    // TECHNICIAN sees only assigned tasks
    return tasks.filter((t) => t.assignedToId === currentUser.id);
  }, [tasks, currentUser]);

  const currentMonthTasks = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return visibleTasks.filter((task) => {
      const taskDate = new Date(task.date);
      return (
        taskDate.getMonth() === currentMonth &&
        taskDate.getFullYear() === currentYear
      );
    });
  }, [visibleTasks]);
  const monthlyTaskStats = useMemo(() => {
    const total = currentMonthTasks.length;
    const completed = currentMonthTasks.filter(
      (t) => t.status === "completed"
    ).length;

    const pending = total - completed;

    const efficiency = total === 0 ? 0 : Math.round((completed / total) * 100);

    const score = completed * 10;

    return {
      total,
      completed,
      pending,
      efficiency,
      score,
    };
  }, [currentMonthTasks]);

  // Merge Tickets and Tasks into CalendarEvents
  const events = useMemo(() => {
    const allEvents: CalendarEvent[] = [];

    // 1. Map Tickets
    tickets.forEach((ticket) => {
      if (ticket.scheduledDate) {
        const assignee = settings.teamMembers.find(
          (m) => m.id === ticket.assignedToId
        );
        allEvents.push({
          id: ticket.id,
          type: "ticket",
          title: `Job: ${ticket.deviceType} - ${ticket.ticketId}`,
          date: ticket.scheduledDate,
          status: ticket.status,
          assignee,
          originalData: ticket,
        });
      }
    });

    // 2. Map Tasks
    visibleTasks.forEach((task) => {
      const assignee = settings.teamMembers.find(
        (m) => m.id === task.assignedToId
      );
      allEvents.push({
        id: task.id,
        type: "task",
        title: task.title,
        date: task.date,
        time: task.time,
        status: task.status,
        assignee,
        originalData: task,
      });
    });

    return allEvents;
  }, [tickets, tasks, settings.teamMembers]);

  // Filter events for the selected date
  const selectedDayEvents = events.filter((e) => e.date === selectedDateStr);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // --- ACTIONS ---

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId);
  };

  const confirmDelete = async () => {
    if (taskToDelete) {
      await supabase.from("tasks").delete().eq("id", taskToDelete);
      setTasks(tasks.filter((t) => t.id !== taskToDelete));
      setTaskToDelete(null);
    }
  };

  const handleToggleTaskStatus = async (taskId: string) => {
    const updated = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            status: (t.status === "completed" ? "pending" : "completed") as
              | "pending"
              | "completed",
          }
        : t
    );

    const changed = updated.find((t) => t.id === taskId);

    if (changed) {
      await supabase
        .from("tasks")
        .update({ status: changed.status })
        .eq("id", changed.id);
    }

    setTasks(updated);
  };

  const handleSaveTask = async (task: Task) => {
    if (editingTask) {
      await supabase
        .from("tasks")
        .update({
          title: task.title,
          description: task.description,
          date: task.date,
          time: task.time,
          type: task.type,
          status: task.status,
          assigned_to_id: task.assignedToId,
        })
        .eq("id", task.id);

      setTasks(tasks.map((t) => (t.id === task.id ? task : t)));
    } else {
      const { data } = await supabase
        .from("tasks")
        .insert({
          title: task.title,
          description: task.description,
          date: task.date,
          time: task.time,
          type: task.type,
          status: task.status,
          assigned_to_id: task.assignedToId,
          created_by_id: task.createdById,
        })
        .select()
        .single();

      if (data) {
        setTasks([
          ...tasks,
          {
            ...task,
            id: data.id,
          },
        ]);
      }
    }

    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleCloseModal = () => {
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleOpenAdd = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  // Render Calendar Grid Cells
  const renderCalendarDays = () => {
    const days = [];

    // Empty cells for previous month padding
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <div
          key={`empty-${i}`}
          className="h-24 sm:h-32 bg-slate-50/30 border border-slate-100/50"
        ></div>
      );
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const dayEvents = events.filter((e) => e.date === dateStr);
      const isSelected = selectedDateStr === dateStr;
      const isToday = new Date().toISOString().split("T")[0] === dateStr;

      days.push(
        <div
          key={day}
          onClick={() => setSelectedDateStr(dateStr)}
          className={`
              h-24 sm:h-32 border border-slate-100 p-2 relative cursor-pointer transition-all group
              ${
                isSelected
                  ? "bg-indigo-50/50 ring-2 ring-inset ring-indigo-500/20 z-10"
                  : "hover:bg-slate-50"
              }
              ${isToday ? "bg-white" : "bg-white"}
            `}
        >
          <div className="flex justify-between items-start mb-1">
            <span
              className={`
                  w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold
                  ${
                    isToday
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-700 group-hover:bg-slate-200"
                  }
              `}
            >
              {day}
            </span>
            {dayEvents.length > 0 && (
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded-md">
                {dayEvents.length}
              </span>
            )}
          </div>

          <div className="space-y-1 overflow-hidden max-h-[calc(100%-30px)]">
            {dayEvents.slice(0, 3).map((evt, idx) => (
              <div
                key={idx}
                className={`
                        text-[10px] px-1.5 py-0.5 rounded truncate font-medium border-l-2
                        ${
                          evt.type === "ticket"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-400"
                            : "bg-emerald-50 text-emerald-700 border-emerald-400"
                        }
                    `}
                title={evt.title}
              >
                {evt.time && (
                  <span className="opacity-75 mr-1">{evt.time}</span>
                )}
                {evt.title}
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-[9px] text-slate-400 pl-1">
                + {dayEvents.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const canDelete = currentUser.role === "ADMIN";

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-6">
      {/* LEFT: CALENDAR VIEW */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Calendar Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              {monthNames[month]}{" "}
              <span className="text-slate-400 font-normal">{year}</span>
            </h2>
            <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
              <button
                onClick={prevMonth}
                className="p-1 hover:bg-white rounded shadow-sm text-slate-600 transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={nextMonth}
                className="p-1 hover:bg-white rounded shadow-sm text-slate-600 transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
          >
            <Plus size={18} /> Add Task
          </button>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-widest text-center py-3">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 flex-1 overflow-y-auto custom-scrollbar">
          {renderCalendarDays()}
        </div>
      </div>

      {/* RIGHT: AGENDA / DETAILS PANEL */}
      <div className="w-full lg:w-96 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <CalendarIcon size={20} className="text-indigo-200" />
            Daily Agenda
          </h3>
          <p className="text-indigo-100 text-sm mt-1">
            {new Date(selectedDateStr).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50">
          {selectedDayEvents.length > 0 ? (
            selectedDayEvents
              .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
              .map((evt) => (
                <div
                  key={`${evt.type}-${evt.id}`}
                  className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm group hover:shadow-md transition-all relative overflow-hidden"
                >
                  {/* Decorative strip */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                      evt.type === "ticket" ? "bg-indigo-500" : "bg-emerald-500"
                    }`}
                  ></div>

                  <div className="pl-2">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {evt.type === "ticket" ? (
                          <span className="text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                            Ticket
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                            Task
                          </span>
                        )}
                        {evt.time && (
                          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                            <Clock size={12} /> {evt.time}
                          </span>
                        )}
                      </div>

                      {/* Actions for Tasks */}
                      {evt.type === "task" && (
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleToggleTaskStatus(evt.id)}
                            title={
                              evt.status === "completed"
                                ? "Mark Pending"
                                : "Mark Completed"
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              evt.status === "completed"
                                ? "text-emerald-600 bg-emerald-50"
                                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            onClick={() =>
                              handleEditTask(evt.originalData as Task)
                            }
                            title="Edit Task"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteTask(evt.id)}
                              title="Delete Task"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <h4
                      className={`font-bold text-slate-800 text-sm mb-1 ${
                        evt.status === "completed" || evt.status === "Resolved"
                          ? "line-through text-slate-400"
                          : ""
                      }`}
                    >
                      {evt.title}
                    </h4>

                    {/* Details */}
                    {evt.type === "ticket" ? (
                      <div className="text-xs text-slate-500 space-y-1">
                        <p className="flex items-center gap-1.5">
                          <MapPin size={12} />{" "}
                          {(evt.originalData as Ticket).store}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Wrench size={12} />{" "}
                          {(evt.originalData as Ticket).issueDescription}
                        </p>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">
                        {(evt.originalData as Task).description}
                      </div>
                    )}

                    {/* Assignee */}
                    <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                      {evt.assignee ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-[10px] flex items-center justify-center font-bold text-slate-600">
                            {evt.assignee.name.charAt(0)}
                          </div>
                          <span className="text-xs text-slate-600">
                            {evt.assignee.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Unassigned
                        </span>
                      )}

                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          evt.status === "completed" ||
                          evt.status === "Resolved"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {evt.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <CalendarIcon size={24} className="opacity-50" />
              </div>
              <p className="text-sm font-medium">No events scheduled</p>
              <p className="text-xs mt-1">Click "Add Task" to create one.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            onClick={handleOpenAdd}
            className="w-full py-2.5 border border-dashed border-indigo-300 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add Task for{" "}
            {new Date(selectedDateStr).getDate()}th
          </button>
        </div>
      </div>

      {/* ADD/EDIT TASK MODAL */}
      {isTaskModalOpen && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={handleCloseModal}
          initialDate={selectedDateStr}
          onSave={handleSaveTask}
          teamMembers={settings.teamMembers}
          currentUser={currentUser}
          taskToEdit={editingTask}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <DeleteConfirmationModal
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// --- TASK MODAL COMPONENT ---
interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  initialDate: string;
  teamMembers: AppUser[];
  currentUser: AppUser;
  taskToEdit?: Task | null;
}

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialDate,
  teamMembers,
  currentUser,
  taskToEdit,
}) => {
  const [formData, setFormData] = useState<Partial<Task>>({
    title: "",
    date: initialDate,
    time: "09:00",
    description: "",
    type: "general",
    assignedToId: currentUser.role !== "TECHNICIAN" ? "" : currentUser.id,
    status: "pending",
  });

  {
    /*useEffect(() => {
      if (taskToEdit) {
        setFormData(taskToEdit);
      } else {
        setFormData({
          title: "",
          date: initialDate,
          time: "09:00",
          description: "",
          type: "general",
          assignedToId: currentUser.role !== "TECHNICIAN" ? "" : currentUser.id,
          status: "pending",
        });
      }
    }, [taskToEdit, initialDate, currentUser]);*/
  }
  useEffect(() => {
    if (taskToEdit) {
      setFormData({
        ...taskToEdit,
        assignedToId: taskToEdit.assignedToId || "",
        status: taskToEdit.status || "pending",
      });
    } else {
      setFormData({
        title: "",
        date: initialDate,
        time: "09:00",
        description: "",
        type: "general",
        assignedToId: currentUser.role === "TECHNICIAN" ? currentUser.id : "",
        status: "pending",
      });
    }
  }, [taskToEdit, initialDate, currentUser]);

  const canAssign =
    currentUser.role === "ADMIN" || currentUser.role === "MANAGER";
  const normalizeRole = (role: string) => role.trim().toUpperCase();

  const assignableMembers = teamMembers.filter((member) => {
    const memberRole = normalizeRole(member.role);
    const currentRole = normalizeRole(currentUser.role);

    if (currentRole === "ADMIN") return true;

    if (currentRole === "MANAGER") {
      return (
        memberRole === "TECHNICIAN" ||
        member.id === currentUser.id ||
        (taskToEdit && member.id === taskToEdit.assignedToId)
      );
    }
    // TECHNICIAN: cannot assign
    return false;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title && formData.date) {
      onSave({
        id: taskToEdit ? taskToEdit.id : crypto.randomUUID(),
        title: formData.title!,
        date: formData.date!,
        time: formData.time,
        description: formData.description || "",
        type: formData.type as any,

        assignedToId:
          currentUser.role === "TECHNICIAN"
            ? currentUser.id
            : formData.assignedToId!,

        createdById: taskToEdit ? taskToEdit.createdById : currentUser.id,

        status: formData.status || "pending",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                taskToEdit
                  ? "bg-amber-50 text-amber-600"
                  : "bg-indigo-50 text-indigo-600"
              }`}
            >
              {taskToEdit ? <Edit size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">
                {taskToEdit ? "Edit Task" : "Add New Task"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {taskToEdit
                  ? "Update activity details"
                  : "Schedule a new activity"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-slate-50/50">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">
              Task Title
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Tag size={16} />
              </div>
              <input
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g. Shop Inventory Check"
                autoFocus={!taskToEdit}
              />
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">
                Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <CalendarIcon size={16} />
                </div>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">
                Time
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Clock size={16} />
                </div>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) =>
                    setFormData({ ...formData, time: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">
              Task Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "general", label: "General", icon: CheckCircle2 },
                { id: "meeting", label: "Meeting", icon: Users },
                { id: "maintenance", label: "Maint.", icon: Wrench },
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, type: type.id as any })
                  }
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                    formData.type === type.id
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-200 shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <type.icon size={20} className="mb-1.5" />
                  <span className="text-xs font-bold">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Assign To */}
          {canAssign && (
            <div className="animate-in fade-in slide-in-from-top-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">
                Assign To
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <select
                  value={formData.assignedToId || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, assignedToId: e.target.value })
                  }
                  className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none transition-all"
                >
                  <option value="">-- Unassigned --</option>
                  {teamMembers
                    .filter((member) => {
                      if (currentUser.role === "MANAGER") {
                        // Manager can assign to technicians or themselves
                        return (
                          member.role.toUpperCase() === "TECHNICIAN" ||
                          member.id === currentUser.id
                        );
                      }
                      if (currentUser.role === "ADMIN") {
                        // Admin can see all
                        return true;
                      }
                      // Technicians cannot assign
                      return false;
                    })
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <ChevronRight size={16} className="rotate-90" />
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">
              Notes
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none text-slate-400">
                <AlignLeft size={16} />
              </div>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none h-24 transition-all"
                placeholder="Add any additional details..."
              />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {taskToEdit ? (
                <>
                  <Save size={18} /> Save Changes
                </>
              ) : (
                "Create Task"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
