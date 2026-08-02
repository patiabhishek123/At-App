import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/session_provider.dart';
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
            backgroundColor: Colors.redAccent,
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
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Today\'s Schedule'),
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Logout',
            onPressed: _logout,
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Profile
          Container(
            padding: const EdgeInsets.all(20.0),
            color: const Color(0xFF1E293B),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: Colors.emeraldAccent[400],
                  radius: 24,
                  child: Text(
                    auth.currentUser?.name.substring(0, 1).toUpperCase() ?? 'T',
                    style: const TextStyle(
                      color: Color(0xFF0F172A),
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
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        auth.currentUser?.email ?? '',
                        style: TextStyle(
                          color: Colors.blueGrey[300],
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 12),

          // Sections List
          Expanded(
            child: session.isLoading
                ? const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation(Colors.emeraldAccent),
                    ),
                  )
                : session.sections.isEmpty
                    ? Center(
                        child: Text(
                          'No courses assigned for this term.',
                          style: TextStyle(color: Colors.blueGrey[400], fontSize: 15),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                        itemCount: session.sections.length,
                        itemBuilder: (context, index) {
                          final sec = session.sections[index];
                          return Card(
                            color: const Color(0xFF1E293B),
                            margin: const EdgeInsets.only(bottom: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(18.0),
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
                                            color: Colors.white,
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF0F172A),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          sec.courseCode,
                                          style: TextStyle(
                                            color: Colors.emeraldAccent[400],
                                            fontWeight: FontWeight.bold,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Term: ${sec.term}',
                                    style: TextStyle(
                                      color: Colors.blueGrey[300],
                                      fontSize: 14,
                                    ),
                                  ),
                                  if (sec.classroomBssid != null) ...[
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        const Icon(Icons.wifi, size: 14, color: Colors.blueGrey),
                                        const SizedBox(width: 6),
                                        Text(
                                          'BSSID: ${sec.classroomBssid}',
                                          style: const TextStyle(
                                            color: Colors.blueGrey,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                  const SizedBox(height: 18),
                                  
                                  // Actions
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      // Dashboard Button
                                      OutlinedButton.icon(
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
                                        icon: const Icon(Icons.analytics_outlined, size: 16),
                                        label: const Text('Metrics'),
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: Colors.blueAccent[200],
                                          side: BorderSide(color: Colors.blueAccent[200]!),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                        ),
                                      ),
                                      
                                      // History Button
                                      OutlinedButton.icon(
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
                                        icon: const Icon(Icons.history_toggle_off, size: 16),
                                        label: const Text('History'),
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: Colors.purpleAccent[200],
                                          side: BorderSide(color: Colors.purpleAccent[200]!),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                        ),
                                      ),
                                      
                                      // Start Button
                                      ElevatedButton(
                                        onPressed: () => _startAttendance(sec.sectionId, sec.courseName, sec.courseCode),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: Colors.emeraldAccent[400],
                                          foregroundColor: const Color(0xFF0F172A),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                        ),
                                        child: const Text('Start'),
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
