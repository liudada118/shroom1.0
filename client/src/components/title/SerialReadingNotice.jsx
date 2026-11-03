import React, { useEffect, useState } from 'react';

/** 连接或读数持续等待两秒才显示提示；快速完成或取消时卸载并清理计时器。 */
export default function SerialReadingNotice({ children }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  return visible ? children : null;
}
