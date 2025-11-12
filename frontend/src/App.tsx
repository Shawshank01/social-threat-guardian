import { Route, Routes, useLocation } from "react-router-dom";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ThemeToggle from "@/components/ThemeToggle";
import ProtectedRoute from "@/components/ProtectedRoute";
import Home from "@/pages/Home";
import HarassmentNetworks from "@/pages/HarassmentNetworks";
import PersonalMonitors from "@/pages/PersonalMonitors";
import Settings from "@/pages/Settings";
import Articles from "@/pages/Articles";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import About from "@/pages/About";
import Api from "@/pages/Api";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import PostDetail from "@/pages/PostDetail";
import Bookmarks from "@/pages/Bookmarks";

const App = () => {
  const location = useLocation();
  const isHomeRoute = location.pathname === "/";
  const mainClasses = [isHomeRoute ? null : "flex-1", "pt-24", "pb-12", "lg:pb-16"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 transition-colors duration-200 dark:bg-stg-bg dark:text-white">
      <NavBar />
      <main className={mainClasses}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/harassment-networks" element={<HarassmentNetworks />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/posts/:postId" element={<PostDetail />} />
          </Route>
          <Route path="/personal-monitors" element={<PersonalMonitors />} />
          <Route path="/articles" element={<Articles />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/about" element={<About />} />
          <Route path="/api" element={<Api />} />
        </Routes>
      </main>
      <Footer />
      <ThemeToggle />
    </div>
  );
};

export default App;
