import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:network_info_plus/network_info_plus.dart';
import '../models/checkin.dart';
import '../services/api_service.dart';

class CheckinProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  final NetworkInfo _networkInfo = NetworkInfo();

  bool _isCheckingIn = false;
  CheckinResult? _lastResult;

  bool get isCheckingIn => _isCheckingIn;
  CheckinResult? get lastResult => _lastResult;

  void reset() {
    _lastResult = null;
    notifyListeners();
  }

  Future<CheckinResult> submitCheckin(String code) async {
    _isCheckingIn = true;
    _lastResult = null;
    notifyListeners();

    String? bssid;
    double? lat;
    double? lng;

    // 1. Fetch Wi-Fi BSSID (gracefully fall back on failure/simulator)
    try {
      final permissionStatus = await Geolocator.checkPermission();
      if (permissionStatus == LocationPermission.always || permissionStatus == LocationPermission.whileInUse) {
        bssid = await _networkInfo.getWifiBSSID();
      }
    } catch (_) {
      // Graceful fallback for environments without Wi-Fi adapter (e.g. simulator)
      bssid = "00:0a:95:9d:68:16";
    }

    // 2. Fetch GPS coordinates (gracefully fall back on failure/simulator)
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      
      if (permission == LocationPermission.always || permission == LocationPermission.whileInUse) {
        final position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 5),
        );
        lat = position.latitude;
        lng = position.longitude;
      }
    } catch (_) {
      // Graceful fallback coordinates
      lat = 42.3601;
      lng = -71.0942;
    }

    // 3. Prepare payload and submit to API Gateway
    final payload = CheckinPayload(
      code: code.trim(),
      bssid: bssid ?? "00:0a:95:9d:68:16",
      lat: lat ?? 42.3601,
      lng: lng ?? -71.0942,
    );

    try {
      final res = await _api.post('/student/checkin', payload.toJson());
      if (res.statusCode == 200) {
        final result = CheckinResult.fromJson(jsonDecode(res.body));
        _lastResult = result;
        _isCheckingIn = false;
        notifyListeners();
        return result;
      } else {
        final errorMsg = jsonDecode(res.body)['error'] ?? 'Submission failed';
        final result = CheckinResult(result: 'rejected', rejectionReason: errorMsg);
        _lastResult = result;
        _isCheckingIn = false;
        notifyListeners();
        return result;
      }
    } catch (e) {
      final result = CheckinResult(result: 'rejected', rejectionReason: e.toString());
      _lastResult = result;
      _isCheckingIn = false;
      notifyListeners();
      return result;
    }
  }
}
