import React from 'react';
import { createRoot } from 'react-dom/client';
import MobilePressureApp from './MobilePressureApp.jsx';

const mount = document.getElementById('root');
if (!mount) throw new Error('移动展示入口缺少 root 容器');
createRoot(mount).render(<MobilePressureApp />);
