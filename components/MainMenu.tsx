import React from 'react';
import { View } from '../App';

interface MainMenuProps {
  onNavigate: () => void; // Changed from (view: View) => void
  hasCharacters: boolean;
  onLogout: () => void;
  onViewLibrary: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onNavigate, hasCharacters, onLogout, onViewLibrary }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
       <div className="absolute top-6 right-6">
        <button onClick={onLogout} className="text-sm bg-gray-800/50 border border-gray-700 text-gray-300 font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">
            Đăng xuất
        </button>
      </div>
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
        My <span className="text-pink-400">Muse</span> AI
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-gray-400">
        Xưởng phim AI cá nhân của bạn. Thiết kế nàng thơ, tạo ra thế giới của họ và thổi hồn vào những câu chuyện của riêng bạn.
      </p>
      <div className="mt-12 flex flex-col sm:flex-row gap-6">
        <button
          onClick={onNavigate}
          className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-4 px-12 rounded-lg transition-transform duration-200 hover:scale-105 shadow-lg text-xl"
        >
          Tạo Nhân Vật Mới
        </button>
        {hasCharacters && (
          <button
            onClick={onViewLibrary}
            className="bg-gray-700 text-white font-bold py-4 px-12 rounded-lg transition-colors duration-200 hover:bg-gray-600 text-xl"
          >
            Thư Viện Muse
          </button>
        )}
      </div>
    </div>
  );
};

export default MainMenu;
