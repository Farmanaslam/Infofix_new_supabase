import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Trash2,
  TrendingUp,
  Target,
  Calendar as CalendarIcon,
  Flame,
  Check,
  Plus,
  Filter,
  User as UserIcon,
  Search,
  ChevronDown,
} from "lucide-react";
import { Task, Report, User } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface TasksViewProps {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  savedReports: Report[];
  currentUser: User;
  teamMembers: User[];
}

export default function TasksView({
  tasks,
  setTasks,
  savedReports,
  currentUser,
  teamMembers,
}: TasksViewProps) {
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "urgent" | "completed"
  >("all");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [chartView, setChartView] = useState<"monthly" | "yearly">("monthly");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");

  // --- DATA PROCESSING & PERMISSIONS ---

  // 1. Determine which users the current user is allowed to see
  const accessibleMembers = useMemo(() => {
    if (currentUser.role === "ADMIN") {
      return teamMembers;
    }
    if (currentUser.role === "MANAGER") {
      // Managers see themselves + Technicians
      return teamMembers.filter(
        (m) => m.id === currentUser.id || m.role === "TECHNICIAN"
      );
    }
    // Technicians only see themselves
    return [currentUser];
  }, [currentUser, teamMembers]);

  // 2. Filter TASKS based on accessible members
  const accessibleTasks = useMemo(() => {
    if (currentUser.role === "TECHNICIAN") {
      return tasks.filter((t) => t.assignedToId === currentUser.id);
    }

    if (currentUser.role === "MANAGER") {
      // Manager: own created + assigned tasks
      return tasks.filter(
        (t) =>
          t.createdById === currentUser.id || t.assignedToId === currentUser.id
      );
    }

    // ADMIN
    return tasks; // Admin sees everything
  }, [tasks, currentUser]);

  // 3. Filter REPORTS based on accessible members (matching by name usually)
  const accessibleReports = useMemo(() => {
    const accessibleNames = accessibleMembers.map((m) => m.name);
    return savedReports.filter(
      (r) =>
        r.deviceInfo.technicianName === currentUser.name || // Always show own
        accessibleNames.includes(r.deviceInfo.technicianName)
    );
  }, [savedReports, accessibleMembers, currentUser]);

  // 4. Apply UI Filters (Status & Specific Member Selection)
  const filteredTasks = useMemo(() => {
    let result: Task[] = accessibleTasks;

    if (memberFilter !== "all") {
      // Show all tasks assigned to that member
      result = tasks.filter((t) => t.assignedToId === memberFilter);
    }

    // Status filter
    if (statusFilter === "active")
      result = result.filter((t) => t.status === "pending");
    if (statusFilter === "completed")
      result = result.filter((t) => t.status === "completed");
    if (statusFilter === "urgent")
      result = result.filter(
        (t) => t.priority === "urgent" && t.status === "pending"
      );

    // Sort
    return result.sort((a, b) => {
      if (
        a.priority === "urgent" &&
        b.priority !== "urgent" &&
        a.status === "pending"
      )
        return -1;
      if (
        b.priority === "urgent" &&
        a.priority !== "urgent" &&
        b.status === "pending"
      )
        return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [tasks, accessibleTasks, statusFilter, memberFilter]);

  // KPI Calculations
  const kpiData = useMemo(() => {
    // KPI is based on filtered view (so if I filter by "John", I see John's stats)
    // If 'all' is selected, I see stats for my whole team (if manager) or just me (if tech)

    // Use the result of memberFilter only (ignore status filter for global stats)
    const baseTasks =
      memberFilter === "all"
        ? accessibleTasks
        : accessibleTasks.filter((t) => t.assignedToId === memberFilter);

    const total = baseTasks.length;
    const completed = baseTasks.filter((t) => t.status === "completed").length;
    const urgentPending = baseTasks.filter(
      (t) => t.status === "pending" && t.priority === "urgent"
    ).length;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    // Reports KPI
    // ---- MONTHLY TASK COMPLETION KPI (FIXED TARGETS) ----
    // ---- MONTHLY TASK COMPLETION KPI (FIXED TARGETS) ----
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Determine monthly target
    let monthlyTarget: number;
    if (currentUser.role === "TECHNICIAN") {
      monthlyTarget = 20;
    } else if (memberFilter === "all") {
      monthlyTarget = 180; // whole team
    } else {
      monthlyTarget = 20; // single member selected
    }

    // Filter tasks for KPI
    let tasksForKPI: Task[];

    // Technician: only own tasks
    if (currentUser.role === "TECHNICIAN") {
      tasksForKPI = accessibleTasks.filter(
        (t) =>
          t.assignedToId === currentUser.id &&
          new Date(t.date).getMonth() === currentMonth &&
          new Date(t.date).getFullYear() === currentYear
      );
    } else {
      // Admin/Manager
      if (memberFilter === "all") {
        tasksForKPI = accessibleTasks.filter(
          (t) =>
            new Date(t.date).getMonth() === currentMonth &&
            new Date(t.date).getFullYear() === currentYear
        );
      } else {
        // Selected technician → all tasks assigned to them this month
        tasksForKPI = tasks.filter(
          (t) =>
            t.assignedToId === memberFilter &&
            new Date(t.date).getMonth() === currentMonth &&
            new Date(t.date).getFullYear() === currentYear
        );
      }
    }

    // Completed tasks
    const completedThisMonth = tasksForKPI.filter(
      (t) => t.status === "completed"
    ).length;

    // Progress %
    const targetProgress = Math.min(
      Math.round((completedThisMonth / monthlyTarget) * 100),
      100
    );

    return {
      active: total - completed,
      completed,
      urgentPending,
      completionRate,
      targetProgress,
      reportsThisMonth: completedThisMonth,
      monthlyTargetDisplay: monthlyTarget,
      totalHistory: accessibleTasks.length,
    };
  }, [
    accessibleTasks,
    accessibleReports,
    memberFilter,
    accessibleMembers,
    teamMembers,
    currentUser.role,
  ]);

  // Chart Data
  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    const now = new Date();

    // Filter reports based on the member filter as well
    const reportsForChart =
      memberFilter === "all"
        ? accessibleReports
        : accessibleReports.filter((r) => {
            const member = teamMembers.find((m) => m.id === memberFilter);
            return member ? r.deviceInfo.technicianName === member.name : false;
          });

    if (chartView === "monthly") {
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        data[i] = 0;
      }
      reportsForChart.forEach((r) => {
        const d = new Date(r.date);
        if (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        ) {
          data[d.getDate()] = (data[d.getDate()] || 0) + 1;
        }
      });
      return Object.keys(data).map((day) => ({
        name: day,
        value: data[day],
        isCurrent: parseInt(day) === now.getDate(),
      }));
    } else {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      months.forEach((m) => (data[m] = 0));
      reportsForChart.forEach((r) => {
        const d = new Date(r.date);
        if (d.getFullYear() === now.getFullYear()) {
          const mName = months[d.getMonth()];
          data[mName] = (data[mName] || 0) + 1;
        }
      });
      return months.map((m, idx) => ({
        name: m,
        value: data[m],
        isCurrent: idx === now.getMonth(),
      }));
    }
  }, [accessibleReports, chartView, memberFilter, teamMembers]);

  // --- HANDLERS ---

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title: quickTaskTitle,
      description: "Quickly added via My Works",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      assignedToId: currentUser.id,
      type: "general",
      status: "pending",
      priority: "normal",
      createdById: currentUser.id,
    };

    setTasks([newTask, ...tasks]);
    setQuickTaskTitle("");
  };

  const toggleTask = (id: string) => {
    {
      /*} setTasks(tasks.map(t => 
      t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
    ));*/
    }

    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    if (task.assignedToId !== currentUser.id) {
      alert("You can only update your own assigned tasks.");
      return;
    }

    setTasks(
      tasks.map((t) =>
        t.id === id
          ? { ...t, status: t.status === "completed" ? "pending" : "completed" }
          : t
      )
    );
  };

  const deleteTask = (id: string) => {
    {
      /*if(confirm('Delete this task?')) {
      setTasks(tasks.filter(t => t.id !== id));
    }*/
    }

    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // Technician cannot delete
    if (currentUser.role === "TECHNICIAN") {
      alert("You are not allowed to delete tasks.");
      return;
    }

    // Admin / Manager can delete ONLY tasks they created
    if (task.createdById !== currentUser.id) {
      alert("You can only delete tasks you created.");
      return;
    }

    if (confirm("Delete this task?")) {
      setTasks(tasks.filter((t) => t.id !== id));
    }
  };

  const clearCompleted = () => {
    if (currentUser.role === "TECHNICIAN") {
      alert("You cannot bulk delete tasks.");
      return;
    }
    if (confirm("Remove all completed tasks visible in this list?")) {
      const visibleIds = new Set(filteredTasks.map((t) => t.id));
      setTasks(
        tasks.filter((t) => !visibleIds.has(t.id) || t.status !== "completed")
      );
    }
  };

  // Helper to get user details
  const getUserDetails = (id: string) =>
    teamMembers.find((m) => m.id === id) || { name: "Unknown", photo: "" };

  // --- RENDER ---

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 1. HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            My Works{" "}
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
              {currentUser.role === "TECHNICIAN"
                ? "Personal View"
                : "Team Overview"}
            </span>
          </h1>
          <p className="text-slate-500 text-sm">
            Manage tasks and track performance goals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Badge */}
          <div className="hidden md:flex bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm text-xs font-bold text-slate-600 items-center gap-2">
            <CalendarIcon size={14} className="text-indigo-500" />
            {new Date().toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </div>

          {/* Team Member Filter (Manager Only) */}
          {accessibleMembers.length > 1 && (
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <UserIcon size={14} />
              </div>
              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors min-w-[160px]"
              >
                <option value="all">Whole Team</option>
                {accessibleMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === currentUser.id ? "My Tasks" : m.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <ChevronDown size={14} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Monthly Target Card */}
        <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Target size={80} />
          </div>
          <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-2">
            Monthly Reports
          </p>
          <h3 className="text-3xl font-black mb-1">
            {kpiData.reportsThisMonth}{" "}
            <span className="text-lg font-medium opacity-70">
              / {kpiData.monthlyTargetDisplay}
            </span>
          </h3>
          <p className="text-xs text-indigo-100 mb-4">Target Progress</p>

          <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${kpiData.targetProgress}%` }}
            ></div>
          </div>
          <div className="mt-2 text-[10px] font-bold text-right">
            {kpiData.targetProgress}% Achieved
          </div>
        </div>

        {/* Pending Tasks Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-indigo-300 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                Active Tasks
              </p>
              <h3 className="text-3xl font-black text-slate-800">
                {kpiData.active}
              </h3>
            </div>
            {kpiData.urgentPending > 0 ? (
              <div className="bg-red-50 text-red-600 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 animate-pulse">
                <Flame size={12} fill="currentColor" /> {kpiData.urgentPending}{" "}
                Urgent
              </div>
            ) : (
              <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                <CheckCircle2 size={20} />
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">Keep the queue moving!</p>
        </div>

        {/* History / All Time */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-indigo-300 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                Lifetime Reports
              </p>
              <h3 className="text-3xl font-black text-slate-800">
                {kpiData.totalHistory}
              </h3>
            </div>
            <div className="bg-slate-50 text-slate-400 p-2 rounded-xl">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Total reports generated</p>
        </div>

        {/* Completion Rate */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-colors">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
              Task Completion
            </p>
            <h3 className="text-3xl font-black text-slate-800">
              {kpiData.completionRate}%
            </h3>
            <p className="text-xs text-slate-400 mt-2">Efficiency Score</p>
          </div>
          <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="#f1f5f9"
                strokeWidth="6"
                fill="transparent"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke={kpiData.completionRate === 100 ? "#10b981" : "#6366f1"}
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={175.9}
                strokeDashoffset={
                  175.9 - (175.9 * kpiData.completionRate) / 100
                }
                className="transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. ACTIVITY CHART */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-800">Activity Volume</h3>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setChartView("monthly")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                chartView === "monthly"
                  ? "bg-white shadow text-indigo-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setChartView("yearly")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                chartView === "yearly"
                  ? "bg-white shadow text-indigo-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                interval={chartView === "monthly" ? 2 : 0}
              />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isCurrent ? "#6366f1" : "#cbd5e1"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. TASK LIST */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Top Controls: Filter & Quick Add */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 bg-slate-50/50">
          {/* Filter Tabs */}
          <div className="flex bg-slate-200/60 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
            {(["all", "active", "urgent", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg capitalize transition-all whitespace-nowrap ${
                  statusFilter === f
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Quick Add Input */}
          <form onSubmit={handleQuickAdd} className="flex-1 relative">
            <input
              type="text"
              value={quickTaskTitle}
              onChange={(e) => setQuickTaskTitle(e.target.value)}
              placeholder="Quick add a personal task..."
              className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
            />
            <button
              type="submit"
              disabled={!quickTaskTitle.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 transition-colors"
            >
              <Plus size={16} />
            </button>
          </form>
        </div>

        {/* Tasks List */}
        <div className="flex-1 min-h-[350px] max-h-[500px] overflow-y-auto custom-scrollbar p-2 space-y-1.5">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => {
              const assignee = getUserDetails(task.assignedToId || "");
              const isAssignedToOther =
                task.assignedToId && task.assignedToId !== currentUser.id;

              return (
                <div
                  key={task.id}
                  className={`
                           group flex items-center justify-between p-3 rounded-xl transition-all border
                           ${
                             task.status === "completed"
                               ? "bg-slate-50 border-transparent opacity-60"
                               : task.priority === "urgent"
                               ? "bg-white border-red-100 shadow-sm ring-1 ring-red-50"
                               : "bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm"
                           }
                        `}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`
                                 w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center border transition-all
                                 ${
                                   task.status === "completed"
                                     ? "bg-emerald-500 border-emerald-500 text-white"
                                     : task.priority === "urgent"
                                     ? "border-red-300 text-transparent hover:bg-red-50"
                                     : "border-slate-300 text-transparent hover:border-indigo-400 hover:bg-indigo-50"
                                 }
                              `}
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>

                    <div className="flex flex-col overflow-hidden">
                      <span
                        className={`text-sm font-medium truncate ${
                          task.status === "completed"
                            ? "line-through text-slate-400"
                            : "text-slate-700"
                        }`}
                      >
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{new Date(task.date).toLocaleDateString()}</span>
                        {task.time && <span>• {task.time}</span>}

                        {/* Assignee Badge for Managers */}
                        {isAssignedToOther && (
                          <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">
                            {assignee.photo ? (
                              <img
                                src={assignee.photo}
                                className="w-3 h-3 rounded-full"
                                alt=""
                              />
                            ) : (
                              <div className="w-3 h-3 rounded-full bg-slate-300 flex items-center justify-center text-[8px] text-white font-bold">
                                {assignee.name.charAt(0)}
                              </div>
                            )}
                            <span className="font-bold text-slate-600">
                              {assignee.name}
                            </span>
                          </div>
                        )}

                        {task.priority === "urgent" &&
                          task.status !== "completed" && (
                            <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold">
                              <Flame size={10} fill="currentColor" /> Urgent
                            </span>
                          )}
                      </div>
                    </div>
                  </div>

                  {/*<button 
                           onClick={() => deleteTask(task.id)}
                           className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                           <Trash2 size={16} />
                        </button>*/}
                  {currentUser.role !== "TECHNICIAN" &&
                    task.createdById === currentUser.id && (
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                {statusFilter === "completed" ? (
                  <CheckCircle2 size={32} />
                ) : (
                  <Filter size={32} />
                )}
              </div>
              <p className="text-sm font-medium">No tasks found</p>
              <p className="text-xs mt-1 text-slate-400/80">
                Try changing your filters or add a new task.
              </p>
            </div>
          )}
        </div>

        {/* Footer Action */}
        {kpiData.completed > 0 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-center">
            <button
              onClick={clearCompleted}
              className="text-xs font-bold text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Clear {kpiData.completed} Completed Tasks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
