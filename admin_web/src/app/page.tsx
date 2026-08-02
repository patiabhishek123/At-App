'use client';

import React, { useState } from 'react';

// Data Types
interface Section {
  id: string;
  courseName: string;
  courseCode: string;
  term: string;
  teacher: string;
  bssid: string;
  lat: number;
  lng: number;
  radius: number;
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sections' | 'import' | 'audit' | 'settings'>('dashboard');

  // App Data (Preset Mock / Configurable States)
  const [sections, setSections] = useState<Section[]>([
    {
      id: 'sec-1',
      courseName: 'Intro to Computer Science',
      courseCode: 'CS101',
      term: 'Fall 2026',
      teacher: 'Dr. Alan Turing',
      bssid: '00:0a:95:9d:68:16',
      lat: 42.3601,
      lng: -71.0942,
      radius: 50,
    },
    {
      id: 'sec-2',
      courseName: 'Advanced Database Systems',
      courseCode: 'CS405',
      term: 'Fall 2026',
      teacher: 'Prof. Grace Hopper',
      bssid: '12:34:56:78:90:ab',
      lat: 42.3615,
      lng: -71.0921,
      radius: 30,
    },
  ]);

  const [auditLogs] = useState<AuditLog[]>([
    {
      id: 'log-1',
      type: 'override',
      actor: 'Dr. Alan Turing (Teacher)',
      student: 'Bob Smith',
      course: 'CS101',
      reason: 'Student forgot mobile device, verified manually in class',
      timestamp: '2026-08-02 09:14:05',
    },
    {
      id: 'log-2',
      type: 'failure',
      actor: 'System Verification',
      student: 'Charlie Brown',
      course: 'CS405',
      reason: 'BSSID mismatch: Connected to home Wi-Fi instead of classroom network',
      timestamp: '2026-08-02 10:45:22',
    },
    {
      id: 'log-3',
      type: 'failure',
      actor: 'System Verification',
      student: 'Diana Prince',
      course: 'CS101',
      reason: 'Geofence breach: Lat/Lng out of bounds (350 meters away)',
      timestamp: '2026-08-02 11:02:11',
    },
  ]);

