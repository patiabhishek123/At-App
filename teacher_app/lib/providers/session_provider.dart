import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/section.dart';
import '../models/session.dart';
import '../models/roster.dart';
import '../services/api_service.dart';

class SessionProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  
  bool _isLoading = false;
  List<TeacherSection> _sections = [];
  
  // Active session details
  String? _activeSessionId;
  String? _activeCode;
  int _codeExpiresIn = 10;
  Timer? _codeTimer;
  Timer? _rosterTimer;

  // Active roster list
  List<RosterStudent> _roster = [];

  bool get isLoading => _isLoading;
  List<TeacherSection> get sections => _sections;
  String? get activeSessionId => _activeSessionId;
  String? get activeCode => _activeCode;
  int get codeExpiresIn => _codeExpiresIn;
  List<RosterStudent> get roster => _roster;

  // Fetch sections assigned to teacher
  Future<void> fetchSections() async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get('/teacher/sections');
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        _sections = data.map((json) => TeacherSection.fromJson(json)).toList();
      }
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  // Start attendance session
  Future<void> startSession(String sectionId) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.post('/teacher/sessions', {'sectionId': sectionId});
      if (res.statusCode == 201) {
        final data = jsonDecode(res.body);
        _activeSessionId = data['sessionId'] as String;
        _activeCode = data['currentCode'] as String;
        _codeExpiresIn = data['codeExpiresInSeconds'] as int;
        
        // Start polling for code updates and roster updates
        _startCodeRotationPolling();
        _startRosterPolling();
      } else {
        throw Exception(jsonDecode(res.body)['error'] ?? 'Failed to start session');
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // End attendance session
  Future<SessionSummary> endSession() async {
    if (_activeSessionId == null) throw Exception("No active session");
    
    _isLoading = true;
    notifyListeners();
    
    // Stop timers
    _stopTimers();

    try {
      final res = await _api.post('/teacher/sessions/$_activeSessionId/end', null);
      if (res.statusCode == 200) {
        final summary = SessionSummary.fromJson(jsonDecode(res.body));
        _activeSessionId = null;
        _activeCode = null;
        _roster = [];
        return summary;
      } else {
        throw Exception(jsonDecode(res.body)['error'] ?? 'Failed to end session');
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Fetch live roster
  Future<void> fetchRoster() async {
    if (_activeSessionId == null) return;
    try {
      final res = await _api.get('/teacher/sessions/$_activeSessionId/roster');
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        _roster = data.map((json) => RosterStudent.fromJson(json)).toList();
        notifyListeners();
      }
    } catch (_) {}
  }

  // Manual Override
  Future<void> submitOverride(String studentId, String status, String reason) async {
    if (_activeSessionId == null) return;
    try {
      final res = await _api.post('/teacher/attendance/overrides', {
        'sessionId': _activeSessionId,
        'studentId': studentId,
        'status': status,
        'reason': reason,
      });
      if (res.statusCode == 200) {
        await fetchRoster();
      } else {
        throw Exception(jsonDecode(res.body)['error'] ?? 'Failed to submit override');
      }
    } catch (_) {
      rethrow;
    }
  }

  // Fetch Section Dashboard
  Future<List<StudentDashboard>> fetchDashboard(String sectionId) async {
    try {
      final res = await _api.get('/teacher/sections/$sectionId/dashboard');
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        return data.map((json) => StudentDashboard.fromJson(json)).toList();
      }
    } catch (_) {}
    return [];
  }

  // Fetch Section History
  Future<List<SessionHistory>> fetchHistory(String sectionId) async {
    try {
      final res = await _api.get('/teacher/sections/$sectionId/sessions');
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        return data.map((json) => SessionHistory.fromJson(json)).toList();
      }
    } catch (_) {}
    return [];
  }

  void _startCodeRotationPolling() {
    _codeTimer?.cancel();
    _codeTimer = Timer.periodic(const Duration(seconds: 3), (timer) async {
      if (_activeSessionId == null) {
        timer.cancel();
        return;
      }
      try {
        final res = await _api.get('/teacher/sessions/$_activeSessionId/code');
        if (res.statusCode == 200) {
          final data = jsonDecode(res.body);
          _activeCode = data['currentCode'] as String;
          _codeExpiresIn = data['codeExpiresInSeconds'] as int;
          notifyListeners();
        }
      } catch (_) {}
    });
  }

  void _startRosterPolling() {
    _rosterTimer?.cancel();
    // Poll roster list every 5 seconds for real-time visualization
    _rosterTimer = Timer.periodic(const Duration(seconds: 5), (timer) async {
      await fetchRoster();
    });
  }

  void _stopTimers() {
    _codeTimer?.cancel();
    _rosterTimer?.cancel();
  }

  @override
  void dispose() {
    _stopTimers();
    super.dispose();
  }
}
