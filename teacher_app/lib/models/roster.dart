class RosterStudent {
  final String studentId;
  final String name;
  final String email;
  final String status; // present, absent, overridden_present, overridden_absent, pending
  final DateTime? recordedAt;

  RosterStudent({
    required this.studentId,
    required this.name,
    required this.email,
    required this.status,
    this.recordedAt,
  });

  factory RosterStudent.fromJson(Map<String, dynamic> json) {
    return RosterStudent(
      studentId: json['studentId'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      status: json['status'] as String,
      recordedAt: json['recordedAt'] != null ? DateTime.parse(json['recordedAt'] as String) : null,
    );
  }
}

class StudentDashboard {
  final String studentId;
  final String name;
  final String email;
  final int presentCount;
  final int totalSessions;
  final double attendancePct;

  StudentDashboard({
    required this.studentId,
    required this.name,
    required this.email,
    required this.presentCount,
    required this.totalSessions,
    required this.attendancePct,
  });

  factory StudentDashboard.fromJson(Map<String, dynamic> json) {
    return StudentDashboard(
      studentId: json['studentId'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      presentCount: json['presentCount'] as int,
      totalSessions: json['totalSessions'] as int,
      attendancePct: (json['attendancePct'] as num).toDouble(),
    );
  }
}
