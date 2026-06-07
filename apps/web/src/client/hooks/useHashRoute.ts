import { useEffect, useState } from "react";
import { type DashboardRoute, isDashboardRoute } from "../dashboard/navigation.js";

function getCurrentRoute(): DashboardRoute {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return isDashboardRoute(hash) ? hash : "overview";
}

export function useHashRoute(): [DashboardRoute, (route: DashboardRoute) => void] {
  const [route, setRoute] = useState<DashboardRoute>(() => getCurrentRoute());

  useEffect(() => {
    const handleChange = () => setRoute(getCurrentRoute());
    window.addEventListener("hashchange", handleChange);
    return () => window.removeEventListener("hashchange", handleChange);
  }, []);

  function navigate(nextRoute: DashboardRoute): void {
    if (window.location.hash === `#/${nextRoute}`) {
      setRoute(nextRoute);
      return;
    }
    window.location.hash = `/${nextRoute}`;
  }

  return [route, navigate];
}
