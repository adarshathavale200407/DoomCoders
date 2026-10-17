import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import ComingSoon from "./pages/ComingSoon.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Home from "./pages/Home.jsx";
import IssueDetail from "./pages/IssueDetail.jsx";
import Issues from "./pages/Issues.jsx";
import Manage from "./pages/Manage.jsx";
import NearbyMap from "./pages/NearbyMap.jsx";
import ReportIssue from "./pages/ReportIssue.jsx";
import Stats from "./pages/Stats.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="issues" element={<Issues />} />
        <Route path="issues/:id" element={<IssueDetail />} />
        <Route path="map" element={<NearbyMap />} />
        <Route path="stats" element={<Stats />} />
        <Route path="report" element={
          <ProtectedRoute roles={["citizen"]}><ReportIssue /></ProtectedRoute>
        } />
        <Route path="dashboard" element={
          <ProtectedRoute roles={["citizen"]}><Dashboard /></ProtectedRoute>
        } />

        {/* Staff console (step 8) */}
        <Route path="manage" element={
          <ProtectedRoute roles={["admin", "team"]}><Manage /></ProtectedRoute>
        } />
        <Route path="*" element={<ComingSoon title="Page not found" step="–" />} />
      </Route>
    </Routes>
  );
}
