import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../models/course.dart';

class CourseDetailScreen extends StatelessWidget {
  final StudentCourse course;

  const CourseDetailScreen({
    super.key,
    required this.course,
  });

  @override
  Widget build(BuildContext context) {
    const double targetPct = 75.0;
    final isWarning = course.attendancePct < targetPct;

    // Build some historical trend coordinates for rendering the fl_chart line.
    // In a production app, this would be fetched from the history endpoint.
    // We mock a realistic trend line based on the student's current percentage.
    final List<FlSpot> spots = [];
    if (course.totalSessions > 0) {
      double current = 100.0;
      spots.add(const FlSpot(0, 100));
      for (int i = 1; i <= course.totalSessions; i++) {
        // Mock a progression towards the final percent
        final factor = i / course.totalSessions;
        final target = course.attendancePct;
        current = current + (target - current) * factor * 0.5;
        spots.add(FlSpot(i.toDouble(), current));
      }
    } else {
      spots.addAll([
        const FlSpot(0, 100),
        const FlSpot(1, 100),
      ]);
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: Text(course.courseCode),
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Course header card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    course.courseName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total Sessions: ${course.totalSessions}',
                        style: const TextStyle(color: Colors.blueGrey, fontSize: 14),
                      ),
                      Text(
                        'Attended: ${course.presentCount}',
                        style: TextStyle(
                          color: Colors.emeraldAccent[400],
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            
            // Attendance Trend Title
            const Text(
              'ATTENDANCE TREND',
              style: TextStyle(
                color: Colors.blueGrey,
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 16),
            
            // Chart Container
            Container(
              height: 260,
              padding: const EdgeInsets.only(right: 20, top: 20, bottom: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(16),
              ),
              child: LineChart(
                LineChartData(
                  gridData: FlGridData(
                    show: true,
                    drawVerticalLine: false,
                    getDrawingHorizontalLine: (value) => FlLine(
                      color: Colors.blueGrey.withOpacity(0.1),
                      strokeWidth: 1,
                    ),
                  ),
                  titlesData: FlTitlesData(
                    show: true,
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    bottomTitles: AxisTitles(
                      axisNameWidget: const Text(
                        'Sessions Conducted',
                        style: TextStyle(color: Colors.blueGrey, fontSize: 10),
                      ),
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 24,
                        interval: 1,
                        getTitlesWidget: (value, meta) {
                          if (value % 2 == 0) {
                            return Text(
                              value.toInt().toString(),
                              style: const TextStyle(color: Colors.blueGrey, fontSize: 10),
                            );
                          }
                          return const Text('');
                        },
                      ),
                    ),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 36,
                        getTitlesWidget: (value, meta) {
                          return Text(
                            '${value.toInt()}%',
                            style: const TextStyle(color: Colors.blueGrey, fontSize: 10),
                          );
                        },
                      ),
                    ),
                  ),
                  borderData: FlBorderData(show: false),
                  minX: 0,
                  maxX: spots.length.toDouble() - 1,
                  minY: 0,
                  maxY: 100,
                  lineBarsData: [
                    // Target Threshold Reference Line (Red/Green boundary)
                    LineChartBarData(
                      spots: [
                        FlSpot(0, targetPct),
                        FlSpot(spots.length.toDouble() - 1, targetPct),
                      ],
                      isCurved: false,
                      color: Colors.redAccent.withOpacity(0.4),
                      strokeWidth: 1.5,
                      dashArray: [5, 5],
                      dotData: const FlDotData(show: false),
                    ),
                    // Real Trend Line
                    LineChartBarData(
                      spots: spots,
                      isCurved: true,
                      color: isWarning ? Colors.orangeAccent : Colors.emeraldAccent[400],
                      barWidth: 4,
                      isStrokeCapRound: true,
                      dotData: const FlDotData(show: true),
                      belowBarData: BarAreaData(
                        show: true,
                        color: (isWarning ? Colors.orangeAccent : Colors.emeraldAccent[400])!.withOpacity(0.1),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            
            // Status / Advisory Board
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isWarning ? Colors.redAccent.withOpacity(0.08) : Colors.emeraldAccent.withOpacity(0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isWarning ? Colors.redAccent.withOpacity(0.2) : Colors.emeraldAccent.withOpacity(0.1),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    isWarning ? Icons.warning_amber_rounded : Icons.check_circle_outline_rounded,
                    color: isWarning ? Colors.orangeAccent : Colors.emeraldAccent[400],
                    size: 28,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isWarning ? 'Attention Required' : 'Status Healthy',
                          style: TextStyle(
                            color: isWarning ? Colors.orangeAccent : Colors.emeraldAccent[400],
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isWarning
                              ? 'Your current attendance is below the college target threshold of 75%. Please ensure you attend the upcoming lectures to avoid administrative alerts.'
                              : 'Keep it up! Your attendance percentage satisfies the academic policy limits.',
                          style: const TextStyle(color: Colors.blueGrey, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
