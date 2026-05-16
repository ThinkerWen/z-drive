import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface TrendPoint {
  date: string;
  views: number;
  downloads: number;
}

const chartConfig = {
  views: {
    label: "浏览",
    color: "hsl(var(--chart-1))",
  },
  downloads: {
    label: "下载",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

function toDateOnly(dateText: string): string {
  return dateText.slice(0, 10);
}

function buildLast14DaysSeries(data: TrendPoint[]) {
  const byDate = new Map<string, TrendPoint>();
  data.forEach((item) => {
    byDate.set(toDateOnly(item.date), {
      date: toDateOnly(item.date),
      views: item.views ?? 0,
      downloads: item.downloads ?? 0,
    });
  });

  const result: Array<TrendPoint & { shortDate: string }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 13; offset >= 0; offset -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    const found = byDate.get(key);

    result.push({
      date: key,
      shortDate: `${mm}/${dd}`,
      views: found?.views ?? 0,
      downloads: found?.downloads ?? 0,
    });
  }

  return result;
}

export function TrendLineChart({ data }: { data: TrendPoint[] }) {
  const chartData = buildLast14DaysSeries(data);

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-full">
      <LineChart
        data={chartData}
        margin={{ top: 12, right: 10, bottom: 4, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="shortDate" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="views"
          name="浏览"
          stroke="var(--color-views)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="downloads"
          name="下载"
          stroke="var(--color-downloads)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
