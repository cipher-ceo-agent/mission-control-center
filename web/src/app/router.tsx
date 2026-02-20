import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { OverviewPage } from "../plugins/overview/OverviewPage";
import { CalendarPage } from "../plugins/calendar/CalendarPage";
import { MemoryPage } from "../plugins/memory/MemoryPage";
import { TasksPage } from "../plugins/tasks/TasksPage";
import { SkillsPage } from "../plugins/skills/SkillsPage";
import { ActivityPage } from "../plugins/activity/ActivityPage";
import { StatsPage } from "../plugins/stats/StatsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "memory", element: <MemoryPage /> },
      { path: "tasks", element: <TasksPage /> },
      { path: "skills", element: <SkillsPage /> },
      { path: "activity", element: <ActivityPage /> },
      { path: "stats", element: <StatsPage /> }
    ]
  }
]);
