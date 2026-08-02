class CheckinPayload {
  final String code;
  final String? bssid;
  final double? lat;
  final double? lng;

  CheckinPayload({
    required this.code,
    this.bssid,
    this.lat,
    this.lng,
  });

  Map<String, dynamic> toJson() {
    final data = <String, dynamic>{
      'code': code,
    };
    if (bssid != null) {
      data['bssid'] = bssid;
    }
    if (lat != null && lng != null) {
      data['gps'] = {
        'lat': lat,
        'lng': lng,
      };
    }
    return data;
  }
}

class CheckinResult {
  final String result; // accepted, rejected
  final String? rejectionReason;

  CheckinResult({
    required this.result,
    this.rejectionReason,
  });

  factory CheckinResult.fromJson(Map<String, dynamic> json) {
    return CheckinResult(
      result: json['result'] as String,
      rejectionReason: json['rejectionReason'] as String?,
    );
  }

  bool get isAccepted => result == 'accepted';
}
