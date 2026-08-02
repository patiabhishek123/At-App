class ClassSession {
  final String sessionId;
  final String currentCode;
  final int codeExpiresInSeconds;

  ClassSession({
    required this.sessionId,
    required this.currentCode,
    required this.codeExpiresInSeconds,
  });

  factory ClassSession.fromJson(Map<String, dynamic> json) {
    return ClassSession(
      sessionId: json['sessionId'] as String,
      currentCode: json['currentCode'] as String,
      codeExpiresInSeconds: json['codeExpiresInSeconds'] as int,
    );
  }
}

class SessionSummary {
  final String sessionId;
  final int presentCount;
  final int absentCount;
  final int overrideCount;

  SessionSummary({
    required this.sessionId,
    required this.presentCount,
    required this.absentCount,
    required this.overrideCount,
  });

  factory SessionSummary.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'] as Map<String, dynamic>;
    return SessionSummary(
      sessionId: json['sessionId'] as String,
      presentCount: summary['presentCount'] as int,
      absentCount: summary['absentCount'] as int,
      overrideCount: summary['overrideCount'] as int,
    );
  }
}

class SessionHistory {
  final String sessionId;
  final DateTime startedAt;
  final DateTime? endedAt;
  final int presentCount;
  final int absentCount;

  SessionHistory({
    required this.sessionId,
    required this.startedAt,
    this.endedAt,
    required this.presentCount,
    required this.absentCount,
  });

  factory SessionHistory.fromJson(Map<String, dynamic> json) {
    return SessionHistory(
      sessionId: json['sessionId'] as String,
      startedAt: DateTime.parse(json['startedAt'] as String),
      endedAt: json['endedAt'] != null ? DateTime.parse(json['endedAt'] as String) : null,
      presentCount: json['presentCount'] as int,
      absentCount: json['absentCount'] as int,
    );
  }
}
