import { Route, Routes } from "react-router-dom";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import HarassmentNetworks from "@/pages/HarassmentNetworks";
import DoxxingMultilingual from "@/pages/DoxxingMultilingual";
import Monitors from "@/pages/Monitors";
import Settings from "@/pages/Settings";
import Articles from "@/pages/Articles";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import About from "@/pages/About";
import Api from "@/pages/Api";

const App = () => {
  return (
    <div className="flex min-h-screen flex-col bg-stg-bg text-white">
      <NavBar />
      <main className="flex-1 pb-24 pt-24">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/harassment-networks" element={<HarassmentNetworks />} />
          <Route path="/doxxing" element={<DoxxingMultilingual />} />
          <Route path="/monitors" element={<Monitors />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/articles" element={<Articles />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/about" element={<About />} />
          <Route path="/api" element={<Api />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export default App;
