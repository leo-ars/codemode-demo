import { useState, useCallback } from "react";
import { DemoLayout } from "./components/DemoLayout";
import type { ViewMode } from "./types";

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  return (
    <DemoLayout viewMode={viewMode} onViewModeChange={handleViewModeChange} />
  );
}
