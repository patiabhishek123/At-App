class TeacherSection {
  final String sectionId;
  final String term;
  final String courseName;
  final String courseCode;
  final String? classroomBssid;
  final double? classroomGeofenceLat;
  final double? classroomGeofenceLng;
  final double? classroomGeofenceRadiusM;

  TeacherSection({
    required this.sectionId,
    required this.term,
    required this.courseName,
    required this.courseCode,
    this.classroomBssid,
    this.classroomGeofenceLat,
    this.classroomGeofenceLng,
    this.classroomGeofenceRadiusM,
  });

  factory TeacherSection.fromJson(Map<String, dynamic> json) {
    return TeacherSection(
      sectionId: json['sectionId'] as String,
      term: json['term'] as String,
      courseName: json['courseName'] as String,
      courseCode: json['courseCode'] as String,
      classroomBssid: json['classroomBssid'] as String?,
      classroomGeofenceLat: (json['classroomGeofenceLat'] as num?)?.toDouble(),
      classroomGeofenceLng: (json['classroomGeofenceLng'] as num?)?.toDouble(),
      classroomGeofenceRadiusM: (json['classroomGeofenceRadiusM'] as num?)?.toDouble(),
    );
  }
}
