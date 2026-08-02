import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/session_provider.dart';
import '../models/session.dart';
import '../widgets/neumorphic.dart';

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

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Color(0xFFE8EAF6),
            Color(0xFFF0F4F8),
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text(
            'Session History',
            style: TextStyle(
              color: Color(0xFF2D3748),
              fontWeight: FontWeight.bold,
            ),
          ),
          backgroundColor: Colors.transparent,
          foregroundColor: const Color(0xFF2D3748),
          elevation: 0,
        ),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top Course Title Card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: NeumorphicCard(
                borderRadius: 20,
                padding: const EdgeInsets.all(20),
                child: Text(
                  widget.courseName,
                  style: const TextStyle(
                    color: Color(0xFF2D3748),
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            
            // History list
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation(Color(0xFF6C63FF)),
                      ),
                    )
                  : _history.isEmpty
                      ? const Center(
                          child: Text(
                            'No sessions conducted yet.',
                            style: TextStyle(color: Colors.blueGrey, fontWeight: FontWeight.bold),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                          itemCount: _history.length,
                          itemBuilder: (context, index) {
                            final item = _history[index];
                            final formattedStart = formatter.format(item.startedAt);
                            
                            int total = item.presentCount + item.absentCount;
                            double percent = total > 0 ? (item.presentCount / total) * 100 : 0.0;

                            Color badgeColor = const Color(0xFF4AD66D); // healthy
                            String turnoutStatusText = 'GOOD';
                            if (percent < 60.0) {
                              badgeColor = const Color(0xFFF35B7A); // critical
                              turnoutStatusText = 'LOW';
                            } else if (percent < 75.0) {
                              badgeColor = const Color(0xFFFFAA00); // warning
                              turnoutStatusText = 'ALERT';
                            }

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 16.0),
                              child: NeumorphicCard(
                                borderRadius: 16,
                                padding: const EdgeInsets.all(18.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            formattedStart,
                                            style: const TextStyle(
                                              color: Color(0xFF2D3748),
                                              fontWeight: FontWeight.bold,
                                              fontSize: 15,
                                            ),
                                          ),
                                        ),
                                        if (item.endedAt == null)
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF6C63FF).withOpacity(0.12),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: const Text(
                                              'ACTIVE',
                                              style: TextStyle(
                                                color: Color(0xFF6C63FF),
                                                fontSize: 9,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          'Present: ${item.presentCount} | Absent: ${item.absentCount}',
                                          style: const TextStyle(
                                            color: Colors.blueGrey,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: badgeColor.withOpacity(0.12),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            '${percent.toStringAsFixed(0)}% $turnoutStatusText',
                                            style: TextStyle(
                                              color: badgeColor,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 12,
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
