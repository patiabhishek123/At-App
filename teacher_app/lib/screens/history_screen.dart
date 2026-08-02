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

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        title: const Text(
          'Session History',
          style: TextStyle(
            color: AppTheme.textDark,
            fontWeight: FontWeight.w900,
          ),
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: AppTheme.textDark,
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
                  color: AppTheme.textDark,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
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
                      valueColor: AlwaysStoppedAnimation(AppTheme.primary),
                    ),
                  )
                : _history.isEmpty
                    ? const Center(
                        child: Text(
                          'No sessions conducted yet.',
                          style: TextStyle(color: AppTheme.textMuted, fontWeight: FontWeight.bold),
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

                          Color badgeColor = AppTheme.success; // healthy
                          String turnoutStatusText = 'GOOD';
                          if (percent < 60.0) {
                            badgeColor = AppTheme.danger; // critical
                            turnoutStatusText = 'LOW';
                          } else if (percent < 75.0) {
                            badgeColor = AppTheme.warning; // warning
                            turnoutStatusText = 'ALERT';
                          }

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12.0),
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
                                            color: AppTheme.textDark,
                                            fontWeight: FontWeight.w800,
                                            fontSize: 15,
                                          ),
                                        ),
                                      ),
                                      if (item.endedAt == null)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: AppTheme.primary.withOpacity(0.12),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: const Text(
                                            'ACTIVE',
                                            style: TextStyle(
                                              color: AppTheme.primary,
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
                                          color: AppTheme.textMuted,
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
    );
  }
}
