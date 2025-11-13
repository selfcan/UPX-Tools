const { invoke } = window.__TAURI__.core;
const { open, save } = window.__TAURI__.dialog;
const { getCurrentWindow } = window.__TAURI__.window;
const { listen } = window.__TAURI__.event;

// 获取当前窗口实例
const appWindow = getCurrentWindow();

// DOM 元素
const compressBtn = document.getElementById('compress-btn');
const decompressBtn = document.getElementById('decompress-btn');
const compressionLevel = document.getElementById('compression-level');
const levelDisplay = document.getElementById('level-display');
const levelDescription = document.getElementById('level-description');
const overwriteCheckbox = document.getElementById('overwrite');
const backupCheckbox = document.getElementById('backup');
const ultraBruteCheckbox = document.getElementById('ultra-brute');
const includeSubfoldersCheckbox = document.getElementById('include-subfolders');
const forceCompressCheckbox = document.getElementById('force-compress');
const logOutput = document.getElementById('log-output');
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings');
const refreshIconBtn = document.getElementById('refresh-icon-btn');
const appTitle = document.getElementById('app-title');

// 窗口控制按钮
const minimizeBtn = document.getElementById('titlebar-minimize');
const maximizeBtn = document.getElementById('titlebar-maximize');
const closeBtn = document.getElementById('titlebar-close');

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    initWindowControls();
    initOperationButtons();
    initCompressionLevelSlider();
    initTitleClick();
    preventRefresh();
    await setupDragAndDrop();

    // 加载保存的配置
    await loadSavedConfig();

    // 获取并显示UPX版本
    try {
        const version = await invoke('get_upx_version');
        // 在标题栏显示版本
        const versionElement = document.getElementById('upx-version');
        if (versionElement) {
            versionElement.textContent = `- ${version}`;
        }
        addLog(`UPX GUI 已就绪 - ${version}`, 'info');
    } catch (error) {
        addLog('UPX GUI 已就绪 - 请选择操作', 'info');
    }

    // 页面加载完成后显示窗口，避免白屏
    setTimeout(async () => {
        await appWindow.show();
    }, 100);

    // 监听窗口大小变化，更新按钮位置缓存（使用防抖优化）
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            cachedButtonRects = null;  // 清除缓存，下次使用时重新计算
        }, 150);
    }, { passive: true });
});

// 屏蔽刷新快捷键
function preventRefresh() {
    // 使用 Map 提高查找效率
    const blockedKeys = new Set(['F5']);

    document.addEventListener('keydown', (e) => {
        // F5 刷新
        if (blockedKeys.has(e.key)) {
            e.preventDefault();
            addLog('刷新功能已禁用', 'warning');
            return false;
        }

        // Ctrl+R 或 Ctrl+Shift+R 刷新
        if (e.ctrlKey && e.key.toLowerCase() === 'r') {
            e.preventDefault();
            addLog('刷新功能已禁用', 'warning');
            return false;
        }

        // Ctrl+W 关闭窗口
        if (e.ctrlKey && e.key.toLowerCase() === 'w') {
            e.preventDefault();
            return false;
        }
    }, { passive: false });
}

// 窗口控制
function initWindowControls() {
    minimizeBtn.addEventListener('click', () => {
        appWindow.minimize();
    });

    maximizeBtn.addEventListener('click', () => {
        appWindow.toggleMaximize();
    });

    closeBtn.addEventListener('click', () => {
        appWindow.close();
    });
}

// 标题点击事件
function initTitleClick() {
    appTitle.addEventListener('click', async (e) => {
        // 阻止事件冒泡，避免触发拖动
        e.stopPropagation();

        try {
            // 使用 Tauri 的 shell 插件打开 URL
            const { open } = window.__TAURI__.shell;
            await open('https://github.com/Y-ASLant/UPX-GUI');
            addLog('已在浏览器中打开 GitHub 仓库', 'info');
        } catch (error) {
            addLog(`打开链接失败: ${error}`, 'error');
        }
    });
}

