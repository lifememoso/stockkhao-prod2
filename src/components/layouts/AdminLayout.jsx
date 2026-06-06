import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const isSuperAdmin = user?.role === 'superadmin';
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { group: 'ตรวจสอบ', items: [
      { to: '/admin/traceability', icon: '🔍', label: 'ตรวจสอบย้อนหลัง' },
      { to: '/admin/activity', icon: '📋', label: 'Activity Log' },
    ]},
    { group: 'จัดการ', items: [
      { to: '/admin/export', icon: '📁', label: 'Export ข้อมูล' },
      { to: '/admin/settings', icon: '⚙️', label: 'ตั้งค่า' },
      ...(isSuperAdmin ? [{ to: '/admin/users', icon: '👥', label: 'จัดการผู้ใช้' }] : []),
      { to: '/admin/profile', icon: '👤', label: 'โปรไฟล์' },
    ]},
  ];

  const bottomNav = [
    { to: '/admin', end: true, icon: '📊', label: 'Dashboard' },
    { to: '/admin/step1', icon: '➕', label: 'รับเข้า' },
    { to: '/admin/step2', icon: '✂️', label: 'คัดข้าว' },
    { to: '/admin/step3', icon: '📤', label: 'ขายออก' },
    { to: '/admin/step4', icon: '🔄', label: 'เคลม' },
    { to: '/admin/approvals', icon: '✅', label: 'อนุมัติ' },
  ];

  const sidebarItems = [
    { group: 'ภาพรวม', items: [
      { to: '/admin', end: true, icon: '📊', label: 'Dashboard' },
    ]},
    { group: 'บันทึกข้อมูล', items: [
      { to: '/admin/step1', icon: '➕', label: 'รับซื้อข้าวเข้า' },
      { to: '/admin/step2', icon: '✂️', label: 'คัดแยกข้าว' },
      { to: '/admin/step3', icon: '📤', label: 'ขายออก' },
      { to: '/admin/step4', icon: '🔄', label: 'บันทึกเคลม' },
    ]},
    { group: 'ตรวจสอบ', items: [
      { to: '/admin/approvals', icon: '✅', label: 'อนุมัติรายการ' },
      { to: '/admin/traceability', icon: '🔍', label: 'ตรวจสอบย้อนหลัง' },
      { to: '/admin/activity', icon: '📋', label: 'Activity Log' },
    ]},
    { group: 'จัดการ', items: [
      { to: '/admin/export', icon: '📁', label: 'Export ข้อมูล' },
      { to: '/admin/settings', icon: '⚙️', label: 'ตั้งค่า' },
      ...(isSuperAdmin ? [{ to: '/admin/users', icon: '👥', label: 'จัดการผู้ใช้' }] : []),
      { to: '/admin/profile', icon: '👤', label: 'โปรไฟล์' },
    ]},
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* MOBILE HEADER */}
      <div className="lg:hidden bg-gradient-to-r from-green-700 to-green-600 p-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="bg-green-800 text-white px-3 py-2 rounded-lg font-bold text-sm"
        >
          ☰ เมนู
        </button>
        <div className="flex items-center gap-2">
          <span className="text-white font-black text-base">🌾 เจ๊นก พันธุ์ข้าว</span>
          <span className="text-green-100 text-sm font-semibold">| {user?.name}</span>
          <button
            onClick={logout}
            className="bg-red-600 text-white px-3 py-2 rounded-lg font-bold text-xs hover:bg-red-700"
          >
            ออก
          </button>
        </div>
      </div>

      {/* MOBILE DROPDOWN */}
      {menuOpen && (
        <div className="lg:hidden bg-white shadow-2xl z-40 overflow-y-auto fixed top-16 left-0 right-0 border-b border-gray-200 max-h-screen">
          {menuItems.map((group, gi) => (
            <div key={gi} className="px-4 py-2">
              <p className="text-xs text-gray-400 font-bold py-2 uppercase tracking-wider">{group.group}</p>
              {group.items.map((item, ii) => (
                <NavLink
                  key={ii}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm mb-1 ${
                      isActive ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex">

        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 shadow-lg flex-col min-h-screen">
          <div className="bg-gradient-to-r from-green-700 to-green-600 p-5">
            <h1 className="text-xl font-black text-white">🌾 เจ๊นก พันธุ์ข้าว</h1>
            <p className="text-green-100 text-xs mt-1">ระบบ Admin</p>
          </div>
          <div className="bg-green-50 px-4 py-3 border-b border-gray-200">
            <p className="text-xs text-gray-500">เข้าสู่ระบบในฐานะ</p>
            <p className="font-black text-green-700">{user?.name}</p>
            <p className="text-xs text-gray-400">{user?.role}</p>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {sidebarItems.map((group, gi) => (
              <div key={gi}>
                <p className="text-xs text-gray-400 font-bold px-3 pt-4 pb-1 uppercase tracking-wider">{group.group}</p>
                {group.items.map((item, ii) => (
                  <NavLink
                    key={ii}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition text-sm ${
                        isActive ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
                      }`
                    }
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={logout}
              className="w-full bg-red-50 text-red-600 px-4 py-3 rounded-xl font-bold hover:bg-red-100 transition text-sm"
            >
              🚪 ออกจากระบบ
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto pb-28 lg:pb-8">
          <div className="p-4 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAV — 6 ปุ่ม */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl z-40">
        <div className="flex justify-between items-stretch">
          {bottomNav.map((item, i) => (
            <NavLink
              key={i}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 text-xs font-bold transition ${
                  isActive
                    ? 'text-green-700 border-t-4 border-green-700 bg-green-50'
                    : 'text-gray-500'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span className="mt-0.5">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}