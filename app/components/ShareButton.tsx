'use client';

import React, { useState } from 'react';
import { ShareDialog } from './ShareDialog';

interface ShareButtonProps {
  driveFileId: string;
  filename: string;
}

export function ShareButton({ driveFileId, filename }: ShareButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="ml-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        📤 共有
      </button>

      {isModalOpen && (
        <ShareDialog
          driveFileId={driveFileId}
          filename={filename}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