// 操作按钮初始化
function initOperationButtons() {
    // 刷新图标缓存按钮
    refreshIconBtn.addEventListener('click', async () => {
        await handleRefreshIcon();
    });

    // 设置按钮 - 显示全局设置
    settingsBtn.addEventListener('click', () => {
        showSettingsModal();
    });

    // 关闭设置按钮
    closeSettingsBtn.addEventListener('click', async () => {
        await saveCurrentConfig();
        hideSettingsModal();
        addLog('设置已保存', 'success');
    });

    // 点击背景关闭弹窗
    settingsModal.addEventListener('click', async (e) => {
        if (e.target === settingsModal) {
            await saveCurrentConfig();
            hideSettingsModal();
        }
    });

    // 加壳压缩按钮 - 直接执行
    compressBtn.addEventListener('click', async () => {
        // 检查是否有多个文件
        if (window.droppedFiles && window.droppedFiles.length > 0) {
            const files = window.droppedFiles;
            window.droppedFiles = null;
            addLog('开始批量加壳压缩...', 'info');
            await processBatchFiles(files, 'compress');
        }
        // 检查是否有单个文件
        else if (window.droppedFile) {
            const filePath = window.droppedFile;
            window.droppedFile = null;
            addLog('开始加壳压缩...', 'info');
            await handleCompressWithFile(filePath);
        } 
        // 没有拖放文件，弹出选择
        else {
            addLog('选择文件进行加壳...', 'info');
            await handleCompress();
        }
    });

    // 脱壳解压按钮 - 直接执行
    decompressBtn.addEventListener('click', async () => {
        // 检查是否有多个文件
        if (window.droppedFiles && window.droppedFiles.length > 0) {
            const files = window.droppedFiles;
            window.droppedFiles = null;
            addLog('开始批量脱壳解压...', 'info');
            await processBatchFiles(files, 'decompress');
        }
        // 检查是否有单个文件
        else if (window.droppedFile) {
            const filePath = window.droppedFile;
            window.droppedFile = null;
            addLog('开始脱壳解压...', 'info');
            await handleDecompressWithFile(filePath);
        } 
        // 没有拖放文件，弹出选择
        else {
            addLog('选择文件进行脱壳...', 'info');
            await handleDecompress();
        }
    });
}

// 级别描述映射（全局常量）
const LEVEL_DESCRIPTIONS = {
    1: '最快速度，压缩率最低',
    2: '较快速度，较低压缩率',
    3: '快速压缩',
    4: '平衡模式',
    5: '标准压缩',
    6: '良好压缩',
    7: '较高压缩率',
    8: '高压缩率',
    9: '推荐级别，平衡速度和压缩率',
    10: '极致压缩，速度最慢'
};

// 更新压缩级别显示
function updateLevelDisplay(value) {
    const level = parseInt(value);
    levelDisplay.textContent = level === 10 ? '级别 best' : `级别 ${level}`;
    levelDescription.textContent = LEVEL_DESCRIPTIONS[level] || '';
}

// 初始化压缩级别滑动条
function initCompressionLevelSlider() {
    updateLevelDisplay(compressionLevel.value);
    compressionLevel.addEventListener('input', (e) => updateLevelDisplay(e.target.value));
}

// 获取当前压缩级别值
function getCompressionLevel() {
    const value = parseInt(compressionLevel.value);
    return value === 10 ? 'best' : value.toString();
}

// 显示设置弹窗
function showSettingsModal() {
    settingsModal.classList.remove('hidden');
}

// 隐藏设置弹窗
function hideSettingsModal() {
    settingsModal.classList.add('hidden');
}

// 扫描文件夹获取所有exe和dll文件
async function scanFolder(folderPath, includeSubfolders) {
    try {
        const files = await invoke('scan_folder', {
            options: {
                folder_path: folderPath,
                include_subfolders: includeSubfolders
            }
        });
        return files;
    } catch (error) {
        addLog(`扫描文件夹失败: ${error}`, 'error');
        return [];
    }
}

