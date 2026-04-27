from fastapi import FastAPI,HTTPException,Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import database
from datetime import datetime
import hashlib
from fastapi import Path
import re

#初始化数据库
database.init_database()

app = FastAPI(title="取件码管理系统")

def extract_pure_pickup_code(text: str) -> str:
    """提取纯取件码"""
    if not text:
        return ""
        
    # 只移除空格，保留所有其他字符
    clean_text = text.replace(' ', '').replace('　', '')
    
    print(f"🔍 取件码处理:")
    print(f"   原始输入: '{text}'")
    print(f"   清理后: '{clean_text}'")
    print(f"   包含字母: {bool(re.search(r'[A-Za-z]', clean_text))}")

    return clean_text  # 如果没有识别到模式，返回原文本

def detect_platform(text: str) -> str:
    """根据文本内容自动识别快递平台"""
    if not text:
        return 'qita'
        
    text_lower = text.lower()
    if '拼多多' in text_lower:
        return 'pinduoduo'
    elif '京东' in text_lower:
        return 'jingdong'
    elif '淘宝' in text_lower:
        return 'taobao'
    elif '美团' in text_lower:
        return 'meituan'
    else:
        return 'qita'

#允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#用户认证相关路由
@app.post("/api/register")
def register_user(data: dict):
    """"用户注册"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return {"success": False, "message": "用户名密码不能为空"}
        
        #检查用户是否已存在
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            return {"success": False, "message": "用户名已存在"}
        
        #创建新用户
        cursor.execute('''
            INSERT INTO users (username, password, role)
            VALUES (?, ?, ?)
        ''', (username, password, 'user'))

        conn.commit()
        user_id = cursor.lastrowid
        conn.close()

        return {"success": True, "message": "注册成功", "user_id": user_id}
    
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"注册失败：{str(e)}")
    finally:
        conn.close()

@app.post("/api/login")
def login_user(data: dict):
    """用户登录"""
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    try:
        username = data.get('username')
        password = data.get('password')

        print(f"DEBUG：登陆尝试 - 用户名：{username}, 密码：{password}")
        
        if not username or not password:
            return {"success": False, "message": "用户名和密码不能为空"}
        
        # 验证用户
        cursor.execute("SELECT id, username, password, role FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        print(f"DEBUG：数据库查询结果：{user}")

        if not user:
            return {"success": False, "message": "用户不存在"}
        
        # 直接比较明文密码
        if user['password'] != password:
            print(f"DEBUG: 密码不匹配! 数据库: '{user['password']}', 输入: '{password}'")  # 调试信息
            return {"success": False, "message": "用户名或密码错误"}
        
        print("DEBUG: 登录成功!")  # 调试信息
        return {
            "success": True, 
            "message": "登录成功", 
            "user_id": user['id'],
            "username": username
        }
        
    except Exception as e:
        print(f"DEBUG: 登录异常: {str(e)}")  # 调试信息
        return {"success": False, "message": f"登录失败: {str(e)}"}
    finally:
        conn.close()

@app.get("/api/users")
def get_all_users(exclude_user_id: int = None):
    """获取所有用户列表"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        query = "SELECT id, username, role FROM users"
        params = []
        
        if exclude_user_id:
            query += " WHERE id != ?"
            params.append(exclude_user_id)
        
        query += " ORDER BY username"
        cursor.execute(query, params)
        
        users = cursor.fetchall()
        return {"success": True, "data": [dict(user) for user in users]}
        
    except Exception as e:
        return {"success": False, "message": f"获取用户列表失败：{str(e)}"}
    finally:
        conn.close()

@app.get("/api/debug-users")
def debug_users():
    """查看所有用户数据"""
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password, role FROM users")
    users = cursor.fetchall()
    conn.close()
    return {"users": [dict(user) for user in users]}

@app.get("/")
def read_root():
    return {"massage": "取件码管理系统API"}

