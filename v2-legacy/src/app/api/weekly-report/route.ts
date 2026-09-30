import { NextRequest } from "next/server";

interface WeeklyReportPayload {
  period: { start: string; end: string; type: "week" | "month" };
  stats: {
    totalMinutes: number;
    totalSessions: number;
    completedSessions: number;
    averageSessionMinutes: number;
    completionRate: number;
    bestDay: { date: string; minutes: number } | null;
    dailyBreakdown: { date: string; minutes: number; sessions: number }[];
    hourlyPeak: { hour: number; minutes: number } | null;
  };
}

function generateReportContent(payload: WeeklyReportPayload): string {
  const { period, stats } = payload;
  const periodLabel = period.type === "week" ? "本周" : "本月";
  const hours = Math.floor(stats.totalMinutes / 60);
  const remain = stats.totalMinutes % 60;

  const hasData = stats.totalSessions > 0;

  let report = `## ${periodLabel}专注复盘\n\n`;

  if (!hasData) {
    report += `${periodLabel}暂无专注记录。开启一段专注旅程，让数据见证你的成长！\n\n`;
    report += `> 💡 小建议：每天 25 分钟专注就足够开始改变。\n`;
    return report;
  }

  report += `### 📊 总体概览\n\n`;
  report += `${periodLabel}你累计专注了 **${hours} 小时 ${remain} 分钟**，共完成 **${stats.totalSessions}** 次专注时段。\n\n`;

  if (stats.completedSessions > 0) {
    report += `其中 **${stats.completedSessions}** 次完整完成，`;
  }
  report += `完成率达到 **${stats.completionRate}%**，平均每次专注 **${stats.averageSessionMinutes}** 分钟。\n\n`;

  if (stats.bestDay) {
    const bestDate = new Date(stats.bestDay.date);
    const bestDayLabel = `${bestDate.getMonth() + 1}月${bestDate.getDate()}日`;
    const bestHours = Math.floor(stats.bestDay.minutes / 60);
    const bestRemain = stats.bestDay.minutes % 60;
    report += `### 🏆 最佳表现\n\n`;
    report += `表现最好的一天是 **${bestDayLabel}**，当天专注了 **${bestHours} 小时 ${bestRemain} 分钟**！\n\n`;
  }

  if (stats.hourlyPeak && stats.hourlyPeak.minutes > 0) {
    report += `### ⏰ 高峰时段\n\n`;
    report += `你的专注高峰在 **${stats.hourlyPeak.hour}:00** 左右，平均专注 ${Math.round(stats.hourlyPeak.minutes)} 分钟。`;
    if (stats.hourlyPeak.hour >= 6 && stats.hourlyPeak.hour < 10) {
      report += `晨间是你的黄金专注期！\n\n`;
    } else if (stats.hourlyPeak.hour >= 10 && stats.hourlyPeak.hour < 14) {
      report += `上午到午间是你的高效时段。\n\n`;
    } else if (stats.hourlyPeak.hour >= 14 && stats.hourlyPeak.hour < 18) {
      report += `下午是你集中精力的好时候。\n\n`;
    } else if (stats.hourlyPeak.hour >= 18 && stats.hourlyPeak.hour < 22) {
      report += `晚间是你安静思考的时段。\n\n`;
    } else {
      report += `夜深人静时你最专注。注意保证睡眠哦！\n\n`;
    }
  }

  report += `### 💡 改进建议\n\n`;

  if (stats.averageSessionMinutes < 25) {
    report += `- 📌 平均每次专注时间较短，试试用番茄钟法（25分钟专注+5分钟休息）延长单次时长\n`;
  }
  if (stats.completionRate < 70) {
    report += `- 🎯 完成率偏低，建议减少单次计划时长，先建立完成习惯\n`;
  }
  if (stats.completionRate >= 80) {
    report += `- 🌟 完成率很不错！可以在舒适区外适当增加挑战时长\n`;
  }

  const activeDays = stats.dailyBreakdown.filter((d) => d.minutes > 0).length;
  const totalDays = stats.dailyBreakdown.length;
  if (activeDays < totalDays * 0.5) {
    report += `- 📅 专注天数偏少，试着每天至少安排一次专注，持续比强度更重要\n`;
  }

  const totalActiveMinutes = stats.dailyBreakdown.reduce((sum, d) => sum + d.minutes, 0);
  if (period.type === "week" && totalActiveMinutes < 150) {
    report += `- 🏃 每周专注时间较少，建议逐步提升到 150 分钟以上\n`;
  }

  report += `\n> 🌱 持续比强度更重要。每天进步一点点，长期积累会有惊人效果。\n`;

  return report;
}

function streamText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < text.length; i++) {
        const chunk = text[i];
        controller.enqueue(encoder.encode(chunk));
        await new Promise((resolve) => setTimeout(resolve, 15 + Math.random() * 15));
      }
      controller.close();
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload: WeeklyReportPayload = await request.json();

    if (!payload.stats) {
      return new Response(JSON.stringify({ error: "Missing stats data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const content = generateReportContent(payload);

    return new Response(streamText(content), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
