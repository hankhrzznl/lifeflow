"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, BarChart3, Trash2, Puzzle, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const menuItems = [
  { label: '回顾', href: '/review', icon: BarChart3 },
  { label: '回收站', href: '/trash', icon: Trash2 },
  { label: '插件', href: '/plugins', icon: Puzzle },
];

export function MoreMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <Menu className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 200 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
              className="fixed right-0 top-0 bottom-0 w-[75vw] max-w-[320px] bg-white dark:bg-gray-900 shadow-xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-end p-4">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <nav className="flex-1 px-2">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 h-14 px-4 rounded-xl text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-120 active:scale-[0.98]"
                  >
                    <item.icon className="w-5 h-5 text-gray-500 dark:text-gray-400" strokeWidth={1.5} />
                    <span className="flex-1 text-base">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  </Link>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
