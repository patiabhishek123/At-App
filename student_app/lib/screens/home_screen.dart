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

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        title: const Text(
          'My Attendance',
          style: TextStyle(
            color: AppTheme.textDark,
            fontWeight: FontWeight.w900,
            fontSize: 22,
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: AppTheme.textDark,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppTheme.textDark),
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
        color: AppTheme.primary,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Student Profile & Overall Stats Card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: NeumorphicCard(
                borderRadius: 20,
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                backgroundColor: AppTheme.primary.withOpacity(0.08),
                                radius: 20,
                                child: Text(
                                  auth.currentUser?.name.substring(0, 1).toUpperCase() ?? 'S',
                                  style: const TextStyle(
                                    color: AppTheme.primary,
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
                                        color: AppTheme.textDark,
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    Text(
                                      auth.currentUser?.email ?? '',
                                      style: const TextStyle(
                                        color: AppTheme.textMuted,
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
                            'OVERALL STATUS',
                            style: TextStyle(
                              color: AppTheme.textMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            overallPct >= 75.0 ? 'Good Standing' : 'Below Threshold',
                            style: TextStyle(
                              color: overallPct >= 75.0 ? AppTheme.success : AppTheme.danger,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    // Elegant progress circle indicator
                    NeumorphicCircleProgress(
                      value: overallPct / 100,
                      centerText: '${overallPct.toStringAsFixed(0)}%',
                      labelText: 'Aggregate',
                      size: 100,
                      progressColor: overallPct >= 75.0 ? AppTheme.primary : AppTheme.danger,
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
                    color: AppTheme.accent, // beautiful ochre highlight
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppTheme.primary, width: 1.5),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withOpacity(0.08),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.bolt, color: AppTheme.primary, size: 24),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              'Attendance Session Live',
                              style: TextStyle(
                                color: AppTheme.primary,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Tap here to check-in now',
                              style: TextStyle(
                                color: AppTheme.primary,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, color: AppTheme.primary, size: 16),
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
                  color: AppTheme.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
            ),
 
            // Courses ListView
            Expanded(
              child: courseProv.isLoading
                  ? const Center(
                      child: CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation(AppTheme.primary),
                      ),
                    )
                  : courseProv.courses.isEmpty
                      ? const Center(
                          child: Text(
                            'No courses found.',
                            style: TextStyle(color: AppTheme.textMuted, fontWeight: FontWeight.w600),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
                          itemCount: courseProv.courses.length,
                          itemBuilder: (context, index) {
                            final c = courseProv.courses[index];
                            final isWarning = c.attendancePct < 75.0;
                            
                            Color percentColor = AppTheme.success;
                            if (c.attendancePct < 60.0) {
                              percentColor = AppTheme.danger;
                            } else if (isWarning) {
                              percentColor = AppTheme.warning;
                            }
 
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12.0),
                              child: NeumorphicButton(
                                color: AppTheme.surface,
                                borderRadius: 16,
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
                                              color: AppTheme.textDark,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 16,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            c.courseCode,
                                            style: const TextStyle(
                                              color: AppTheme.textMuted,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            'Attended: ${c.presentCount} of ${c.totalSessions} classes',
                                            style: const TextStyle(
                                              color: AppTheme.textMuted,
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
                                            fontWeight: FontWeight.w900,
                                            fontSize: 20,
                                            fontFamily: 'monospace',
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
    );
  }
}
