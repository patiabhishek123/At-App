import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';
import '../models/roster.dart';

class DashboardScreen extends StatefulWidget {
  final String sectionId;
  final String courseName;

  const DashboardScreen({
    super.key,
    required this.sectionId,
    required this.courseName,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<StudentDashboard> _list = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() async {
    final provider = context.read<SessionProvider>();
    final data = await provider.fetchDashboard(widget.sectionId);
    setState(() {
      _list = data;
      _loading = false;
    });
  }

  void _exportCSV() {
    // Mock export dialog
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Export Attendance', style: TextStyle(color: Colors.white)),
        content: Text(
          'Exporting attendance records for ${widget.courseName} as a CSV spreadsheet.',
          style: const TextStyle(color: Colors.blueGrey),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel', style: TextStyle(color: Colors.blueGrey)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('CSV successfully generated and saved to Downloads'),
                  backgroundColor: Colors.emerald,
                ),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.emeraldAccent[400]),
            child: const Text('Export', style: TextStyle(color: Color(0xFF0F172A))),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Target threshold is 75%
    const double threshold = 75.0;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Course Metrics'),
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.file_download_rounded),
            tooltip: 'Export CSV',
            onPressed: _exportCSV,
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: const Color(0xFF1E293B),
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.courseName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Minimum Attendance Target: ${threshold.toStringAsFixed(0)}%',
                  style: TextStyle(
                    color: Colors.emeraldAccent[400],
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation(Colors.emeraldAccent),
                    ),
                  )
                : _list.isEmpty
                    ? Center(
                        child: Text(
                          'No students enrolled in this section.',
                          style: TextStyle(color: Colors.blueGrey[400]),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _list.length,
                        itemBuilder: (context, index) {
                          final item = _list[index];
                          final isBreached = item.attendancePct < threshold;
                          
                          Color color = Colors.emeraldAccent[400]!;
                          if (item.attendancePct < threshold - 15) {
                            color = Colors.redAccent;
                          } else if (isBreached) {
                            color = Colors.orangeAccent;
                          }

                          return Card(
                            color: const Color(0xFF1E293B),
                            margin: const EdgeInsets.only(bottom: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              title: Text(
                                item.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 4),
                                  Text(item.email, style: const TextStyle(color: Colors.blueGrey, fontSize: 13)),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Attended: ${item.presentCount} of ${item.totalSessions} sessions',
                                    style: const TextStyle(color: Colors.blueGrey, fontSize: 12),
                                  ),
                                ],
                              ),
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '${item.attendancePct.toStringAsFixed(1)}%',
                                    style: TextStyle(
                                      color: color,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  if (isBreached)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.redAccent.withOpacity(0.2),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: const Text(
                                        'WARNING',
                                        style: TextStyle(
                                          color: Colors.redAccent,
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
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
