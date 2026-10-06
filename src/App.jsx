import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddjqfqalqyfqsodiheia.supabase.co';
const supabaseKey = 'sb_publishable_GV378hITIHek5Vp9otZFYA_S70Ecwsg';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('rank_app_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isRegistering, setIsRegistering] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMsg, setAuthMsg] = useState({ text: '', isError: false });

  const [members, setMembers] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  const [editAnnouncement, setEditAnnouncement] = useState('');
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRank, setFilterRank] = useState('ALL');
  const [newMemberName, setNewMemberName] = useState('');
  
  const [showRankModal, setShowRankModal] = useState(false);
  const [newRankTitle, setNewRankTitle] = useState('');
  const [newRankLvl, setNewRankLvl] = useState('');

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
      if (currentUser.role === 'host') fetchPendingUsers();
    }
  }, [currentUser]);

  async function fetchAllData() {
    setLoading(true);
    const { data: rankData } = await supabase.from('ranks').select('*').order('level', { ascending: true });
    if (rankData) setRanks(rankData);

    const { data: memberData } = await supabase
      .from('project_members')
      .select('id, name, rank_id, ranks(id, name, level)')
      .order('created_at', { ascending: false });
    if (memberData) setMembers(memberData);

    const { data: annData } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1);
    if (annData && annData.length > 0) {
      setAnnouncement(annData[0].content);
      setEditAnnouncement(annData[0].content);
    }
    setLoading(false);
  }

  async function fetchPendingUsers() {
    const { data } = await supabase.from('app_users').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (data) setPendingUsers(data);
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthMsg({ text: '', isError: false });

    if (isRegistering) {
      const { data, error } = await supabase.rpc('register_user', {
        p_username: authUsername.trim(),
        p_password: authPassword,
      });

      if (error || !data?.success) {
        setAuthMsg({ text: data?.message || 'Registrierung fehlgeschlagen.', isError: true });
      } else {
        setAuthMsg({ text: data.message, isError: false });
        setIsRegistering(false);
        setAuthPassword('');
      }
    } else {
      const { data, error } = await supabase.rpc('login_user', {
        p_username: authUsername.trim(),
        p_password: authPassword,
      });

      if (error || !data?.success) {
        setAuthMsg({ text: data?.message || 'Anmeldedaten ungültig.', isError: true });
      } else {
        setCurrentUser(data.user);
        localStorage.setItem('rank_app_user', JSON.stringify(data.user));
      }
    }
  }

  function handleLogout() {
    localStorage.removeItem('rank_app_user');
    setCurrentUser(null);
  }

  async function approveUser(userId, username) {
    await supabase.from('app_users').update({ status: 'approved' }).eq('id', userId);
    if (ranks.length > 0) {
      await supabase.from('project_members').insert([{ name: username, rank_id: ranks[0].id }]);
    }
    fetchPendingUsers();
    fetchAllData();
  }

  async function rejectUser(userId) {
    await supabase.from('app_users').delete().eq('id', userId);
    fetchPendingUsers();
  }

  async function saveAnnouncement() {
    if (!editAnnouncement.trim()) return;
    await supabase.from('announcements').insert([{ content: editAnnouncement.trim() }]);
    setAnnouncement(editAnnouncement.trim());
    setIsEditingNotice(false);
  }

  async function handleCreateRank(e) {
    e.preventDefault();
    if (!newRankTitle || !newRankLvl) return;
    const { data } = await supabase.rpc('add_rank', {
      rank_name: newRankTitle.trim(),
      rank_level: parseInt(newRankLvl, 10),
    });

    if (data?.success) {
      setNewRankTitle('');
      setNewRankLvl('');
      setShowRankModal(false);
      fetchAllData();
    } else {
      alert(data?.message || 'Fehler beim Erstellen des Rangs.');
    }
  }

  async function addMember(e) {
    e.preventDefault();
    if (!newMemberName.trim() || ranks.length === 0) return;
    const { error } = await supabase.from('project_members').insert([{ name: newMemberName.trim(), rank_id: ranks[0].id }]);
    if (!error) {
      setNewMemberName('');
      fetchAllData();
    }
  }

  async function promoteMember(id) {
    const { error } = await supabase.rpc('promote_member', { member_id: id });
    if (!error) fetchAllData();
  }

  async function demoteMember(id) {
    const { error } = await supabase.rpc('demote_member', { member_id: id });
    if (!error) fetchAllData();
  }

  async function deleteMember(id) {
    const { error } = await supabase.from('project_members').delete().eq('id', id);
    if (!error) fetchAllData();
  }

