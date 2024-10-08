"use client";
import {useState, useRef, useEffect, CSSProperties} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, SkipBack, Play, Pause, SkipForward, List, ChevronDown, Repeat, Shuffle, ArrowRight } from 'lucide-react';
import IpcRendererEvent = Electron.IpcRendererEvent;



interface ExtendedCSSProperties extends CSSProperties {
  WebkitAppRegion?: string;
}

const draggableStyle: ExtendedCSSProperties = {
  WebkitAppRegion: 'drag'
};


// 定义 Track 类型，表示一首歌曲的基本信息
type Track = {
  title: string;      // 歌曲标题
  artist: string;     // 艺术家名称
  duration: number;   // 歌曲时长（以秒为单位）
  filePath: string;   // 歌曲文件路径
};

// 定义播放模式类型
type PlayMode = 'random' | 'loop' | 'once'; // 播放模式可以是随机、循环或单曲播放

export default function Home() {
  const [isExpanded, setIsExpanded] = useState(false);               // 控制播放器是否展开
  const [tracks, setTracks] = useState<Track[]>([]);                 // 存储歌曲列表
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);     // 当前播放的歌曲索引
  const [isPlaying, setIsPlaying] = useState(false);                 // 控制播放状态
  const [volume, setVolume] = useState(1);                           // 音量设置（范围从0到1）
  const [progress, setProgress] = useState(0);                       // 当前播放进度（百分比）
  const [playMode, setPlayMode] = useState<PlayMode>('once');        // 当前播放模式，默认为单曲播放
  const audioRef = useRef<HTMLAudioElement | null>(null);            // 音频元素引用

  // 切换播放器展开状态
  const toggleExpand = () => setIsExpanded(!isExpanded);

  // 初始化音频元素
  useEffect(() => {
    if (!audioRef.current) {
      // 创建音频元素
      const audio = new Audio();
      audioRef.current = audio;
      audio.volume = volume;

      // 监听音频事件
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      console.log('音频元素已初始化', audioRef.current);
    }

    // 在组件卸载时清理音频元素
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current = null;
      }
    };
  }, []);

  // 监听主进程发送的音乐列表更新，并通知主进程渲染进程已准备好
  useEffect(() => {
    if (
        typeof window !== 'undefined' &&
        window.electron &&
        window.electron.ipcRenderer
    ) {
      const updateAudioList = (event: IpcRendererEvent, audioData: Track[]) => {
        // 更新 tracks 状态，填充 Track 数据
        setTracks(audioData);

        // 重置当前音频索引为 0，即从第一首开始播放
        setCurrentTrackIndex(0);

        // 将播放状态设置为未播放
        setIsPlaying(false);

        // 在控制台打印更新后的音频文件列表
        console.log('已更新音频文件列表:', audioData);
      };

      // 监听 'update-audio-list' 事件
      window.electron.ipcRenderer.on('update-audio-list', updateAudioList);

      // 通知主进程渲染进程已准备好
      window.electron.ipcRenderer.send('renderer-ready');

      // 组件卸载时清理监听器
      return () => {
        window.electron.ipcRenderer.removeAllListeners('update-audio-list');
      };
    }
  }, []);

  // 当 currentTrackIndex 或 tracks 变化时，更新音频源
  useEffect(() => {
    if (audioRef.current && tracks.length > 0) {
      audioRef.current.src = tracks[currentTrackIndex].filePath;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(error => console.error('音频播放失败', error));
      }
    }
  }, [currentTrackIndex, tracks]);

  // 监听音量变化
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // 更新播放进度
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentTime = audioRef.current.currentTime;
      const duration = audioRef.current.duration || 1;
      const progressPercent = (currentTime / duration) * 100;
      setProgress(progressPercent);
    }
  };

  // 音频播放结束后根据播放模式决定下一步
  const handleEnded = () => {
    console.log('播放完成',playMode); // 添加这行打印“播放完成”
    switch (playMode) {
      case 'once':
        setIsPlaying(false);
        break;
      case 'loop':
        audioRef.current?.play();
        break;
      case 'random':
        playRandomTrack();
        break;
      default:
        playNext();
        break;
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      // 移除旧的监听器，防止重复绑定
      audioRef.current.removeEventListener('ended', handleEnded);

      // 添加新的监听器，确保捕获最新的 playMode
      audioRef.current.addEventListener('ended', handleEnded);
    }

    // 清理事件监听器
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleEnded);
      }
    };
  }, [playMode]); // 将 playMode 作为依赖



  // 播放随机歌曲
  const playRandomTrack = () => {
    const randomIndex = Math.floor(Math.random() * tracks.length);
    setCurrentTrackIndex(randomIndex);
    setProgress(0);
    setIsPlaying(true); // 确保下一首歌开始播放
  };


  // 切换播放/暂停音频的函数
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        console.log('暂停音频');
      } else {
        audioRef.current.play()
            .then(() => console.log('音频播放成功'))
            .catch(error => console.error('音频播放失败', error));
      }
      setIsPlaying(!isPlaying);
      console.log('播放状态切换为:', !isPlaying);
    } else {
      console.error('音频元素未定义');
    }
  };

  // 播放下一个音频的函数
  const playNext = () => {
    if (tracks.length > 0) {
      let nextIndex = currentTrackIndex;
      if (playMode === 'random') {
        nextIndex = Math.floor(Math.random() * tracks.length);
      } else {
        nextIndex = (currentTrackIndex + 1) % tracks.length;
      }
      setCurrentTrackIndex(nextIndex);
      setProgress(0);
      setIsPlaying(true);
      console.log('播放下一个音频:', tracks[nextIndex]);
    }
  };

  // 播放上一个音频的函数
  const playPrevious = () => {
    if (tracks.length > 0) {
      const previousIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
      setCurrentTrackIndex(previousIndex);
      setProgress(0);
      setIsPlaying(true);
      console.log('播放上一个音频:', tracks[previousIndex]);
    }
  };

  // 切换静音状态
  const toggleMute = () => {
    const newVolume = volume === 0 ? 1 : 0;
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // 切换播放模式
  const cyclePlayMode = () => {
    setPlayMode(currentMode => {
      switch (currentMode) {
        case 'once': return 'random';
        case 'random': return 'loop';
        case 'loop': return 'once';
        default: return 'once';
      }
    });
  };

  // 获取当前播放模式的图标
  const getPlayModeIcon = () => {
    switch (playMode) {
      case 'random': return <Shuffle size={20} />;
      case 'loop': return <Repeat size={20} />;
      case 'once': return <ArrowRight size={20} />;
    }
  };

  // 处理进度条点击事件
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedValue = (x / rect.width) * 100;
    setProgress(clickedValue);

    if (audioRef.current) {
      const targetTime = (clickedValue / 100) * audioRef.current.duration;
      audioRef.current.currentTime = targetTime;
    }
  };

  // 格式化时间显示
  const formatTime = (time: number) => {
    if (!isFinite(time)) {
      return '0:00';
    }
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
      <div className="flex items-center justify-center min-h-screen transparent p-4">
        <motion.div
            className="bg-white rounded-3xl shadow-lg overflow-hidden"
            initial={false}
            animate={isExpanded ? { width: 360, height: 480 } : { width: 360, height: 240 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="bg-emerald-600 p-4 relative"  style={draggableStyle}>
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-600 to-emerald-800">
              <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-emerald-900 opacity-50"></div>
            </div>
            <div className="relative z-10" >
              <h2 className="text-white text-2xl font-bold mb-1">NEO NEMO</h2>
              <p className="text-emerald-200 text-lg">Local Music Player</p>
            </div>
          </div>
          <div className="p-4">
            <h3 className="text-slate-800 font-semibold">
              {tracks[currentTrackIndex]?.title || '暂无歌曲'}
            </h3>
            <p className="text-slate-600 text-sm">
              {tracks[currentTrackIndex]?.artist || '未知艺术家'}
            </p>
            <div className="mt-4 mb-2">
              <div className="h-1 bg-emerald-200 rounded-full cursor-pointer" onClick={handleProgressClick}>
                <motion.div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <motion.button
                  className="text-slate-600 hover:text-emerald-600 transition-colors"
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleMute}
              >
                {volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </motion.button>
              <div className="flex items-center space-x-4">
                <motion.button
                    className="text-slate-800 hover:text-emerald-600 transition-colors"
                    whileTap={{ scale: 0.9 }}
                    onClick={playPrevious}
                >
                  <SkipBack size={24} />
                </motion.button>
                <motion.button
                    className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center hover:bg-emerald-700 transition-colors"
                    whileTap={{ scale: 0.9 }}
                    onClick={togglePlay}
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                </motion.button>
                <motion.button
                    className="text-slate-800 hover:text-emerald-600 transition-colors"
                    whileTap={{ scale: 0.9 }}
                    onClick={playNext}
                >
                  <SkipForward size={24} />
                </motion.button>
              </div>
              <div className="flex items-center space-x-2">
                <motion.button
                    className="text-slate-600 hover:text-emerald-600 transition-colors"
                    whileTap={{ scale: 0.9 }}
                    onClick={cyclePlayMode}
                    title={`当前模式: ${playMode}`}
                >
                  {getPlayModeIcon()}
                </motion.button>
                <motion.button
                    className="text-slate-600 hover:text-emerald-600 transition-colors"
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleExpand}
                >
                  <List size={24} />
                </motion.button>
              </div>
            </div>
          </div>
          <AnimatePresence>
            {isExpanded && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white p-4"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-slate-800 font-semibold">即将播放</h4>
                    <motion.button
                        className="text-emerald-600"
                        whileTap={{ scale: 0.9 }}
                        onClick={toggleExpand}
                    >
                      <ChevronDown size={24} />
                    </motion.button>
                  </div>
                  <div className="max-h-[180px] overflow-y-auto custom-scrollbar">
                    <ul className="space-y-2 pr-2">
                      {tracks.map((track, index) => (
                          <motion.li
                              key={track.filePath}
                              className={`flex justify-between items-center text-sm cursor-pointer hover:bg-emerald-50 p-2 rounded ${index === currentTrackIndex ? 'bg-emerald-100' : ''}`}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setCurrentTrackIndex(index);
                                setProgress(0);
                                setIsPlaying(true);
                              }}
                          >
                            <div>
                              <p className="text-slate-800 font-medium">{track.title}</p>
                              <p className="text-slate-600">{track.artist}</p>
                            </div>
                            <span className="text-slate-600">{formatTime(track.duration)}</span>
                          </motion.li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(16, 185, 129, 0.5);
            border-radius: 20px;
            border: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgba(16, 185, 129, 0.8);
          }
        `}</style>
      </div>
  );
}
