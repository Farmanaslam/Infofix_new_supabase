
import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Ticket, 
  FileCheck, 
  Users, 
  Calendar, 
  BarChart3, 
  Settings, 
  LogOut, 
  LifeBuoy, 
  Clock, 
  User, 
  Phone,
  Globe,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Cpu,
  X,
  Wifi,
  WifiOff,
  AlertTriangle,
  ClipboardCheck,
  Database,
  CheckSquare,
  FileText,
  Star
} from 'lucide-react';
import { View, User as AppUser, Role } from '../types';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
  currentUser: AppUser;
  onLogout: () => void;
  syncStatus?: 'connected' | 'local' | 'error';
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  allowedRoles: Role[];
  children?: NavItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isMobileOpen, setIsMobileOpen, currentUser, onLogout, syncStatus = 'local' }) => {
  // Store the ID of the currently expanded menu group
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  
  // Define all items with nesting
  const allNavItems: NavItem[] = [
    // STAFF ITEMS
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      allowedRoles: ['ADMIN', 'MANAGER','TECHNICIAN'] 
    },
    { 
      id: 'tickets', 
      label: 'Service Tickets', 
      icon: Ticket,
      allowedRoles: ['ADMIN', 'MANAGER', 'TECHNICIAN']
    },
    { 
      id: 'review_reports', 
      label: 'Review Requests', 
      icon: FileCheck,
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    {
      id: 'tasks_group',
      label: 'Task Management',
      icon: CheckSquare,
      allowedRoles: ['ADMIN', 'MANAGER', 'TECHNICIAN'],
      children: [
        { id: 'task_dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['ADMIN', 'MANAGER', ] },
        { id: 'task_my_works', label: 'My Works', icon: Briefcase, allowedRoles: ['ADMIN', 'MANAGER', 'TECHNICIAN'] },
        { id: 'task_schedule', label: 'Schedule', icon: Calendar, allowedRoles: ['ADMIN', 'MANAGER','TECHNICIAN'] },
        { id: 'task_reports', label: 'Reports', icon: FileText, allowedRoles: ['ADMIN', 'MANAGER'] },
        { id: 'task_ratings', label: 'Staff Ratings', icon: Star, allowedRoles: ['ADMIN', 'MANAGER'] }
      ]
    },
    { 
      id: 'laptop_reports_group', 
      label: 'Laptop Reports', 
      icon: ClipboardCheck,
      allowedRoles: ['ADMIN', 'MANAGER', 'TECHNICIAN'],
      children: [
         { id: 'laptop_dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['ADMIN', 'MANAGER', ] },
         { id: 'laptop_data', label: 'Data Management', icon: Database, allowedRoles: ['ADMIN', 'MANAGER', 'TECHNICIAN'] }
      ]
    },
    { 
      id: 'customers', 
      label: 'Customer Database', 
      icon: Users,
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    {
       id: 'brands_group',
       label: 'Partner Brands',
       icon: Briefcase,
       allowedRoles: ['ADMIN', 'MANAGER', 'TECHNICIAN'],
       children: [
          { id: 'brand_ivoomi', label: 'IVOOMI', icon: Globe, allowedRoles: ['ADMIN', 'MANAGER', 'TECHNICIAN'] },
          { id: 'brand_elista', label: 'ELISTA', icon: Globe, allowedRoles: ['ADMIN', 'MANAGER', 'TECHNICIAN'] }
       ]
    },
    { 
      id: 'reports', 
      label: 'Analytics & Reports', 
      icon: BarChart3,
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    { 
      id: 'supports', 
      label: 'AI Support Agent', 
      icon: LifeBuoy, 
      allowedRoles: ['ADMIN', 'MANAGER', 'TECHNICIAN'] 
    },
    { 
      id: 'settings', 
      label: 'System Settings', 
      icon: Settings,
      allowedRoles: ['ADMIN']
    },

    // CUSTOMER ITEMS
    {
      id: 'customer_dashboard',
      label: 'Service History',
      icon: Clock,
      allowedRoles: ['CUSTOMER']
    },
    {
      id: 'customer_supports',
      label: 'Support & Contact',
      icon: Phone,
      allowedRoles: ['CUSTOMER']
    },
    {
      id: 'customer_profile',
      label: 'My Profile',
      icon: User,
      allowedRoles: ['CUSTOMER']
    }
  ];

  const handleNavClick = (item: NavItem) => {
    if (item.children) {
      setExpandedMenu(expandedMenu === item.id ? null : item.id);
    } else {
      setCurrentView(item.id as View);
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-[#020617] text-slate-300 transform transition-transform duration-300 ease-out border-r border-white/5
        lg:translate-x-0 lg:static flex flex-col shadow-2xl
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Close Button */}
        <button 
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white lg:hidden"
        >
          <X size={24} />
        </button>

        {/* Logo Area */}
        <div className="flex items-center gap-3 px-6 py-8">
          <div>
             <h1 className="text-xl font-black text-white tracking-tight leading-none">INFOFIX</h1>
             <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Services CRM</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {allNavItems.map((item) => {
            // Check visibility
            if (!item.allowedRoles.includes(currentUser.role)) return null;

            const isActive = currentView === item.id;
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            
            // Check if any child is active to keep parent open/highlighted
            const isChildActive = item.children?.some(child => currentView === child.id);
            const isOpen = expandedMenu === item.id || isChildActive;

            return (
              <div key={item.id} className="relative">
                <button
                  onClick={() => handleNavClick(item)}
                  className={`
                    w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 group
                    ${isActive || (hasChildren && isChildActive)
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                      : 'hover:bg-white/5 hover:text-white text-slate-400'}
                  `}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon size={20} className={isActive || isChildActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400 transition-colors'} />
                    {item.label}
                  </div>
                  {hasChildren && (
                     <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                       <ChevronDown size={16} className="opacity-50" />
                     </div>
                  )}
                </button>

                {/* Nested Items */}
                {hasChildren && isOpen && (
                   <div className="mt-1 ml-4 pl-4 border-l border-white/10 space-y-1 animate-in slide-in-from-top-1 duration-200">
                     {item.children
  ?.filter(child => child.allowedRoles.includes(currentUser.role))
  .map(child => (
    <button
      key={child.id}
      onClick={() => {
        setCurrentView(child.id as View);
        setIsMobileOpen(false);
      }}
      className={`
        w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
        ${currentView === child.id
          ? 'text-white bg-white/10'
          : 'text-slate-500 hover:text-white hover:bg-white/5'}
      `}
    >
      <child.icon
        size={16}
        className={currentView === child.id ? 'text-indigo-400' : 'opacity-70'}
      />
      {child.label}
    </button>
))}
                   </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer: User Profile & Logout */}
        <div className="p-4 border-t border-white/5 bg-[#0B1120]">
          <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between group hover:bg-white/10 transition-colors cursor-default mb-2">
             <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-9 h-9 rounded-full flex shrink-0 items-center justify-center text-white font-bold text-sm shadow-inner ${currentUser.role === 'CUSTOMER' ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                    {currentUser.photo ? (
                      <img src={currentUser.photo} className="w-full h-full object-cover rounded-full" alt="" />
                    ) : (
                      currentUser.name.charAt(0)
                    )}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{currentUser.role}</p>
                </div>
             </div>
             
             <button 
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                title="Sign Out"
             >
                <LogOut size={18} />
             </button>
          </div>

          {/* Sync Status Indicator */}
          <div className="flex items-center justify-between px-2 pt-1">
             <div className="flex items-center gap-2">
                {syncStatus === 'connected' && <Wifi size={14} className="text-emerald-500" />}
                {syncStatus === 'local' && <WifiOff size={14} className="text-slate-500" />}
                {syncStatus === 'error' && <AlertTriangle size={14} className="text-red-500" />}
                
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                   syncStatus === 'connected' ? 'text-emerald-500' : 
                   syncStatus === 'error' ? 'text-red-500' : 'text-slate-500'
                }`}>
                   {syncStatus === 'connected' ? 'Cloud Synced' : syncStatus === 'error' ? 'Sync Error' : 'Local Mode'}
                </span>
             </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
