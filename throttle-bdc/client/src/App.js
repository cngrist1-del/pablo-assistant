import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

const styles = {
  app: { display: 'flex', height: '100vh', background: '#0a0a0a' },
  sidebar: { width: '260px', background: '#111', borderRight: '1px solid #222', padding: '20px', display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '24px', fontWeight: 'bold', color: '#e53935', marginBottom: '30px', letterSpacing: '2px' },
  navItem: { padding: '12px 16px', color: '#888', cursor: 'pointer', borderRadius: '8px', marginBottom: '4px', transition: 'all 0.2s' },
  navItemActive: { background: '#1a1a1a', color: '#fff' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { height: '60px', background: '#111', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' },
  headerTitle: { fontSize: '18px', fontWeight: '600' },
  content: { flex: 1, display: 'flex', overflow: 'hidden' },
  leadList: { width: '350px', background: '#0f0f0f', borderRight: '1px solid #222', overflowY: 'auto' },
  leadItem: { padding: '16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', transition: 'background 0.2s' },
  leadItemActive: { background: '#1a1a1a', borderLeft: '3px solid #e53935' },
  leadName: { fontWeight: '600', marginBottom: '4px' },
  leadMeta: { fontSize: '12px', color: '#666' },
  chatPanel: { flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0a0a' },
  chatHeader: { padding: '16px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chatMessages: { flex: 1, padding: '24px', overflowY: 'auto' },
  messageBubble: { maxWidth: '70%', padding: '12px 16px', borderRadius: '12px', marginBottom: '12px', fontSize: '14px' },
  messageInbound: { background: '#1a1a1a', alignSelf: 'flex-start', borderBottomLeftRadius: '4px' },
  messageOutbound: { background: '#e53935', alignSelf: 'flex-end', borderBottomRightRadius: '4px', color: '#fff' },
  chatInput: { padding: '16px 24px', borderTop: '1px solid #222', display: 'flex', gap: '12px' },
  input: { flex: 1, padding: '12px 16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '14px' },
  button: { padding: '12px 24px', background: '#e53935', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', marginRight: '6px', background: '#e53935', color: '#fff' },
  loginScreen: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a' },
  loginBox: { width: '400px', padding: '40px', background: '#111', borderRadius: '12px', border: '1px solid #222' },
  loginInput: { width: '100%', padding: '12px', marginBottom: '16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '14px' },
  statCard: { flex: 1, background: '#111', borderRadius: '12px', padding: '20px', margin: '0 8px', border: '1px solid #222' },
  statNumber: { fontSize: '32px', fontWeight: 'bold', color: '#e53935' },
  statLabel: { fontSize: '12px', color: '#666', marginTop: '4px' },
  pipelineStage: { padding: '8px 16px', borderRadius: '8px', margin: '4px 0', fontSize: '12px', fontWeight: '600', background: '#1a1a1a', color: '#888' }
};

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('leads');
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [stats, setStats] = useState({});

  useEffect(() => {
    if (token) { loadLeads(); loadStats(); }
  }, [token]);

  const loadLeads = async () => {
    try {
      const res = await axios.get(`${API_URL}/leads`, { headers: { Authorization: `Bearer ${token}` } });
      setLeads(res.data);
    } catch (err) { console.error(err); }
  };

  const loadStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } });
      setStats(res.data);
    } catch (err) { console.error(err); }
  };

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('token', res.data.token);
    } catch (err) { alert('Login failed'); }
  };

  const logout = () => { setToken(null); setUser(null); localStorage.removeItem('token'); };

  const selectLead = async (lead) => {
    setSelectedLead(lead);
    try {
      const res = await axios.get(`${API_URL}/leads/${lead.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(res.data.messages || []);
    } catch (err) { console.error(err); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedLead) return;
    try {
      await axios.post(`${API_URL}/messages`, { leadId: selectedLead.id, type: 'sms', content: newMessage, direction: 'outbound' }, { headers: { Authorization: `Bearer ${token}` } });
      setMessages([...messages, { id: Date.now(), content: newMessage, direction: 'outbound', timestamp: new Date() }]);
      setNewMessage('');
    } catch (err) { console.error(err); }
  };

  if (!token) return <LoginScreen onLogin={login} />;

  return (
    <div style={styles.app}>
      <div style={styles.sidebar}>
        <div style={styles.logo}>THROTTLE<span style={{color:'#fff'}}>BDC</span></div>
        <div style={{...styles.navItem, ...styles.navItemActive}} onClick={() => setView('leads')}>📋 Leads</div>
        <div style={styles.navItem} onClick={() => setView('pipeline')}>📊 Pipeline</div>
        <div style={styles.navItem} onClick={() => setView('appointments')}>📅 Appointments</div>
        <div style={styles.navItem} onClick={() => setView('templates')}>📝 Templates</div>
        <div style={styles.navItem} onClick={() => setView('dashboard')}>📈 Dashboard</div>
        <div style={{marginTop:'auto', color:'#666', fontSize:'12px'}}>Logged in as {user?.name || 'Admin'}</div>
        <div style={styles.navItem} onClick={logout}>🚪 Logout</div>
      </div>
      <div style={styles.main}>
        <div style={styles.header}>
          <div style={styles.headerTitle}>{view === 'leads' ? 'Lead Inbox' : view.charAt(0).toUpperCase() + view.slice(1)}</div>
          <div style={{color:'#666', fontSize:'14px'}}>{new Date().toLocaleDateString()}</div>
        </div>
        <div style={styles.content}>
          {view === 'leads' && <LeadList leads={leads} selectedLead={selectedLead} onSelectLead={selectLead} />}
          {view === 'dashboard' && <Dashboard stats={stats} />}
          {(view === 'leads' && selectedLead) && (
            <div style={styles.chatPanel}>
              <div style={styles.chatHeader}>
                <div>
                  <div style={{fontWeight:'bold', fontSize:'18px'}}>{selectedLead.name}</div>
                  <div style={{fontSize:'12px', color:'#666'}}>{selectedLead.phone} • {selectedLead.source}</div>
                </div>
                <div>
                  <span style={{...styles.badge, background: '#e53935'}}>{selectedLead.bikeOfInterest}</span>
                </div>
              </div>
              <div style={styles.chatMessages}>
                {messages.length === 0 && <div style={{color:'#444', textAlign:'center', marginTop:'40px'}}>No messages yet</div>}
                {messages.map(msg => (
                  <div key={msg.id} style={{...styles.messageBubble, ...(msg.direction === 'inbound' ? styles.messageInbound : styles.messageOutbound)}}>
                    {msg.content}
                  </div>
                ))}
              </div>
              <div style={styles.chatInput}>
                <input style={styles.input} placeholder="Type a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} />
                <button style={styles.button} onClick={sendMessage}>Send</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('admin@throttlebdc.com');
  const [password, setPassword] = useState('admin123');

  return (
    <div style={styles.loginScreen}>
      <div style={styles.loginBox}>
        <div style={{fontSize:'28px', fontWeight:'bold', color:'#e53935', marginBottom:'8px'}}>THROTTLE<span style={{color:'#fff'}}>BDC</span></div>
        <div style={{color:'#666', marginBottom:'24px'}}>Motorcycle Dealership CRM</div>
        <input style={styles.loginInput} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={styles.loginInput} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button style={{...styles.button, width:'100%'}} onClick={() => onLogin(email, password)}>Login</button>
      </div>
    </div>
  );
}

function LeadList({ leads, selectedLead, onSelectLead }) {
  return (
    <div style={styles.leadList}>
      <div style={{padding:'16px', borderBottom:'1px solid #222'}}>
        <input style={{...styles.input, width:'100%'}} placeholder="Search leads..." />
      </div>
      {leads.map(lead => (
        <div key={lead.id} style={{...styles.leadItem, ...(selectedLead?.id === lead.id ? styles.leadItemActive : {})}} onClick={() => onSelectLead(lead)}>
          <div style={styles.leadName}>{lead.name}</div>
          <div style={{fontSize:'12px', color:'#888', marginBottom:'4px'}}>{lead.bikeOfInterest}</div>
          <div style={styles.leadMeta}>
            <span style={styles.badge}>{lead.status}</span>
            {lead.tags && JSON.parse(lead.tags).map(tag => <span key={tag} style={{...styles.badge, background: '#e53935'}}>{tag}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ stats }) {
  return (
    <div style={{flex:1, padding:'24px', overflowY:'auto'}}>
      <div style={{display:'flex', marginBottom:'24px'}}>
        <div style={styles.statCard}><div style={styles.statNumber}>{stats.totalLeads}</div><div style={styles.statLabel}>Total Leads</div></div>
        <div style={styles.statCard}><div style={styles.statNumber}>{stats.newLeads}</div><div style={styles.statLabel}>New Leads</div></div>
        <div style={styles.statCard}><div style={styles.statNumber}>{stats.appointmentRate}%</div><div style={styles.statLabel}>Appointment Rate</div></div>
        <div style={styles.statCard}><div style={styles.statNumber}>{stats.showRate}%</div><div style={styles.statLabel}>Show Rate</div></div>
        <div style={styles.statCard}><div style={styles.statNumber}>{stats.closeRate}%</div><div style={styles.statLabel}>Close Rate</div></div>
      </div>
      <div style={{background:'#111', borderRadius:'12px', padding:'24px', border:'1px solid #222'}}>
        <div style={{fontSize:'18px', fontWeight:'600', marginBottom:'16px'}}>Pipeline</div>
        <div style={styles.pipelineStage}>NEW → {stats.newLeads} leads</div>
        <div style={styles.pipelineStage}>CONTACTED → {stats.contacted} leads</div>
        <div style={styles.pipelineStage}>APPOINTMENT → {stats.appointment} leads</div>
        <div style={styles.pipelineStage}>SHOWED → {stats.showed} leads</div>
        <div style={styles.pipelineStage}>SOLD → {stats.sold} deals</div>
      </div>
    </div>
  );
}

export default App;