const filteredMembers = members.filter((m) => {
    const matchesSearch = (m.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const currentMemberRankId = m.rank_id || m.ranks?.id;
    const matchesRank = filterRank === 'ALL' || String(currentMemberRankId) === String(filterRank);
    return matchesSearch && matchesRank;
  });

  async function demoteMember(id) {
  const { error } = await supabase.rpc('demote_member', { member_id: id });
  if (error) {
    console.error('Fehler beim Zurückstufen:', error);
    alert('Fehler: ' + error.message);
  } else {
    fetchAllData();
  }
}

  // --- ANMELDE-BILDSCHIRM (Klassisch & zentriert) ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] text-slate-800 flex items-center justify-center p-4 antialiased">
        <div className="bg-white border border-slate-300 w-full max-w-sm p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Mitgliederverwaltung</h1>
            <p className="text-xs text-slate-500 mt-1">
              {isRegistering ? 'Neues Benutzerkonto anfordern' : 'Mit Benutzername und Passwort anmelden'}
            </p>
          </div>

          {authMsg.text && (
            <div className={`p-3 text-xs mb-4 border ${
              authMsg.isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              {authMsg.text}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Benutzername</label>
              <input
                type="text"
                required
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Passwort</label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-slate-800"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded text-xs tracking-wide transition-colors"
            >
              {isRegistering ? 'Konto anfordern' : 'Anmelden'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            {isRegistering ? 'Bereits registriert?' : 'Noch kein Konto?'}{' '}
            <button
              onClick={() => { setIsRegistering(!isRegistering); setAuthMsg({ text: '', isError: false }); }}
              className="text-slate-900 font-medium hover:underline"
            >
              {isRegistering ? 'Zur Anmeldung' : 'Registrieren'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- HAUPTANSICHT (Standard Business Dashboard) ---
  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 antialiased flex flex-col">
      {/* Obere Navigationsleiste */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm tracking-tight text-slate-900">Workspace Management</span>
          <span className="text-slate-300">/</span>
          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
            {currentUser.username} ({currentUser.role === 'host' ? 'Host' : 'Mitglied'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.role === 'host' && (
            <button
              onClick={() => setShowRankModal(true)}
              className="text-xs border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded transition"
            >
              Ränge verwalten
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1.5 transition"
          >
            Abmelden
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">

        {/* Ankündigung (Subtiler Hinweiskasten) */}
        {announcement && (
          <div className="bg-white border border-slate-200 border-l-4 border-l-slate-900 p-4 flex items-start justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Mitteilung</div>
              <div className="text-sm text-slate-700 leading-relaxed">{announcement}</div>
            </div>
            {currentUser.role === 'host' && (
              <button
                onClick={() => setIsEditingNotice(!isEditingNotice)}
                className="text-xs text-slate-500 hover:text-slate-900 underline ml-4 shrink-0"
              >
                {isEditingNotice ? 'Schließen' : 'Bearbeiten'}
              </button>
            )}
          </div>
        )}

        {/* Host Edit Announcement Box */}
        {currentUser.role === 'host' && isEditingNotice && (
          <div className="bg-white border border-slate-300 p-4 space-y-2">
            <label className="text-xs font-medium text-slate-700">Mitteilung bearbeiten</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editAnnouncement}
                onChange={(e) => setEditAnnouncement(e.target.value)}
                className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-slate-800"
              />
              <button
                onClick={saveAnnouncement}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 py-1.5 rounded font-medium transition"
              >
                Speichern
              </button>
            </div>
          </div>
        )}

        {/* Host: Offene Beitrittsanfragen */}
        {currentUser.role === 'host' && pendingUsers.length > 0 && (
          <div className="bg-white border border-amber-300 p-4">
            <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-3">
              Ausstehende Registrierungen ({pendingUsers.length})
            </div>
            <div className="divide-y divide-slate-100">
              {pendingUsers.map((u) => (
                <div key={u.id} className="py-2.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{u.username}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveUser(u.id, u.username)}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 py-1 rounded transition"
                    >
                      Bestätigen
                    </button>
                    <button
                      onClick={() => rejectUser(u.id)}
                      className="border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs px-2.5 py-1 rounded transition"
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Werkzeugleiste: Neues Mitglied + Suche + Filter */}
        <div className="bg-white border border-slate-200 p-4 space-y-3">
          <form onSubmit={addMember} className="flex gap-2">
            <input
              type="text"
              placeholder="Name des Mitglieds..."
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-slate-800"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 py-1.5 rounded font-medium transition"
            >
              Hinzufügen
            </button>
          </form>

          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              placeholder="Nach Namen filtern..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-800"
            />
            <select
              value={filterRank}
              onChange={(e) => setFilterRank(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:border-slate-800"
            >
              <option value="ALL">Alle Ränge</option>
              {ranks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (Level {r.level})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabellarische Mitgliederansicht */}
        <div className="bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Mitgliederverzeichnis ({filteredMembers.length})
            </span>
            <span className="text-xs text-slate-400">Total: {members.length}</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Lade Verzeichnis...</div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Keine Datensätze vorhanden.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase bg-slate-50/30">
                  <th className="py-2.5 px-4 font-medium">Name</th>
                  <th className="py-2.5 px-4 font-medium">Aktueller Rang</th>
                  <th className="py-2.5 px-4 font-medium text-center">Stufe</th>
                  <th className="py-2.5 px-4 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredMembers.map((m) => {
                  const isMax = m.ranks?.level === ranks[ranks.length - 1]?.level;
                  const isMin = m.ranks?.level === ranks[0]?.level;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">{m.name}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block bg-slate-100 text-slate-800 text-xs px-2 py-0.5 rounded border border-slate-200 font-medium">
                          {m.ranks?.name || 'Unbekannt'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-slate-500 font-mono">
                        {m.ranks?.level || 1}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => promoteMember(m.id)}
                            disabled={isMax}
                            className={`text-xs px-2.5 py-1 rounded border transition ${
                              isMax
                                ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                            }`}
                          >
                            + Befördern
                          </button>
                          <button
                            onClick={() => demoteMember(m.id)}
                            disabled={isMin}
                            className={`text-xs px-2.5 py-1 rounded border transition ${
                              isMin
                                ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                            }`}
                          >
                            - Zurückstufen
                          </button>
                          <button
                            onClick={() => deleteMember(m.id)}
                            className="text-xs text-slate-400 hover:text-red-600 px-1.5 py-1 ml-1 transition"
                            title="Entfernen"
                          >
                            Entfernen
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </main>

      {/* Modal: Ränge verwalten */}
      {showRankModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-300 w-full max-w-sm p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-semibold text-sm text-slate-900">Ränge konfigurieren</h3>
              <button onClick={() => setShowRankModal(false)} className="text-slate-400 hover:text-slate-700 text-sm">
                ✕
              </button>
            </div>

            <div className="mb-4 max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200">
              {ranks.map((r) => (
                <div key={r.id} className="py-2 px-3 flex justify-between text-xs bg-slate-50/50">
                  <span className="font-medium text-slate-700">{r.name}</span>
                  <span className="text-slate-500 font-mono">Level {r.level}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateRank} className="space-y-3 pt-2">
              <input
                type="text"
                placeholder="Rangbezeichnung..."
                required
                value={newRankTitle}
                onChange={(e) => setNewRankTitle(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-800"
              />
              <input
                type="number"
                placeholder="Stufe / Zahl (z. B. 4)..."
                required
                value={newRankLvl}
                onChange={(e) => setNewRankLvl(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-800"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRankModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-xs text-slate-600 rounded hover:bg-slate-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800"
                >
                  Rang anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}