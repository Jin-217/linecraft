import React, { useState, useEffect } from 'react';
import { 
  UserProfile, 
  AdminNotification, 
  fetchAllUsers, 
  fetchAdminNotifications, 
  markNotificationAsRead 
} from '../firebase';
import { 
  Users, 
  Bell, 
  ShieldCheck, 
  X, 
  UserPlus, 
  RefreshCw, 
  Clock, 
  Mail, 
  CheckCircle,
  Sparkles,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  currentUserEmail: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  isOpen, 
  onClose, 
  isDarkMode, 
  currentUserEmail 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'notifications'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [allUsers, allNotifs] = await Promise.all([
        fetchAllUsers(),
        fetchAdminNotifications()
      ]);
      setUsers(allUsers);
      setNotifications(allNotifs);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAdminData();
    }
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;
  const googleUsersCount = users.filter(u => u.providerId?.includes('google')).length;
  const emailUsersCount = users.length - googleUsersCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] ${
          isDarkMode ? 'bg-[#0f1222] border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isDarkMode ? 'border-slate-800 bg-[#14182e]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Linecraft Admin Management Console</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Developer Mode
                </span>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Administrator: <span className="font-mono text-indigo-400">{currentUserEmail}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAdminData}
              disabled={loading}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
              title="Refresh User Data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button 
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
              }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className={`flex items-center gap-2 px-6 pt-3 border-b text-xs font-semibold ${
          isDarkMode ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles size={14} />
            <span>Metrics Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={14} />
            <span>Registered Users ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-2 relative ${
              activeTab === 'notifications'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bell size={14} />
            <span>New Registration Alerts</span>
            {unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-red-500 text-white font-extrabold rounded-full animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-4 rounded-2xl border ${
                  isDarkMode ? 'bg-[#14182e] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-[11px] font-semibold">Total Registered Users</span>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                      <Users size={16} />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-indigo-400">{users.length}</div>
                  <p className="text-[10px] text-slate-500 mt-1">Unique accounts registered in Linecraft</p>
                </div>

                <div className={`p-4 rounded-2xl border ${
                  isDarkMode ? 'bg-[#14182e] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-[11px] font-semibold">Google Auth Users</span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <UserPlus size={16} />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-400">{googleUsersCount}</div>
                  <p className="text-[10px] text-slate-500 mt-1">Authenticated via Google OAuth</p>
                </div>

                <div className={`p-4 rounded-2xl border ${
                  isDarkMode ? 'bg-[#14182e] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-[11px] font-semibold">Email/Password Users</span>
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                      <Mail size={16} />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-purple-400">{emailUsersCount}</div>
                  <p className="text-[10px] text-slate-500 mt-1">Registered via email & password</p>
                </div>
              </div>

              {/* Recent Notifications Summary */}
              <div className={`p-4 rounded-2xl border ${
                isDarkMode ? 'bg-[#14182e] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <UserPlus size={16} className="text-indigo-400" />
                  Latest Registrations
                </h3>
                {users.length === 0 ? (
                  <p className="text-slate-500 py-4 text-center">No users registered yet.</p>
                ) : (
                  <div className="space-y-2">
                    {users.slice(0, 5).map(user => (
                      <div key={user.uid} className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        isDarkMode ? 'bg-[#0f1222] border-slate-800/80' : 'bg-white border-slate-200'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                            {user.displayName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-xs flex items-center gap-2">
                              <span>{user.displayName}</span>
                              {user.role === 'admin' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 font-mono">ADMIN</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
                          </div>
                        </div>

                        <div className="text-right text-[10px] text-slate-400 font-mono">
                          <div>Registered: {new Date(user.createdAt).toLocaleDateString()}</div>
                          <div className="text-slate-500">Last login: {new Date(user.lastLoginAt).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">User Directory ({users.length})</span>
              </div>

              <div className="border rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                      isDarkMode ? 'bg-[#14182e] border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      <th className="p-3">User</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Registered Date</th>
                      <th className="p-3">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {users.map((u) => (
                      <tr key={u.uid} className={`hover:bg-indigo-500/5 transition-colors ${
                        isDarkMode ? 'border-slate-800/50' : 'border-slate-200'
                      }`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                              {u.displayName ? u.displayName.charAt(0) : 'U'}
                            </div>
                            <div>
                              <div className="font-semibold">{u.displayName || 'Anonymous User'}</div>
                              {u.role === 'admin' && (
                                <span className="text-[9px] text-amber-400 font-bold font-mono">ADMIN</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-indigo-300 text-[11px]">{u.email}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            u.providerId?.includes('google')
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          }`}>
                            {u.providerId?.includes('google') ? 'Google OAuth' : 'Email/Password'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-400">
                          {new Date(u.createdAt).toLocaleDateString()} {new Date(u.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-400">
                          {new Date(u.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">New User Registration Notifications</span>
                <span className="text-[11px] text-slate-500">Only sent when a user signs up for the first time</span>
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Bell size={28} className="mx-auto mb-2 opacity-50 text-indigo-400" />
                  <p>No new registration notifications yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                        !notif.read 
                          ? 'bg-indigo-600/10 border-indigo-500/40' 
                          : isDarkMode ? 'bg-[#14182e] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl mt-0.5 ${
                          !notif.read ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          <UserPlus size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-2">
                            <span>New User Registration: {notif.userDisplayName}</span>
                            {!notif.read && (
                              <span className="px-1.5 py-0.2 text-[9px] bg-indigo-500 text-white font-extrabold rounded-full">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="text-indigo-300 font-mono text-[11px] mt-0.5">{notif.userEmail}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                            <Clock size={11} />
                            <span>Registered on {new Date(notif.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {!notif.read && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-xs font-semibold border border-indigo-500/30 transition-all"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex justify-end ${
          isDarkMode ? 'border-slate-800 bg-[#14182e]' : 'border-slate-200 bg-slate-50'
        }`}>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all active:scale-95"
          >
            Close Console
          </button>
        </div>
      </motion.div>
    </div>
  );
};
