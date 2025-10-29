import { useState } from 'react';
import { Home, Sparkles, User, Settings, Heart } from 'lucide-react';
import { HomeGallery } from './components/HomeGallery';
import { GeneratePage } from './components/GeneratePage';
import { StyleProfile } from './components/StyleProfile';
import { SettingsPage } from './components/SettingsPage';
import { CommandBar } from './components/CommandBar';
import { ConfirmationModal } from './components/ConfirmationModal';
import { mockImages, mockStyleProfile } from './lib/mockData';
import { toast } from 'sonner@2.0.3';
import { Toaster } from './components/ui/sonner';

type Page = 'home' | 'generate' | 'profile' | 'settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [images, setImages] = useState(mockImages);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<{
    userCommand: string;
    interpretation: {
      count: number;
      style?: string;
      garment?: string;
      estimatedTime: string;
    };
  } | null>(null);

  const handleLike = (id: string) => {
    const image = images.find((img) => img.id === id);
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, liked: !img.liked } : img))
    );
    if (image?.liked) {
      toast('Removed from likes', {
        icon: '💔',
      });
    } else {
      toast('Added to likes', {
        icon: '💖',
      });
    }
  };

  const handleDiscard = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    toast.info('Image discarded');
  };

  const handleCommand = (command: string) => {
    // Parse command (simple mock parsing)
    const lowerCommand = command.toLowerCase();
    let count = 50;
    let style: string | undefined;
    let garment: string | undefined;

    // Extract count
    const countMatch = lowerCommand.match(/\d+/);
    if (countMatch) {
      count = parseInt(countMatch[0]);
    }

    // Extract style
    if (lowerCommand.includes('elegant')) style = 'elegant';
    if (lowerCommand.includes('minimalist')) style = 'minimalist';
    if (lowerCommand.includes('casual')) style = 'casual';

    // Extract garment
    if (lowerCommand.includes('dress')) garment = 'dresses';
    if (lowerCommand.includes('blazer')) garment = 'blazers';
    if (lowerCommand.includes('suit')) garment = 'suits';

    // Handle special commands
    if (lowerCommand.includes('show liked')) {
      setCurrentPage('home');
      toast.info('Showing liked images');
      return;
    }

    // Calculate estimated time
    const estimatedTime = count <= 10 ? '1 minute' : count <= 50 ? '5 minutes' : '10 minutes';

    setPendingCommand({
      userCommand: command,
      interpretation: {
        count,
        style,
        garment,
        estimatedTime,
      },
    });
    setShowConfirmation(true);
  };

  const handleGenerate = (count: number, prompt?: string) => {
    const estimatedTime = count <= 10 ? '1 minute' : count <= 50 ? '5 minutes' : '10 minutes';
    
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: `Generating ${count} images...`,
        success: `${count} new images ready!`,
        error: 'Generation failed. Please try again.',
      }
    );

    // Simulate adding new images (in real app, these would come from API)
    setTimeout(() => {
      setCurrentPage('home');
    }, 2000);
  };

  const handleGenerateStyle = (styleName: string) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: `Generating ${styleName} designs...`,
        success: `${styleName} designs ready!`,
        error: 'Generation failed. Please try again.',
      }
    );
    
    setTimeout(() => {
      setCurrentPage('home');
    }, 2000);
  };

  const navItems = [
    { id: 'home' as Page, icon: Home, label: 'Home' },
    { id: 'generate' as Page, icon: Sparkles, label: 'Generate' },
    { id: 'profile' as Page, icon: User, label: 'Style Profile' },
    { id: 'settings' as Page, icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl text-gray-900">Podna</span>
            </div>

            {/* Nav Items */}
            <div className="flex items-center gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    currentPage === item.id
                      ? 'bg-[#000000] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Liked count badge */}
            <div className="flex items-center gap-2">
              {images.filter(img => img.liked).length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ec4899]/10 rounded-full">
                  <Heart className="w-4 h-4 text-[#ec4899] fill-[#ec4899]" />
                  <span className="text-sm text-[#ec4899]">
                    {images.filter(img => img.liked).length}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {currentPage === 'home' && (
          <HomeGallery images={images} onLike={handleLike} onDiscard={handleDiscard} />
        )}
        {currentPage === 'generate' && <GeneratePage onGenerate={handleGenerate} />}
        {currentPage === 'profile' && (
          <StyleProfile profile={mockStyleProfile} onGenerateStyle={handleGenerateStyle} />
        )}
        {currentPage === 'settings' && <SettingsPage />}
      </main>

      {/* Command Bar */}
      <CommandBar onCommand={handleCommand} />

      {/* Confirmation Modal */}
      {pendingCommand && (
        <ConfirmationModal
          open={showConfirmation}
          onClose={() => {
            setShowConfirmation(false);
            setPendingCommand(null);
          }}
          onExecute={() => {
            handleGenerate(pendingCommand.interpretation.count);
            setPendingCommand(null);
          }}
          userCommand={pendingCommand.userCommand}
          interpretation={pendingCommand.interpretation}
        />
      )}

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}
