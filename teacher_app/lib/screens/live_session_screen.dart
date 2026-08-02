import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';
import '../models/roster.dart';

class LiveSessionScreen extends StatefulWidget {
  final String courseName;
  final String courseCode;

  const LiveSessionScreen({
    super.key,
    required this.courseName,
    required this.courseCode,
  });

  @override
  State<LiveSessionScreen> createState() => _LiveSessionScreenState();
}

class _LiveSessionScreenState extends State<LiveSessionScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SessionProvider>().fetchRoster();
    });
  }

  void _endSession() async {
    final provider = context.read<SessionProvider>();
    try {
      final summary = await provider.endSession();
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            backgroundColor: const Color(0xFF1E293B),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text(
              'Session Ended Summary',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _summaryRow('Present Students', summary.presentCount, Colors.emeraldAccent),
                const SizedBox(height: 8),
                _summaryRow('Absent Students', summary.absentCount, Colors.redAccent),
                const SizedBox(height: 8),
                _summaryRow('Manual Overrides', summary.overrideCount, Colors.blueAccent),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop(); // Dismiss dialog
                  Navigator.of(context).pop(); // Exit screen
                },
                child: const Text(
                  'Back to Schedule',
                  style: TextStyle(color: Colors.emeraldAccent, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  Widget _summaryRow(String label, int value, Color valueColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.blueGrey)),
        Text(
          value.toString(),
          style: TextStyle(color: valueColor, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ],
    );
  }

  void _openOverrideDialog(RosterStudent student) {
    final reasonController = TextEditingController();
    String selectedStatus = student.status.startsWith('overridden_') 
        ? student.status 
        : (student.status == 'present' ? 'overridden_absent' : 'overridden_present');

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: Text(
            'Override for ${student.name}',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: selectedStatus,
                dropdownColor: const Color(0xFF1E293B),
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: 'Override Status',
                  labelStyle: TextStyle(color: Colors.blueGrey),
                ),
                items: const [
                  DropdownMenuItem(
                    value: 'overridden_present',
                    child: Text('Present'),
                  ),
                  DropdownMenuItem(
                    value: 'overridden_absent',
                    child: Text('Absent'),
                  ),
                ],
                onChanged: (val) {
                  if (val != null) {
                    setDialogState(() {
                      selectedStatus = val;
                    });
                  }
                },
              ),
              const SizedBox(height: 16),
              TextField(
                controller: reasonController,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: 'Reason for Override (Required)',
                  labelStyle: TextStyle(color: Colors.blueGrey),
                  focusedBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: Colors.emeraldAccent),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel', style: TextStyle(color: Colors.blueGrey)),
            ),
            ElevatedButton(
              onPressed: () async {
                if (reasonController.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Reason is required')),
                  );
                  return;
                }
                
                final provider = context.read<SessionProvider>();
                try {
                  await provider.submitOverride(
                    student.studentId,
                    selectedStatus,
                    reasonController.text.trim(),
                  );
                  if (mounted) Navigator.of(ctx).pop();
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString()), backgroundColor: Colors.redAccent),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.emeraldAccent[400]),
              child: const Text('Save', style: TextStyle(color: Color(0xFF0F172A))),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final roster = session.roster;
    final presentCount = roster.where((s) => s.status == 'present' || s.status == 'overridden_present').length;

    return WillPopScope(
      onWillPop: () async => false, // Prevent accidental back navigation
      child: Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        appBar: AppBar(
          title: Text(widget.courseCode),
          backgroundColor: const Color(0xFF1E293B),
          foregroundColor: Colors.white,
          automaticallyImplyLeading: false,
          actions: [
            ElevatedButton(
              onPressed: _endSession,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('End Session'),
            ),
            const SizedBox(width: 16),
          ],
        ),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 32),
            Text(
              widget.courseName,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 16),
            ),
            const SizedBox(height: 24),
            
            // Giant Code Container
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 40),
              padding: const EdgeInsets.symmetric(vertical: 36),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.emeraldAccent.withOpacity(0.3), width: 1),
              ),
              child: Column(
                children: [
                  const Text(
                    'STUDENT CHECK-IN CODE',
                    style: TextStyle(
                      color: Colors.blueGrey,
                      fontSize: 12,
                      letterSpacing: 1.5,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    session.activeCode ?? '------',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 64,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 8,
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Countdown Progress
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.timer_outlined, size: 16, color: Colors.emeraldAccent[400]),
                      const SizedBox(width: 8),
                      Text(
                        'Rotating in ${session.codeExpiresIn}s',
                        style: TextStyle(
                          color: Colors.emeraldAccent[400],
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 40),
            
            // Roster Counters Banner
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'LIVE ROSTER',
                    style: TextStyle(
                      color: Colors.white70,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      letterSpacing: 1,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '$presentCount / ${roster.length} Present',
                      style: TextStyle(
                        color: Colors.emeraldAccent[400],
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            
            // Live Student List
            Expanded(
              child: roster.isEmpty
                  ? Center(
                      child: Text(
                        'Waiting for students to join...',
                        style: TextStyle(color: Colors.blueGrey[400]),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0),
                      itemCount: roster.length,
                      itemBuilder: (context, index) {
                        final student = roster[index];
                        final isPresent = student.status == 'present' || student.status == 'overridden_present';
                        final isOverridden = student.status.startsWith('overridden_');
                        
                        Color statusColor = Colors.redAccent;
                        if (isPresent) {
                          statusColor = Colors.emeraldAccent[400]!;
                        } else if (student.status == 'pending') {
                          statusColor = Colors.blueGrey;
                        }

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              // Status dot/indicator
                              Icon(
                                isPresent ? Icons.check_circle : (student.status == 'pending' ? Icons.hourglass_empty : Icons.cancel),
                                color: statusColor,
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      student.name,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    Text(
                                      student.status.toUpperCase(),
                                      style: TextStyle(
                                        color: isOverridden ? Colors.blueAccent : Colors.blueGrey,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.edit, color: Colors.blueGrey),
                                onPressed: () => _openOverrideDialog(student),
                              ),
                            ],
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
