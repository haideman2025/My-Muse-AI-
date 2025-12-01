


import React, { useState, useRef, useEffect, useContext } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CharacterProfile, WardrobeItem, GalleryImage, Lookbook } from '../types';
import { chatWithCharacter, generateCharacterImage, generateSceneConcept, extractOutfitFromImage } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import InteractiveSpace from './PhotoStoryCreator';
import CharacterGalleryModal from './CharacterGalleryModal';
import PoseSelectionModal from './PoseSelectionModal';
import BackgroundSelectionModal from './BackgroundSelectionModal';
import OutfitSelectionModal from './OutfitSelectionModal';
import { usePreview } from './PreviewContext';
import { SubscriptionContext } from '../App'; // Import Context

// --- SVG Icons ---
const IconMagicWand = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>;
const IconChatHeart = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1z" /></svg>;
const IconPaperPlane = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>;
const IconCamera = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>;
const IconBookOpen = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 16c1.255 0 2.443-.29 3.5-.804V4.804zM14.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 0114.5 16c1.255 0 2.443-.29 3.5-.804v-10A7.968 7.968 0 0014.5 4z" /></svg>;
const IconSparkles = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.934L13.033 17.256A1 1 0 0112 18V2z" clipRule="evenodd" /></svg>;
const IconWardrobe = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435A1 1 0 018.847 8H11a1 1 0 011 1v5H8a1 1 0 01-1-1V9a1 1 0 01-1-1H4a1 1 0 01-1-1V3z" /><path d="M12 9a1 1 0 011-1h3a1 1 0 011 1v5a1 1 0 01-1 1h-3a1 1 0 01-1-1V9z" /></svg>;

interface StoryStudioProps {
  character: CharacterProfile;
  allCharacters: CharacterProfile[];
  onUpdate: (updatedCharacter: CharacterProfile) => void;
  onBack: () => void;
}

interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
    imageUrl?: string;
    isGeneratingImage?: boolean;
    suggestions?: string[]; // New: Contextual Suggestions
}

interface UploadedOutfit {
  previewUrl: string;
  base64: string;
  file: File;
  analyzedData?: {
    name: string;
    masterPrompt: string;
  };
}

type StudioSelection = { name: string; prompt: string | null; };

const CAMERA_ANGLE_OPTIONS: (StudioSelection & { icon: string })[] = [
  { name: 'Tự động (Đa dạng)', prompt: null, icon: '✨' },
  { name: 'Toàn thân', prompt: 'full body shot, cinematic wide angle', icon: '💃' },
  { name: 'Trung cảnh', prompt: 'medium shot, waist up', icon: '🧍‍♀️' },
  { name: 'Cận mặt', prompt: 'close-up portrait, head and shoulders shot', icon: '👤' },
  { name: 'Sát mặt', prompt: 'extreme close-up face shot', icon: '👩' },
  { name: 'Góc thấp', prompt: 'dynamic low-angle shot', icon: '🔼' },
  { name: 'Góc cao', prompt: 'high-angle shot', icon: '🔽' },
];

const MAKEUP_OPTIONS: StudioSelection[] = [
    { name: 'Mặt Mộc', prompt: 'barefaced, no makeup' },
    { name: 'Tự Nhiên', prompt: 'wearing natural, subtle makeup with a nude lip' },
    { name: 'Mắt Khói', prompt: 'wearing dramatic smoky eyeshadow and a nude lip' },
    { name: 'Quyến Rũ', prompt: 'wearing glamorous makeup with bold red lipstick and winged eyeliner' },
    { name: 'Gothic', prompt: 'wearing gothic makeup with dark lipstick and heavy eyeliner' },
];

const getLatestImageUrl = (character: CharacterProfile): string | undefined => {
    const singleImages = character.singleImages || [];
    if (singleImages.length === 0) return undefined;
    const latestSingle = singleImages.sort((a, b) => b.createdAt - a.createdAt)[0];
    return latestSingle.url;
};

