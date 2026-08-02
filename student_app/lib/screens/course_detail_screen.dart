import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../models/course.dart';
import '../widgets/neumorphic.dart';

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
    final List<FlSpot> spots = [];
    if (course.totalSessions > 0) {
      double current = 100.0;
      spots.add(const FlSpot(0, 100));
      for (int i = 1; i <= course.totalSessions; i++) {
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
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        title: Text(
          course.courseCode,
          style: const TextStyle(
            color: AppTheme.textDark,
            fontWeight: FontWeight.w900,
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: AppTheme.textDark,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Course header card
            NeumorphicCard(
              borderRadius: 20,
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    course.courseName,
                    style: const TextStyle(
                      color: AppTheme.textDark,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total Sessions: ${course.totalSessions}',
                        style: const TextStyle(
                          color: AppTheme.textMuted,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        'Attended: ${course.presentCount}',
                        style: const TextStyle(
                          color: AppTheme.success,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            
            // Attendance Trend Title
            const Text(
              'ATTENDANCE TREND',
              style: TextStyle(
                color: AppTheme.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 16),
            
            // Chart Container
            NeumorphicCard(
              borderRadius: 20,
              padding: const EdgeInsets.only(right: 20, top: 20, bottom: 10, left: 8),
              child: SizedBox(
                height: 240,
                child: LineChart(
                  LineChartData(
                    gridData: FlGridData(
                      show: true,
                      drawVerticalLine: false,
                      getDrawingHorizontalLine: (value) => FlLine(
                        color: AppTheme.border,
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
                          style: TextStyle(color: AppTheme.textMuted, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 24,
                          interval: 1,
                          getTitlesWidget: (value, meta) {
                            if (value % 2 == 0) {
                              return Text(
                                value.toInt().toString(),
                                style: const TextStyle(color: AppTheme.textMuted, fontSize: 10),
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
                              style: const TextStyle(color: AppTheme.textMuted, fontSize: 10),
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
                      // Target Threshold Reference Line
                      LineChartBarData(
                        spots: [
                          FlSpot(0, targetPct),
                          FlSpot(spots.length.toDouble() - 1, targetPct),
                        ],
                        isCurved: false,
                        color: AppTheme.danger.withOpacity(0.5),
                        barWidth: 1.5,
                        dashArray: [5, 5],
                        dotData: const FlDotData(show: false),
                      ),
                      // Real Trend Line
                      LineChartBarData(
                        spots: spots,
                        isCurved: true,
                        color: isWarning ? AppTheme.warning : AppTheme.primary,
                        barWidth: 4,
                        isStrokeCapRound: true,
                        dotData: const FlDotData(show: true),
                        belowBarData: BarAreaData(
                          show: true,
                          color: (isWarning ? AppTheme.warning : AppTheme.primary).withOpacity(0.08),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 28),
            
            // Status / Advisory Board
            NeumorphicCard(
              borderRadius: 20,
              color: AppTheme.surface,
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  Icon(
                    isWarning ? Icons.warning_amber_rounded : Icons.check_circle_outline_rounded,
                    color: isWarning ? AppTheme.warning : AppTheme.success,
                    size: 32,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isWarning ? 'Attention Required' : 'Status Healthy',
                          style: TextStyle(
                            color: isWarning ? AppTheme.warning : AppTheme.success,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          isWarning
                              ? 'Your current attendance is below the college target threshold of 75%. Please ensure you attend the upcoming lectures to avoid administrative alerts.'
                              : 'Keep it up! Your attendance percentage satisfies the academic policy limits.',
                          style: const TextStyle(
                            color: AppTheme.textMuted,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            height: 1.4,
                          ),
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
