import sqlite3
import os
from datetime import datetime

def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect("express.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    """初始化数据库"""
    # 删除旧数据库，重新创建
    if os.path.exists("express.db"):
        os.remove("express.db")
        print("删除旧数据库文件，重新创建...")
    
    conn = get_db_connection()
    cursor = conn.cursor()

    #创建用户表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')

    #创建平台表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS platforms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VERCHAR(50) NOT NULL UNIQUE,
            display_name VERCHAR(50) NOT NULL,
            color VERCHAR(20) DEFAULT 'black'
        )
    ''')

    #创建用户自定义列表表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            color TEXT DEFAULT '#808080',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(user_id,name)
        )
    ''')

    #创建取件码表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS express_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            platform_id INTEGER NOT NULL,
            list_id INTEGER,
            pickup_code VERCHAR(50) NOT NULL,
            status VERCHAR(20) DEFAULT 'pending',
            source_type VARCHAR(20) DEFAULT 'manual',
            original_text TEXT,
            received_time TIMESTAMP,
            shared_from INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (platform_id) REFERENCES platforms (id),
            FOREIGN KEY (list_id) REFERENCES user_lists (id) ON DELETE SET NULL
        )
    ''')

    #插入默认用户
    cursor.execute('''
        INSERT INTO users (username, password,role)
        VALUES (?, ?, ?)
''', ('admin', '123456', 'admin'))

    #插入初始平台数据
    cursor.execute('''
        INSERT OR IGNORE INTO platforms (name,display_name,color) VALUES
        ('pinduoduo','拼多多','#FF4466'),
        ('jingdong','京东','#E31414'),
        ('taobao','淘宝','#FF6A00'),
        ('meituan','美团','#FFC300'),
        ('qita','其他','#666666')
    ''')

    conn.commit()
    conn.close()
    print("数据库初始化完成!")

if __name__ == "__main__":
    init_database()
    print("数据库初始化测试完成")