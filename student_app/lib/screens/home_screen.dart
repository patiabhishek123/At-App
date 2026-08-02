import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/course_provider.dart';
import '../widgets/neumorphic.dart';
import 'login_screen.dart';
import 'checkin_screen.dart';
import 'course_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CourseProvider>().fetchCourses();
    });
  }

  void _logout() async {
    final auth = context.read<AuthProvider>();
    await auth.logout();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final courseProv = context.watch<CourseProvider>();

    // Calculate overall attendance metrics
    double overallPct = 0;
    int totalPresent = 0;
    int totalSessions = 0;
    for (var c in courseProv.courses) {
      totalPresent += c.presentCount;
      totalSessions += c.totalSessions;
    }
    if (totalSessions > 0) {
      overallPct = (totalPresent / totalSessions) * 100;
    } else {
      overallPct = 100.0; // default if no classes
    }

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Color(0xFFE8EAF6), // Soft lavender top
            Color(0xFFF0F4F8), // Soft blue-grey base
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text(
            'My Attendance',
            style: TextStyle(
              color: Color(0xFF2D3748),
              fontWeight: FontWeight.bold,
              fontSize: 22,
            ),
          ),
          backgroundColor: Colors.transparent,
          elevation: 0,
          foregroundColor: const Color(0xFF2D3748),
          actions: [
            IconButton(
              icon: const Icon(Icons.logout_rounded, color: Color(0xFF2D3748)),
              tooltip: 'Logout',
              onPressed: _logout,
            ),
            const SizedBox(width: 8),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: () async {
            await courseProv.fetchCourses();
          },
          color: const Color(0xFF6C63FF),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Student Profile & Overall Stats Card
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: NeumorphicCard(
                  padding: const EdgeInsets.all(20),
                  borderRadius: 24,
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  backgroundColor: const Color(0xFF6C63FF).withOpacity(0.1),
                                  radius: 20,
                                  child: Text(
                                    auth.currentUser?.name.substring(0, 1).toUpperCase() ?? 'S',
                                    style: const TextStyle(
                                      color: Color(0xFF6C63FF),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        auth.currentUser?.name ?? 'Student',
                                        style: const TextStyle(
                                          color: Color(0xFF2D3748),
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Text(
                                        auth.currentUser?.email ?? '',
                                        style: const TextStyle(
                                          color: Colors.blueGrey,
                                          fontSize: 12,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),
                            const Text(
                              'Overall Status',
                              style: TextStyle(
                                color: Colors.blueGrey,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              overallPct >= 75.0 ? 'Good Standing' : 'Below Threshold',
                              style: TextStyle(
                                color: overallPct >= 75.0 ? const Color(0xFF4AD66D) : const Color(0xFFF35B7A),
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      // Radial Neumorphic Circle Progress Widget
                      NeumorphicCircleProgress(
                        value: overallPct / 100,
                        centerText: '${overallPct.toStringAsFixed(0)}%',
                        labelText: 'Attendance',
                        size: 110,
                        progressColor: overallPct >= 75.0 ? const Color(0xFF6C63FF) : const Color(0xFFF35B7A),
                      ),
                    ],
                  ),
                ),
              ),
              
              // Live Session Alert Banner
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const CheckinScreen()),
                    ).then((_) {
                      courseProv.fetchCourses(); // Reload after check-in
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.all(18.0),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF6C63FF), Color(0xFF8EC5FC)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF6C63FF).withOpacity(0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: const BoxDecoration(
                            color: Colors.white24,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.bolt, color: Colors.white, size: 24),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Text(
                                'Attendance Session Live',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Tap here to check-in now',
                                style: TextStyle(
                                  color: Colors.white84,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 16),
                      ],
                    ),
                  ),
                ),
              ),
              
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
                child: Text(
                  'YOUR ENROLLED COURSES',
                  style: TextStyle(
                    color: Color(0xFF718096),
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                  ),
                ),
              ),
   
              // Courses ListView
              Expanded(
                child: courseProv.isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation(Color(0xFF6C63FF)),
                        ),
                      )
                    : courseProv.courses.isEmpty
                        ? const Center(
                            child: Text(
                              'No courses found.',
                              style: TextStyle(color: Colors.blueGrey),
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
                            itemCount: courseProv.courses.length,
                            itemBuilder: (context, index) {
                              final c = courseProv.courses[index];
                              final isWarning = c.attendancePct < 75.0;
                              
                              Color percentColor = const Color(0xFF4AD66D); // soft success green
                              if (c.attendancePct < 60.0) {
                                percentColor = const Color(0xFFF35B7A); // soft failure red
                              } else if (isWarning) {
                                percentColor = const Color(0xFFFFAA00); // soft warning amber
                              }
   
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 16.0),
                                child: NeumorphicButton(
                                  color: const Color(0xFFF0F4F8),
                                  borderRadius: 20,
                                  padding: const EdgeInsets.all(18),
                                  onPressed: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => CourseDetailScreen(course: c),
                                      ),
                                    );
                                  },
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              c.courseName,
                                              style: const TextStyle(
                                                color: Color(0xFF2D3748),
                                                fontWeight: FontWeight.bold,
                                                fontSize: 16,
                                              ),
                                            ),
                                            const SizedBox(height: 6),
                                            Text(
                                              c.courseCode,
                                              style: const TextStyle(
                                                color: Color(0xFF6C63FF),
                                                fontSize: 12,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            const SizedBox(height: 6),
                                            Text(
                                              'Attended: ${c.presentCount} of ${c.totalSessions} classes',
                                              style: const TextStyle(
                                                color: Colors.blueGrey,
                                                fontSize: 12,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        children: [
                                          Text(
                                            '${c.attendancePct.toStringAsFixed(1)}%',
                                            style: TextStyle(
                                              color: percentColor,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 20,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          if (isWarning)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                              decoration: BoxDecoration(
                                                color: percentColor.withOpacity(0.12),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: Text(
                                                'LOW',
                                                style: TextStyle(
                                                  color: percentColor,
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
