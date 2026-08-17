import React, { useState, useEffect } from 'react';
import { User, Search, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, getValidUserId } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { ContactsSkeleton } from '../components/ui/Skeleton';

interface Contact {
  id: string;
  organization_id: string;
  name: string;
  position?: string;
  phone?: string;
  email?: string;
  created_at?: string;
}

export default function Contacts() {
  const { theme } = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase.from('organizations').select('*');
      if (!error && data) {
        setOrganizations(data);
      } else {
        setOrganizations([]);
      }
    } catch {
      setOrganizations([]);
    }
  };

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setContacts(data);
      } else {
        setContacts([]);
      }
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
    fetchContacts();
  }, []);

  const contactsWithOrgs = contacts.map(c => ({
    ...c,
    organizationName: organizations.find(o => o.id === c.organization_id)?.name || 'Unknown'
  }));

  const filteredContacts = contactsWithOrgs.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.organizationName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <ContactsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className={cn("text-3xl font-bold tracking-tight", theme === 'dark' ? "text-gray-100" : "text-slate-900")}>
          Contacts
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#1848A0] hover:bg-[#003880] text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-md"
        >
          <Plus className="w-5 h-5" />
          Add Contact
        </button>
      </div>

      <div className={cn(
        "rounded-2xl shadow-sm border overflow-hidden transition-all",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className={cn("p-4 border-b", theme === 'dark' ? "border-[#2A2A35]" : "border-slate-100")}>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all text-sm focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
                theme === 'dark' 
                  ? "bg-[#0B0B0E] border-[#2A2A35] text-gray-100 placeholder-gray-500" 
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              )}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn(
                "text-xs uppercase tracking-widest font-bold",
                theme === 'dark' ? "bg-[#1A1A22] text-gray-400" : "bg-slate-100 text-slate-600"
              )}>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">Position</th>
                <th className="px-6 py-4">Contact Details</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", theme === 'dark' ? "divide-[#2A2A35]" : "divide-slate-100")}>
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className={cn(
                  "transition-colors",
                  theme === 'dark' ? "hover:bg-[#1A1A22]" : "hover:bg-slate-50"
                )}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F88020]/10 border border-[#F88020]/20 flex items-center justify-center text-[#F88020] shrink-0 font-bold">
                        {contact.name.charAt(0)}
                      </div>
                      <div className={cn("font-bold text-sm", theme === 'dark' ? "text-gray-100" : "text-slate-900")}>
                        {contact.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-gray-400">{contact.organizationName}</td>
                  <td className="px-6 py-4 text-xs font-medium text-gray-400">{contact.position || '-'}</td>
                  <td className="px-6 py-4 text-xs font-medium text-gray-400">
                    <div>{contact.phone || '-'}</div>
                    <div className="text-[11px] text-[#1848A0]">{contact.email || '-'}</div>
                  </td>
                </tr>
              ))}
              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm">
                    No contacts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <AddContactModal organizations={organizations} onClose={() => {
          setIsModalOpen(false);
          fetchContacts();
        }} />
      )}
    </div>
  );
}

function AddContactModal({ organizations, onClose }: { organizations: any[], onClose: () => void }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data: any = {
      organization_id: formData.get('organizationId') as string,
      name: formData.get('name') as string,
      position: formData.get('position') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      created_by: getValidUserId(user),
    };

    Object.keys(data).forEach(key => {
      if (data[key] === '') {
        delete data[key];
      }
    });

    try {
      const { error } = await supabase.from('contacts').insert([data]);
      if (error) throw error;
      onClose();
    } catch (error: any) {
      console.error(error);
      alert('Failed to add contact: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = cn(
    "w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
    theme === 'dark' 
      ? "bg-[#0B0B0E] border-[#2A2A35] text-white placeholder-gray-500" 
      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
  );

  const labelClass = cn(
    "block text-xs font-semibold uppercase tracking-wider mb-1.5",
    theme === 'dark' ? "text-gray-400" : "text-slate-600"
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={cn(
        "border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className={cn("p-6 border-b", theme === 'dark' ? "border-[#2A2A35]" : "border-slate-100")}>
          <h2 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>
            Add New Contact
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 flex flex-col gap-4">
          <div>
            <label className={labelClass}>Organization *</label>
            <select required name="organizationId" className={inputClass}>
              <option value="">Select an organization...</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Contact Name *</label>
            <input required name="name" type="text" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Position / Job Title</label>
            <input name="position" type="text" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input name="phone" type="tel" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input name="email" type="email" className={inputClass} />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-400 font-semibold hover:text-gray-200 rounded-xl transition-colors text-sm">
              Cancel
            </button>
            <button disabled={loading} type="submit" className="px-5 py-2.5 bg-[#1848A0] text-white font-bold hover:bg-[#003880] rounded-xl transition-colors disabled:opacity-50 text-sm shadow-md">
              {loading ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

