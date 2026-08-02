import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/session_provider.dart';
import '../widgets/neumorphic.dart';
import 'login_screen.dart';
import 'live_session_screen.dart';
import 'dashboard_screen.dart';
import 'history_screen.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SessionProvider>().fetchSections();
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

  void _startAttendance(String sectionId, String courseName, String courseCode) async {
    final provider = context.read<SessionProvider>();
    try {
      await provider.startSession(sectionId);
      if (mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => LiveSessionScreen(
              courseName: courseName,
              courseCode: courseCode,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: const Color(0xFFF35B7A), // soft pinkish red
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final session = context.watch<SessionProvider>();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        title: const Text(
          "Today's Schedule",
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
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Profile Card
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: NeumorphicCard(
              borderRadius: 20,
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppTheme.primary.withOpacity(0.08),
                    radius: 24,
                    child: Text(
                      auth.currentUser?.name.substring(0, 1).toUpperCase() ?? 'T',
                      style: const TextStyle(
                        color: AppTheme.primary,
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Welcome, ${auth.currentUser?.name ?? 'Teacher'}',
                          style: const TextStyle(
                            color: AppTheme.textDark,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          auth.currentUser?.email ?? '',
                          style: const TextStyle(
                            color: AppTheme.textMuted,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          const SizedBox(height: 8),

          // Assigned Sections List
          Expanded(
            child: session.isLoading
                ? const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation(AppTheme.primary),
                    ),
                  )
                : session.sections.isEmpty
                    ? const Center(
                        child: Text(
                          'No courses assigned for this term.',
                          style: TextStyle(color: AppTheme.textMuted, fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                        itemCount: session.sections.length,
                        itemBuilder: (context, index) {
                          final sec = session.sections[index];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            child: NeumorphicCard(
                              borderRadius: 20,
                              padding: const EdgeInsets.all(20.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          sec.courseName,
                                          style: const TextStyle(
                                            color: AppTheme.textDark,
                                            fontSize: 18,
                                            fontWeight: FontWeight.w800,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: AppTheme.primary.withOpacity(0.08),
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                        child: Text(
                                          sec.courseCode,
                                          style: const TextStyle(
                                            color: AppTheme.primary,
                                            fontWeight: FontWeight.w800,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Term: ${sec.term}',
                                    style: const TextStyle(
                                      color: AppTheme.textMuted,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if (sec.classroomBssid != null) ...[
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        const Icon(Icons.wifi_tethering_rounded, size: 16, color: AppTheme.textMuted),
                                        const SizedBox(width: 6),
                                        Text(
                                          'BSSID: ${sec.classroomBssid}',
                                          style: const TextStyle(
                                            color: AppTheme.textMuted,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                  const SizedBox(height: 24),
                                  
                                  // Action buttons row
                                  Row(
                                    children: [
                                      // Metrics Button
                                      Expanded(
                                        child: NeumorphicButton(
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                          borderRadius: 12,
                                          color: AppTheme.surface,
                                          onPressed: () {
                                            Navigator.of(context).push(
                                              MaterialPageRoute(
                                                builder: (_) => DashboardScreen(
                                                  sectionId: sec.sectionId,
                                                  courseName: sec.courseName,
                                                ),
                                              ),
                                            );
                                          },
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: const [
                                              Icon(Icons.analytics_outlined, size: 16, color: AppTheme.primary),
                                              SizedBox(width: 6),
                                              Text(
                                                'Metrics',
                                                style: TextStyle(
                                                  color: AppTheme.textDark,
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      
                                      // History Button
                                      Expanded(
                                        child: NeumorphicButton(
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                          borderRadius: 12,
                                          color: AppTheme.surface,
                                          onPressed: () {
                                            Navigator.of(context).push(
                                              MaterialPageRoute(
                                                builder: (_) => HistoryScreen(
                                                  sectionId: sec.sectionId,
                                                  courseName: sec.courseName,
                                                ),
                                              ),
                                            );
                                          },
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: const [
                                              Icon(Icons.history_toggle_off, size: 16, color: AppTheme.primary),
                                              SizedBox(width: 6),
                                              Text(
                                                'History',
                                                style: TextStyle(
                                                  color: AppTheme.textDark,
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      
                                      // Start Button
                                      Expanded(
                                        child: NeumorphicButton(
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                          borderRadius: 12,
                                          color: AppTheme.primary,
                                          onPressed: () => _startAttendance(sec.sectionId, sec.courseName, sec.courseCode),
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: const [
                                              Icon(Icons.play_arrow_rounded, size: 16, color: Colors.white),
                                              SizedBox(width: 4),
                                              Text(
                                                'Start',
                                                style: TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ],
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
    );
  }
}