const StoryStudio: React.FC<StoryStudioProps> = ({ character, allCharacters, onUpdate, onBack }) => {
  const [activeView, setActiveView] = useState<'studio' | 'interactive_space'>('studio');
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [isPoseModalOpen, setPoseModalOpen] = useState(false);
  const [isBackgroundModalOpen, setBackgroundModalOpen] = useState(false);
  const [isOutfitModalOpen, setIsOutfitModalOpen] = useState(false);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const [numberOfImages, setNumberOfImages] = useState(4);

  // New layered state for AI Workshop selections
  const [selectedMakeup, setSelectedMakeup] = useState<StudioSelection>(MAKEUP_OPTIONS[0]);
  const [customMakeupPrompt, setCustomMakeupPrompt] = useState('');
  const [selectedOutfit, setSelectedOutfit] = useState<StudioSelection | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<StudioSelection | null>(null);
  const [customBackgroundPrompt, setCustomBackgroundPrompt] = useState('');
  const [selectedPose, setSelectedPose] = useState<StudioSelection | null>(null);
  const [selectedCameraAngle, setSelectedCameraAngle] = useState<StudioSelection>(CAMERA_ANGLE_OPTIONS[0]);
  
  const [uploadedOutfit, setUploadedOutfit] = useState<UploadedOutfit | null>(null);
  const [isAnalyzingOutfit, setIsAnalyzingOutfit] = useState(false);
  const outfitFileInputRef = useRef<HTMLInputElement>(null);
  const { showPreview } = usePreview();
  const subContext = useContext(SubscriptionContext); // Consumption of Subscription

  const [isSuggesting, setIsSuggesting] = useState(false);
  

  const latestImageUrl = getLatestImageUrl(character);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  const handleSendMessage = async (inputOverride?: string) => {
    const messageToSend = inputOverride || userInput;
    if (!messageToSend.trim()) return;

    const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: messageToSend }] };
    const currentChatHistory = [...chatHistory, newUserMessage];
    setChatHistory(currentChatHistory);
    
    setUserInput('');
    setIsChatLoading(true);
    setChatError(null);
    try {
        const modelResponse = await chatWithCharacter(character, chatHistory, messageToSend);
        
        const newModelMessage: ChatMessage = { 
            role: 'model', 
            parts: [{ text: modelResponse.textResponse }], 
            isGeneratingImage: !!modelResponse.imagePrompt,
            suggestions: modelResponse.suggestions // Capture suggestions
        };
        setChatHistory([...currentChatHistory, newModelMessage]);

        if (modelResponse.imagePrompt) {
            // CHECK SUBSCRIPTION BEFORE GENERATING
            if (subContext && !subContext.checkAndIncrement()) {
                 setChatHistory(prev => prev.map(msg => msg === newModelMessage ? { ...msg, isGeneratingImage: false, parts: [{text: `${msg.parts[0].text}\n\n(Hết lượt tạo ảnh. Vui lòng nâng cấp gói để tiếp tục nhìn thấy em.)`}] } : msg ));
                 return;
            }

            // Hiển thị trạng thái đang tạo ảnh
            setLoadingMessage("Muse đang chụp ảnh mới gửi bạn...");
            setIsImageLoading(true);

            const imageBase64Array = await generateCharacterImage(character, { backgroundPrompt: modelResponse.imagePrompt });
            if (imageBase64Array.length > 0) {
                const newImage: GalleryImage = { id: uuidv4(), url: `data:image/jpeg;base64,${imageBase64Array[0]}`, createdAt: Date.now(), prompt: modelResponse.imagePrompt };
                
                // Cập nhật chat history với ảnh thumbnail nhỏ
                setChatHistory(prev => prev.map(msg => msg === newModelMessage ? { ...msg, imageUrl: newImage.url, isGeneratingImage: false } : msg));
                
                // QUAN TRỌNG: Cập nhật state nhân vật ngay lập tức để ảnh LỚN bên trái tự động đổi
                onUpdate({ ...character, singleImages: [newImage, ...(character.singleImages || [])] });
            } else {
                 setChatHistory(prev => prev.map(msg => msg === newModelMessage ? { ...msg, isGeneratingImage: false, parts: [{text: `${msg.parts[0].text}\n\n(Em xin lỗi, em không thể tạo ảnh lúc này.)`}] } : msg ));
            }
            setIsImageLoading(false);
        }
    } catch (err) {
        setChatError('Đã có lỗi xảy ra. Vui lòng thử lại.'); console.error(err); setChatHistory(chatHistory);
        setIsImageLoading(false);
    } finally { setIsChatLoading(false); }
  };
  
 const handleGenerateCustomImage = async () => {
      // CHECK SUBSCRIPTION
      if (subContext && !subContext.checkAndIncrement()) {
          return;
      }

      setIsImageLoading(true); setImageError(null); setLoadingMessage(`Đang tạo ${numberOfImages} ảnh với các góc máy đa dạng...`);
      try {
          const makeupPrompt = customMakeupPrompt || selectedMakeup?.prompt;
          const outfitPrompt = selectedOutfit?.prompt;
          const backgroundPrompt = customBackgroundPrompt || selectedBackground?.prompt;

          const imageBase64Array = await generateCharacterImage(character, { 
              numberOfImages: numberOfImages, 
              makeupPrompt: makeupPrompt ?? undefined,
              outfitPrompt: outfitPrompt ?? undefined,
              backgroundPrompt: backgroundPrompt ?? undefined,
              posePrompt: selectedPose?.prompt ?? undefined,
              cameraAnglePrompt: selectedCameraAngle?.prompt ?? undefined,
            });
          
          const newImages: GalleryImage[] = imageBase64Array.map(b64 => ({ id: uuidv4(), url: `data:image/jpeg;base64,${b64}`, createdAt: Date.now(), prompt: `Makeup: ${makeupPrompt}, Outfit: ${outfitPrompt}, Scene: ${backgroundPrompt}` }));
          onUpdate({ ...character, singleImages: [...newImages, ...(character.singleImages || [])] });

      } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
          setImageError(`Không thể tạo ảnh. Lỗi: ${errorMessage}. Vui lòng thử lại hoặc thay đổi prompt.`);
          console.error(err);
      } finally { setIsImageLoading(false); }
  };

  const handleGetSuggestions = async () => {
    setIsSuggesting(true);
    try {
        const concepts = await generateSceneConcept(character);
        if (concepts && concepts.length > 0) {
            const concept = concepts[0];
            setSelectedMakeup({ name: 'AI Gợi ý', prompt: concept.makeup });
            setCustomMakeupPrompt('');
            setSelectedOutfit({ name: 'AI Gợi ý', prompt: concept.outfit });
            setSelectedBackground({ name: 'AI Gợi ý', prompt: concept.background });
            setCustomBackgroundPrompt('');
        }
    } catch (e) {
        console.error("Failed to get suggestions", e);
        alert("Không thể lấy gợi ý từ AI lúc này.");
    } finally {
        setIsSuggesting(false);
    }
  };

  const handleOutfitImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setIsAnalyzingOutfit(true);
        setImageError(null);
        setSelectedOutfit(null);
        setUploadedOutfit(null);

        const previewUrl = URL.createObjectURL(file);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            
            setUploadedOutfit({
                previewUrl,
                base64: base64Data,
                file,
            });

            try {
                const outfitDetails = await extractOutfitFromImage(base64Data, file.type);
                
                setUploadedOutfit(prev => prev ? { ...prev, analyzedData: outfitDetails } : null);
                setSelectedOutfit({ name: `Từ ảnh: ${outfitDetails.name}`, prompt: outfitDetails.masterPrompt });

            } catch (err) {
                console.error("Outfit analysis failed", err);
                setImageError("Không thể phân tích trang phục từ ảnh. Vui lòng thử lại.");
                setUploadedOutfit(null);
            } finally {
                setIsAnalyzingOutfit(false);
                if (e.target) {
                    e.target.value = '';
                }
            }
        };
         reader.onerror = () => {
            setImageError("Không thể đọc tệp hình ảnh.");
            setIsAnalyzingOutfit(false);
        }
    }
  };

  const handleSaveToWardrobe = () => {
    if (!uploadedOutfit?.analyzedData || !uploadedOutfit.base64) {
        alert("Không có dữ liệu trang phục đã phân tích để lưu.");
        return;
    }

    const newWardrobeItem: WardrobeItem = {
        id: uuidv4(),
        name: uploadedOutfit.analyzedData.name,
        imageUrl: `data:${uploadedOutfit.file.type};base64,${uploadedOutfit.base64}`,
        masterPrompt: uploadedOutfit.analyzedData.masterPrompt,
    };

    const updatedWardrobe = [...(character.wardrobe || []), newWardrobeItem];
    onUpdate({ ...character, wardrobe: updatedWardrobe });

    alert(`Đã lưu "${newWardrobeItem.name}" vào tủ đồ!`);
    
    setUploadedOutfit(null);
    setSelectedOutfit(null);
  };
  
  const handleUploadClickFromModal = () => {
    setIsOutfitModalOpen(false);
    setTimeout(() => {
        outfitFileInputRef.current?.click();
    }, 100);
  };

  if (activeView === 'interactive_space') { return <InteractiveSpace allCharacters={allCharacters} initialCharacter={character} onUpdateCharacter={onUpdate} onBack={() => setActiveView('studio')} />; }
  
  const SelectionButton: React.FC<{label: string, value: string | null, onClick: () => void}> = ({ label, value, onClick }) => (
    <div className="bg-gray-900/50 p-3 rounded-lg flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-semibold truncate text-white">{value || 'Chưa chọn'}</p>
      </div>
      <button onClick={onClick} className="text-sm bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-md transition-colors">Chọn</button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
        <style>{`.animate-fade-in { animation: fade-in 0.3s ease-out; } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }`}</style>
        {isGalleryModalOpen && <CharacterGalleryModal character={character} onClose={() => setIsGalleryModalOpen(false)} onUpdate={onUpdate} />}
        {isPoseModalOpen && <PoseSelectionModal character={character} onClose={() => setPoseModalOpen(false)} onSelect={(pose) => { setSelectedPose(pose); setPoseModalOpen(false); }} />}
        {isBackgroundModalOpen && <BackgroundSelectionModal character={character} onClose={() => setBackgroundModalOpen(false)} onSelect={(bg) => { setSelectedBackground(bg); setCustomBackgroundPrompt(''); setBackgroundModalOpen(false); }} />}
        {isOutfitModalOpen && <OutfitSelectionModal character={character} onClose={() => setIsOutfitModalOpen(false)} onSelect={(outfit) => { setSelectedOutfit(outfit); setUploadedOutfit(null); setIsOutfitModalOpen(false); }} onUploadClick={handleUploadClickFromModal} />}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 lg:sticky top-8 self-start">
                <button onClick={onBack} className="block mx-auto lg:mx-0 text-pink-400 hover:text-pink-300 mb-4 font-semibold">&larr; Quay lại Thư viện</button>
                 <div className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700 shadow-2xl">
                    <div className="w-full aspect-[9/16] bg-gray-900 flex items-center justify-center relative">
                      {isImageLoading ? (
                         <div className="text-center p-4">
                           <LoadingSpinner />
                           <p className="mt-4 font-semibold text-pink-400 animate-pulse">{loadingMessage}</p>
                         </div>
                      ) : (
                        <img 
                            key={latestImageUrl} /* FORCE RE-RENDER on change */
                            src={latestImageUrl || `https://placehold.co/900x1600/1a1a1a/333333?text=${encodeURIComponent(character.name)}`} 
                            alt={character.name} 
                            className="w-full h-full object-cover animate-fade-in" 
                        />
                      )}
                      
                      {/* Gradient overlay for text legibility */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                           <h2 className="text-2xl font-bold text-white drop-shadow-md">{character.name}</h2>
                           <p className="text-pink-400 font-semibold drop-shadow-sm">{character.personality}, {character.occupation}</p>
                           {subContext?.subscription && (
                               <div className="mt-2 flex items-center gap-2">
                                   <span className={`text-xs px-2 py-0.5 rounded font-bold ${subContext.subscription.tier === 'TRIAL' ? 'bg-blue-600' : 'bg-gradient-to-r from-pink-500 to-purple-500'}`}>
                                       {subContext.subscription.tier}
                                   </span>
                                   <span className="text-xs text-gray-300">
                                       Used: {subContext.subscription.dailyUsage} / {subContext.subscription.tier === 'FREE' ? 0 : 
                                            (subContext.subscription.tier === 'TRIAL' ? 10 : 
                                            (subContext.subscription.tier === 'SILVER' ? 15 : 
                                            (subContext.subscription.tier === 'GOLD' ? 100 : 500)))}
                                   </span>
                               </div>
                           )}
                      </div>
                    </div>
                    <div className="p-4 border-t border-gray-700 bg-gray-800">
                        <button onClick={() => setIsGalleryModalOpen(true)} className="w-full bg-gray-700 text-white font-bold py-2.5 rounded-lg hover:bg-gray-600 transition-colors">Xem Album Ảnh ({character.singleImages?.length || 0})</button>
                    </div>
                 </div>
                 <button onClick={onBack} className="mt-4 w-full bg-gray-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200 hover:bg-gray-600 shadow-lg">Thoát Studio</button>
            </div>

            <div className="lg:col-span-2 space-y-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center lg:text-left">Studio <span className="text-pink-400">Sáng Tạo</span></h1>
                <div>
                  <h2 className="text-2xl font-bold flex items-center mb-4"><IconMagicWand /> Xưởng Ảnh AI</h2>
                  <div className="bg-gray-800/50 p-4 rounded-lg space-y-4 border border-gray-700">
                    
                    {/* --- Layered Workflow --- */}
                    {/* 1. Makeup Layer */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3">1. Makeup</h3>
                        <div className="flex flex-wrap gap-2">
                            {MAKEUP_OPTIONS.map(opt => (
                                <button
                                    key={opt.name}
                                    onClick={() => { setSelectedMakeup(opt); setCustomMakeupPrompt(''); }}
                                    className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${selectedMakeup?.name === opt.name ? 'bg-pink-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                >{opt.name}</button>
                            ))}
                            <button
                                onClick={() => setSelectedMakeup({name: 'Tùy chỉnh', prompt: null})}
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${selectedMakeup?.name === 'Tùy chỉnh' ? 'bg-pink-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                            >Tùy chỉnh...</button>
                        </div>
                        {selectedMakeup?.name === 'Tùy chỉnh' && (
                             <textarea value={customMakeupPrompt} onChange={(e) => setCustomMakeupPrompt(e.target.value)} placeholder="VD: glittery eyeshadow, glossy lips, face tattoos..." className="bg-gray-900 mt-3 p-2 rounded-lg w-full text-sm" rows={2}></textarea>
                        )}
                    </div>
                    
                    {/* 2. Outfit Layer */}
                     <div>
                        <h3 className="text-lg font-semibold mb-3">2. Trang Phục</h3>
                        <div className="bg-gray-900/50 p-3 rounded-lg flex items-center justify-between gap-4">
                            <div className="flex-grow flex items-center gap-4 min-w-0">
                                {uploadedOutfit ? (
                                    <>
                                        <img 
                                            src={uploadedOutfit.previewUrl} 
                                            alt="Preview" 
                                            className="w-16 h-16 rounded-md object-cover flex-shrink-0 cursor-pointer"
                                            onClick={() => showPreview(uploadedOutfit.previewUrl)}
                                        />
                                        <div className="flex-grow min-w-0">
                                            {isAnalyzingOutfit ? (
                                                 <div className="flex items-center gap-2">
                                                    <LoadingSpinner />
                                                    <span className="text-sm text-purple-400">Đang phân tích...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-sm font-semibold truncate text-white" title={uploadedOutfit.analyzedData?.name}>{uploadedOutfit.analyzedData?.name || '...'}</p>
                                                    <p className="text-xs text-gray-400 truncate" title={uploadedOutfit.analyzedData?.masterPrompt}>{uploadedOutfit.analyzedData?.masterPrompt || '...'}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <button 
                                                            onClick={handleSaveToWardrobe} 
                                                            disabled={!uploadedOutfit.analyzedData}
                                                            className="text-xs bg-green-600 text-white px-2 py-1 rounded disabled:opacity-50 hover:bg-green-700"
                                                            title="Lưu vào Tủ đồ"
                                                        >Lưu vào Tủ đồ</button>
                                                        <a 
                                                            href={uploadedOutfit.previewUrl} 
                                                            download={uploadedOutfit.file.name}
                                                            className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500"
                                                        >Tải về</a>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <button onClick={() => { setUploadedOutfit(null); setSelectedOutfit(null); }} className="flex-shrink-0 self-start w-7 h-7 flex items-center justify-center bg-red-800/50 hover:bg-red-700 text-white rounded-full">&times;</button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex-grow">
                                            <span className="text-gray-400 mr-4">Trang phục</span>
                                            <span className="font-semibold text-white">{selectedOutfit?.name || 'Chưa chọn'}</span>
                                        </div>
                                        <input type="file" ref={outfitFileInputRef} onChange={handleOutfitImageUpload} accept="image/jpeg,image/png" className="hidden"/>
                                         <button
                                            onClick={() => setIsOutfitModalOpen(true)}
                                            className="flex-shrink-0 bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-md transition-colors"
                                            >
                                            Chọn / Tải Lên
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3. Scene Layer */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3">3. Bối Cảnh & Chi Tiết</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <SelectionButton label="Bối cảnh" value={selectedBackground?.name || 'Tùy chỉnh'} onClick={() => setBackgroundModalOpen(true)} />
                            <SelectionButton label="Tư thế" value={selectedPose?.name || null} onClick={() => setPoseModalOpen(true)} />
                        </div>
                        <textarea value={customBackgroundPrompt} onChange={(e) => setCustomBackgroundPrompt(e.target.value)} placeholder="Mô tả bối cảnh tùy chỉnh hoặc thêm chi tiết..." className="bg-gray-900 mt-3 p-2 rounded-lg w-full text-sm" rows={2}></textarea>
                    </div>

                     {/* AI Idea Suggestion */}
                    <button onClick={handleGetSuggestions} disabled={isSuggesting} className="w-full text-sm flex items-center justify-center bg-purple-600/80 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-600 transition-colors shadow-md disabled:opacity-50">
                        {isSuggesting ? <LoadingSpinner /> : <IconSparkles />} {isSuggesting ? 'AI đang nghĩ...' : 'AI Gợi ý ý tưởng'}
                    </button>
                    
                     <hr className="border-gray-700"/>

                     {/* 4. Final Touches */}
                     <div>
                        <h3 className="text-lg font-semibold mb-3">4. Hoàn Thiện</h3>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-semibold mb-2">Góc Máy</label>
                                <select value={selectedCameraAngle.name} onChange={(e) => setSelectedCameraAngle(CAMERA_ANGLE_OPTIONS.find(o => o.name === e.target.value) || CAMERA_ANGLE_OPTIONS[0])} className="bg-gray-900 p-2 rounded-lg w-full text-sm border border-gray-600">
                                    {CAMERA_ANGLE_OPTIONS.map(opt => <option key={opt.name} value={opt.name}>{opt.icon} {opt.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="numberOfImages" className="block text-sm font-semibold mb-2">Số lượng ảnh</label>
                                <select id="numberOfImages" value={numberOfImages} onChange={(e) => setNumberOfImages(parseInt(e.target.value, 10))} className="bg-gray-900 p-2 rounded-lg w-full text-sm border border-gray-600">
                                    {[1, 2, 4, 8].map(num => (<option key={num} value={num}>{num} ảnh</option>))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleGenerateCustomImage} disabled={isImageLoading} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-2.5 px-6 rounded-lg transition-transform duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"><IconCamera />{isImageLoading ? 'Đang tạo...' : 'Tạo Ảnh'}</button>
                    {imageError && <p className="text-red-400 mt-2 text-sm text-center">{imageError}</p>}
                  </div>
                </div>

                <div><button onClick={() => setActiveView('interactive_space')} className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold py-3 px-6 rounded-lg transition-transform duration-200 hover:scale-105 shadow-lg flex items-center justify-center text-lg"><IconSparkles />Làm Gì Đó Cùng Nhau</button></div>

                <div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center"><IconChatHeart/> Tâm sự cùng Muse</h2>
                  <div className="bg-gray-900/70 border border-gray-700 rounded-lg h-full min-h-[60vh] flex flex-col p-4">
                      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                          {chatHistory.length === 0 && (<div className="flex justify-center items-center h-full"><p className="text-gray-500">Bắt đầu cuộc trò chuyện nào...</p></div>)}
                          {chatHistory.map((msg, index) => (
                             <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                 <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-pink-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                                      <p className="text-sm whitespace-pre-wrap">{msg.parts[0].text}</p>
                                      {msg.isGeneratingImage && (<div className="mt-2 p-2 bg-gray-800/50 rounded-lg flex items-center gap-2"><LoadingSpinner /><span className="text-xs text-gray-400">Đang vẽ...</span></div>)}
                                      {msg.imageUrl && (<img src={msg.imageUrl} alt="Generated in chat" className="mt-2 rounded-lg max-w-full h-auto cursor-pointer border border-gray-600 hover:border-pink-500" onClick={() => setIsGalleryModalOpen(true)}/>)}
                                 </div>
                                 {/* SUGGESTION CHIPS */}
                                 {msg.role === 'model' && msg.suggestions && msg.suggestions.length > 0 && (
                                     <div className="mt-2 flex flex-wrap gap-2 max-w-md">
                                         {msg.suggestions.map((sug, i) => (
                                             <button 
                                                key={i} 
                                                onClick={() => handleSendMessage(sug)}
                                                className="text-xs bg-gray-800/80 hover:bg-pink-600 border border-gray-600 text-gray-200 py-1.5 px-3 rounded-full transition-all animate-fade-in"
                                             >
                                                 {sug}
                                             </button>
                                         ))}
                                     </div>
                                 )}
                             </div>
                          ))}
                           {isChatLoading && !chatHistory.some(m => m.isGeneratingImage) && (<div className="flex justify-start"><div className="bg-gray-700 text-gray-200 rounded-2xl rounded-bl-none px-4 py-2 flex items-center"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce mr-1"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce mr-1" style={{animationDelay: '0.1s'}}></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div></div></div>)}
                          <div ref={chatEndRef} />
                      </div>
                      <div className="mt-4 flex-shrink-0">
                           <div className="relative">
                               <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder={`Gửi lời yêu thương tới ${character.name}...`} onKeyPress={(e) => e.key === 'Enter' && !isChatLoading && handleSendMessage()} className="w-full bg-gray-800 p-3 pl-4 pr-16 rounded-full focus:ring-2 focus:ring-pink-500 focus:outline-none text-sm" disabled={isChatLoading}/>
                               <button onClick={() => handleSendMessage()} disabled={isChatLoading || !userInput.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 bg-pink-600 text-white p-2 rounded-full hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><IconPaperPlane /></button>
                          </div>
                          {chatError && <p className="text-red-400 mt-2 text-xs text-center">{chatError}</p>}
                      </div>
                  </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default StoryStudio;
