export type UiPluginManifest = {
  id: string;
  route: string;
  title: string;
  mvp: boolean;
};

export const uiPlugins: UiPluginManifest[] = [
  { id: "overview", route: "/", title: "Overview", mvp: true },
  { id: "calendar", route: "/calendar", title: "Calendar", mvp: true },
  { id: "memory", route: "/memory", title: "Memory", mvp: true },
  { id: "tasks", route: "/tasks", title: "Tasks", mvp: false },
  { id: "skills", route: "/skills", title: "Skills", mvp: false },
  { id: "activity", route: "/activity", title: "Activity", mvp: false },
  { id: "stats", route: "/stats", title: "Stats", mvp: false }
];
