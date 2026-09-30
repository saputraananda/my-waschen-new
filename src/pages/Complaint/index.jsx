import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import AddComplaint from './components/AddComplaint.jsx';
import HistoryComplaint from './components/HistoryComplaint.jsx';
import { MessageSquareWarning, Plus, History } from 'lucide-react';

const authCfg = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });

export default function ComplaintPage() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || '');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [activeTab, setActiveTab] = useState(() => (window.location.hash === '#riwayat' ? 'history' : 'add'));

  useEffect(() => {
    window.location.hash = activeTab === 'history' ? 'riwayat' : '';
  }, [activeTab]);
  const [meta, setMeta] = useState({ types: [], categories: [], topics: [] });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    document.title = 'Pengajuan Komplain | Waschen Laundry';
    if (!localStorage.getItem('token')) {
      navigate('/login', { replace: true });
      return;
    }
    const isHq = localStorage.getItem('companyId') === '1';
    setUserProfile({
      fullName: localStorage.getItem('fullName') || 'Kasir Waschen',
      role: isHq ? 'Management Alora' : (localStorage.getItem('activeRole') || 'Staff Kasir')
    });
    axios.get('/api/masters/outlets', authCfg())
      .then((res) => { if (res.data?.success) setOutlets(res.data.data || []); })
      .catch(() => {});
    axios.get('/api/complaints/meta', authCfg())
      .then((res) => { if (res.data?.success) setMeta(res.data.data); })
      .catch(() => {});
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#313030] flex flex-col font-sans">
      <HeaderNav
        activeOutletName={activeOutletName}
        setActiveOutletName={setActiveOutletName}
        activeOutletId={activeOutletId}
        setActiveOutletId={setActiveOutletId}
        outlets={outlets}
        userProfile={userProfile}
      />

      <main className="max-w-[1500px] w-full mx-auto p-4 sm:p-6 flex-grow flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#313030] tracking-tight flex items-center gap-2.5">
              <MessageSquareWarning className="h-6 w-6 text-[#5f1340]" />
              <span>Komplain Outlet</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Pengajuan masuk sebagai Request. Admin Alsa yang menyetujui menjadi Open atau menolak menjadi Archive.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#f8f8f8] border border-[#e0e0e0] p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'add' ? 'bg-[#5f1340] text-white shadow-xs' : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>Ajukan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'history' ? 'bg-[#5f1340] text-white shadow-xs' : 'text-slate-500 hover:text-[#313030]'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Riwayat Cabang</span>
            </button>
          </div>
        </div>

        {activeTab === 'add' ? (
          <AddComplaint
            meta={meta}
            activeOutletId={activeOutletId}
            activeOutletName={activeOutletName}
            onSubmitted={() => {
              setRefreshKey((n) => n + 1);
              setActiveTab('history');
            }}
          />
        ) : (
          <HistoryComplaint
            activeOutletId={activeOutletId}
            activeOutletName={activeOutletName}
            refreshKey={refreshKey}
          />
        )}
      </main>
    </div>
  );
}
