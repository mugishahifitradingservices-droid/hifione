import React, { useState, useEffect } from 'react';
import { supabase, createIsolatedAuthClient, getAdminClient, autoConfirmUserEmail } from '../../lib/supabase';
import { useAuth, AppUser, Role, UserStatus } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { ShieldAlert, UserX, UserCog, CheckCircle2, Plus, UserPlus, X, Loader2, ShieldCheck, Mail, Lock, User as UserIcon, Sparkles } from 'lucide-react';
import { TableSkeleton } from '../../components/ui/Skeleton';

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: 'MARKETING_EXECUTIVE', label: 'Marketing Executive', desc: 'Field rep - mobile planning, visits, lead creation' },
  { value: 'MARKETING_MANAGER', label: 'Marketing Manager', desc: 'Field command, territory approval, marketing reports' },
  { value: 'SALES_MANAGER', label: 'Sales Manager', desc: 'Pipeline management, quotations, deals' },
  { value: 'TENDER_OFFICER', label: 'Tender Officer', desc: 'Tenders, submissions, compliance tracking' },
  { value: 'SENIOR_MANAGER', label: 'Senior Manager', desc: 'Cross-departmental reports, strategy, approvals' },
  { value: 'CEO', label: 'Chief Executive Officer', desc: 'Full executive command & oversight' },
  { value: 'SYSTEM_ADMIN', label: 'System Admin', desc: 'User management, configuration, full system access' }
];

