const { createApp, ref, onMounted, computed } = Vue;
createApp({
    setup() {
        // 用户认证状态
        const currentView = ref('dashboard')
        const isLoggedIn = ref(false);
        const currentUser = ref('');
        const showRegister = ref(false);
        
        // 登录表单
        const loginForm = ref({
            username: '',
            password: ''
        });
        
        // 注册表单
        const registerForm = ref({
            username: '',
            password: '',
            confirmPassword: ''
        });

        // 列表管理状态
        const userLists = ref([]);  // 用户的列表
        const showListManager = ref(false);  // 显示列表管理器
        const newListForm = ref({  // 新建列表表单
            name: '',
            description: '',
            color: '#4285F4'
        });
        const editingList = ref(null);  // 正在编辑的列表
        // 添加新的状态变量
        const expandedListId = ref(null);  // 当前展开的列表ID
        const listCodes = ref({});

        //取件码状态
        const codes = ref([]);
        const newCode = ref({
            platform: 'pinduoduo',
            code: ''
        });

        // 搜索状态
        const searchQuery = ref({
            platform: '',
            date: '',
            keyword: ''
        });

        const searchResults = ref([]);
        const showSearchResults = ref(false);

        // 个人资料状态
        const profileSettings = ref({
            receiveReminders: true,      // 接收滞留包裹提醒
            reminderTime: '20:00',       // 提醒时间
            notificationSound: true,     // 通知声音
        });

        const showUserSwitch = ref(false);
        const availableUsers = ref([]);
        const showProfileDialog = ref(false); // 添加这个

        // 打开个人资料
        function openProfile() {
            showProfileDialog.value = true;
            loadProfileSettings();
        }

        // 关闭个人资料  
        function closeProfile() {
            showProfileDialog.value = false;
        }

        function getCurrentUserId() {
            console.log('🆔 获取用户ID - 当前用户名:', currentUser.value);
            // 方法1：如果登录响应返回了user_id，保存到currentUserId变量中
            if (window.currentUserId) {
                return window.currentUserId;
            }

            const userMap = {
                'admin': 1,
                '用户2': 2,
                '用户3': 3,
                'tqx': 4,
                'user1': 1,
                'user2': 2
                // 添加您的实际用户名和对应的数据库ID
            };

            const userId = userMap[currentUser.value] || 1;
            console.log('🆔 使用映射用户ID:', userId);
            return userId;
        }

        // 加载个人资料设置
        function loadProfileSettings() {
            const saved = localStorage.getItem('pickupProfileSettings');
            if (saved) {
                profileSettings.value = { ...profileSettings.value, ...JSON.parse(saved) };
            }
            
            // 模拟加载可用用户列表
            availableUsers.value = [
                { id: 1, username: currentUser.value, current: true },
                { id: 2, username: '用户2', lastLogin: '2024-01-10' },
                { id: 3, username: '用户3', lastLogin: '2024-01-08' }
            ];
        }

        // 保存个人资料设置
        function saveProfileSettings() {
            localStorage.setItem('pickupProfileSettings', JSON.stringify(profileSettings.value));
            alert('设置已保存！');
        }

        // 切换用户
        function switchUser(targetUser) {
            if (confirm('确定要切换用户吗？将返回登录页面重新登录。')) {
                // 清除当前用户信息，回到登录状态
                isLoggedIn.value = false;
                currentUser.value = '';
                codes.value = [];
                showUserSwitch.value = false;
                
                // 重置登录表单
                loginForm.value = { username: '', password: '' };
                
                //alert('请重新登录其他账号');
            }
        }

        // 添加新用户
        function addNewUser() {
            const newUsername = prompt('请输入新用户名：');
            if (newUsername && newUsername.trim()) {
                availableUsers.value.push({
                    id: availableUsers.value.length + 1,
                    username: newUsername.trim(),
                    lastLogin: '从未登录'
                });
                alert(`用户 "${newUsername}" 已添加！将返回登录界面。`);

                // 自动切换到新用户并返回登录页
                showUserSwitch.value = false;
                isLoggedIn.value = false;
                currentUser.value = '';
                codes.value = [];
                
                // 自动填充新用户名到登录表单
                loginForm.value.username = username;
                loginForm.value.password = '';
                
                // 隐藏注册弹窗
                showRegister.value = false;
                
                alert(`用户 "${username}" 已添加！请设置密码并登录。`);
                
                // 焦点自动到密码输入框
                setTimeout(() => {
                    const passwordInput = document.querySelector('input[type="password"]');
                    if (passwordInput) passwordInput.focus();
                }, 100);
            }
        }

        // ============ 列表管理函数 ============

        // 加载用户的所有列表
        async function loadUserLists() {
            if (!isLoggedIn.value) return;
            
            try {
                const userId = getCurrentUserId();
                const response = await fetch(`http://localhost:8000/api/lists?user_id=${userId}`);
                const result = await response.json();
                
                if (result.success) {
                    userLists.value = result.data;
                    console.log('📋 加载的列表:', userLists.value);
                } else {
                    console.error('加载列表失败:', result.message);
                }
            } catch (error) {
                console.error('加载列表失败:', error);
            }
        }

        // ============ 列表管理辅助函数 ============

        // 列表颜色选项
        const listColorOptions = [
            { value: '#4285F4', label: '蓝色' },
            { value: '#EA4335', label: '红色' },
            { value: '#FBBC05', label: '黄色' },
            { value: '#34A853', label: '绿色' },
            { value: '#8B5CF6', label: '紫色' },
            { value: '#F97316', label: '橙色' },
            { value: '#06B6D4', label: '青色' },
            { value: '#EC4899', label: '粉色' },
            { value: '#78716C', label: '灰色' },
            { value: '#0F766E', label: '深青' }
        ];

        // 格式化列表日期
        function formatListDate(dateStr) {
            if (!dateStr) return '未知时间';
            
            try {
                const date = new Date(dateStr);
                const now = new Date();
                const diffMs = now - date;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) {
                    return '今天';
                } else if (diffDays === 1) {
                    return '昨天';
                } else if (diffDays < 7) {
                    return `${diffDays}天前`;
                } else if (diffDays < 30) {
                    const weeks = Math.floor(diffDays / 7);
                    return `${weeks}周前`;
                } else {
                    return date.toLocaleDateString('zh-CN', {
                        month: 'short',
                        day: 'numeric'
                    });
                }
            } catch (e) {
                return '未知时间';
            }
        }

        // 获取列表颜色（带默认值）
        function getListColor(list) {
            return list?.color || '#808080';
        }

        // 获取列表显示的取件码数量
        function getListCodeCount(list) {
            return list?.code_count || 0;
        }

        // 打开列表管理器
        function openListManager() {
            showListManager.value = true;
            loadUserLists();
            resetNewListForm();
        }

        // 关闭列表管理器
        function closeListManager() {
            showListManager.value = false;
            editingList.value = null;
            resetNewListForm();
        }

        // 重置新建列表表单
        function resetNewListForm() {
            newListForm.value = {
                name: '',
                description: '',
                color: '#4285F4'
            };
        }

        // 创建新列表
        async function createNewList() {
            if (!newListForm.value.name.trim()) {
                alert('请输入列表名称');
                return;
            }
            
            try {
                const userId = getCurrentUserId();
                const response = await fetch('http://localhost:8000/api/lists', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        name: newListForm.value.name.trim(),
                        description: newListForm.value.description.trim(),
                        color: newListForm.value.color
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('列表创建成功！');
                    resetNewListForm();
                    await loadUserLists(); // 重新加载列表
                } else {
                    alert('创建失败：' + result.message);
                }
            } catch (error) {
                console.error('创建列表失败:', error);
                alert('网络错误，请检查后端服务');
            }
        }

        // 开始编辑列表
        function startEditList(list) {
            editingList.value = { ...list };
            newListForm.value = {
                name: list.name,
                description: list.description || '',
                color: list.color
            };
        }

        // 更新列表
        async function updateList() {
            if (!editingList.value || !newListForm.value.name.trim()) {
                return;
            }
            
            try {
                const userId = getCurrentUserId();
                const response = await fetch(`http://localhost:8000/api/lists/${editingList.value.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        name: newListForm.value.name.trim(),
                        description: newListForm.value.description.trim(),
                        color: newListForm.value.color
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('列表更新成功！');
                    editingList.value = null;
                    resetNewListForm();
                    await loadUserLists(); // 重新加载列表
                } else {
                    alert('更新失败：' + result.message);
                }
            } catch (error) {
                console.error('更新列表失败:', error);
                alert('网络错误，请检查后端服务');
            }
        }

        // 标记取件码为已取件（在列表管理器中）
        async function markCodeAsCompletedInMain(codeId) {
            try {
                const userId = getCurrentUserId();
                const response = await fetch(`http://localhost:8000/api/codes/${codeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        status: 'completed'
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // 正确的方式：更新所有相关的列表
                    for (const listId in listCodes.value) {
                        if (Array.isArray(listCodes.value[listId])) {
                            const index = listCodes.value[listId].findIndex(code => code.id === codeId);
                            if (index !== -1) {
                                // 创建新数组来更新（Vue响应式要求）
                                const newCodes = [...listCodes.value[listId]];
                                newCodes[index] = { ...newCodes[index], status: 'completed' };
                                
                                const newListCodes = { ...listCodes.value };
                                newListCodes[listId] = newCodes;
                                listCodes.value = newListCodes;
                            }
                        }
                    }
                    
                    // 同时更新主列表
                    const mainIndex = codes.value.findIndex(code => code.id === codeId);
                    if (mainIndex !== -1) {
                        codes.value[mainIndex].status = 'completed';
                    }
                } else {
                    alert('操作失败：' + result.message);
                }
            } catch (error) {
                console.error('标记取件码失败：', error);
                alert('网络错误，请检查后端服务');
            }
        }

        // 标记取件码为待取件（在列表管理器中）
        async function markCodeAsPending(codeId) {
            try {
                const userId = getCurrentUserId();
                const response = await fetch(`http://localhost:8000/api/codes/${codeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        status: 'pending'
                    })
                });

                const result = await response.json();

                if (result.success) {
                    console.log(`✅ 标记取件码 ${codeId} 为待取件`);
                    
                    // 1. 更新所有列表中的这个取件码
                    for (const listId in listCodes.value) {
                        if (Array.isArray(listCodes.value[listId])) {
                            const index = listCodes.value[listId].findIndex(code => code.id === codeId);
                            if (index !== -1) {
                                // 创建新数组来触发响应式更新
                                const newCodes = [...listCodes.value[listId]];
                                newCodes[index] = { ...newCodes[index], status: 'pending' };
                                
                                const newListCodes = { ...listCodes.value };
                                newListCodes[listId] = newCodes;
                                listCodes.value = newListCodes;
                                
                                console.log(`✅ 更新列表 ${listId} 中的取件码状态为 pending`);
                            }
                        }
                    }
                    
                    // 2. 更新主列表
                    const mainIndex = codes.value.findIndex(code => code.id === codeId);
                    if (mainIndex !== -1) {
                        const newCodes = [...codes.value];
                        newCodes[mainIndex] = { ...newCodes[mainIndex], status: 'pending' };
                        codes.value = newCodes;
                    }
                    
                    alert('✅ 已标记为待取件！');
                } else {
                    alert('❌ 操作失败：' + result.message);
                }
            } catch (error) {
                console.error('标记取件码失败：', error);
                alert('网络错误，请检查后端服务');
            }
        }

        // 切换列表展开状态
        async function toggleListExpansion(listId) {
            console.log(`🔄 toggleListExpansion: listId=${listId}, 当前展开=${expandedListId.value}`);
    
            if (expandedListId.value === listId) {
                expandedListId.value = null;
                console.log(`📌 收起列表 ${listId}`);
            } else {
                expandedListId.value = listId;
                console.log(`📌 展开列表 ${listId}`);
                
                // 先检查现有数据
                debugListCodes(listId);
                
                // 加载或刷新数据
                if (!listCodes.value[listId]) {
                    console.log(`🔄 首次加载列表 ${listId} 的取件码`);
                    await loadListCodes(listId);
                } else {
                    console.log(`🔄 使用缓存数据，重新加载确保最新`);
                    await loadListCodes(listId); // 总是重新加载确保数据最新
                }
                
                // 检查加载后的数据
                setTimeout(() => {
                    debugListCodes(listId);
                }, 300);
            }
        }

        // 加载指定列表的取件码
        async function loadListCodes(listId) {
            try {
                const userId = getCurrentUserId();
                const url = `http://localhost:8000/api/lists/${listId}/codes?user_id=${userId}`;
                console.log(`🔍 加载列表 ${listId} 的取件码...`);
                
                const response = await fetch(url);
                const result = await response.json();
                
                console.log(`📊 列表 ${listId} API 响应:`, {
                    success: result.success,
                    data_length: result.data?.length || 0,
                    data: result.data
                });
                
                if (result.success) {
                    // ✅ 确保存储的是数组
                    const newListCodes = { ...listCodes.value };
                    
                    // 检查API返回的是不是数组
                    if (!Array.isArray(result.data)) {
                        console.error('❌ API返回的不是数组:', result.data);
                        newListCodes[listId] = [];
                    } else {
                        newListCodes[listId] = result.data;
                        console.log(`✅ 列表 ${listId} 存储了 ${result.data.length} 个取件码`);
                    }
                    
                    listCodes.value = newListCodes;
                    
                    // 调试：查看存储后的数据
                    console.log(`💾 存储后 listCodes[${listId}]:`, listCodes.value[listId]);
                    console.log(`🔢 类型:`, Array.isArray(listCodes.value[listId]) ? '数组 ✅' : '非数组 ❌');
                    console.log(`📏 长度:`, listCodes.value[listId]?.length || 0);
                    
                } else {
                    console.error('❌ 加载失败:', result.message);
                    const newListCodes = { ...listCodes.value };
                    newListCodes[listId] = []; // 确保是空数组
                    listCodes.value = newListCodes;
                }
            } catch (error) {
                console.error('❌ 网络错误:', error);
                const newListCodes = { ...listCodes.value };
                newListCodes[listId] = []; // 确保是空数组
                listCodes.value = newListCodes;
            }
        }

        // 获取列表的待取件数量
        function getListPendingCount(listId) {
            if (!listCodes.value[listId]) return 0;
            return listCodes.value[listId].filter(code => code.status === 'pending').length;
        }

        // 获取列表的已取件数量
        function getListCompletedCount(listId) {
            if (!listCodes.value[listId]) return 0;
            return listCodes.value[listId].filter(code => code.status === 'completed').length;
        }

        // 标记取件码状态（带列表ID参数）
        async function markCodeAsCompleted(codeId, listId) {
            try {
                console.log(`🔍 markCodeAsCompleted 被调用，参数:`, { codeId, targetListId });
                console.log(`🔍 当前展开的列表ID:`, expandedListId.value);
                console.log(`🔍 当前 listCodes 数据:`, listCodes.value);
                const userId = getCurrentUserId();
                console.log(`🏷️ 标记取件码 ${codeId} 为已取件`);
                
                const response = await fetch(`http://localhost:8000/api/codes/${codeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        status: 'completed'
                    })
                });

                const result = await response.json();

                if (result.success) {
                    console.log('✅ 标记成功');
                    
                    // === 关键修复：使用深度响应式更新 ===
                    
                    // 1. 更新主列表（使用Vue.set或创建新数组）
                    const mainIndex = codes.value.findIndex(code => code.id === codeId);
                    if (mainIndex !== -1) {
                        // 创建新数组来触发响应式
                        const newCodes = [...codes.value];
                        newCodes[mainIndex] = { ...newCodes[mainIndex], status: 'completed' };
                        codes.value = newCodes;
                    }
                    
                    // 2. 更新列表管理器中的数据
                    for (const listId in listCodes.value) {
                        if (Array.isArray(listCodes.value[listId])) {
                            const index = listCodes.value[listId].findIndex(code => code.id === codeId);
                            if (index !== -1) {
                                // 正确的方法：创建全新的对象结构
                                const newListCodes = JSON.parse(JSON.stringify(listCodes.value));
                                newListCodes[listId][index].status = 'completed';
                                listCodes.value = newListCodes;
                                
                                console.log(`✅ 更新列表 ${listId} 中的取件码状态`);
                            }
                        }
                    }
                    
                    alert('✅ 标记为已取件成功！');
                } else {
                    alert('❌ 操作失败：' + result.message);
                }
            } catch (error) {
                console.error('❌ 标记失败：', error);
                alert('网络错误，请检查后端服务');
            }
        }

        // 从列表管理打开分配对话框
        function openAssignToListDialogFromList(list) {
            // 这里可以打开分配对话框，并预选这个列表
            alert('打开分配对话框功能，可以预选列表：' + list.name);
            // 或者你可以打开之前实现的分配对话框
            // showAssignToListDialog.value = true;
            // selectedListForPreSelect.value = list.id;
        }

        // 删除列表
        async function deleteList(listId) {
            if (!confirm('确定要删除这个列表吗？列表中的所有取件码也会被删除！')) {
                return;
            }
            
            try {
                const userId = getCurrentUserId();
                const response = await fetch(`http://localhost:8000/api/lists/${listId}?user_id=${userId}`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('列表删除成功！');
                    await loadUserLists(); // 重新加载列表
                    // 如果当前正在查看这个列表的取件码，需要刷新取件码
                    loadCodes();
                } else {
                    alert('删除失败：' + result.message);
                }
            } catch (error) {
                console.error('删除列表失败:', error);
                alert('网络错误，请检查后端服务');
            }
        }

        // 取消编辑
        function cancelEdit() {
            editingList.value = null;
            resetNewListForm();
        }

        // 获取列表显示颜色
        function getListColor(list) {
            return list.color || '#808080';
        }

        // 发送测试提醒
        function sendTestReminder() {
            if (profileSettings.value.receiveReminders) {
                alert('📦 测试提醒：您有滞留包裹需要尽快取件！');
            } else {
                alert('请先开启接收提醒功能');
            }
        }

        // 导出用户数据
        function exportUserData() {
            const userData = {
                username: currentUser.value,
                settings: profileSettings.value,
                codes: codes.value,
                exportTime: new Date().toISOString()
            };
            
            const dataStr = JSON.stringify(userData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `取件码数据_${currentUser.value}_${new Date().getTime()}.json`;
            link.click();
            
            alert('数据导出成功！');
        }

        // 系统设置状态
        const settings = ref({
            theme: 'light',
            fontSize: 'medium', 
            fontFamily: 'system-ui',
            primaryColor: '#1890ff',
            borderRadius: '8px',
            layout: 'default'
        });

        const showSettings = ref(false);

        // 主题配置
        const themeConfig = {
            light: {
                '--bg-color': '#ffffff',
                '--text-color': '#333333',
                '--primary-color': '#1890ff',
                '--border-color': '#e0e0e0',
                '--card-bg': '#f8f9fa',
                '--nav-text-color': '#333333', // 新增：导航栏文字颜色
                '--nav-bg-color': '#f8f9fa'    // 新增：导航栏背景色
            },
            dark: {
                '--bg-color': '#1a1a1a',
                '--text-color': '#ffffff',
                '--primary-color': '#1890ff',
                '--border-color': '#444444',
                '--card-bg': '#2d2d2d',
                '--nav-text-color': '#ffffff', // 新增
                '--nav-bg-color': '#2d2d2d'    // 新增
            },
            blue: {
                '--bg-color': '#f0f8ff',
                '--text-color': '#003366',
                '--primary-color': '#0056b3',
                '--border-color': '#b3d4fc',
                '--card-bg': '#e6f3ff',
                '--nav-text-color': '#003366', // 新增
                '--nav-bg-color': '#e6f3ff'    // 新增
            },
            green: {
                '--bg-color': '#f6ffed',
                '--text-color': '#135200',
                '--primary-color': '#52c41a',
                '--border-color': '#b7eb8f',
                '--card-bg': '#f6ffed',
                '--nav-text-color': '#135200', // 新增
                '--nav-bg-color': '#f6ffed'    // 新增
            }
        };

        // 应用系统设置
        function applySettings() {
            const currentTheme = themeConfig[settings.value.theme];
            
            Object.entries(currentTheme).forEach(([key, value]) => {
                document.documentElement.style.setProperty(key, value);
            });
            
            const fontSizeMap = {
                small: '14px',
                medium: '16px',
                large: '18px'
            };
            document.documentElement.style.setProperty('--font-size', fontSizeMap[settings.value.fontSize]);
            document.documentElement.style.setProperty('--font-family', settings.value.fontFamily);
            document.documentElement.style.setProperty('--primary-color', settings.value.primaryColor);
            document.documentElement.style.setProperty('--border-radius', settings.value.borderRadius);
            
            localStorage.setItem('pickupSettings', JSON.stringify(settings.value));

            // 强制重新应用样式到所有元素
            applyStylesToElements();
        }

        // 强制应用样式到所有元素
        function applyStylesToElements() {
            // 给 body 添加一个临时类来触发重绘
            document.body.classList.add('settings-applied');
            setTimeout(() => {
                document.body.classList.remove('settings-applied');
            }, 100);

            // 更新所有动态颜色的元素
            updateDynamicColors();
        }

        // 更新动态颜色
        function updateDynamicColors() {
            // 更新平台颜色
            const platformElements = document.querySelectorAll('.platform');
            platformElements.forEach(el => {
                const currentColor = el.style.color;
                if (currentColor && currentColor.includes('var(--primary-color)')) {
                    el.style.color = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
                }
            });
            
            // 更新边框颜色
            const codeItems = document.querySelectorAll('.code-item');
            codeItems.forEach(item => {
                const borderColor = item.style.borderLeftColor;
                if (borderColor && borderColor.includes('var(--primary-color)')) {
                    item.style.borderLeftColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
                }
            });
            
            // 更新按钮样式
            const primaryButtons = document.querySelectorAll('.btn-primary, .complete-btn, .login-btn, .register-btn');
            primaryButtons.forEach(btn => {
                btn.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
            });
        }

        // 加载保存的设置
        function loadSavedSettings() {
            const saved = localStorage.getItem('pickupSettings');
            if (saved) {
                settings.value = { ...settings.value, ...JSON.parse(saved) };
                applySettings();
            }
        }

        // 重置设置为默认
        function resetSettings() {
            settings.value = {
                theme: 'light',
                fontSize: 'medium',
                fontFamily: 'system-ui',
                primaryColor: '#1890ff',
                borderRadius: '8px',
                layout: 'default'
            };
            applySettings();
        }

        //计算待取件的取件码
        const pendingCodes = computed(() => {
            return codes.value.filter(code => code.status === 'pending');
        });

        //计算已取件的取件码
        const completedCodes = computed(() => {
            return codes.value.filter(code => code.status === 'completed');
        });

        // 用户认证方法
        async function login() {
            if (!loginForm.value.username || !loginForm.value.password) {
                alert('请输入用户名和密码');
                return;
            }

            try {
                const response = await fetch('http://localhost:8000/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(loginForm.value)
                });

                const result = await response.json();
                console.log('登录响应：', result);

                if (result.success) {
                    isLoggedIn.value = true;
                    currentUser.value = result.username;

                    window.currentUserId = result.user_id;
                    console.log('✅ 登录成功 - 保存的用户ID:', window.currentUserId);
                    console.log('✅ 登录成功 - 用户名:', currentUser.value);
                    
                    // 清空登录表单
                    loginForm.value = { username: '', password: '' };
                    // 加载用户的取件码
                    loadCodes();
                } else {
                    alert('登录失败: ' + result.message);
                }
            } catch (error) {
                console.error('登录失败:', error);
                alert('网络错误，请检查后端服务');
            }
        }

        async function register() {
            console.log('注册函数被调用');

            if (!registerForm.value.username || !registerForm.value.password) {
                alert('请输入用户名和密码');
                return;
            }

            if (registerForm.value.password !== registerForm.value.confirmPassword) {
                alert('两次输入的密码不一致');
                return;
            }

            try {
                console.log('发送注册请求');
                const response = await fetch('http://localhost:8000/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: registerForm.value.username,
                        password: registerForm.value.password
                    })
                });

                const result = await response.json();
                console.log('注册响应：', result);
                
                if (result.success) {
                    showRegister.value = false;
                    registerForm.value = { username: '', password: '', confirmPassword: '' };
                } else {
                    alert('注册失败: ' + result.message);
                }
            } catch (error) {
                console.error('注册失败:', error);
                alert('网络错误');
            }
        }

        function logout() {
            isLoggedIn.value = false;
            currentUser.value = '';
            codes.value = [];
        }

        //加载取件码列表
        async function loadCodes() {
            if (!isLoggedIn.value) return;

            try {
                const userId = getCurrentUserId();
                console.log('加载取件码，用户ID:', userId);

                const response = await fetch(`http://localhost:8000/api/codes?user_id=${userId}`);
                const result = await response.json();

                if (result.success) {
                    codes.value = result.data;
                    console.log('📦 加载的取件码数据:', codes.value); // 添加这行
                }
            } catch (error) {
                console.error('加载失败:', error);
                alert('加载取件码失败，清检查后端服务器是否启动');
            }
        }

        //添加取件码
        async function addCode() {
            if (!isLoggedIn.value) {
                alert('请先登录');
                return;
            }

            let finalCode = newCode.value.code.trim();

            if (!finalCode) {
                alert('请输入取件码');
                return;
            }

            // 简单清理：只移除空格，保留用户输入的原样
            finalCode = finalCode.replace(/\s+/g, '');

            

            try {
                const userId = getCurrentUserId();
                console.log('🔍 前端调试 - 添加取件码，用户ID:', userId);
                console.log('🔍 前端调试 - 取件码内容:', finalCode);
                console.log('🔍 前端调试 - 平台:', newCode.value.platform);

                const response = await fetch('http://localhost:8000/api/codes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        platform: newCode.value.platform,
                        code: finalCode,
                        source_type: 'manual',
                        user_id: userId
                    })
                });

                const result = await response.json();

                if (result.success) {
                    newCode.value.code = '';
                    loadCodes();
                    //alert('添加成功！');
                } else {
                    alert('添加失败：' + result.message);
                }
            } catch (error) {
                console.error('添加失败：', error);
                alert('网络错误，请检查后端服务是否启动\n运行命令：cd backend && python main.py');
            }
        }

        // 标记为已取件
        async function completedCode(codeId) {
            try {
                const userId = getCurrentUserId();
                console.log('开始标记取件码：', codeId, '用户ID：', userId);
                
                const response = await fetch(`http://localhost:8000/api/codes/${codeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        status: 'completed'
                    })
                });

                const result = await response.json();

                if (result.success) {
                    alert('标记为已取件成功！');
                    loadCodes(); // 重新加载列表
                } else {
                    alert('操作失败：' + result.message);
                }
            } catch (error) {
                console.error('标记取件码失败：', error);
                alert('网络错误，请检查后端服务');
            }
        }

        // 搜索取件码
        function searchCodes() {
            if (!searchQuery.value.platform && !searchQuery.value.date && !searchQuery.value.keyword) {
                alert('请至少选择一个搜索条件');
                return;
            }

            let results = codes.value;
            
            // 按平台搜索
            if (searchQuery.value.platform) {
                console.log('按平台筛选:', searchQuery.value.platform);
                results = results.filter(code => {
                    // 使用 platform_name 字段进行匹配
                    const match = code.platform_name === getPlatformName(searchQuery.value.platform);
                    console.log('平台对比:', code.platform_name, '===', getPlatformName(searchQuery.value.platform), '结果:', match);
                    return match;
                });
            }
            
            // 按日期搜索
            if (searchQuery.value.date) {
                const searchDate = new Date(searchQuery.value.date).toDateString();
                results = results.filter(code => {
                    const codeDate = new Date(code.received_time).toDateString();
                    return codeDate === searchDate;
                });
            }
            
            // 按关键词搜索（取件码）
            if (searchQuery.value.keyword) {
                const keyword = searchQuery.value.keyword.toLowerCase();
                results = results.filter(code => 
                    code.pickup_code.toLowerCase().includes(keyword)
                );
            }
            
            searchResults.value = results;
            showSearchResults.value = true;
        }

        // 重置搜索
        function resetSearch() {
            searchQuery.value = {
                platform: '',
                date: '',
                keyword: ''
            };
            searchResults.value = [];
            showSearchResults.value = false;
        }

        // 获取所有平台列表（用于搜索下拉框）
        const platformOptions = computed(() => {
            console.log('📊 所有取件码:', codes.value);
            const platforms = [...new Set(codes.value.map(code => code.platform))];
            console.log('📊 提取的平台列表:', platforms);

            const options =  platforms.map(platform => ({
                value: platform,
                label: getPlatformName(platform)
            }));

            console.log('📊 平台选项:', options);
            return options;

        });

        // 获取平台显示名称
        function getPlatformName(platform) {
            const platformNames = {
                'pinduoduo': '拼多多',
                'jingdong': '京东',
                'taobao': '淘宝',
                'meituan': '美团',
                'other': '其他'
            };
            return platformNames[platform] || platform;
        }

        //格式化时间
        function formatTime(timeStr) {
            return new Date(timeStr).toLocaleString('zh-CN');
        }

        

        //页面加载时获取数据
        onMounted(() => {
            loadCodes();
            loadSavedSettings();
            loadProfileSettings();
        });

        // ============ 取件码分配到列表的功能 ============

        // 状态变量
        const showAssignToListDialog = ref(false);  // 显示分配对话框
        const selectedCodeForAssign = ref(null);    // 要分配的取件码
        const targetListForAssign = ref('');        // 目标列表ID
        const showQuickAssignMenu = ref(false);     // 显示快速分配菜单

        // 打开分配对话框
        function openAssignToListDialog(code) {
            selectedCodeForAssign.value = code;
            showAssignToListDialog.value = true;
        }

        // 关闭分配对话框
        function closeAssignToListDialog() {
            showAssignToListDialog.value = false;
            selectedCodeForAssign.value = null;
            targetListForAssign.value = '';
        }

        // 执行分配到列表
        async function assignCodeToList() {
            if (!selectedCodeForAssign.value || !targetListForAssign.value) {
                alert('请选择目标列表');
                return;
            }

            try {
                const userId = getCurrentUserId();
                const targetListId = parseInt(targetListForAssign.value);
                
                console.log(`📤 分配取件码 ${selectedCodeForAssign.value.id} 到列表 ${targetListId}`);
                
                const response = await fetch(`http://localhost:8000/api/codes/${selectedCodeForAssign.value.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        list_id: targetListId
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    alert('分配成功！');
                    closeAssignToListDialog();
                    
                    console.log(`✅ 分配成功`);
                    
                    // 刷新所有数据
                    await loadCodes(); // 刷新主列表
                    
                    // 如果目标列表当前是展开的，刷新它的取件码（不是覆盖！）
                    if (expandedListId.value === targetListId) {
                        console.log(`🔄 重新加载列表 ${targetListId} 的取件码（不覆盖缓存）`);
                        await loadListCodes(targetListId);
                    }
                    
                    // 调试：检查当前列表的取件码数量
                    setTimeout(() => {
                        console.log(`📊 分配后检查 - 列表 ${targetListId} 取件码:`, listCodes.value[targetListId]);
                        console.log(`📏 数量:`, listCodes.value[targetListId]?.length || 0);
                    }, 500);
                    
                } else {
                    alert('分配失败：' + result.message);
                }
            } catch (error) {
                console.error('分配失败：', error);
                alert('网络错误，请检查后端服务');
            }
        }

        // 快速分配到列表（直接从菜单选择）
        async function quickAssignToList(codeId, listId) {
            try {
                const userId = getCurrentUserId();
                const response = await fetch(`http://localhost:8000/api/codes/${codeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        list_id: listId
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    console.log('快速分配成功！');
                    // 刷新取件码列表
                    loadCodes();
                } else {
                    console.error('快速分配失败：', result.message);
                }
            } catch (error) {
                console.error('快速分配失败：', error);
            }
        }

        // 移除取件码的列表分配
        async function removeFromList(codeId,listId) {
            try {
                const userId = getCurrentUserId();
                const response = await fetch(`http://localhost:8000/api/codes/${codeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        list_id: null  // 设置为null表示移除列表
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    console.log('移除列表成功！');
                    loadCodes();
                    // 从本地数据中移除
                    if (listCodes.value[listId]) {
                        const newCodes = listCodes.value[listId].filter(code => code.id !== codeId);
                        const newListCodes = { ...listCodes.value };
                        newListCodes[listId] = newCodes;
                        listCodes.value = newListCodes;
                    }
                    // 同时更新主列表
                    loadCodes();
                } else {
                    alert('操作失败：' + result.message);
                }
            } catch (error) {
                console.error('移除列表失败：', error);
            }
        }

        // 调试函数：检查列表取件码数据
        function debugListCodes(listId) {
            console.log(`=== 调试列表 ${listId} 的取件码 ===`);
            console.log(`listCodes[${listId}] 类型:`, typeof listCodes.value[listId]);
            console.log(`是数组吗:`, Array.isArray(listCodes.value[listId]) ? '是 ✅' : '否 ❌');
            
            if (Array.isArray(listCodes.value[listId])) {
                console.log(`数组长度:`, listCodes.value[listId].length);
                console.log(`取件码详情:`, listCodes.value[listId]);
                
                // 检查是否有重复ID
                const ids = listCodes.value[listId].map(code => code.id);
                const uniqueIds = [...new Set(ids)];
                if (ids.length !== uniqueIds.length) {
                    console.warn(`⚠️ 发现重复的取件码ID!`);
                }
            } else if (listCodes.value[listId]) {
                console.log(`❌ 错误：不是数组，而是:`, listCodes.value[listId]);
            } else {
                console.log(`列表 ${listId} 没有取件码数据`);
            }
            console.log(`=== 调试结束 ===`);
        }

        // 获取取件码所属的列表名称
        function getCodeListName(code) {
            if (!code.list_name) return '未分配';
            return code.list_name;
        }

        // 获取取件码所属的列表颜色
        function getCodeListColor(code) {
            if (!code.list_color) return '#808080';
            return code.list_color;
        }

        // 强制刷新所有列表数据
        async function refreshAllLists() {
            console.log('🔄 强制刷新所有列表数据');
            
            // 重新加载用户列表
            await loadUserLists();
            
            // 重新加载当前展开的列表
            if (expandedListId.value) {
                console.log(`🔄 刷新当前展开的列表 ${expandedListId.value}`);
                const newListCodes = { ...listCodes.value };
                newListCodes[expandedListId.value] = null; // 清除缓存
                listCodes.value = newListCodes;
                
                await loadListCodes(expandedListId.value);
            }
            
            // 重新加载主列表
            await loadCodes();
            
            console.log('✅ 所有数据刷新完成');
        }

        return {
            isLoggedIn,
            currentUser,
            showRegister,
            currentView,
            loginForm,
            registerForm,
            login,
            register,
            logout,
            codes,
            newCode,
            pendingCodes,
            completedCodes,
            addCode,
            completedCode,
            formatTime,
            showProfileDialog,  // 添加这个
            openProfile,        // 添加这个  
            closeProfile,       // 添加这个
            settings,
            showSettings,
            applySettings,
            resetSettings,
            themeOptions: [
                { value: 'light', label: '浅色' },
                { value: 'dark', label: '深色' },
                { value: 'blue', label: '蓝色' },
                { value: 'green', label: '绿色' }
            ],
            fontSizeOptions: [
                { value: 'small', label: '小' },
                { value: 'medium', label: '中' },
                { value: 'large', label: '大' }
            ],
            fontFamilyOptions: [
                { value: 'system-ui', label: '系统字体' },
                { value: 'Arial, sans-serif', label: 'Arial' },
                { value: 'Microsoft YaHei, sans-serif', label: '微软雅黑' },
                { value: 'PingFang SC, sans-serif', label: '苹方' },
                { value: '"SimHei", "黑体", sans-serif', label: '黑体' },
                { value: '"KaiTi", "楷体", sans-serif', label: '楷体' },
                { value: '"Courier New", monospace', label: '等宽字体' }
            ],
            profileSettings,
            showUserSwitch,
            availableUsers,
            saveProfileSettings,
            switchUser,
            addNewUser,
            sendTestReminder,
            exportUserData,
            searchQuery,
            searchResults,
            showSearchResults,
            platformOptions,
            searchCodes,
            resetSearch,
            getPlatformName,
            // 列表管理相关
            userLists,
            showListManager,
            newListForm,
            editingList,
            listColorOptions,
            openListManager,
            closeListManager,
            createNewList,
            startEditList,
            updateList,
            deleteList,
            cancelEdit,
            getListColor,
            formatListDate,
            getListCodeCount,
            showAssignToListDialog,
            selectedCodeForAssign,
            targetListForAssign,
            showQuickAssignMenu,
            openAssignToListDialog,
            closeAssignToListDialog,
            assignCodeToList,
            quickAssignToList,
            getCodeListName,
            getCodeListColor,
            expandedListId,
            listCodes,
            toggleListExpansion,
            getListPendingCount,
            getListCompletedCount,
            openAssignToListDialogFromList,
            markCodeAsCompletedInMain,
            markCodeAsCompleted, 
            markCodeAsPending,
            removeFromList
        };
    }
}).mount('#app'); 