@app.get("/api/codes")
def get_codes(user_id: int = None):
    """获取用户的取件码"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    print(f"🔍 获取取件码 - 接收到的用户ID: {user_id}")  # 调试信息

    if user_id is None:
        print("错误：未提供用户ID")
        return {"success": True, "data": []}

    cursor.execute('''
        SELECT
            ec.id,
            ec.pickup_code,
            ec.status,
            ec.received_time,
            p.display_name as platform_name,
            p.color as platform_color
        FROM express_codes ec
        JOIN platforms p ON ec.platform_id = p.id
        WHERE ec.user_id = ?
        ORDER BY ec.received_time DESC     
    ''', (user_id,))

    codes = cursor.fetchall()
    conn.close()

    print(f"📦 为用户 {user_id} 加载了 {len(codes)} 个取件码")
    return {"success": True, "data": [dict(code) for code in codes]}

@app.post("/api/codes")
def add_code(data: dict, user_id: int = 1):
    """为用户添加取件码"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        # 从请求体中获取用户ID
        user_id = data.get('user_id')
        if user_id is None:
            return {"success": False, "message": "未提供用户ID"}
        
        print(f"🔍 添加取件码 - 用户ID: {user_id}")  # 调试信息

        # 智能处理取件码和平台识别
        original_text = data.get('code', '')
        pure_code = extract_pure_pickup_code(original_text)
        
        # 优先使用文本识别的平台，只有在无法识别时才使用手动选择
        auto_detected_platform = detect_platform(original_text)
        manual_selected_platform = data.get('platform', 'qita')

        # 决定最终使用的平台
        if auto_detected_platform != 'qita':  # 如果文本识别成功（不是其他）
            platform_name = auto_detected_platform  # 使用文本识别结果
            source = "自动识别"
        else:
            platform_name = manual_selected_platform  # 使用手动选择
            source = "手动选择"

        print(f"🔍 平台选择调试:")
        print(f"   文本识别结果: {auto_detected_platform}")
        print(f"   手动选择结果: {manual_selected_platform}")
        print(f"   最终使用平台: {platform_name} ({source})")
        print(f"   提取的取件码: {pure_code}")

        # 获取平台ID
        cursor.execute("SELECT id FROM platforms WHERE name = ?", (platform_name,))
        platform = cursor.fetchone()
        platform_id = platform['id'] if platform else 5

        #插入取件码
        cursor.execute('''
            INSERT INTO express_codes
            (user_id, platform_id, pickup_code, source_type, original_text, received_time)
                VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            platform_id,
            pure_code,
            data.get('source_type','manual'),
            original_text,
            datetime.now()
        ))

        conn.commit()
        print("✅ 取件码插入成功")
        return {"success": True, "message": "取件码添加成功"}
    
    except Exception as e:
        conn.rollback()
        print(f"❌ 插入失败: {str(e)}")
        return {"success": False, "message": f"添加失败：{str(e)}"}
    finally:
        conn.close()

@app.get("/api/test-parse")
def test_parse(text: str):
    """测试取件码解析"""
    return {
        "original": text,
        "parsed_code": extract_pure_pickup_code(text),
        "platform": detect_platform(text)
    }

@app.put("/api/codes/{code_id}/complete")
def complete_code(code_id: int = Path(..., description="取件码ID")):
    """标记为已取件"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            UPDATE express_codes
            SET status = 'completed'
            WHERE id = ?
        ''', (code_id,))

        conn.commit()
        success = cursor.rowcount > 0
        return {"success": success, "message": "标记成功" if success else "取件码不存在"}
    except Exception as e:
        conn.rollback()
        return {"success": False, "message": f"标记失败：{str(e)}"}
    finally:
        conn.close()