  // Modal State for adding Section
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newTeacher, setNewTeacher] = useState('');
  const [newBssid, setNewBssid] = useState('');
  const [newLat, setNewLat] = useState(42.3601);
  const [newLng, setNewLng] = useState(-71.0942);
  const [newRadius, setNewRadius] = useState(50);

  // Settings State
  const [strictWifi, setStrictWifi] = useState(true);
  const [strictGps, setStrictGps] = useState(true);
  const [termStart, setTermStart] = useState('2026-08-20');
  const [termEnd, setTermEnd] = useState('2026-12-15');

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importFeedback, setImportFeedback] = useState('');

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

  // Handle Add Section
  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    const newSec: Section = {
      id: `sec-${Date.now()}`,
      courseName: newCourseName,
      courseCode: newCourseCode,
      term: 'Fall 2026',
      teacher: newTeacher,
      bssid: newBssid,
      lat: Number(newLat),
      lng: Number(newLng),
      radius: Number(newRadius),
    };
    setSections([...sections, newSec]);
    setShowAddModal(false);
    // Reset Form
    setNewCourseName('');
    setNewCourseCode('');
    setNewTeacher('');
    setNewBssid('');
  };

  // Mock CSV parsing
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCsvFile(file);
      // Generate mock preview records
      setCsvPreview([
        { id: '1', name: 'John Doe', email: 'johndoe@college.edu', section: 'CS101' },
        { id: '2', name: 'Jane Miller', email: 'janemiller@college.edu', section: 'CS101' },
        { id: '3', name: 'Alice Cooper', email: 'alicecooper@college.edu', section: 'CS405' },
      ]);
      setImportFeedback('');
    }
  };

  const executeImport = () => {
    if (!csvFile) return;
    setImportFeedback('Roster successfully parsed! Registered 3 student enrollment mappings.');
    setCsvFile(null);
    setCsvPreview([]);
  };

  // Render Login Page
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <span style={{ fontSize: '48px', color: '#10b981' }}>🛡️</span>
            <h2 style={{ fontSize: '24px', fontWeight: '800', marginTop: '12px' }}>AtApp Console</h2>
            <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px' }}>Tenant Administration Portal</p>
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
            </div>

            <div className="stats-grid">
              <div className="card">
                <div className="card-header-icon">
                  <span>AVERAGE ATTENDANCE</span>
                  <span>📈</span>
                </div>
                <div className="card-value" style={{ color: '#10b981' }}>82.4%</div>
                <div className="card-footer-desc">Healthy (Above target 75%)</div>
              </div>
              <div className="card">
                <div className="card-header-icon">
                  <span>ACTIVE SECTIONS</span>
                  <span>📚</span>
                </div>
                <div className="card-value">{sections.length}</div>
                <div className="card-footer-desc">Fall 2026 Semester</div>
              </div>
              <div className="card">
                <div className="card-header-icon">
                  <span>VERIFICATION WARNINGS</span>
                  <span>⚠️</span>
                </div>
                <div className="card-value" style={{ color: '#fbbf24' }}>2</div>
                <div className="card-footer-desc">Triggered BSSID/Geofence exceptions</div>
              </div>
            </div>

            <div className="header-row" style={{ marginTop: '40px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Active Courses</h2>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Teacher</th>
                    <th>Term</th>
                    <th>Assigned BSSID</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((sec) => (
                    <tr key={sec.id}>
                      <td><span style={{ fontWeight: '700', color: '#10b981' }}>{sec.courseCode}</span></td>
                      <td>{sec.courseName}</td>
                      <td>{sec.teacher}</td>
                      <td>{sec.term}</td>
                      <td><code>{sec.bssid}</code></td>
                      <td>
                        <span className="badge badge-success">ACTIVE</span>
                      </td>
                    </tr>
                  ))}
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
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
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
                    <th>Radius</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((sec) => (
                    <tr key={sec.id}>
                      <td>
                        <div>
                          <div style={{ fontWeight: '700' }}>{sec.courseName}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>{sec.courseCode} ({sec.term})</div>
                        </div>
                      </td>
                      <td>{sec.teacher}</td>
                      <td><code>{sec.bssid}</code></td>
                      <td>{sec.lat.toFixed(4)}, {sec.lng.toFixed(4)}</td>
                      <td>{sec.radius} meters</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => {
                            // Simple mock delete/deactivate
                            setSections(sections.filter(s => s.id !== sec.id));
                          }}
                        >
                          Deactivate
                        </button>
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
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px' }}>Create Section</h2>
                  <form onSubmit={handleAddSection}>
                    <div className="form-group">
                      <label className="form-label">Course Code</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="CS101"
                        value={newCourseCode}
                        onChange={(e) => setNewCourseCode(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Course Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Intro to Programming"
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Instructor Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Dr. Alan Turing"
                        value={newTeacher}
                        onChange={(e) => setNewTeacher(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Access Point BSSID</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="00:0a:95:9d:68:16"
                        value={newBssid}
                        onChange={(e) => setNewBssid(e.target.value)}
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
                          value={newLat}
                          onChange={(e) => setNewLat(Number(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          className="form-control"
                          value={newLng}
                          onChange={(e) => setNewLng(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Geofence Radius (meters)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={newRadius}
                        onChange={(e) => setNewRadius(Number(e.target.value))}
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
              <p style={{ color: '#9ca3af', fontSize: '13px', margin: '8px 0 20px' }}>
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

            {csvPreview.length > 0 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>File Preview</h3>
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
                      {csvPreview.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>{row.name}</td>
                          <td><code>{row.email}</code></td>
                          <td>{row.section}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
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
                border: '1px solid var(--color-primary)',
                padding: '16px',
                borderRadius: 'var(--border-radius-md)',
                color: '#34d399',
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
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '13px', color: '#9ca3af' }}>{log.timestamp}</td>
                      <td>
                        <span className={`badge ${log.type === 'override' ? 'badge-success' : 'badge-danger'}`}>
                          {log.type.toUpperCase()}
                        </span>
                      </td>
                      <td>{log.actor}</td>
                      <td style={{ fontWeight: '600' }}>{log.student}</td>
                      <td>{log.course}</td>
                      <td style={{ fontSize: '13px', color: '#d1d5db' }}>{log.reason}</td>
                    </tr>
                  ))}
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

            <div className="card" style={{ maxWidth: '600px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '24px' }}>Verification Policy</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>Strict Wi-Fi BSSID Matching</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>Only check in when connected to registered classroom access points</div>
                </div>
                <input
                  type="checkbox"
                  style={{ width: '20px', height: '20px', accentColor: '#10b981' }}
                  checked={strictWifi}
                  onChange={(e) => setStrictWifi(e.target.checked)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>Strict Geofence Boundary Check</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>Invalidate check-ins outside the configured radius perimeter</div>
                </div>
                <input
                  type="checkbox"
                  style={{ width: '20px', height: '20px', accentColor: '#10b981' }}
                  checked={strictGps}
                  onChange={(e) => setStrictGps(e.target.checked)}
                />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '24px 0' }} />

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
                  ScaffoldMessengerShow();
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

  function ScaffoldMessengerShow() {
    alert('Settings successfully updated and saved to Tenant Config Table.');
  }
}
