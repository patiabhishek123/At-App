'use client';

import React, { useState } from 'react';

// Data Types
interface Section {
  id: string;
  courseName: string;
  courseCode: string;
  department: string;
  term: string;
  teacher: string;
  bssid: string;
  lat: number;
  lng: number;
  radius: number;
  threshold: number;
  attendance: number;
}

interface AuditLog {
  id: string;
  type: 'override' | 'failure';
  actor: string;
  student: string;
  course: string;
  reason: string;
  timestamp: string;
}

export default function AdminDashboard() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(true); // default true for immediate developer preview
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sections' | 'import' | 'audit' | 'settings'>('dashboard');

  // App Data (Configurable States)
  const [sections, setSections] = useState<Section[]>([
    {
      id: 'sec-1',
      courseName: 'Intro to Computer Science',
      courseCode: 'CS101',
      department: 'Computer Science',
      term: 'Fall 2026',
      teacher: 'Dr. Alan Turing',
      bssid: '00:0a:95:9d:68:16',
      lat: 42.3601,
      lng: -71.0942,
      radius: 50,
      threshold: 75,
      attendance: 82.4,
    },
    {
      id: 'sec-2',
      courseName: 'Advanced Database Systems',
      courseCode: 'CS405',
      department: 'Computer Science',
      term: 'Fall 2026',
      teacher: 'Prof. Grace Hopper',
      bssid: '12:34:56:78:90:ab',
      lat: 42.3615,
      lng: -71.0921,
      radius: 30,
      threshold: 75,
      attendance: 68.5,
    },
    {
      id: 'sec-3',
      courseName: 'Quantum Mechanics',
      courseCode: 'PHY301',
      department: 'Physics',
      term: 'Fall 2026',
      teacher: 'Dr. Richard Feynman',
      bssid: 'ab:cd:ef:12:34:56',
      lat: 42.3622,
      lng: -71.0955,
      radius: 40,
      threshold: 75,
      attendance: 72.8,
    }
  ]);

  const [auditLogs] = useState<AuditLog[]>([
    {
      id: 'log-1',
      type: 'override',
      actor: 'Dr. Alan Turing (Teacher)',
      student: 'Alice Smith',
      course: 'CS101',
      reason: 'Student forgot mobile device, verified presence manually',
      timestamp: '2026-08-02 09:14:05',
    },
    {
      id: 'log-2',
      type: 'failure',
      actor: 'System Verification',
      student: 'Bob Miller',
      course: 'CS405',
      reason: 'BSSID mismatch: Connected to home Wi-Fi instead of classroom network',
      timestamp: '2026-08-02 10:45:22',
    },
    {
      id: 'log-3',
      type: 'failure',
      actor: 'System Verification',
      student: 'Charlie Brown',
      course: 'PHY301',
      reason: 'Geofence breach: Lat/Lng out of bounds (350 meters away)',
      timestamp: '2026-08-02 11:02:11',
    },
  ]);

  // Dashboard Filters
  const [dashSearch, setDashSearch] = useState('');
  const [dashDept, setDashDept] = useState('All');

  // Audit Log Filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditType, setAuditType] = useState<'all' | 'override' | 'failure'>('all');

  // Section Modal State (Create/Edit)
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDept, setFormDept] = useState('Computer Science');
  const [formTeacher, setFormTeacher] = useState('');
  const [formBssid, setFormBssid] = useState('');
  const [formLat, setFormLat] = useState(42.3601);
  const [formLng, setFormLng] = useState(-71.0942);
  const [formRadius, setFormRadius] = useState(50);
  const [formThreshold, setFormThreshold] = useState(75);

  // Settings State
  const [strictWifi, setStrictWifi] = useState(true);
  const [strictGps, setStrictGps] = useState(true);
  const [strictCode, setStrictCode] = useState(true);
  const [signalsRequired, setSignalsRequired] = useState(2);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [termStart, setTermStart] = useState('2026-08-20');
  const [termEnd, setTermEnd] = useState('2026-12-15');

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importFeedback, setImportFeedback] = useState('');
  const [importError, setImportError] = useState('');

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@college.edu' && password === 'admin123') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Invalid administrator credentials.');
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setFormCode('');
    setFormName('');
    setFormDept('Computer Science');
    setFormTeacher('');
    setFormBssid('');
    setFormLat(42.3601);
    setFormLng(-71.0942);
    setFormRadius(50);
    setFormThreshold(75);
    setShowAddModal(true);
  };

  // Handle Add Section
  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    const newSec: Section = {
      id: `sec-${Date.now()}`,
      courseName: formName,
      courseCode: formCode,
      department: formDept,
      term: 'Fall 2026',
      teacher: formTeacher,
      bssid: formBssid,
      lat: Number(formLat),
      lng: Number(formLng),
      radius: Number(formRadius),
      threshold: Number(formThreshold),
      attendance: 0.0, // newly initialized course
    };
    setSections([...sections, newSec]);
    setShowAddModal(false);
  };

  // Open Edit Modal
  const openEditModal = (sec: Section) => {
    setEditingSection(sec);
    setFormCode(sec.courseCode);
    setFormName(sec.courseName);
    setFormDept(sec.department);
    setFormTeacher(sec.teacher);
    setFormBssid(sec.bssid);
    setFormLat(sec.lat);
    setFormLng(sec.lng);
    setFormRadius(sec.radius);
    setFormThreshold(sec.threshold);
    setShowEditModal(true);
  };

  // Handle Edit Section
  const handleEditSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection) return;
    const updated = sections.map(s => {
      if (s.id === editingSection.id) {
        return {
          ...s,
          courseCode: formCode,
          courseName: formName,
          department: formDept,
          teacher: formTeacher,
          bssid: formBssid,
          lat: Number(formLat),
          lng: Number(formLng),
          radius: Number(formRadius),
          threshold: Number(formThreshold),
        };
      }
      return s;
    });
    setSections(updated);
    setShowEditModal(false);
    setEditingSection(null);
  };

  // Real client-side CSV parsing
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportFeedback('');
    setImportError('');
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCsvFile(file);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) {
          setImportError("File is empty.");
          return;
        }

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        const required = ['id', 'name', 'email', 'section'];
        const hasAll = required.every(h => headers.includes(h));
        
        if (!hasAll) {
          setImportError("Import failed — CSV must contain headers: id, name, email, section");
          setCsvPreview([]);
          return;
        }

        const idIdx = headers.indexOf('id');
        const nameIdx = headers.indexOf('name');
        const emailIdx = headers.indexOf('email');
        const secIdx = headers.indexOf('section');

        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map(p => p.trim());
          if (parts.length < required.length) continue;
          parsed.push({
            id: parts[idIdx] || `auto-${i}`,
            name: parts[nameIdx] || 'N/A',
            email: parts[emailIdx] || 'N/A',
            section: parts[secIdx] || 'N/A'
          });
        }
        setCsvPreview(parsed);
      };
      reader.readAsText(file);
    }
  };

  const executeImport = () => {
    if (!csvFile || csvPreview.length === 0) return;
    setImportFeedback(`Roster successfully parsed! Registered ${csvPreview.length} student enrollment mappings.`);
    setCsvFile(null);
    setCsvPreview([]);
  };

  // Export Dashboard Attendance Overview to CSV
  const exportDashboardCSV = () => {
    const headers = 'Code,Name,Department,Teacher,Term,Assigned BSSID,Average Attendance\n';
    const rows = sections.map(s => 
      `"${s.courseCode}","${s.courseName}","${s.department}","${s.teacher}","${s.term}","${s.bssid}",${s.attendance}%`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `AtApp_Attendance_Report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter sections for Dashboard Overview
  const filteredDashboardSections = sections.filter(s => {
    const matchesSearch = s.courseName.toLowerCase().includes(dashSearch.toLowerCase()) || 
                          s.courseCode.toLowerCase().includes(dashSearch.toLowerCase());
    const matchesDept = dashDept === 'All' || s.department === dashDept;
    return matchesSearch && matchesDept;
  });

  // Filter audit logs
  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = log.student.toLowerCase().includes(auditSearch.toLowerCase()) ||
                          log.actor.toLowerCase().includes(auditSearch.toLowerCase()) ||
                          log.reason.toLowerCase().includes(auditSearch.toLowerCase());
    const matchesType = auditType === 'all' || log.type === auditType;
    return matchesSearch && matchesType;
  });

  // Calculate status badge style based on attendance threshold
  const getAttendanceStatusInfo = (attendance: number, threshold: number) => {
    if (attendance >= threshold) {
      return { label: 'ON TRACK', className: 'badge-success' };
    } else if (attendance >= threshold - 5) {
      return { label: 'WARNING', className: 'badge-warning' };
    } else {
      return { label: 'CRITICAL', className: 'badge-danger' };
    }
  };

  // Render Login Page
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <span style={{ fontSize: '48px' }}>🛡️</span>
            <h2 style={{ fontSize: '24px', fontWeight: '800', marginTop: '12px' }}>AtApp Console</h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Tenant Administration Portal</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Administrator Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="admin@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {authError && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', fontWeight: 600 }}>
                {authError}
              </p>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
              Sign In to Console
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render Admin Layout
  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">A</div>
          <span className="logo-text">AtApp Admin</span>
        </div>
        
        <nav className="nav-list">
          <a
            href="#"
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}
          >
            <span>📊</span> Dashboard
          </a>
          <a
            href="#"
            className={`nav-link ${activeTab === 'sections' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('sections'); }}
          >
            <span>📚</span> Sections
          </a>
          <a
            href="#"
            className={`nav-link ${activeTab === 'import' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('import'); }}
          >
            <span>📥</span> Bulk Import
          </a>
          <a
            href="#"
            className={`nav-link ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('audit'); }}
          >
            <span>🔍</span> Audit Logs
          </a>
          <a
            href="#"
            className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('settings'); }}
          >
            <span>⚙️</span> Tenant Settings
          </a>
        </nav>

        <button className="logout-button" onClick={() => setIsAuthenticated(false)}>
          <span>🚪</span> Log out
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Tab 1: Institution Dashboard */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="header-row">
              <div className="title-desc">
                <h1>Institution Overview</h1>
                <p>Overall attendance statistics and status metrics</p>
              </div>
              <button className="btn btn-secondary" onClick={exportDashboardCSV}>
                📥 Export CSV
              </button>
            </div>

            <div className="stats-grid">
              <div className="card card-attendance">
                <div className="card-header-icon">
                  <span>AVERAGE ATTENDANCE</span>
                  <span>📊</span>
                </div>
                <div className="card-value">
                  {(sections.reduce((acc, s) => acc + s.attendance, 0) / sections.length).toFixed(1)}%
                </div>
                <div className="card-footer-desc">School-wide Aggregate</div>
              </div>
              <div className="card card-sections">
                <div className="card-header-icon">
                  <span>ACTIVE SECTIONS</span>
                  <span>📚</span>
                </div>
                <div className="card-value">{sections.length}</div>
                <div className="card-footer-desc">Fall 2026 Semester</div>
              </div>
              <div className="card card-alerts">
                <div className="card-header-icon">
                  <span>ATTENDANCE ALERTS</span>
                  <span>⚠️</span>
                </div>
                <div className="card-value">
                  {sections.filter(s => s.attendance < s.threshold).length}
                </div>
                <div className="card-footer-desc">Sections below threshold</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by Course Name or Code..."
                  value={dashSearch}
                  onChange={(e) => setDashSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '16px' }}
                />
              </div>
              <div style={{ width: '220px' }}>
                <select
                  className="form-control"
                  value={dashDept}
                  onChange={(e) => setDashDept(e.target.value)}
                >
                  <option value="All">All Departments</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Physics">Physics</option>
                </select>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Teacher</th>
                    <th>Term</th>
                    <th>Average Attendance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDashboardSections.map((sec) => {
                    const status = getAttendanceStatusInfo(sec.attendance, sec.threshold);
                    return (
                      <tr key={sec.id}>
                        <td><span style={{ fontWeight: '700' }}>{sec.courseCode}</span></td>
                        <td>{sec.courseName}</td>
                        <td>{sec.teacher}</td>
                        <td>{sec.term}</td>
                        <td><code style={{ fontSize: '15px' }}>{sec.attendance.toFixed(1)}%</code></td>
                        <td>
                          <span className={`badge ${status.className}`}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDashboardSections.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>
                        No courses found matching search filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Section Management */}
        {activeTab === 'sections' && (
          <div>
            <div className="header-row">
              <div className="title-desc">
                <h1>Course & Section Config</h1>
                <p>Register new classes and configure geofence calibration profiles</p>
              </div>
              <button className="btn btn-primary" onClick={openCreateModal}>
                ➕ Create Section
              </button>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Teacher</th>
                    <th>BSSID</th>
                    <th>Geofence (Lat/Lng)</th>
                    <th>Radius / Threshold</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((sec) => (
                    <tr key={sec.id}>
                      <td>
                        <div>
                          <div style={{ fontWeight: '700' }}>{sec.courseName}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{sec.courseCode} ({sec.term})</div>
                        </div>
                      </td>
                      <td>{sec.teacher}</td>
                      <td><code>{sec.bssid}</code></td>
                      <td>{sec.lat.toFixed(6)}, {sec.lng.toFixed(6)}</td>
                      <td>
                        <div>
                          <div>{sec.radius} meters</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Min: {sec.threshold}% attendance</div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => openEditModal(sec)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px', color: '#ef4444' }}
                            onClick={() => {
                              if (confirm(`Deactivate ${sec.courseCode}?`)) {
                                setSections(sections.filter(s => s.id !== sec.id));
                              }
                            }}
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal for Creating Section */}
            {showAddModal && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '20px' }}>Create Section</h2>
                  <form onSubmit={handleAddSection}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">Course Code</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="CS101"
                          value={formCode}
                          onChange={(e) => setFormCode(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Department</label>
                        <select
                          className="form-control"
                          value={formDept}
                          onChange={(e) => setFormDept(e.target.value)}
                        >
                          <option value="Computer Science">Computer Science</option>
                          <option value="Physics">Physics</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Course Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Intro to Programming"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">Instructor Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Dr. Alan Turing"
                          value={formTeacher}
                          onChange={(e) => setFormTeacher(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Attendance Threshold (%)</label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          max="100"
                          value={formThreshold}
                          onChange={(e) => setFormThreshold(Number(e.target.value))}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Access Point BSSID</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="00:0a:95:9d:68:16"
                        value={formBssid}
                        onChange={(e) => setFormBssid(e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">Latitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          className="form-control"
                          value={formLat}
                          onChange={(e) => setFormLat(Number(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          className="form-control"
                          value={formLng}
                          onChange={(e) => setFormLng(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Geofence Radius (meters)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formRadius}
                        onChange={(e) => setFormRadius(Number(e.target.value))}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Save Section
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal for Editing Section */}
            {showEditModal && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '20px' }}>Edit Section</h2>
                  <form onSubmit={handleEditSection}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">Course Code</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formCode}
                          onChange={(e) => setFormCode(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Department</label>
                        <select
                          className="form-control"
                          value={formDept}
                          onChange={(e) => setFormDept(e.target.value)}
                        >
                          <option value="Computer Science">Computer Science</option>
                          <option value="Physics">Physics</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Course Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">Instructor Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formTeacher}
                          onChange={(e) => setFormTeacher(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Attendance Threshold (%)</label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          max="100"
                          value={formThreshold}
                          onChange={(e) => setFormThreshold(Number(e.target.value))}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Access Point BSSID</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formBssid}
                        onChange={(e) => setFormBssid(e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">Latitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          className="form-control"
                          value={formLat}
                          onChange={(e) => setFormLat(Number(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          className="form-control"
                          value={formLng}
                          onChange={(e) => setFormLng(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Geofence Radius (meters)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formRadius}
                        onChange={(e) => setFormRadius(Number(e.target.value))}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingSection(null); }}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Bulk CSV Import */}
        {activeTab === 'import' && (
          <div>
            <div className="header-row">
              <div className="title-desc">
                <h1>Bulk Student Upload</h1>
                <p>Import student lists and class enrollment data tables from CSV sheets</p>
              </div>
            </div>

            <div style={{
              border: '2px dashed var(--border-color)',
              borderRadius: 'var(--border-radius-lg)',
              padding: '48px',
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.01)',
              marginBottom: '32px'
            }}>
              <span style={{ fontSize: '48px' }}>📁</span>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginTop: '16px' }}>Select CSV File</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: '8px 0 20px' }}>
                Files must contain headers: <code>id, name, email, section</code>
              </p>
              <input
                type="file"
                accept=".csv"
                id="csvFileInput"
                style={{ display: 'none' }}
                onChange={handleCsvChange}
              />
              <label htmlFor="csvFileInput" className="btn btn-secondary">
                Choose Local File
              </label>
            </div>

            {importError && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--color-danger)',
                padding: '16px',
                borderRadius: 'var(--border-radius-md)',
                color: 'var(--color-danger)',
                fontWeight: '600',
                fontSize: '14px',
                marginBottom: '24px'
              }}>
                ⚠ {importError}
              </div>
            )}

            {csvPreview.length > 0 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>File Preview ({csvPreview.length} records found)</h3>
                <div className="table-container" style={{ marginBottom: '24px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Student Name</th>
                        <th>Student Email</th>
                        <th>Assigned Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 10).map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.id}</td>
                          <td>{row.name}</td>
                          <td><code>{row.email}</code></td>
                          <td>{row.section}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvPreview.length > 10 && (
                    <div style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--border-color)' }}>
                      Showing top 10 rows. Total {csvPreview.length} records parsed successfully.
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                  <button className="btn btn-primary" onClick={executeImport}>
                    Confirm and Import
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setCsvFile(null); setCsvPreview([]); }}>
                    Clear
                  </button>
                </div>
              </div>
            )}

            {importFeedback && (
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid var(--color-success)',
                padding: '16px',
                borderRadius: 'var(--border-radius-md)',
                color: 'var(--color-success)',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                ✓ {importFeedback}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Audit Logs */}
        {activeTab === 'audit' && (
          <div>
            <div className="header-row">
              <div className="title-desc">
                <h1>Console Audit Logs</h1>
                <p>Chronological journal of teacher overrides and student validation failures</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by student, actor, or reason..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ width: '220px' }}>
                <select
                  className="form-control"
                  value={auditType}
                  onChange={(e) => setAuditType(e.target.value as any)}
                >
                  <option value="all">All Log Types</option>
                  <option value="override">Overrides Only</option>
                  <option value="failure">Failures Only</option>
                </select>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Type</th>
                    <th>Triggered By</th>
                    <th>Target Student</th>
                    <th>Course</th>
                    <th>Action Details / Exception Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{log.timestamp}</td>
                      <td>
                        <span className={`badge ${log.type === 'override' ? 'badge-success' : 'badge-danger'}`}>
                          {log.type.toUpperCase()}
                        </span>
                      </td>
                      <td>{log.actor}</td>
                      <td style={{ fontWeight: '600' }}>{log.student}</td>
                      <td>{log.course}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-text-main)' }}>{log.reason}</td>
                    </tr>
                  ))}
                  {filteredAuditLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>
                        No audit logs found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Tenant Settings */}
        {activeTab === 'settings' && (
          <div>
            <div className="header-row">
              <div className="title-desc">
                <h1>Tenant Security & Settings</h1>
                <p>Enforce Postgres RLS parameters and device matching strictness limits</p>
              </div>
            </div>

            <div className="card" style={{ maxWidth: '650px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '24px' }}>Verification Policy</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>Verify Rotating Code</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Enforce rotating code match generated by teacher app</div>
                </div>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', accentColor: '#ffffff' }}
                  checked={strictCode}
                  onChange={(e) => setStrictCode(e.target.checked)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>Verify Wi-Fi BSSID Matching</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Require match of classroom router hardware access points</div>
                </div>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', accentColor: '#ffffff' }}
                  checked={strictWifi}
                  onChange={(e) => setStrictWifi(e.target.checked)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>Verify GPS Geofence Boundary Check</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Check location bounds of student check-in within classroom radius</div>
                </div>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', accentColor: '#ffffff' }}
                  checked={strictGps}
                  onChange={(e) => setStrictGps(e.target.checked)}
                />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '20px 0' }} />

              <div className="form-group">
                <label className="form-label">Signals Required for Successful Check-in</label>
                <select
                  className="form-control"
                  value={signalsRequired}
                  onChange={(e) => setSignalsRequired(Number(e.target.value))}
                >
                  <option value="3">3 of 3 (Rotating Code + Wi-Fi BSSID + GPS Geofence)</option>
                  <option value="2">2 of 3 (Any 2 signals valid)</option>
                  <option value="1">1 of 3 (Any 1 signal valid)</option>
                </select>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                  Recommended: 2 of 3 to allow grace for temporary GPS/Wi-Fi connection dropouts inside heavy building walls.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Max verification attempts (per student, per session)</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="10"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '20px 0' }} />

              <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Active Term Dates</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div className="form-group">
                  <label className="form-label">Term Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={termStart}
                    onChange={(e) => setTermStart(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Term End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={termEnd}
                    onChange={(e) => setTermEnd(e.target.value)}
                  />
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => {
                  alert(`Settings successfully saved:\n- Strict Code: ${strictCode}\n- Strict Wi-Fi: ${strictWifi}\n- Strict GPS: ${strictGps}\n- Signals Required: ${signalsRequired}/3\n- Max Attempts: ${maxAttempts}\n- Term Dates: ${termStart} to ${termEnd}`);
                }}
              >
                Save Settings
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
