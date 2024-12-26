import os
os.environ["USE_TORCH"] = "1"
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import google.generativeai as genai
from doctr.models import ocr_predictor
from doctr.io import DocumentFile
import tempfile
import sqlite3
import json
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

app = Flask(__name__)
CORS(app)
app.config['JWT_SECRET_KEY'] = 'your-secret-key'  # Change in production
jwt = JWTManager(app)

# Initialize models and configs
ocr_model = ocr_predictor(pretrained=True)
genai.configure(api_key="AIzaSyBdKX9CNNCjU2cXj6V6ASZ_lhF_p5K4hyM")
genai_model = genai.GenerativeModel("gemini-1.5-flash")

# S3 Configuration (commented during testing)
# s3_client = boto3.client('s3')
# BUCKET_NAME = 'your-bucket-name'

def init_db():
    conn = sqlite3.connect('invoices.db')
    c = conn.cursor()
    
    # Users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')
    
    # Insert default users if they don't exist
    c.execute('SELECT * FROM users WHERE username IN (?, ?)', ('admin', 'user'))
    if not c.fetchall():
        c.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                 ('admin', generate_password_hash('admin'), 'admin'))
        c.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                 ('user', generate_password_hash('user'), 'user'))
    
    # Create tables for each division
    divisions = ['engineering', 'ultra_filtration', 'water']
    for division in divisions:
        c.execute(f'''
            CREATE TABLE IF NOT EXISTS {division}_invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_number TEXT,
                invoice_date TEXT,
                supplier_name TEXT,
                total_amount TEXT,
                job_ID TEXT,
                vehicle_number TEXT,
                s3_filepath TEXT,
                scanning_date TEXT,
                status TEXT,
                processed_by TEXT,
                approved_by TEXT,
                data JSON
            )
        ''')
    
    conn.commit()
    conn.close()

with app.app_context():
    init_db()

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        conn = sqlite3.connect('invoices.db')
        c = conn.cursor()
        c.execute('SELECT * FROM users WHERE username = ?', (username,))
        user = c.fetchone()
        conn.close()
        
        if user and check_password_hash(user[2], password):
            access_token = create_access_token(identity={
                'username': username,
                'role': user[3]
            })
            return jsonify({'token': access_token, 'role': user[3]})
        
        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload_invoice/<division>', methods=['POST'])
@jwt_required()
def upload_invoice(division):
    try:
        current_user = get_jwt_identity()
        if current_user['role'] != 'user':
            return jsonify({'error': 'Unauthorized'}), 403
            
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
            
        if not file.filename.endswith('.pdf'):
            return jsonify({'error': 'Only PDF files are allowed'}), 400
        
        # Local storage during testing
        temp_dir = 'temp_invoices'
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
            
        file_path = os.path.join(temp_dir, f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
        file.save(file_path)
        
        # Process invoice
        result = process_invoice(file_path)
        extracted_data = json.loads(clean_response(result))
        
        # Store in database
        conn = sqlite3.connect('invoices.db')
        c = conn.cursor()
        c.execute(f'''
            INSERT INTO {division}_invoices 
            (invoice_number, invoice_date, supplier_name, total_amount, job_ID, 
             vehicle_number, s3_filepath, scanning_date, status, processed_by, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            extracted_data['invoice_number'],
            extracted_data['invoice_date'],
            extracted_data['supplier_name'],
            extracted_data['total_amount'],
            extracted_data.get('job_ID', 'NA'),
            extracted_data.get('vehicle_number', 'NA'),
            file_path,  # Will be S3 path in production
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'pending',
            current_user['username'],
            json.dumps(extracted_data)
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Invoice uploaded and processed successfully',
            'data': extracted_data
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Additional routes for getting invoices, updating status, etc.
@app.route('/get_invoices/<division>', methods=['GET'])
@jwt_required()
def get_invoices(division):
    try:
        status = request.args.get('status')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        conn = sqlite3.connect('invoices.db')
        c = conn.cursor()
        
        query = f'SELECT * FROM {division}_invoices WHERE 1=1'
        params = []
        
        if status:
            query += ' AND status = ?'
            params.append(status)
        
        if start_date:
            query += ' AND scanning_date >= ?'
            params.append(start_date)
            
        if end_date:
            query += ' AND scanning_date <= ?'
            params.append(end_date)
            
        c.execute(query, params)
        
        columns = [description[0] for description in c.description]
        invoices = [dict(zip(columns, row)) for row in c.fetchall()]
        
        conn.close()
        return jsonify(invoices)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/approve_invoice/<division>/<int:invoice_id>', methods=['PUT'])
@jwt_required()
def approve_invoice(division, invoice_id):
    try:
        current_user = get_jwt_identity()
        if current_user['role'] != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
            
        conn = sqlite3.connect('invoices.db')
        c = conn.cursor()
        
        c.execute(f'''
            UPDATE {division}_invoices 
            SET status = 'approved', 
                approved_by = ? 
            WHERE id = ?
        ''', (current_user['username'], invoice_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Invoice approved successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Helper functions
def process_invoice(file_path):
    doc = DocumentFile.from_pdf(file_path)
    results = ocr_model(doc)
    
    recognized_lines = []
    for page in results.pages:
        for block in page.blocks:
            for line in block.lines:
                line_text = ' '.join(word.value for word in line.words)
                recognized_lines.append(line_text)
    
    prompt = f"""
        Extract supplier_name, PO_number, supplier_address, supplier_GSTIN, customer_address, customer_GSTIN,
        invoice_number, invoice_date, total_amount,job_ID( like "J-number" if not present then NA), vehicle_number(if not present NA),
        line items(item_description, product_code(HSN/SAC), quantity, unit_Price,line_total),
        total_tax_percentage(not null give 0% instead, calculate as total tax amount/total amount before tax *100) from the OCR processed text.
        No explanation, just json, no backticks and "json" string, just start with curly braces.
        Ensure the output is a valid JSON object, strictly adhering to JSON standards.
        If multiple pages are different invoices, make them different jsons
        If some fields are unrecognizable, just fill with context or null.
        Verify the total amount with the total in words, words is final.
        NOTE:
        1. Sometimes the total amount may have a prefix of rupee symbol that is being recognized as '2'
        2. For total tax amount, add up components like SGST, CGST but careful of duplicates
        The OCR processed Text: {recognized_lines}
    """
    
    response = genai_model.generate_content(prompt)
    return response.text

def clean_response(response_text):
    cleaned_text = response_text.replace("```json", "").replace("```", "").strip()
    return cleaned_text

if __name__ == '__main__':
    app.run(debug=True)