class StudentCourse {
  final String sectionId;
  final String courseName;
  final String courseCode;
  final int presentCount;
  final int totalSessions;
  final double attendancePct;

  StudentCourse({
    required this.sectionId,
    required this.courseName,
    required this.courseCode,
    required this.presentCount,
    required this.totalSessions,
    required this.attendancePct,
  });

  factory StudentCourse.fromJson(Map<String, dynamic> json) {
    return StudentCourse(
      sectionId: json['sectionId'] as String,
      courseName: json['courseName'] as String,
      courseCode: json['courseCode'] as String,
      presentCount: json['presentCount'] as int,
      totalSessions: json['totalSessions'] as int,
      attendancePct: (json['attendancePct'] as num).toDouble(),
    );
  }
}
