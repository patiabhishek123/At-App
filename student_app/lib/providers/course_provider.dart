import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/course.dart';
import '../services/api_service.dart';

class CourseProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  
  bool _isLoading = false;
  List<StudentCourse> _courses = [];

  bool get isLoading => _isLoading;
  List<StudentCourse> get courses => _courses;

  Future<void> fetchCourses() async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.get('/student/courses');
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        _courses = data.map((json) => StudentCourse.fromJson(json)).toList();
      }
    } catch (_) {}

    _isLoading = false;
    notifyListeners();
  }
}
