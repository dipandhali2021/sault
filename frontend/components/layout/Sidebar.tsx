import { useState } from "react";
import SharedDocs from "../Share";
import {
  LayoutDashboard,
  Grid,
  Share2,
  Menu,
  MessageSquare,
} from "lucide-react";
import { IoAnalytics } from "react-icons/io5";
import { Dialog, DialogContent } from "../ui/dialog";
import DocumentCategories from "../Category";
import ChatWithDocs from "../Chat";
import { Analytics } from "../Analytics";

const ACTIVE_TAB_STYLES = "bg-gradient-to-r from-blue-500/20 to-blue-500/10 border-l-2 border-blue-500 text-blue-700";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  isMobile: boolean;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  isMobile,
}: SidebarProps) {
  const [isSharedDocsOpen, setIsSharedDocsOpen] = useState(false);
  const [isCategorizeOpen, setIsCategorizeOpen] = useState(false);
  const [isDocumentOpen, setIsDocumentOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const navigationItems = [
    { id: "dashboard", icon: <LayoutDashboard className="w-5 h-5" />, label: "Dashboard" },
    { id: "analytics", icon: <IoAnalytics className="w-5 h-5" />, label: "Analytics", onClick: () => setIsDocumentOpen(true) },
    { id: "Categorized", icon: <Grid className="w-5 h-5" />, label: "Categorized", onClick: () => setIsCategorizeOpen(true) },
    { id: "Shared", icon: <Share2 className="w-5 h-5" />, label: "Shared", onClick: () => setIsSharedDocsOpen(true) },
    { id: "chat", icon: <MessageSquare className="w-5 h-5" />, label: "Chat Assistant", onClick: () => setIsChatOpen(true) },
  ];

  return (
    <>
      <div
        className={`${isMobile ? "fixed" : "relative"} z-20 transition-all duration-300 flex flex-col ${
          isSidebarCollapsed ? "w-16" : "w-64"
        } h-full border-r border-gray-200 bg-white shadow-sm`}
      >
        {/* Logo/Header */}
        <div className="px-4 py-6">
          <div className="flex items-center justify-between">
            {!isSidebarCollapsed && (
              <h2 className="text-4xl font-bold flex items-center text-gray-800">
                <img src="/logo.png" alt="Logo" className="w-14 h-13 mr-2" />
                SAULT
              </h2>
            )}
            {isMobile && (
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.onClick) item.onClick();
              }}
              className={`w-full rounded-lg transition-all duration-200 flex items-center ${
                isSidebarCollapsed ? "justify-center p-3" : "px-4 py-2 space-x-3"
              } ${activeTab === item.id ? ACTIVE_TAB_STYLES : "text-gray-600 hover:text-blue-600 hover:bg-gray-100"}`}
            >
              {item.icon}
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Mobile Overlay */}
      {isMobile && !isSidebarCollapsed && (
        <div className="fixed inset-0 bg-black/50 z-10" onClick={() => setIsSidebarCollapsed(true)} />
      )}

      {/* Categorize Dialog */}
      <Dialog open={isCategorizeOpen} onOpenChange={setIsCategorizeOpen}>
        <DialogContent className="max-w-7xl w-[90vw] h-[90vh] p-0">
          <DocumentCategories />
        </DialogContent>
      </Dialog>

      {/* Chat Dialog */}
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="max-w-4xl w-[90vw] h-[90vh] p-0">
          <ChatWithDocs isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Shared Docs Dialog */}
      <Dialog open={isSharedDocsOpen} onOpenChange={setIsSharedDocsOpen}>
        <DialogContent className="max-w-7xl w-[90vw] h-[90vh] p-0">
          <SharedDocs isOpen={isSharedDocsOpen} onClose={() => setIsSharedDocsOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isDocumentOpen} onOpenChange={setIsDocumentOpen}>
        <DialogContent className="max-w-7xl w-[90vw] h-[90vh] p-0">
            <Analytics isOpen={isDocumentOpen} onClose={() => setIsDocumentOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}