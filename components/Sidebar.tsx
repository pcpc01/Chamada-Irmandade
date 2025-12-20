
import React from 'react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const menuItems = [
    { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
    { id: 'students', icon: 'fa-user-graduate', label: 'Alunos' },
    { id: 'classes', icon: 'fa-chalkboard-user', label: 'Turmas' },
    { id: 'attendance', icon: 'fa-calendar-check', label: 'Chamada' },
    { id: 'reports', icon: 'fa-file-lines', label: 'Relatórios' },
  ];

  return (
    <aside className="w-20 md:w-64 bg-indigo-700 text-white flex flex-col transition-all duration-300">
      <div className="p-6 flex items-center justify-center md:justify-start gap-4 mb-2">
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-xl overflow-hidden p-1.5 shrink-0 transition-transform hover:scale-105">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="hidden md:block">
          <span className="block font-black text-xl tracking-tighter leading-none">EduPresença</span>
          <span className="block text-[8px] font-bold text-indigo-300 uppercase tracking-widest mt-1.5 opacity-80 leading-tight">
            Irmandade de <br /> Misericórdia
          </span>
        </div>
      </div>

      <nav className="flex-1 mt-6">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as View)}
            className={`w-full flex items-center justify-center md:justify-start gap-4 p-4 transition-colors ${currentView === item.id
                ? 'bg-indigo-800 border-l-4 border-indigo-300'
                : 'hover:bg-indigo-600'
              }`}
          >
            <i className={`fas ${item.icon} text-lg`}></i>
            <span className="hidden md:block font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-indigo-600 hidden md:block">
        <p className="text-xs text-indigo-300 text-center">v1.0.0 - MVP</p>
      </div>
    </aside>
  );
};

export default Sidebar;
