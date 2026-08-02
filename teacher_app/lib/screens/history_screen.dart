import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/session_provider.dart';
import '../models/session.dart';

class HistoryScreen extends StatefulWidget {
  final String sectionId;
  final String courseName;

  const HistoryScreen({
    super.key,
    required this.sectionId,
    required this.courseName,
  });

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<SessionHistory> _history = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() async {
    final provider = context.read<SessionProvider>();
    final data = await provider.fetchHistory(widget.sectionId);
    setState(() {
      _history = data;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final DateFormat formatter = DateFormat('EEE, MMM d, yyyy - h:mm a');

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Session History'),
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: const Color(0xFF1E293B),
            padding: const EdgeInsets.all(20),
            child: Text(
              widget.courseName,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation(Colors.white),
                    ),
                  )
                : _history.isEmpty
                    ? Center(
                        child: Text(
                          'No sessions conducted yet.',
                          style: TextStyle(color: Colors.blueGrey[400]),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _history.length,
                        itemBuilder: (context, index) {
                          final item = _history[index];
                          final formattedStart = formatter.format(item.startedAt);
                          
                          int total = item.presentCount + item.absentCount;
                          double percent = total > 0 ? (item.presentCount / total) * 100 : 0.0;

                          Color turnoutColor = const Color(0xFF10B981);
                          if (percent < 60.0) {
                            turnoutColor = const Color(0xFFEF4444);
                          } else if (percent < 75.0) {
                            turnoutColor = const Color(0xFFF59E0B);
                          }

                          return Card(
                            color: const Color(0xFF1E293B),
                            margin: const EdgeInsets.only(bottom: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          formattedStart,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15,
                                          ),
                                        ),
                                      ),
                                      if (item.endedAt == null)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: Colors.blueAccent.withOpacity(0.2),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: const Text(
                                            'ACTIVE',
                                            style: TextStyle(
                                              color: Colors.blueAccent,
                                              fontSize: 9,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Present: ${item.presentCount} | Absent: ${item.absentCount}',
                                        style: TextStyle(
                                          color: Colors.blueGrey[300],
                                          fontSize: 13,
                                        ),
                                      ),
                                      Text(
                                        '${percent.toStringAsFixed(0)}% Turnout',
                                        style: TextStyle(
                                          color: turnoutColor,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
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