# 备用标记接口 - 使用不同的路径
@app.put("/api/codes/{code_id}")
def update_code_status(code_id: int, data: dict):
    """更新取件码状态或列表"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        user_id = data.get('user_id')
        
        # 验证用户权限
        cursor.execute('''
            SELECT id FROM express_codes 
            WHERE id = ? AND user_id = ?
        ''', (code_id, user_id))
        
        if not cursor.fetchone():
            return {"success": False, "message": "取件码不存在或无权操作"}
        
        # 构建更新字段
        updates = []
        values = []
        
        if 'status' in data:
            updates.append("status = ?")
            values.append(data['status'])
        
        if 'list_id' in data:
            list_id = data['list_id']
            if list_id is None:
                updates.append("list_id = NULL")
            else:
                # 验证列表权限
                cursor.execute('''
                    SELECT id FROM user_lists 
                    WHERE id = ? AND user_id = ?
                ''', (list_id, user_id))
                
                if not cursor.fetchone():
                    return {"success": False, "message": "列表不存在或无权操作"}
                
                updates.append("list_id = ?")
                values.append(list_id)
        
        if not updates:
            return {"success": False, "message": "没有可更新的字段"}
        
        values.append(code_id)
        query = f'''
            UPDATE express_codes 
            SET {', '.join(updates)}
            WHERE id = ?
        '''
        
        cursor.execute(query, values)
        conn.commit()
        
        return {"success": True, "message": "更新成功"}
        
    except Exception as e:
        conn.rollback()
        print(f"❌ 更新失败：{str(e)}")
        return {"success": False, "message": f"更新失败：{str(e)}"}
    finally:
        conn.close()

# 添加调试路由
@app.get("/api/debug-codes")
def debug_codes():
    """查看所有取件码数据"""
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT ec.id, ec.pickup_code, ec.status, p.display_name 
        FROM express_codes ec 
        JOIN platforms p ON ec.platform_id = p.id
    ''')
    codes = cursor.fetchall()
    conn.close()
    return {"codes": [dict(code) for code in codes]}

@app.get("/api/lists")
def get_user_lists(user_id: int):
    """获取用户的所有列表"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            SELECT id, name, description, color, created_at,
                   (SELECT COUNT(*) FROM express_codes WHERE list_id = user_lists.id) as code_count
            FROM user_lists 
            WHERE user_id = ?
            ORDER BY created_at DESC
        ''', (user_id,))
        
        lists = cursor.fetchall()
        return {"success": True, "data": [dict(lst) for lst in lists]}
        
    except Exception as e:
        return {"success": False, "message": f"获取列表失败：{str(e)}"}
    finally:
        conn.close()

# 2. 创建新列表
@app.post("/api/lists")
def create_list(data: dict):
    """创建新列表"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        user_id = data.get('user_id')
        name = data.get('name')
        description = data.get('description', '')
        color = data.get('color', '#808080')
        
        if not user_id or not name:
            return {"success": False, "message": "参数不完整"}
        
        # 检查列表名是否重复
        cursor.execute('''
            SELECT id FROM user_lists 
            WHERE user_id = ? AND name = ?
        ''', (user_id, name))
        
        if cursor.fetchone():
            return {"success": False, "message": "列表名已存在"}
        
        # 创建列表
        cursor.execute('''
            INSERT INTO user_lists (user_id, name, description, color)
            VALUES (?, ?, ?, ?)
        ''', (user_id, name, description, color))
        
        conn.commit()
        new_list_id = cursor.lastrowid
        
        return {"success": True, "message": "创建成功", "list_id": new_list_id}
        
    except Exception as e:
        conn.rollback()
        return {"success": False, "message": f"创建失败：{str(e)}"}
    finally:
        conn.close()

# 3. 更新列表信息
@app.put("/api/lists/{list_id}")
def update_list(list_id: int, data: dict):
    """更新列表信息"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        user_id = data.get('user_id')
        
        # 验证用户权限
        cursor.execute('''
            SELECT id FROM user_lists 
            WHERE id = ? AND user_id = ?
        ''', (list_id, user_id))
        
        if not cursor.fetchone():
            return {"success": False, "message": "列表不存在或无权操作"}
        
        # 更新字段
        updates = []
        values = []
        
        if 'name' in data:
            updates.append("name = ?")
            values.append(data['name'])
        
        if 'description' in data:
            updates.append("description = ?")
            values.append(data['description'])
        
        if 'color' in data:
            updates.append("color = ?")
            values.append(data['color'])
        
        if not updates:
            return {"success": False, "message": "没有可更新的字段"}
        
        values.append(list_id)
        values.append(user_id)
        
        query = f'''
            UPDATE user_lists 
            SET {', '.join(updates)}
            WHERE id = ? AND user_id = ?
        '''
        
        cursor.execute(query, values)
        conn.commit()
        
        return {"success": True, "message": "更新成功"}
        
    except Exception as e:
        conn.rollback()
        return {"success": False, "message": f"更新失败：{str(e)}"}
    finally:
        conn.close()

# 4. 删除列表
@app.delete("/api/lists/{list_id}")
def delete_list(list_id: int, user_id: int = None):
    """删除列表（会同时删除列表中的取件码）"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        if not user_id:
            return {"success": False, "message": "未提供用户ID"}
        
        # 验证用户权限
        cursor.execute('''
            SELECT id FROM user_lists 
            WHERE id = ? AND user_id = ?
        ''', (list_id, user_id))
        
        if not cursor.fetchone():
            return {"success": False, "message": "列表不存在或无权操作"}
        
        # 先删除列表中的取件码
        cursor.execute('DELETE FROM express_codes WHERE list_id = ?', (list_id,))
        # 再删除列表
        cursor.execute('DELETE FROM user_lists WHERE id = ?', (list_id,))
        
        conn.commit()
        return {"success": True, "message": "删除成功"}
        
    except Exception as e:
        conn.rollback()
        return {"success": False, "message": f"删除失败：{str(e)}"}
    finally:
        conn.close()

# 5. 获取指定列表中的所有取件码
@app.get("/api/lists/{list_id}/codes")
def get_list_codes(list_id: int, user_id: int = None):
    """获取指定列表中的所有取件码"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        if not user_id:
            return {"success": False, "message": "未提供用户ID"}
        
        # 验证用户权限
        cursor.execute('''
            SELECT id FROM user_lists 
            WHERE id = ? AND user_id = ?
        ''', (list_id, user_id))
        
        if not cursor.fetchone():
            return {"success": False, "message": "列表不存在或无权查看"}
        
        cursor.execute('''
            SELECT
                ec.id,
                ec.pickup_code,
                ec.status,
                ec.received_time,
                p.display_name as platform_name,
                p.color as platform_color,
                ul.name as list_name,
                ul.color as list_color
            FROM express_codes ec
            JOIN platforms p ON ec.platform_id = p.id
            LEFT JOIN user_lists ul ON ec.list_id = ul.id
            WHERE ec.user_id = ? AND ec.list_id = ?
            ORDER BY ec.received_time DESC
        ''', (user_id, list_id))

        codes = cursor.fetchall()
        return {"success": True, "data": [dict(code) for code in codes]}
        
    except Exception as e:
        return {"success": False, "message": f"获取取件码失败：{str(e)}"}
    finally:
        conn.close()

# 6. 批量更新取件码
@app.put("/api/codes/batch")
def batch_update_codes(data: dict):
    """批量更新取件码"""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    try:
        user_id = data.get('user_id')
        code_ids = data.get('code_ids', [])
        action = data.get('action')  # 'complete', 'delete', 'move'
        target_list_id = data.get('target_list_id')
        
        if not user_id or not code_ids or not action:
            return {"success": False, "message": "参数不完整"}
        
        # 验证用户对所有这些取件码的权限
        placeholders = ','.join(['?'] * len(code_ids))
        cursor.execute(f'''
            SELECT COUNT(*) as count FROM express_codes 
            WHERE id IN ({placeholders}) AND user_id = ?
        ''', (*code_ids, user_id))
        
        result = cursor.fetchone()
        if result['count'] != len(code_ids):
            return {"success": False, "message": "部分取件码不存在或无权操作"}
        
        # 执行批量操作
        if action == 'complete':
            cursor.execute(f'''
                UPDATE express_codes 
                SET status = 'completed'
                WHERE id IN ({placeholders})
            ''', tuple(code_ids))
            
        elif action == 'delete':
            cursor.execute(f'''
                DELETE FROM express_codes 
                WHERE id IN ({placeholders})
            ''', tuple(code_ids))
            
        elif action == 'move' and target_list_id:
            # 验证目标列表权限
            cursor.execute('''
                SELECT id FROM user_lists 
                WHERE id = ? AND user_id = ?
            ''', (target_list_id, user_id))
            
            if not cursor.fetchone():
                return {"success": False, "message": "目标列表不存在或无权操作"}
            
            cursor.execute(f'''
                UPDATE express_codes 
                SET list_id = ?
                WHERE id IN ({placeholders})
            ''', (target_list_id, *code_ids))
        
        else:
            return {"success": False, "message": "无效的操作类型"}
        
        conn.commit()
        return {"success": True, "message": "批量操作成功"}
        
    except Exception as e:
        conn.rollback()
        return {"success": False, "message": f"批量操作失败：{str(e)}"}
    finally:
        conn.close()

@app.get("/api/debug-all")
def debug_all():
    """查看所有用户和取件码数据"""
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # 查看所有用户
    cursor.execute("SELECT id, username FROM users")
    users = cursor.fetchall()
    
    # 查看所有取件码及其所属用户
    cursor.execute('''
        SELECT ec.id, ec.pickup_code, ec.user_id, u.username, ec.status, p.display_name as platform
        FROM express_codes ec 
        JOIN users u ON ec.user_id = u.id
        JOIN platforms p ON ec.platform_id = p.id
        ORDER BY ec.user_id, ec.id
    ''')
    codes = cursor.fetchall()
    
    conn.close()
    
    return {
        "users": [dict(user) for user in users],
        "codes": [dict(code) for code in codes]
    }

# ============ 在这里添加获取当前用户取件码的调试接口 ============
@app.get("/api/debug-user-codes")
def debug_user_codes(user_id: int = None):
    """查看指定用户的取件码"""
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    if user_id is None:
        user_id = 1
    
    cursor.execute('''
        SELECT ec.id, ec.pickup_code, ec.status, u.username, p.display_name as platform
        FROM express_codes ec 
        JOIN users u ON ec.user_id = u.id
        JOIN platforms p ON ec.platform_id = p.id
        WHERE ec.user_id = ?
        ORDER BY ec.id
    ''', (user_id,))

    codes = cursor.fetchall()
    conn.close()
    
    return {
        "user_id": user_id,
        "codes": [dict(code) for code in codes]
    }

@app.get("/api/routes")
def list_routes():
    """列出所有API路由"""
    routes_info = []
    
    for route in app.routes:
        if hasattr(route, "methods"):
            route_info = {
                "path": route.path,
                "methods": list(route.methods),
                "name": route.name if hasattr(route, "name") else "未命名",
                "summary": getattr(route, "summary", ""),
                "description": getattr(route, "description", "")
            }
            routes_info.append(route_info)
    
    # 按路径排序
    routes_info.sort(key=lambda x: x["path"])
    
    return {
        "success": True,
        "data": routes_info,
        "count": len(routes_info)
    }

if __name__ == "__main__":
    import uvicorn
    print("启动FastAPI服务器...")
    print("访问地址： http://localhost:8000")
    print("API文档: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
