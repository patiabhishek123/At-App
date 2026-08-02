import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  static const String baseUrl = 'http://10.0.2.2:8080/api/v1'; // Standard Android loopback. Use localhost for iOS.
  final _storage = const FlutterSecureStorage();
  
  // Singleton instance
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  Future<void> saveTokens(String access, String refresh) async {
    await _storage.write(key: 'accessToken', value: access);
    await _storage.write(key: 'refreshToken', value: refresh);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: 'accessToken');
    await _storage.delete(key: 'refreshToken');
  }

  Future<String?> getAccessToken() async {
    return await _storage.read(key: 'accessToken');
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: 'refreshToken');
  }

  // HTTP GET with Auto-Auth & Auto-Refresh
  Future<http.Response> get(String path) async {
    final url = Uri.parse('$baseUrl$path');
    final headers = await _getHeaders();
    
    var response = await http.get(url, headers: headers);
    if (response.statusCode == 401) {
      final refreshed = await _attemptTokenRefresh();
      if (refreshed) {
        final newHeaders = await _getHeaders();
        response = await http.get(url, headers: newHeaders);
      }
    }
    return response;
  }

  // HTTP POST with Auto-Auth & Auto-Refresh
  Future<http.Response> post(String path, Map<String, dynamic>? body) async {
    final url = Uri.parse('$baseUrl$path');
    final headers = await _getHeaders();
    final bodyStr = body != null ? jsonEncode(body) : null;

    var response = await http.post(url, headers: headers, body: bodyStr);
    if (response.statusCode == 401) {
      final refreshed = await _attemptTokenRefresh();
      if (refreshed) {
        final newHeaders = await _getHeaders();
        response = await http.post(url, headers: newHeaders, body: bodyStr);
      }
    }
    return response;
  }

  Future<Map<String, String>> _getHeaders() async {
    final token = await getAccessToken();
    final headers = {
      'Content-Type': 'application/json',
    };
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<bool> _attemptTokenRefresh() async {
    final refresh = await getRefreshToken();
    if (refresh == null) return false;

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refresh}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final newAccess = data['accessToken'] as String;
        // The endpoint may or may not return a new refresh token. Keep old if not provided.
        final newRefresh = (data['refreshToken'] as String?) ?? refresh;
        await saveTokens(newAccess, newRefresh);
        return true;
      }
    } catch (_) {
      // Fail silently, token clear is handled by consumer/auth_provider
    }
    
    await clearTokens();
    return false;
  }
}
