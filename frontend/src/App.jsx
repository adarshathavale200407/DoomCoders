import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import ComingSoon from "./pages/ComingSoon.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Home from "./pages/Home.jsx";
import IssueDetail from "./pages/IssueDetail.jsx";
import Issues from "./pages/Issues.jsx";
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

        {/* Replaced step by step */}
        <Route path="manage" element={
          <ProtectedRoute roles={["admin", "team"]}><ComingSoon title="Management console" step={8} /></ProtectedRoute>
        } />
        <Route path="*" element={<ComingSoon title="Page not found" step="–" />} />
      </Route>
    </Routes>
  );
}
