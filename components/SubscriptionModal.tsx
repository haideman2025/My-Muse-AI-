
import React from 'react';
import { SubscriptionTier, UserSubscription } from '../types';
import { TIER_LIMITS, TIER_PRICES, upgradeSubscription } from '../services/subscriptionService';

interface SubscriptionModalProps {
    currentUser: string;
    currentSub: UserSubscription;
    onClose: () => void;
    onUpgrade: () => void; // Trigger refresh
}

const PlanCard: React.FC<{
    tier: SubscriptionTier;
    currentTier: SubscriptionTier;
    price: number;
    limit: number;
    description: string;
    features: string[];
    onSelect: () => void;
    isBestValue?: boolean;
    isExpired?: boolean;
}> = ({ tier, currentTier, price, limit, description, features, onSelect, isBestValue, isExpired }) => {
    const isCurrent = tier === currentTier;
    const isTrial = tier === SubscriptionTier.TRIAL;

    let buttonText = "Nâng Cấp Ngay";
    let buttonClass = "bg-gray-700 hover:bg-gray-600 text-white";
    let isDisabled = false;

    if (isCurrent) {
        buttonText = "Đang sử dụng";
        buttonClass = "bg-green-600 text-white cursor-default";
        isDisabled = true;
    } else if (isTrial && isExpired) {
        buttonText = "Đã hết hạn";
        buttonClass = "bg-gray-800 text-gray-500 cursor-not-allowed";
        isDisabled = true;
    } else if (isBestValue) {
        buttonClass = "bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-400 hover:to-purple-500 animate-pulse";
    }

    return (
        <div className={`relative p-6 rounded-2xl border-2 flex flex-col h-full ${isCurrent ? 'border-green-500 bg-gray-800/80' : isBestValue ? 'border-pink-500 bg-gray-800/50' : 'border-gray-700 bg-gray-900/50'} transition-transform hover:scale-105`}>
            {isBestValue && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">Phổ biến nhất</div>}
            {isCurrent && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">Gói hiện tại</div>}
            {isTrial && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">Quà chào mừng</div>}

            <h3 className="text-xl font-bold text-white mb-2">{tier === 'TRIAL' ? 'FREE TRIAL' : `${tier} MEMBER`}</h3>
            <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-1">
                {price === 0 ? 'Miễn Phí' : `$${price}`} <span className="text-sm text-gray-400 font-normal">/{isTrial ? '3 ngày' : 'tháng'}</span>
            </div>
            <p className="text-gray-400 text-sm mb-4">{description}</p>
            
            <div className="flex-grow space-y-2 mb-6">
                <p className="flex items-center text-sm text-gray-200">
                    <span className="mr-2 text-green-400">✓</span> {limit} ảnh / ngày
                </p>
                {features.map((f, i) => (
                    <p key={i} className="flex items-center text-sm text-gray-400">
                        <span className="mr-2 text-pink-500">★</span> {f}
                    </p>
                ))}
            </div>

            <button
                onClick={onSelect}
                disabled={isDisabled}
                className={`w-full py-3 rounded-lg font-bold transition-colors shadow-lg ${buttonClass}`}
            >
                {buttonText}
            </button>
        </div>
    );
};

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ currentUser, currentSub, onClose, onUpgrade }) => {
    
    const handleSelect = (tier: SubscriptionTier) => {
        if (tier === SubscriptionTier.TRIAL) return; // Cannot manually select trial
        upgradeSubscription(currentUser, tier);
        onUpgrade();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
            <style>{`.animate-fade-in { animation: fade-in 0.3s ease-out; } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }`}</style>
            
            <div className="w-full max-w-7xl relative my-auto py-8">
                <button onClick={onClose} className="absolute top-0 right-0 text-gray-400 hover:text-white text-lg font-bold p-4">✕ Đóng</button>
                
                <div className="text-center mb-10">
                    <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-4 tracking-tight">Nâng Cấp <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">Muse AI</span></h2>
                    <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                        {currentSub.tier === SubscriptionTier.FREE 
                            ? "Gói dùng thử của bạn đã kết thúc. Hãy nâng cấp để tiếp tục trò chuyện và tạo ảnh cùng Muse."
                            : "Mở khóa sức mạnh sáng tạo không giới hạn. Tạo nhiều ảnh hơn, video sắc nét và nuôi dưỡng Muse của bạn tốt hơn."}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                    {/* TRIAL - DISPLAY ONLY */}
                    <PlanCard
                        tier={SubscriptionTier.TRIAL}
                        currentTier={currentSub.tier}
                        price={0}
                        limit={TIER_LIMITS[SubscriptionTier.TRIAL]}
                        description="Gói trải nghiệm miễn phí dành cho người mới."
                        features={["3 Ngày trải nghiệm", "10 ảnh/ngày", "Truy cập Studio cơ bản"]}
                        onSelect={() => {}}
                        isExpired={currentSub.hasUsedTrial && currentSub.tier === SubscriptionTier.FREE}
                    />

                    {/* SILVER */}
                    <PlanCard
                        tier={SubscriptionTier.SILVER}
                        currentTier={currentSub.tier}
                        price={TIER_PRICES[SubscriptionTier.SILVER]}
                        limit={TIER_LIMITS[SubscriptionTier.SILVER]}
                        description="Gói tiết kiệm cho nhu cầu cơ bản."
                        features={["450 ảnh/tháng", "Truy cập Studio nâng cao", "Mở khóa Chat 18+"]}
                        onSelect={() => handleSelect(SubscriptionTier.SILVER)}
                    />

                    {/* GOLD */}
                    <PlanCard
                        tier={SubscriptionTier.GOLD}
                        currentTier={currentSub.tier}
                        price={TIER_PRICES[SubscriptionTier.GOLD]}
                        limit={TIER_LIMITS[SubscriptionTier.GOLD]}
                        description="Lựa chọn tốt nhất cho trải nghiệm trọn vẹn."
                        features={["3000 ảnh/tháng", "Ưu tiên xử lý nhanh", "Tạo Video Storyboard", "Hỗ trợ 24/7"]}
                        onSelect={() => handleSelect(SubscriptionTier.GOLD)}
                        isBestValue={true}
                    />

                    {/* DIAMOND */}
                    <PlanCard
                        tier={SubscriptionTier.DIAMOND}
                        currentTier={currentSub.tier}
                        price={TIER_PRICES[SubscriptionTier.DIAMOND]}
                        limit={TIER_LIMITS[SubscriptionTier.DIAMOND]}
                        description="Đặc quyền tối thượng cho Creator."
                        features={["15,000 ảnh/tháng", "Tạo Video 4K không giới hạn", "Quyền truy cập KOC Studio", "Beta tính năng mới"]}
                        onSelect={() => handleSelect(SubscriptionTier.DIAMOND)}
                    />
                </div>
                
                <div className="mt-12 text-center space-y-2">
                     <p className="text-gray-500 text-sm">Thanh toán an toàn qua cổng quốc tế. Có thể hủy bất cứ lúc nào.</p>
                     <div className="flex justify-center gap-4 opacity-50 grayscale hover:grayscale-0 transition-all">
                         {/* Fake payment icons for trust */}
                         <div className="h-8 w-12 bg-white rounded flex items-center justify-center font-bold text-blue-800 text-xs">VISA</div>
                         <div className="h-8 w-12 bg-white rounded flex items-center justify-center font-bold text-red-600 text-xs">Master</div>
                         <div className="h-8 w-12 bg-white rounded flex items-center justify-center font-bold text-blue-500 text-xs">Amex</div>
                     </div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionModal;
