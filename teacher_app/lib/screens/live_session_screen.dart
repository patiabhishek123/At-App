import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';
import '../models/roster.dart';
import '../widgets/neumorphic.dart';

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
            backgroundColor: const Color(0xFFF0F4F8),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            title: const Text(
              'Session Ended Summary',
              style: TextStyle(color: Color(0xFF2D3748), fontWeight: FontWeight.bold),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _summaryRow('Present Students', summary.presentCount, const Color(0xFF4AD66D)),
                const SizedBox(height: 12),
                _summaryRow('Absent Students', summary.absentCount, const Color(0xFFF35B7A)),
                const SizedBox(height: 12),
                _summaryRow('Manual Overrides', summary.overrideCount, const Color(0xFF6C63FF)),
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
                  style: TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.bold),
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
            backgroundColor: const Color(0xFFF35B7A),
          ),
        );
      }
    }
  }

  Widget _summaryRow(String label, int value, Color valueColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Colors.blueGrey,
            fontWeight: FontWeight.w600,
          ),
        ),
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
          backgroundColor: const Color(0xFFF0F4F8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Text(
            'Override for ${student.name}',
            style: const TextStyle(color: Color(0xFF2D3748), fontWeight: FontWeight.bold, fontSize: 18),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: selectedStatus,
                dropdownColor: const Color(0xFFF0F4F8),
                style: const TextStyle(color: Color(0xFF2D3748), fontWeight: FontWeight.w600),
                decoration: const InputDecoration(
                  labelText: 'Override Status',
                  labelStyle: TextStyle(color: Colors.blueGrey, fontWeight: FontWeight.w600),
                  enabledBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: Colors.black12),
                  ),
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
                style: const TextStyle(color: Color(0xFF2D3748)),
                decoration: const InputDecoration(
                  labelText: 'Reason for Override (Required)',
                  labelStyle: TextStyle(color: Colors.blueGrey, fontWeight: FontWeight.w600),
                  enabledBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: Colors.black12),
                  ),
                  focusedBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: Color(0xFF6C63FF)),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel', style: TextStyle(color: Colors.blueGrey, fontWeight: FontWeight.bold)),
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
                    SnackBar(content: Text(e.toString()), backgroundColor: const Color(0xFFF35B7A)),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Save', style: TextStyle(fontWeight: FontWeight.bold)),
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
      child: Container(
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
            title: Text(
              widget.courseCode,
              style: const TextStyle(
                color: Color(0xFF2D3748),
                fontWeight: FontWeight.bold,
              ),
            ),
            backgroundColor: Colors.transparent,
            elevation: 0,
            foregroundColor: const Color(0xFF2D3748),
            automaticallyImplyLeading: false,
            actions: [
              TextButton.icon(
                onPressed: _endSession,
                icon: const Icon(Icons.stop_circle_outlined, color: Color(0xFFF35B7A), size: 20),
                label: const Text(
                  'End Session',
                  style: TextStyle(
                    color: Color(0xFFF35B7A),
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ),
              const SizedBox(width: 16),
            ],
          ),
          body: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              Text(
                widget.courseName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.blueGrey,
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 24),
              
              // Giant Code Container using NeumorphicCard
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: NeumorphicCard(
                  borderRadius: 28,
                  padding: const EdgeInsets.symmetric(vertical: 36),
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
                          color: Color(0xFF6C63FF),
                          fontSize: 60,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 8,
                        ),
                      ),
                      const SizedBox(height: 20),
                      
                      // Countdown Progress
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.timer_outlined, size: 16, color: Colors.blueGrey),
                          const SizedBox(width: 8),
                          Text(
                            'Rotating in ${session.codeExpiresIn}s',
                            style: const TextStyle(
                              color: Colors.blueGrey,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              
              const SizedBox(height: 32),
              
              // Roster Counters Banner
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'LIVE ROSTER',
                      style: TextStyle(
                        color: Color(0xFF2D3748),
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        letterSpacing: 1,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF4AD66D).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '$presentCount / ${roster.length} Present',
                        style: const TextStyle(
                          color: Color(0xFF4AD66D),
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              
              // Live Student List
              Expanded(
                child: roster.isEmpty
                    ? const Center(
                        child: Text(
                          'Waiting for students to join...',
                          style: TextStyle(color: Colors.blueGrey, fontWeight: FontWeight.w500),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 24.0),
                        itemCount: roster.length,
                        itemBuilder: (context, index) {
                          final student = roster[index];
                          final isPresent = student.status == 'present' || student.status == 'overridden_present';
                          final isOverridden = student.status.startsWith('overridden_');
                          
                          Color statusColor = const Color(0xFFF35B7A); // absent
                          if (isPresent) {
                            statusColor = const Color(0xFF4AD66D); // present
                          } else if (student.status == 'pending') {
                            statusColor = Colors.blueGrey;
                          }

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12.0),
                            child: NeumorphicCard(
                              borderRadius: 16,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              child: Row(
                                children: [
                                  Icon(
                                    isPresent ? Icons.check_circle_rounded : (student.status == 'pending' ? Icons.hourglass_empty_rounded : Icons.cancel_rounded),
                                    color: statusColor,
                                    size: 24,
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          student.name,
                                          style: const TextStyle(
                                            color: Color(0xFF2D3748),
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          student.status.toUpperCase(),
                                          style: TextStyle(
                                            color: isOverridden ? const Color(0xFF6C63FF) : Colors.blueGrey,
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.edit_note_rounded, color: Color(0xFF6C63FF), size: 24),
                                    onPressed: () => _openOverrideDialog(student),
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