// 批量处理文件
async function processBatchFiles(files, mode) {
    if (files.length === 0) {
        addLog('没有找到可处理的文件', 'warning');
        return;
    }

    addLog(`批量处理模式 - 找到 ${files.length} 个文件`, 'info');

    let successCount = 0;
    let failCount = 0;

    // 并行处理，每次最多5个文件
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, Math.min(i + batchSize, files.length));
        const batchStart = i + 1;
        const batchEnd = Math.min(i + batchSize, files.length);

        // 显示进度
        addLog(`处理进度: ${batchStart}-${batchEnd}/${files.length}`, 'info');

        await Promise.all(batch.map(async (file) => {
            try {
                if (mode === 'compress') {
                    await handleCompressWithFile(file);
                } else {
                    await handleDecompressWithFile(file);
                }
                successCount++;
            } catch (error) {
                addLog(`处理失败: ${file}`, 'error');
                failCount++;
            }
        }));

        // 让出主线程，避免阻塞 UI
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    addLog(`批量处理完成! 成功: ${successCount} 个，失败: ${failCount} 个`, 'success', true);
}

// 判断路径是否为文件夹并扫描
async function checkAndScanPath(path) {
    // 尝试扫描文件夹
    const files = await scanFolder(path, includeSubfoldersCheckbox.checked);
    
    if (files.length > 0) {
        // 是文件夹，返回扫描到的文件
        addLog(`扫描文件夹: ${path} (找到 ${files.length} 个文件)`, 'info');
        return files;
    } else {
        // 不是文件夹或没有找到文件，检查是否是exe/dll文件
        if (path.toLowerCase().endsWith('.exe') || path.toLowerCase().endsWith('.dll')) {
            return [path];
        }
        return [];
    }
}

// 设置文件拖放功能
async function setupDragAndDrop() {
    // 监听文件拖放释放事件
    await listen('tauri://drag-drop', async (event) => {
        const paths = event.payload.paths;
        const position = event.payload.position;
        
        if (paths && paths.length > 0) {
            // 收集所有文件
            const allFiles = [];
            
            for (const path of paths) {
                const files = await checkAndScanPath(path);
                allFiles.push(...files);
            }
            
            if (allFiles.length === 0) {
                addLog('未找到 .exe 或 .dll 文件', 'warning');
                return;
            }
            
            // 判断拖放位置，自动触发对应操作
            const dropTarget = getDropTarget(position);
            
            if (dropTarget === 'compress') {
                addLog('检测到拖放至加壳区域', 'info');
                await processBatchFiles(allFiles, 'compress');
            } else if (dropTarget === 'decompress') {
                addLog('检测到拖放至脱壳区域', 'info');
                await processBatchFiles(allFiles, 'decompress');
            } else {
                // 拖放到其他位置，存储文件等待用户选择
                if (allFiles.length === 1) {
                    addLog('请点击"加壳压缩"或"脱壳解压"按钮', 'info');
                    window.droppedFile = allFiles[0];
                } else {
                    addLog(`已选择 ${allFiles.length} 个文件，请点击操作按钮`, 'info');
                    window.droppedFiles = allFiles;
                }
            }
        }
    });

    // 为按钮添加视觉反馈
    setupVisualFeedback(compressBtn);
    setupVisualFeedback(decompressBtn);
}

// 缓存按钮位置信息
let cachedButtonRects = null;

// 更新按钮位置缓存
function updateButtonRectsCache() {
    cachedButtonRects = {
        compress: compressBtn.getBoundingClientRect(),
        decompress: decompressBtn.getBoundingClientRect()
    };
}

// 判断拖放位置对应的目标
function getDropTarget(position) {
    if (!position) return null;
    
    // 如果缓存不存在，创建缓存
    if (!cachedButtonRects) {
        updateButtonRectsCache();
    }
    
    const x = position.x;
    const y = position.y;
    
    // 检查是否在加壳压缩按钮范围内
    const compressRect = cachedButtonRects.compress;
    if (x >= compressRect.left && x <= compressRect.right &&
        y >= compressRect.top && y <= compressRect.bottom) {
        return 'compress';
    }
    
    // 检查是否在脱壳解压按钮范围内
    const decompressRect = cachedButtonRects.decompress;
    if (x >= decompressRect.left && x <= decompressRect.right &&
        y >= decompressRect.top && y <= decompressRect.bottom) {
        return 'decompress';
    }
    
    return null;
}