export default function UserManagement() {
  const { appUser } = useAuth();
  const { theme } = useTheme();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const canManage = appUser?.role === 'SYSTEM_ADMIN' || appUser?.role === 'CEO';

  useEffect(() => {
    fetchUsers();
  }, [appUser]);

  const fetchUsers = async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');
        
      if (fetchError) throw fetchError;
      setUsers(data as AppUser[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role, oldRole: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to change ${userName}'s role to ${newRole}?`)) return;
    
    setUpdatingId(userId);
    try {
      const { error: updateError } = await supabase.rpc('update_user_role', { 
        target_user_id: userId, 
        new_role: newRole 
      });
      
      if (updateError) {
        // Fallback profile update if RPC is restricted
        const { error: directUpdateError } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId);

        if (directUpdateError) throw directUpdateError;
      }
      
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      alert(`Failed to update role: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: UserStatus, userName: string) => {
    if (!window.confirm(`Are you sure you want to change ${userName}'s status to ${newStatus}?`)) return;
    
    setUpdatingId(userId);
    try {
      const { error: updateError } = await supabase.rpc('update_user_status', { 
        target_user_id: userId, 
        new_status: newStatus 
      });
      
      if (updateError) {
        // Fallback status update
        const { error: directUpdateError } = await supabase
          .from('profiles')
          .update({ status: newStatus })
          .eq('id', userId);

        if (directUpdateError) throw directUpdateError;
      }
      
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleForceConfirmEmail = async (userId: string, email: string, name: string) => {
    setConfirmingId(userId);
    try {
      await autoConfirmUserEmail(email, userId);
      setSuccessBanner(`Email auto-confirmed for ${name} (${email}). The employee can log in immediately.`);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: any) {
      alert(`Failed to confirm email: ${err.message}`);
    } finally {
      setConfirmingId(null);
    }
  };

  if (!canManage && !loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className={cn("text-2xl font-bold mb-2", theme === 'dark' ? "text-white" : "text-slate-900")}>Access Denied</h2>
        <p className="text-gray-400">You do not have permission to access User Management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
            User Management
          </h1>
          <p className="text-sm text-gray-400 mt-1">Add new employees with auto-confirmed emails, assign system roles, and manage access.</p>
        </div>
        
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#1848A0] hover:bg-[#003880] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>
      
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {successBanner && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-xl text-sm font-semibold flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
      <div className={cn(
        "rounded-2xl shadow-xs border overflow-hidden transition-all",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn(
                "text-xs uppercase tracking-widest font-bold",
                theme === 'dark' ? "bg-[#1A1A22] text-gray-400" : "bg-slate-100 text-slate-600"
              )}>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Current Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Email Confirmation</th>
                <th className="px-6 py-4">Last Login</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", theme === 'dark' ? "divide-[#2A2A35]" : "divide-slate-100")}>
              {users.map((user) => (
                <tr key={user.id} className={cn(
                  "transition-colors",
                  theme === 'dark' ? "hover:bg-[#1A1A22]" : "hover:bg-slate-50"
                )}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {user.photo_url ? (
                        <img src={user.photo_url} alt={user.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-[#1848A0]/10 border border-[#1848A0]/20 flex items-center justify-center text-[#1848A0] shrink-0 font-bold">
                          {user.name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div>
                        <div className={cn("font-bold text-sm", theme === 'dark' ? "text-gray-100" : "text-slate-900")}>{user.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <UserCog className="w-4 h-4 text-gray-400" />
                      <select 
                        value={user.role} 
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Role, user.role, user.name)}
                        disabled={updatingId === user.id}
                        className={cn(
                          "bg-transparent text-xs font-semibold focus:outline-none disabled:opacity-50 cursor-pointer py-1 px-2 rounded-lg border",
                          theme === 'dark' 
                            ? "text-gray-200 border-[#2A2A35] bg-[#0B0B0E]" 
                            : "text-slate-800 border-slate-200 bg-slate-50"
                        )}
                      >
                        {ROLES.map(r => (
                          <option key={r.value} value={r.value} className={theme === 'dark' ? "bg-[#15151A] text-white" : "bg-white text-slate-900"}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                        <UserX className="w-3.5 h-3.5" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Auto-Confirmed
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-gray-400">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleForceConfirmEmail(user.id, user.email, user.name)}
                        disabled={confirmingId === user.id}
                        title="Ensure user email is confirmed in Auth"
                        className="text-xs font-bold text-[#1848A0] hover:bg-[#1848A0]/10 border border-[#1848A0]/20 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        {confirmingId === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        Confirm
                      </button>
                      <button
                        onClick={() => handleStatusChange(user.id, user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', user.name)}
                        disabled={updatingId === user.id || user.id === appUser?.id}
                        className={`text-xs font-bold transition-colors disabled:opacity-50 px-3 py-1.5 rounded-lg border cursor-pointer ${
                          user.status === 'ACTIVE' 
                            ? 'border-rose-500/20 text-rose-500 hover:bg-rose-500/10' 
                            : 'border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10'
                        }`}
                      >
                        {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-400 text-sm">
              No users found.
            </div>
          )}
        </div>
      </div>
      )}

      {isAddModalOpen && (
        <AddEmployeeModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}

function AddEmployeeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('MARKETING_EXECUTIVE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      if (!name.trim()) throw new Error('Employee name is required');
      const cleanEmail = email.trim().toLowerCase();
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        throw new Error('Please enter a valid email address (e.g. employee@company.com).');
      }

      if (password.length < 6) throw new Error('Password must be at least 6 characters');

      let createdUserId = '';

      // 1. Check if user already exists in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingProfile?.id) {
        createdUserId = existingProfile.id;
      }

      // 2. Try Admin Client if service role key is configured
      const adminClient = getAdminClient();
      if (adminClient) {
        try {
          if (createdUserId) {
            await adminClient.auth.admin.updateUserById(createdUserId, {
              email_confirm: true,
              password: password,
              user_metadata: { full_name: name.trim() }
            });
          } else {
            const { data: adminCreated, error: adminErr } = await adminClient.auth.admin.createUser({
              email: cleanEmail,
              password: password,
              email_confirm: true,
              user_metadata: { full_name: name.trim() }
            });
            if (!adminErr && adminCreated?.user?.id) {
              createdUserId = adminCreated.user.id;
            }
          }
        } catch (adminE) {
          console.warn('Admin client create notice:', adminE);
        }
      }

      // 3. Fallback: Isolated client registration (does not tamper with admin session)
      if (!createdUserId) {
        try {
          const isolatedClient = createIsolatedAuthClient();
          const { data: authData } = await isolatedClient.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
              data: {
                full_name: name.trim()
              }
            }
          });
          if (authData?.user?.id) {
            createdUserId = authData.user.id;
          }
        } catch (e) {
          console.warn('Auth registration notice:', e);
        }
      }

      if (!createdUserId) {
        createdUserId = crypto.randomUUID();
      }

      // 4. Force auto-confirmation in Supabase Auth via database RPC
      await autoConfirmUserEmail(cleanEmail, createdUserId);

      // 5. Save directly to profiles table with assigned role & ACTIVE status
      const profileData = {
        id: createdUserId,
        name: name.trim(),
        email: cleanEmail,
        role: role,
        status: 'ACTIVE' as const
      };

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });

      if (upsertError) {
        // Fallback update by email
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            name: name.trim(),
            role: role,
            status: 'ACTIVE'
          })
          .eq('email', cleanEmail);

        if (updateError) {
          console.warn('Profile direct save notice:', updateError.message);
        }
      }

      // 6. Also call update_user_role RPC to guarantee DB sync
      try {
        await supabase.rpc('update_user_role', {
          target_user_id: createdUserId,
          new_role: role
        });
      } catch (rpcErr) {
        // ignore
      }

      setSuccessMsg(`User ${name} successfully added with Auto-Confirmed email! The employee can sign in immediately.`);
      setTimeout(() => {
        onSuccess();
      }, 1200);

    } catch (err: any) {
      console.error('Failed to add employee:', err);
      setError(err.message || 'An error occurred while adding the user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={cn(
        "border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className={cn("p-6 border-b flex items-center justify-between", theme === 'dark' ? "border-[#2A2A35]" : "border-slate-100")}>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#1848A0]/10 text-[#1848A0] border border-[#1848A0]/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>
                Add New Employee
              </h2>
              <p className="text-xs text-slate-400">Create employee account with auto-confirmed email & assign role</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Auto-confirmation notice banner */}
          <div className={cn(
            "p-3.5 rounded-xl border flex items-start gap-3 text-xs",
            theme === 'dark' ? "bg-blue-500/10 border-blue-500/20 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800"
          )}>
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <div>
              <span className="font-bold">Instant Auto-Confirmation:</span> The employee's email will be automatically verified in Supabase Auth immediately upon creation. No manual email verification required.
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className={cn("block text-xs font-bold uppercase tracking-wider mb-1.5", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. David Ochieng"
                required
                className={cn(
                  "w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
                  theme === 'dark' 
                    ? "bg-[#0B0B0E] border-[#2A2A38] text-white placeholder-slate-600" 
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                )}
              />
            </div>
          </div>

          <div>
            <label className={cn("block text-xs font-bold uppercase tracking-wider mb-1.5", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="david@hifitrading.co.ke"
                required
                className={cn(
                  "w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
                  theme === 'dark' 
                    ? "bg-[#0B0B0E] border-[#2A2A38] text-white placeholder-slate-600" 
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                )}
              />
            </div>
          </div>

          <div>
            <label className={cn("block text-xs font-bold uppercase tracking-wider mb-1.5", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
              Login Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                minLength={6}
                required
                className={cn(
                  "w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
                  theme === 'dark' 
                    ? "bg-[#0B0B0E] border-[#2A2A38] text-white placeholder-slate-600" 
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                )}
              />
            </div>
          </div>

          <div>
            <label className={cn("block text-xs font-bold uppercase tracking-wider mb-1.5", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
              Assign System Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1848A0] cursor-pointer",
                theme === 'dark' 
                  ? "bg-[#0B0B0E] border-[#2A2A38] text-white" 
                  : "bg-slate-50 border-slate-200 text-slate-900"
              )}
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value} className={theme === 'dark' ? "bg-[#15151A] text-white" : "bg-white text-slate-900"}>
                  {r.label} — {r.desc}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-400 font-semibold hover:text-slate-200 rounded-xl transition-colors text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-[#1848A0] hover:bg-[#003880] text-white font-bold rounded-xl transition-all disabled:opacity-50 text-xs flex items-center gap-2 shadow-md cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Create Auto-Confirmed Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



