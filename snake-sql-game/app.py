from flask import Flask, render_template, request, jsonify
import sqlite3
import json
import re
import os
import tempfile

app = Flask(__name__)

# Use temp directory instead of OneDrive to avoid permission issues
BASE_DIR = tempfile.gettempdir()
DB_PATH = os.path.join(BASE_DIR, 'snake_sql_game.db')

def init_database():
    """Initialize the database with sample SQL questions"""
    print("Initializing database...")
    print(f"Database path: {DB_PATH}")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Create tables
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sql_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                expected_query TEXT NOT NULL,
                difficulty TEXT DEFAULT 'easy'
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                high_score INTEGER DEFAULT 0,
                total_questions INTEGER DEFAULT 0,
                correct_answers INTEGER DEFAULT 0
            )
        ''')
        
        # Sample data for demonstration
        sample_questions = [
            {
                'question': "Select all employees from the 'employees' table",
                'expected_query': "SELECT * FROM employees;",
                'difficulty': 'easy'
            },
            {
                'question': "Find all customers from California ordered by name",
                'expected_query': "SELECT * FROM customers WHERE state = 'CA' ORDER BY name;",
                'difficulty': 'easy'
            },
            {
                'question': "Count the number of products in each category",
                'expected_query': "SELECT category, COUNT(*) FROM products GROUP BY category;",
                'difficulty': 'medium'
            },
            {
                'question': "Find employees with salary greater than 50000",
                'expected_query': "SELECT * FROM employees WHERE salary > 50000;",
                'difficulty': 'easy'
            },
            {
                'question': "Get the average price of products by supplier",
                'expected_query': "SELECT supplier_id, AVG(price) FROM products GROUP BY supplier_id;",
                'difficulty': 'medium'
            }
        ]
        
        # Insert sample questions
        for q in sample_questions:
            cursor.execute('''
                INSERT OR IGNORE INTO sql_questions (question, expected_query, difficulty)
                VALUES (?, ?, ?)
            ''', (q['question'], q['expected_query'], q['difficulty']))
        
        conn.commit()
        conn.close()
        print("Database initialized successfully!")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        raise

# ... rest of the app.py code remains the same (all the routes and functions)
# Just replace the entire init_database function and DB_PATH definition

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/question/random')
def get_random_question():
    """Get a random SQL question"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, question, expected_query, difficulty 
            FROM sql_questions 
            ORDER BY RANDOM() 
            LIMIT 1
        ''')
        
        question = cursor.fetchone()
        conn.close()
        
        if question:
            return jsonify({
                'id': question[0],
                'question': question[1],
                'expected_query': question[2],
                'difficulty': question[3]
            })
        else:
            return jsonify({'error': 'No questions available'}), 404
    except Exception as e:
        return jsonify({'error': f'Database error: {e}'}), 500

@app.route('/api/validate', methods=['POST'])
def validate_query():
    """Validate user's SQL query"""
    data = request.json
    user_query = data.get('query', '').strip()
    question_id = data.get('question_id')
    
    if not user_query or not question_id:
        return jsonify({'valid': False, 'error': 'Missing query or question ID'})
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get the expected query
        cursor.execute('SELECT expected_query FROM sql_questions WHERE id = ?', (question_id,))
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return jsonify({'valid': False, 'error': 'Question not found'})
        
        expected_query = result[0]
        
        # Basic validation (for demo purposes)
        is_valid = validate_sql_query(user_query, expected_query)
        
        conn.close()
        
        return jsonify({
            'valid': is_valid,
            'expected': expected_query,
            'user_query': user_query
        })
    except Exception as e:
        return jsonify({'valid': False, 'error': f'Validation error: {e}'})

def validate_sql_query(user_query, expected_query):
    """Simple SQL query validation (basic implementation)"""
    # Normalize queries for comparison
    def normalize_query(query):
        # Remove extra whitespace and convert to lowercase
        query = re.sub(r'\s+', ' ', query.strip()).lower()
        # Remove trailing semicolons for comparison
        return query.rstrip(';')
    
    user_norm = normalize_query(user_query)
    expected_norm = normalize_query(expected_query)
    
    # Basic exact match
    return user_norm == expected_norm

@app.route('/api/stats', methods=['POST'])
def update_stats():
    """Update user statistics"""
    data = request.json
    username = data.get('username', 'anonymous')
    score = data.get('score', 0)
    questions_answered = data.get('questions_answered', 0)
    correct_answers = data.get('correct_answers', 0)
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Insert or update user stats
        cursor.execute('''
            INSERT INTO users (username, high_score, total_questions, correct_answers)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                high_score = MAX(high_score, ?),
                total_questions = total_questions + ?,
                correct_answers = correct_answers + ?
        ''', (username, score, questions_answered, correct_answers, 
              score, questions_answered, correct_answers))
        
        conn.commit()
        conn.close()
        
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

if __name__ == '__main__':
    print("Starting Snake SQL Game...")
    print(f"Database location: {DB_PATH}")
    init_database()
    print("Server starting on http://localhost:5000")
    app.run(debug=True)