import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function StaffLayout() {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-500 p-4 shadow-lg flex justify-between items-center rounded-b-2xl">
        <h1 className="text-2xl font-black text-white">🌾 เจ๊นก พันธุ์ข้าว</h1>
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-sm">{user?.name}</span>
          <button
            onClick={logout}
            className="bg-green-800 text-white px-3 py-1 rounded-lg font-bold hover:bg-green-900 text-xs"
          >
            ออก
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 pb-20 px-4 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-2xl">
        <div className="flex justify-between items-stretch max-w-full">
          <NavLink 
            to="/staff/step1" 
            end 
            className={({isActive}) => `flex-1 flex flex-col items-center justify-center py-3 text-xs font-bold transition ${isActive ? 'text-green-700 border-t-4 border-green-700 bg-green-50' : 'text-gray-600'}`}
          >
            <span className="text-2xl">➕</span>
            <span className="mt-1">รับเข้า</span>
          </NavLink>
          
          <NavLink 
            to="/staff/step2" 
            className={({isActive}) => `flex-1 flex flex-col items-center justify-center py-3 text-xs font-bold transition ${isActive ? 'text-green-700 border-t-4 border-green-700 bg-green-50' : 'text-gray-600'}`}
          >
            <span className="text-2xl">✂️</span>
            <span className="mt-1">คัดข้าว</span>
          </NavLink>
          
          <NavLink 
            to="/staff/step3" 
            className={({isActive}) => `flex-1 flex flex-col items-center justify-center py-3 text-xs font-bold transition ${isActive ? 'text-green-700 border-t-4 border-green-700 bg-green-50' : 'text-gray-600'}`}
          >
            <span className="text-2xl">📤</span>
            <span className="mt-1">ขายออก</span>
          </NavLink>
          
          <NavLink 
            to="/staff/step4" 
            className={({isActive}) => `flex-1 flex flex-col items-center justify-center py-3 text-xs font-bold transition ${isActive ? 'text-green-700 border-t-4 border-green-700 bg-green-50' : 'text-gray-600'}`}
          >
            <span className="text-2xl">🔄</span>
            <span className="mt-1">เคลม</span>
          </NavLink>
          
          <NavLink 
            to="/staff/inventory" 
            className={({isActive}) => `flex-1 flex flex-col items-center justify-center py-3 text-xs font-bold transition ${isActive ? 'text-green-700 border-t-4 border-green-700 bg-green-50' : 'text-gray-600'}`}
          >
            <span className="text-2xl">📦</span>
            <span className="mt-1">คงเหลือ</span>
          </NavLink>
          
          <NavLink 
            to="/staff/profile" 
            className={({isActive}) => `flex-1 flex flex-col items-center justify-center py-3 text-xs font-bold transition ${isActive ? 'text-green-700 border-t-4 border-green-700 bg-green-50' : 'text-gray-600'}`}
          >
            <span className="text-2xl">👤</span>
            <span className="mt-1">โปรไฟล์</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}