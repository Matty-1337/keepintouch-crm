"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { CATEGORY_CHART_COLORS } from "@/lib/utils";

interface CategoryData {
  name: string;
  count: number;
}

export function CategoryChart({ data }: { data: CategoryData[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">Categories</h2>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              dataKey="count"
              nameKey="name"
              label={({ name, count }) => `${name} (${count})`}
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={
                    CATEGORY_CHART_COLORS[entry.name] ||
                    CATEGORY_CHART_COLORS[""]
                  }
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(240 10% 3.9%)",
                border: "1px solid hsl(240 3.7% 15.9%)",
                borderRadius: "6px",
                color: "white",
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