// 为元素设置视觉反馈
function setupVisualFeedback(element) {
    const handleDragEnter = (e) => {
        e.preventDefault();
        element.classList.add('drag-over');
    };

    const handleDragLeave = () => {
        element.classList.remove('drag-over');
    };

    // 使用被动事件监听器优化性能
    element.addEventListener('dragenter', handleDragEnter, { passive: false });
    element.addEventListener('dragover', handleDragEnter, { passive: false });
    element.addEventListener('dragleave', handleDragLeave, { passive: true });
    element.addEventListener('drop', handleDragLeave, { passive: true });
}

// 处理加壳压缩
async function handleCompress() {
    try {
        // 选择文件（支持多选）
        const selected = await open({
            multiple: true,
            filters: [{
                name: '可执行文件',
                extensions: ['exe', 'dll']
            }]
        });

        if (!selected || (Array.isArray(selected) && selected.length === 0)) {
            addLog('未选择文件', 'warning');
            return;
        }

        // 处理选择结果（可能是单个路径或路径数组）
        const files = Array.isArray(selected) ? selected : [selected];
        
        // 批量处理或单文件处理
        if (files.length === 1) {
            addLog(`选择文件: ${files[0]}`, 'info');
            await handleCompressWithFile(files[0]);
        } else {
            addLog(`选择了 ${files.length} 个文件`, 'info');
            await processBatchFiles(files, 'compress');
        }
    } catch (error) {
        addLog(`操作失败: ${error}`, 'error');
    }
}

// 使用指定文件处理加壳压缩
async function handleCompressWithFile(inputFile) {
    try {

        let outputFile;
        
        // 根据覆盖选项决定输出文件
        if (overwriteCheckbox.checked) {
            outputFile = inputFile;
            addLog('将覆盖原文件', 'info');
        } else {
            // 自动生成输出文件名
            const ext = inputFile.substring(inputFile.lastIndexOf('.'));
            const baseName = inputFile.substring(0, inputFile.lastIndexOf('.'));
            const defaultOutput = `${baseName}_packed${ext}`;

            // 选择输出位置
            outputFile = await save({
                filters: [{
                    name: '可执行文件',
                    extensions: ['exe', 'dll']
                }],
                defaultPath: defaultOutput
            });

            if (!outputFile) {
                addLog('未选择输出位置', 'warning');
                return;
            }

            addLog(`输出文件: ${outputFile}`, 'info');
        }

        // 执行压缩
        await processUpx('compress', inputFile, outputFile);

    } catch (error) {
        addLog(`操作失败: ${error}`, 'error');
    }
}

// 处理脱壳解压
async function handleDecompress() {
    try {
        // 选择文件（支持多选）
        const selected = await open({
            multiple: true,
            filters: [{
                name: '可执行文件',
                extensions: ['exe', 'dll']
            }]
        });

        if (!selected || (Array.isArray(selected) && selected.length === 0)) {
            addLog('未选择文件', 'warning');
            return;
        }

        // 处理选择结果（可能是单个路径或路径数组）
        const files = Array.isArray(selected) ? selected : [selected];
        
        // 批量处理或单文件处理
        if (files.length === 1) {
            addLog(`选择文件: ${files[0]}`, 'info');
            await handleDecompressWithFile(files[0]);
        } else {
            addLog(`选择了 ${files.length} 个文件`, 'info');
            await processBatchFiles(files, 'decompress');
        }
    } catch (error) {
        addLog(`操作失败: ${error}`, 'error');
    }
}

// 使用指定文件处理脱壳解压
async function handleDecompressWithFile(inputFile) {
    try {
        // 脱壳默认覆盖原文件（直接恢复原状）
        const outputFile = inputFile;
        addLog('将覆盖原文件', 'info');

        // 执行解压
        await processUpx('decompress', inputFile, outputFile);

    } catch (error) {
        addLog(`操作失败: ${error}`, 'error');
    }
}

