import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  User? _currentUser;
  bool _isLoading = false;
  bool _isCheckingStartup = true;

  User? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;
  bool get isCheckingStartup => _isCheckingStartup;

  AuthProvider() {
    checkStartupAuth();
  }

  Future<void> checkStartupAuth() async {
    _isCheckingStartup = true;
    notifyListeners();

    try {
      final token = await _api.getAccessToken();
      if (token != null) {
        // Resolve profile (e.g., using a ping or decoding JWT)
        // For simplicity, we decode JWT claims or fetch from secure storage
        // Here we parse claims from the JWT to get role, name, id, etc.
        final parts = token.split('.');
        if (parts.length == 3) {
          final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
          final claims = jsonDecode(payload);
          if (claims['role'] == 'teacher') {
            _currentUser = User(
              id: claims['sub'] ?? '',
              name: claims['name'] ?? 'Teacher',
              email: claims['email'] ?? '',
              role: claims['role'] ?? 'teacher',
              collegeId: claims['collegeId'] ?? '',
            );
          }
        }
      }
    } catch (_) {
      await _api.clearTokens();
    } finally {
      _isCheckingStartup = false;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.post('/auth/login', {
        'email': email,
        'password': password,
      });

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final accessToken = data['accessToken'] as String;
        final refreshToken = data['refreshToken'] as String;
        final userJson = data['user'] as Map<String, dynamic>;

        _currentUser = User.fromJson(userJson);
        if (_currentUser!.role != 'teacher') {
          _currentUser = null;
          await _api.clearTokens();
          _isLoading = false;
          notifyListeners();
          throw Exception("Only teachers are authorized to use this application.");
        }

        await _api.saveTokens(accessToken, refreshToken);
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        final errorMsg = jsonDecode(response.body)['error'] ?? 'Login failed';
        throw Exception(errorMsg);
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> logout() async {
    await _api.clearTokens();
    _currentUser = null;
    notifyListeners();
  }
}
