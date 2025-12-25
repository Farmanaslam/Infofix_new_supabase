
import React, { useMemo } from 'react';
import { 
  Ticket, 
  Customer, 
  AppSettings, 
  User 
} from '../types';
import { 
  TrendingUp, 
  Users, 
  AlertCircle, 
  Clock, 
  Activity, 
  Plus, 
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Store,
  CalendarCheck,
  Laptop,
  Tag,
  FileQuestion,
  Sparkles,
  CheckCircle,
  Wrench
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { collection, getDocs } from "firebase/firestore";
import { db } from '@/firebaseConfig';



interface DashboardProps {
  tickets: Ticket[];
  customers: Customer[];
  settings: AppSettings;
  currentUser: User;
  onNavigate: (view: any) => void;
  onAction: (action: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ tickets, customers, settings, currentUser, onNavigate, onAction }) => {
  
  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    const activeTickets = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Rejected');
    
    // Resolved Today
   const today = new Date();
today.setHours(0, 0, 0, 0);

const resolvedToday = tickets.filter(t => {
  if (t.status !== "Resolved") return false;
  if (!t.resolvedAt) return false;

  const resolvedDate = t.resolvedAt.toDate();
  resolvedDate.setHours(0, 0, 0, 0);

  return resolvedDate.getTime() === today.getTime();
}).length;
    // Overdue Calculation (Based on SLA settings)
    const overdueCount = activeTickets.filter(t => {
       const created = new Date(t.date);
       const now = new Date();
       const diffTime = Math.abs(now.getTime() - created.getTime());
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
       
       const priority = t.priority.toLowerCase() as 'high' | 'medium' | 'low';
       const allowedDays = settings.sla[priority] || 7; // Default 7 if config missing
       
       return diffDays > allowedDays;
    }).length;

    // Specific Counts for Small Cards
    const laptopCount = tickets.filter(t => t.deviceType === 'Laptop').length;
    const brandServiceCount = tickets.filter(t => t.deviceType === 'Brand Service').length;
    const newCount = tickets.filter(t => t.status === 'New').length;
    const totalResolved = tickets.filter(t => t.status === 'Resolved').length;
    const pendingApprovalCount = tickets.filter(t => t.status === 'Pending Approval').length;

    return {
      activeCount: activeTickets.length,
      overdueCount,
      resolvedToday,
      customerCount: customers.length,
      laptopCount,
      brandServiceCount,
      newCount,
      totalResolved,
      pendingApprovalCount
    };
  }, [tickets, customers, settings.sla]);

  // --- STORE WORKLOAD ---
  const storeLoad = useMemo(() => {
     const activeTickets = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Rejected');
     const totalActive = activeTickets.length || 1; // Prevent div by zero
     
     const load: Record<string, number> = {};
     activeTickets.forEach(t => {
         load[t.store] = (load[t.store] || 0) + 1;
     });

     return settings.stores.map(store => {
         const count = load[store.name] || 0;
         const percent = Math.round((count / totalActive) * 100);
         return { name: store.name, count, percent };
     }).sort((a,b) => b.count - a.count);
  }, [tickets, settings.stores]);

  // --- TECHNICIAN WORKLOAD ---
  const techLoad = useMemo(() => {
     const activeTickets = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Rejected');
     const totalActive = activeTickets.length || 1;
     
     const load: Record<string, number> = {};
     activeTickets.forEach(t => {
         if (t.assignedToId) {
             load[t.assignedToId] = (load[t.assignedToId] || 0) + 1;
         }
     });

     return settings.teamMembers
        .filter(m => m.role === 'TECHNICIAN')
        .map(tech => {
             const count = load[tech.id] || 0;
             const percent = Math.round((count / totalActive) * 100);
             return { id: tech.id, name: tech.name, count, percent, photo: tech.photo };
        })
        .sort((a,b) => b.count - a.count);
  }, [tickets, settings.teamMembers]);

  // --- CHART DATA ---
  const weeklyData = useMemo(() => {
     // Last 7 days volume
     const data = [];
     for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString();
        const count = tickets.filter(t => new Date(t.date).toLocaleDateString() === dateStr).length;
        // Day Name (e.g., Mon)
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        data.push({ name: dayName, tickets: count });
     }
     return data;
  }, [tickets]);

  const deviceData = useMemo(() => {
      const counts: Record<string, number> = {};
      tickets.forEach(t => {
          counts[t.deviceType] = (counts[t.deviceType] || 0) + 1;
      });
      return Object.keys(counts).map(k => ({ name: k, value: counts[k] })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [tickets]);

  // --- URGENT ITEMS ---
  const urgentTickets = tickets
    .filter(t => (t.priority === 'High' || t.status === 'On Hold') && t.status !== 'Resolved' && t.status !== 'Rejected')
    .slice(0, 5);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* 1. WELCOME SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Good Morning, {currentUser.name.split(' ')[0]} 👋
          </h2>
          <p className="text-slate-500">Here's your operational overview.</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={() => onAction('new_ticket')} 
             className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-2"
           >
             <Plus size={18} /> New Ticket
           </button>
           <button 
             onClick={() => onNavigate('customers')} 
             className="px-4 py-2 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2"
           >
             <Users size={18} /> Add Customer
           </button>
        </div>
      </div>

      {/* 2. KPI GRID (UPDATED) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
         {/* Card 1: Open Jobs */}
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-blue-300 transition-colors">
            <div className="flex justify-between items-start mb-2">
               <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Briefcase size={20} />
               </div>
               <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">Real-time</span>
            </div>
            <div>
               <h3 className="text-3xl font-black text-slate-800">{stats.activeCount}</h3>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">Open Jobs</p>
            </div>
         </div>

         {/* Card 2: Estimated Overdue */}
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-red-300 transition-colors">
            <div className="flex justify-between items-start mb-2">
               <div className="p-2.5 bg-red-50 text-red-600 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <Clock size={20} />
               </div>
               {stats.overdueCount > 0 && <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md animate-pulse">Attention</span>}
            </div>
            <div>
               <h3 className="text-3xl font-black text-slate-800">{stats.overdueCount}</h3>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">Est. Overdue</p>
            </div>
         </div>

         {/* Card 3: Resolved Today */}
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-emerald-300 transition-colors">
            <div className="flex justify-between items-start mb-2">
               <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <CalendarCheck size={20} />
               </div>
               <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">Today</span>
            </div>
            <div>
               <h3 className="text-3xl font-black text-slate-800">{stats.resolvedToday}</h3>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">Resolved Today</p>
            </div>
         </div>

         {/* Card 4: Total Customers */}
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-purple-300 transition-colors">
            <div className="flex justify-between items-start mb-2">
               <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Users size={20} />
               </div>
               <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-md">Lifetime</span>
            </div>
            <div>
               <h3 className="text-3xl font-black text-slate-800">{stats.customerCount}</h3>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">Total Customers</p>
            </div>
         </div>
      </div>

      {/* 2.5 SMALL SUMMARY CARDS (NEW) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between hover:shadow-sm transition-all">
             <div>
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Total Laptops</p>
                <p className="text-xl font-black text-blue-700">{stats.laptopCount}</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-500 shadow-sm">
                <Laptop size={18} />
             </div>
          </div>

          <div className="bg-violet-50/50 p-4 rounded-xl border border-violet-100 flex items-center justify-between hover:shadow-sm transition-all">
             <div>
                <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1">Brand Svc</p>
                <p className="text-xl font-black text-violet-700">{stats.brandServiceCount}</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-violet-500 shadow-sm">
                <Tag size={18} />
             </div>
          </div>

          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between hover:shadow-sm transition-all">
             <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Total New</p>
                <p className="text-xl font-black text-indigo-700">{stats.newCount}</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-500 shadow-sm">
                <Sparkles size={18} />
             </div>
          </div>

          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between hover:shadow-sm transition-all">
             <div>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">All Resolved</p>
                <p className="text-xl font-black text-emerald-700">{stats.totalResolved}</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-emerald-500 shadow-sm">
                <CheckCircle size={18} />
             </div>
          </div>

          <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 flex items-center justify-between hover:shadow-sm transition-all">
             <div>
                <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">Pending Appr.</p>
                <p className="text-xl font-black text-orange-700">{stats.pendingApprovalCount}</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-orange-500 shadow-sm">
                <FileQuestion size={18} />
             </div>
          </div>
      </div>

      {/* 3. MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* CHART SECTION */}
         <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Activity size={20} className="text-indigo-600"/> Weekly Intake
               </h3>
            </div>
            
            {/* Fix for "width(-1)": Use relative parent + absolute inset child */}
            <div className="relative h-[300px] w-full">
               <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                           <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                           itemStyle={{ color: '#6366f1', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="tickets" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTickets)" />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         {/* URGENT ATTENTION LIST */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle size={20} className="text-red-500"/> Urgent Attention
               </h3>
               <span className="text-xs font-bold bg-white border border-slate-200 px-2 py-1 rounded text-slate-500">
                  {urgentTickets.length} Items
               </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 max-h-[300px]">
               {urgentTickets.length > 0 ? (
                  <div className="space-y-2">
                     {urgentTickets.map(ticket => (
                        <div key={ticket.id} className="p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group">
                           <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-indigo-600 font-mono bg-indigo-50 px-1.5 py-0.5 rounded">{ticket.ticketId}</span>
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                 ticket.priority === 'High' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                              }`}>
                                 {ticket.priority === 'High' ? 'Critical' : 'On Hold'}
                              </span>
                           </div>
                           <h4 className="font-bold text-slate-800 text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors">
                              {ticket.deviceType} - {ticket.issueDescription}
                           </h4>
                           <div className="flex justify-between items-center mt-2">
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                 <Clock size={12}/> {ticket.date}
                              </span>
                              <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                           </div>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10 text-slate-400">
                     <CheckCircle2 size={32} className="mb-2 text-emerald-400 opacity-50" />
                     <p className="text-sm font-medium">All clear!</p>
                     <p className="text-xs">No critical items pending.</p>
                  </div>
               )}
            </div>
            <button 
               onClick={() => onNavigate('tickets')} 
               className="p-3 text-center text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors border-t border-slate-100 mt-auto"
            >
               View All Tickets
            </button>
         </div>

      </div>
      
      {/* 4. SECONDARY METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* STORE WORKLOAD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Store size={20} className="text-indigo-600" /> Store Workload
             </h3>
             <div className="space-y-4">
                {storeLoad.map((store) => (
                    <div key={store.name}>
                       <div className="flex justify-between items-end mb-1">
                          <span className="text-sm font-medium text-slate-700">{store.name}</span>
                          <span className="text-xs font-bold text-slate-500">{store.count} Active</span>
                       </div>
                       <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div 
                             className="bg-indigo-500 h-2.5 rounded-full transition-all duration-1000 ease-out" 
                             style={{ width: `${Math.max(store.percent, 5)}%` }} // Min width 5% for visibility
                          ></div>
                       </div>
                    </div>
                ))}
                {storeLoad.length === 0 && <p className="text-xs text-slate-400 italic">No active data available.</p>}
             </div>
          </div>

          {/* TECHNICIAN WORKLOAD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Wrench size={20} className="text-indigo-600" /> Technician Load
             </h3>
             <div className="space-y-4">
                {techLoad.map((tech) => (
                    <div key={tech.id}>
                       <div className="flex justify-between items-end mb-1">
                          <div className="flex items-center gap-2">
                              {tech.photo ? (
                                <img src={tech.photo} className="w-6 h-6 rounded-full object-cover border border-slate-200" alt={tech.name} /> 
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200">
                                    {tech.name.charAt(0)}
                                </div>
                              )}
                              <span className="text-sm font-medium text-slate-700 truncate max-w-[100px]">{tech.name}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-500">{tech.count} Jobs</span>
                       </div>
                       <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div 
                             className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-out" 
                             style={{ width: `${Math.max(tech.percent, 0)}%` }} 
                          ></div>
                       </div>
                    </div>
                ))}
                {techLoad.length === 0 && <p className="text-xs text-slate-400 italic">No technicians active.</p>}
             </div>
          </div>
          
          {/* DEVICE DISTRIBUTION */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Activity size={20} className="text-indigo-600" /> Device Distribution
              </h3>
              
              {/* Fix for "width(-1)": Use relative parent + absolute inset child */}
              <div className="relative h-40 w-full">
                  <div className="absolute inset-0">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={deviceData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                              <Tooltip 
                                cursor={{fill: '#f8fafc'}}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {deviceData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      </div>

    </div>
  );
};

export default Dashboard;