// 执行 UPX 处理
async function processUpx(mode, inputFile, outputFile) {
    try {
        const options = {
            mode: mode,
            input_file: inputFile,
            output_file: outputFile,
            compression_level: getCompressionLevel(),
            backup: backupCheckbox.checked,
            ultra_brute: ultraBruteCheckbox.checked,
            force: forceCompressCheckbox.checked
        };

        if (ultraBruteCheckbox.checked) {
            addLog('已启用极限压缩模式', 'info');
        }

        if (forceCompressCheckbox.checked) {
            addLog('已启用强制压缩模式', 'warning');
        }

        addLog(`开始${mode === 'compress' ? '加壳压缩' : '脱壳解压'}...`, 'info');

        const result = await invoke('process_upx', { options });

        // 分行显示结果信息
        const lines = result.split('\n');
        lines.forEach((line) => {
            if (line.trim()) {
                // 根据内容判断日志类型
                if (line.includes('操作成功') || line.includes('操作完成')) {
                    addLog(line, 'success', true);
                } else if (line.includes('输出:') || line.includes('大小:') || line.includes('压缩率:')) {
                    addLog(line, 'success');
                } else if (line.includes('UPX 输出:')) {
                    addLog(line, 'info');
                } else if (line.includes('扫描') || line.includes('检测')) {
                    addLog(line, 'warning');
                } else {
                    addLog(line, 'info');
                }
            }
        });

    } catch (error) {
        // 格式化错误信息，保留换行和特殊字符
        const errorMsg = String(error);

        // 分行显示错误信息，保持格式
        const lines = errorMsg.split('\n');
        lines.forEach((line, index) => {
            if (line.trim()) {
                // 错误标题使用 error，解决方案等使用 warning
                if (line.includes('[错误]')) {
                    addLog(line, 'error');
                } else if (line.includes('解决方案:') || line.includes('可能原因:')) {
                    addLog(line, 'warning');
                } else if (line.trim().startsWith('-')) {
                    addLog(line, 'info');
                } else {
                    addLog(line, index === 0 ? 'error' : 'warning');
                }
            }
        });
    }
}

// 刷新图标缓存
async function handleRefreshIcon() {
    try {
        addLog('正在刷新图标缓存...', 'info');
        await invoke('refresh_icon_cache');
        addLog('图标缓存刷新完成', 'success');
    } catch (error) {
        addLog(`刷新失败: ${error}`, 'error');
    }
}

// 日志初始化标志
let logInitialized = false;

// 添加日志
function addLog(message, type = 'info', highlight = false) {
    const logLine = document.createElement('div');
    logLine.className = `log-line log-${type} fade-in${highlight ? ' log-highlight' : ''}`;

    const timestamp = new Date().toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    logLine.textContent = `[${timestamp}] ${message}`;

    // 清除初始提示（只执行一次）
    if (!logInitialized) {
        logOutput.innerHTML = '';
        logInitialized = true;
    }

    logOutput.appendChild(logLine);

    // 使用 requestAnimationFrame 优化滚动性能
    requestAnimationFrame(() => {
        logOutput.scrollTop = logOutput.scrollHeight;
    });
}

// 保存当前配置
async function saveCurrentConfig() {
    try {
        const config = {
            compression_level: parseInt(compressionLevel.value),
            overwrite: overwriteCheckbox.checked,
            backup: backupCheckbox.checked,
            ultra_brute: ultraBruteCheckbox.checked,
            include_subfolders: includeSubfoldersCheckbox.checked,
            force_compress: forceCompressCheckbox.checked
        };

        await invoke('save_config', { config });
    } catch (error) {
        console.error('保存配置失败:', error);
    }
}

// 加载保存的配置
async function loadSavedConfig() {
    try {
        const config = await invoke('load_config');

        // 应用配置到界面
        compressionLevel.value = config.compression_level;
        overwriteCheckbox.checked = config.overwrite;
        backupCheckbox.checked = config.backup;
        ultraBruteCheckbox.checked = config.ultra_brute;
        includeSubfoldersCheckbox.checked = config.include_subfolders;
        forceCompressCheckbox.checked = config.force_compress;

        // 更新压缩级别显示（复用现有函数）
        updateLevelDisplay(config.compression_level);

        addLog('已加载上次保存的配置', 'info');
    } catch (error) {
        console.error('加载配置失败:', error);
        addLog('使用默认配置', 'info');
    }
}

