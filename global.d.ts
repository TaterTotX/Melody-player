export {}; // 确保这是一个模块

declare global {
    interface Window {
        electron: {
            getTracks: () => Promise<Track[]>;
            getCurrentTime: () => Promise<number>;
            getDuration: () => Promise<number>;
            playAudio: (filePath: string) => Promise<void>;
            pauseAudio: () => Promise<void>;
            resumeAudio: () => Promise<void>;
            stopAudio: () => Promise<void>;
            ipcRenderer: {
                on: (channel: string, listener: (...args: any[]) => void) => void;
                send: (channel: string, ...args: any[]) => void;
                removeAllListeners: (channel: string) => void;
            };
        };
    }
}
