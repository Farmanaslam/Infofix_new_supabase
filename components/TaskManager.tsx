import React, { useMemo, useState, useEffect } from "react";
import {
  CheckSquare,
  Briefcase,
  FileText,
  Star,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  Calendar as CalendarIcon,
  Search,
  Filter,
  BarChart,
  LayoutDashboard,
  Check,
  Award,
} from "lucide-react";
import { Task, AppSettings, User as AppUser, Report } from "../types";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import TasksView from "./TasksView";

interface TaskManagerProps {
  activeTab: "dashboard" | "my_works" | "reports" | "ratings";
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  teamMembers: AppUser[];
  currentUser: AppUser;
  savedReports?: Report[];
}

export default function TaskManager({
  activeTab,
  tasks,
  setTasks,
  teamMembers,
  currentUser,
  savedReports = [],
}: TaskManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "completed"
  >("all");

  const [staffRatings, setStaffRatings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // --- DERIVED DATA ---
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch = t.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "all" || t.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchTerm, filterStatus]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pending = total - completed;

    // Group by assignee for ratings
    const staffPerformance: Record<
      string,
      { name: string; total: number; completed: number; points: number }
    > = {};

    tasks.forEach((t) => {
      if (t.assignedToId) {
        const member = teamMembers.find((m) => m.id === t.assignedToId);
        const name = member ? member.name : "Unknown";
        if (!staffPerformance[name])
          staffPerformance[name] = { name, total: 0, completed: 0, points: 0 };

        staffPerformance[name].total += 1;
        if (t.status === "completed") {
          staffPerformance[name].completed += 1;
          staffPerformance[name].points += 10; // Simple point system
        }
      }
    });

    const leaderboard = Object.values(staffPerformance).sort(
      (a, b) => b.points - a.points
    );

    return { total, completed, pending, leaderboard };
  }, [tasks, teamMembers]);

  const monthlyLeaderboard = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const staffPerformance: Record<
      string,
      {
        name: string;
        total: number;
        completed: number;
        points: number;
      }
    > = {};

    tasks.forEach((t) => {
      if (!t.assignedToId || !t.date) return;

      const dateParts = t.date.split("-"); // ["YYYY","MM","DD"]
      const taskYear = parseInt(dateParts[0], 10);
      const taskMonth = parseInt(dateParts[1], 10) - 1; // JS months 0-indexed

      if (taskMonth !== currentMonth || taskYear !== currentYear) return;

      const member = teamMembers.find((m) => m.id === t.assignedToId);
      const name = member ? member.name : "Unknown";

      if (!staffPerformance[name]) {
        staffPerformance[name] = {
          name,
          total: 0,
          completed: 0,
          points: 0,
        };
      }

      staffPerformance[name].total += 1;

      if (t.status === "completed") {
        staffPerformance[name].completed += 1;
        staffPerformance[name].points += 10; // SAME POINT SYSTEM AS UI
      }
    });
    return Object.values(staffPerformance)
      .filter((s) => s.total > 0)
      .sort((a, b) => b.points - a.points);
  }, [tasks, teamMembers]);

  const userStats = useMemo(() => {
    if (!currentUser) {
      return { total: 0, pending: 0, completed: 0 };
    }

    const userTasks = tasks.filter(
      (task) => task.assignedToId === currentUser.id
    );

    return {
      total: userTasks.length,
      pending: userTasks.filter((t) => t.status !== "completed").length,
      completed: userTasks.filter((t) => t.status === "completed").length,
    };
  }, [tasks, currentUser]);

  // --- SUB-VIEWS ---

  // 1. DASHBOARD VIEW
  if (activeTab === "dashboard" && currentUser.role === "TECHNICIAN") {
    return null;
  }
  if (activeTab === "dashboard") {
    const pieData = [
      { name: "Completed", value: userStats.completed, color: "#10b981" },
      { name: "Pending", value: userStats.pending, color: "#f59e0b" },
    ];

    return (
      <div className="space-y-6 pb-20">
        <div className="bg-indigo-600 rounded-2xl p-8 text-white shadow-xl shadow-indigo-200">
          <h1 className="text-3xl font-bold mb-2">Task Dashboard</h1>
          <p className="text-indigo-100">
            Overview of all operational tasks and team progress.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                Total Tasks
              </p>
              <h3 className="text-3xl font-black text-slate-800">
                {userStats.total}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <CheckSquare size={24} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                Pending
              </p>
              <h3 className="text-3xl font-black text-amber-500">
                {userStats.pending}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock size={24} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                Completed
              </p>
              <h3 className="text-3xl font-black text-emerald-500">
                {userStats.completed}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Completion Status</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {pieData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-2 text-xs font-bold text-slate-500"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  {item.name}: {item.value}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">
              Top Performers (Tasks Done)
            </h3>
            <div className="space-y-4">
              {userStats?.leaderboard?.slice(0, 5).map((staff, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        idx === 0
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-white border border-slate-200 text-slate-500"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span className="font-bold text-slate-700">
                      {staff.name}
                    </span>
                  </div>
                  <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs">
                    {staff.completed} Done
                  </span>
                </div>
              ))}
              {userStats?.leaderboard?.length === 0 && (
                <p className="text-slate-400 text-center py-4">No data yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. MY WORKS VIEW (Using New TasksView Component)
  if (activeTab === "my_works") {
    return (
      <TasksView
        tasks={tasks}
        setTasks={setTasks}
        savedReports={savedReports}
        currentUser={currentUser}
        teamMembers={teamMembers}
      />
    );
  }

  // 3. REPORTS VIEW
  if (activeTab === "reports") {
    return (
      <div className="h-full flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-indigo-600" /> Task Reports
          </h2>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto h-full">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-600">
                    Task Title
                  </th>
                  <th className="px-6 py-4 font-bold text-slate-600">
                    Assignee
                  </th>
                  <th className="px-6 py-4 font-bold text-slate-600">Date</th>
                  <th className="px-6 py-4 font-bold text-slate-600">Type</th>
                  <th className="px-6 py-4 font-bold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const assignee = teamMembers.find(
                    (m) => m.id === task.assignedToId
                  );
                  return (
                    <tr key={task.id} className="hover:bg-slate-50 group">
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {task.title}
                      </td>
                      <td className="px-6 py-4">
                        {assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                              {assignee.name.charAt(0)}
                            </div>
                            <span className="text-slate-600">
                              {assignee.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{task.date}</td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs uppercase font-bold tracking-wide">
                          {task.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                            task.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-slate-400"
                    >
                      No tasks found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 4. STAFF RATINGS VIEW

  if (activeTab === "ratings") {
    return (
      <div className="h-full flex flex-col space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Star className="text-yellow-500 fill-current" /> Staff Performance
            Ratings
          </h2>
          <p className="text-slate-500 text-sm">
            Automated scoring based on task completion and efficiency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {monthlyLeaderboard.map((staff, idx) => {
            const efficiency =
              staff.total > 0
                ? Math.round((staff.completed / staff.total) * 100)
                : 0;
            return (
              <div
                key={staff.name}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
              >
                {/* Rank Badge */}
                <div
                  className={`absolute top-0 right-0 p-3 rounded-bl-2xl font-bold text-lg w-12 h-12 flex items-center justify-center text-white ${
                    idx === 0
                      ? "bg-yellow-400"
                      : idx === 1
                      ? "bg-slate-400"
                      : idx === 2
                      ? "bg-amber-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {idx === 0 ? (
                    <Award size={20} className="fill-current" />
                  ) : (
                    `#${idx + 1}`
                  )}
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-400 border-4 border-slate-50">
                    {staff.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">
                      {staff.name}
                    </h3>
                    <div className="flex items-center gap-1 text-yellow-500">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={14}
                          className={
                            efficiency >= star * 20
                              ? "fill-current"
                              : "text-slate-200"
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-50 p-3 rounded-xl text-center">
                    <span className="block text-xs font-bold text-slate-400 uppercase">
                      Tasks
                    </span>
                    <span className="block text-xl font-black text-slate-700">
                      {staff.total}
                    </span>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl text-center">
                    <span className="block text-xs font-bold text-emerald-600 uppercase">
                      Score
                    </span>
                    <span className="block text-xl font-black text-emerald-600">
                      {staff.points}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Efficiency Rate</span>
                    <span>{efficiency}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${efficiency}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}

          {monthlyLeaderboard?.leaderboard?.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400">
              No performance data available.
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
