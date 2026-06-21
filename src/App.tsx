import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Matches from "./pages/Matches";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import AdminChannels from "./pages/admin/AdminChannels";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminMatches from "./pages/admin/AdminMatches";
import AdminSliders from "./pages/admin/AdminSliders";
import AdminRadio from "./pages/admin/AdminRadio";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminGlobalConfig from "./pages/admin/AdminGlobalConfig";
import ChannelPlayer from "./pages/ChannelPlayer";
import CategoryChannels from "./pages/CategoryChannels";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/channels" element={<AdminChannels />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/matches" element={<AdminMatches />} />
            <Route path="/admin/sliders" element={<AdminSliders />} />
            <Route path="/admin/radio" element={<AdminRadio />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/admin/config" element={<AdminGlobalConfig />} />
            <Route path="/channel/:id" element={<ChannelPlayer />} />
            <Route path="/category/:id" element={<CategoryChannels />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
