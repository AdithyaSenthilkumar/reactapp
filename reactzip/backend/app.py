import os
os.environ["USE_TORCH"] = "1"
from flask import Flask, request, jsonify, send_file
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
import uuid
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)
app.config['JWT_SECRET_KEY'] = 'your-secret-key' # Change in production
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
    c.execute('SELECT * FROM users WHERE username IN (?, ?, ?)', ('admin', 'user', 'store'))
    if not c.fetchall():
        c.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                 ('admin', generate_password_hash('admin'), 'admin'))
        c.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                 ('gate', generate_password_hash('gate'), 'gate'))
        c.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                 ('store', generate_password_hash('store'), 'store'))
    
    # Create tables for each division
    divisions = ['engineering', 'ultra_filtration', 'water']
    for division in divisions:
        c.execute(f'''
            CREATE TABLE IF NOT EXISTS {division}_invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_number TEXT UNIQUE NOT NULL,
                invoice_date TEXT,
                supplier_name TEXT,
                supplier_address TEXT,
                supplier_GSTIN TEXT,
                customer_address TEXT,
                customer_GSTIN TEXT,
                 PO_number TEXT,
                total_amount TEXT,
                total_tax_percentage TEXT,
                job_ID TEXT,
                vehicle_number TEXT,
                s3_filepath TEXT,
                scanning_date TEXT,
                status TEXT,
                processed_by TEXT,
                approved_by TEXT,
                reference_number TEXT UNIQUE NOT NULL,
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
        data = request.get_json()
        if not data or not all(key in data for key in ['username', 'password']):
            return jsonify({'error': 'Username and password are required'}), 400
        username = data.get('username')
        password = data.get('password')
        
        conn = sqlite3.connect('invoices.db')
        c = conn.cursor()
        c.execute('SELECT * FROM users WHERE username = ?', (username,))
        user = c.fetchone()
        conn.close()
        
        if user and check_password_hash(user[2], password):
            access_token = create_access_token(identity=json.dumps({
    'username': username,
    'role': user[3]
})) 
            
            return jsonify({'token': access_token, 'role': user[3]})
        
        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
          app.logger.error(f"Login error: {str(e)}") # Log error
          return jsonify({'error': 'An unexpected error occurred'}), 500
    
@app.route('/register', methods=['POST'])
@jwt_required()
def register():
    try:
        current_user = json.loads(get_jwt_identity())
        if current_user['role'] != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        if not data or not all(key in data for key in ['username', 'password', 'role']):
            return jsonify({'error': 'Username, password, and role are required'}), 400
        
        username = data.get('username')
        password = data.get('password')
        role = data.get('role')
        
        conn = sqlite3.connect('invoices.db')
        c = conn.cursor()
        
        # Check if username already exists
        c.execute('SELECT * FROM users WHERE username = ?', (username,))
        if c.fetchone():
            conn.close()
            return jsonify({'error': 'Username already exists'}), 409
            
        hashed_password = generate_password_hash(password)
        c.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                    (username, hashed_password, role))
        
        conn.commit()
        conn.close()
        return jsonify({'message': 'User registered successfully'}), 201
    
    except Exception as e:
        app.logger.error(f"Registration error: {str(e)}") # Log error
        return jsonify({'error': 'An unexpected error occurred'}), 500


@app.route('/upload_invoice/<division>', methods=['POST'])
@jwt_required()
def upload_invoice(division):
    try:
        current_user = json.loads(get_jwt_identity())
        if current_user['role'] not in ['gate','admin']:
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
        # Check if invoice number already exists
        c.execute(f'SELECT * FROM {division}_invoices WHERE invoice_number = ?', (extracted_data['invoice_number'],))
        if c.fetchone():
            conn.close()
            return jsonify({'error': 'Invoice with this number already exists'}), 409
        reference_number = str(uuid.uuid4())
        c.execute(f'''
            INSERT INTO {division}_invoices
            (invoice_number, invoice_date, supplier_name,supplier_address,supplier_GSTIN,customer_address, customer_GSTIN,
                PO_number, total_amount,total_tax_percentage, job_ID,
             vehicle_number, s3_filepath, scanning_date, status, processed_by,reference_number, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            extracted_data['invoice_number'],
            extracted_data['invoice_date'],
            extracted_data['supplier_name'],
            extracted_data.get('supplier_address', 'NA'),
            extracted_data.get('supplier_GSTIN', 'NA'),
             extracted_data.get('customer_address', 'NA'),
            extracted_data.get('customer_GSTIN', 'NA'),
            extracted_data.get('PO_number','NA'),
            extracted_data['total_amount'],
            extracted_data.get('total_tax_percentage','NA'),
            extracted_data.get('job_ID', 'NA'),
            extracted_data.get('vehicle_number', 'NA'),
            file_path,  # Will be S3 path in production
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'pending',
            current_user['username'],
            reference_number,
            json.dumps(extracted_data)
        ))
        conn.commit()
        c.execute('select last_insert_rowid()')
        row_id = c.fetchone()[0]
        conn.close()
        return jsonify({
            'message': 'Invoice uploaded and processed successfully',
            'data': extracted_data,
            'id': row_id
        })
        
    except Exception as e:
        import traceback
        app.logger.error(f"Upload error: {str(e)} \n Traceback: {traceback.format_exc()}") # Log error
        return jsonify({'error': 'An unexpected error occurred'}), 500


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
            query += ' AND date(scanning_date) >= ?'
            params.append(start_date)
            
        if end_date:
            query += ' AND date(scanning_date) <= ?'
            params.append(end_date)
            
        c.execute(query, params)
        
        columns = [description[0] for description in c.description]
        invoices = [dict(zip(columns, row)) for row in c.fetchall()]
        
        conn.close()
        return jsonify(invoices)
        
    except Exception as e:
        app.logger.error(f"Get invoices error: {str(e)}") # Log error
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/get_pdf/<division>/<int:invoice_id>', methods=['GET'])
@jwt_required()
def get_pdf(division, invoice_id):
    try:
        conn = sqlite3.connect('invoices.db')
        c = conn.cursor()
        c.execute(f"SELECT s3_filepath FROM {division}_invoices WHERE id = ?", (invoice_id,))
        result = c.fetchone()
        conn.close()
        
        if result and result[0]:
            file_path = result[0]
            if os.path.exists(file_path):
                return send_file(
                    file_path,
                    mimetype='application/pdf',
                    as_attachment=False
                )
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        app.logger.error(f"Error serving PDF: {str(e)}") # Log error
        return jsonify({'error': 'An unexpected error occurred'}), 500
@app.route('/approve_invoice/<division>/<int:invoice_id>', methods=['PUT'])
@jwt_required()
def approve_invoice(division, invoice_id):
    try:
        current_user = json.loads(get_jwt_identity())
        if current_user['role'] not in ['store','admin']:
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
         app.logger.error(f"Approve invoice error: {str(e)}") # Log error
         return jsonify({'error': 'An unexpected error occurred'}), 500


@app.route('/get_invoice/<division>/<int:invoice_id>', methods=['GET'])
@jwt_required()
def get_invoice(division, invoice_id):
    try:
        conn = sqlite3.connect('invoices.db')
        c = conn.cursor()
        
        # Fetch the invoice details by ID
        c.execute(f'SELECT * FROM {division}_invoices WHERE id = ?', (invoice_id,))
        result = c.fetchone()
        conn.close()

        if result:
            # Get column names
            columns = [description[0] for description in c.description]
            invoice = dict(zip(columns, result))
            return jsonify(invoice)
        else:
            return jsonify({'error': 'Invoice not found'}), 404
    except Exception as e:
        app.logger.error(f"Get invoice error: {str(e)}")  # Log error
        return jsonify({'error': 'An unexpected error occurred'}), 500
    
@app.route('/edit_invoice/<division>/<int:invoice_id>', methods=['PUT'])
@jwt_required()
def edit_invoice(division, invoice_id):
    try:
        # Get the current user
        current_user = json.loads(get_jwt_identity())
        
        # Check if user is authorized (role: 'gate' or 'admin')
        if current_user['role'] not in ['gate','store', 'admin']:
            return jsonify({'error': 'Unauthorized'}), 403

        # Get the data from the request
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Connect to the database
        conn = sqlite3.connect('invoices.db')
        c = conn.cursor()

        # Dynamically build the SQL query
        update_fields = ', '.join([f"{key} = ?" for key in data.keys()])
        values = list(data.values())  # Get all the new values
        values.append(invoice_id)    # Add `invoice_id` for the WHERE clause

        # Execute the SQL query
        c.execute(f"UPDATE {division}_invoices SET {update_fields} WHERE id = ?", values)

        # Commit and close the connection
        conn.commit()
        conn.close()

        # Return success message
        return jsonify({'message': 'Invoice updated successfully'}), 200

    except sqlite3.Error as e:
        # Log and handle database errors
        app.logger.error(f"Database error during edit: {str(e)}")  # Log error
        return jsonify({'error': 'An unexpected database error occurred'}), 500
    except Exception as e:
        # General error handling
        app.logger.error(f"General error during edit: {str(e)}") # Log error
        return jsonify({'error': 'An unexpected error occurred'}), 500
    
@app.route('/generate_report', methods=['GET'])
@jwt_required()
def generate_report():
    try:
        current_user = json.loads(get_jwt_identity())
        if current_user['role'] not in ['store', 'admin']:
            return jsonify({'error': 'Unauthorized'}), 403
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        conn = sqlite3.connect('invoices.db')
        c = conn.cursor()
        
        all_invoices = []
        divisions = ['engineering', 'ultra_filtration', 'water']
        for div in divisions:
            query = f'SELECT * FROM {div}_invoices WHERE 1=1'
            params = []

            if start_date:
                query += ' AND date(scanning_date) >= ?'
                params.append(start_date)
            
            if end_date:
                query += ' AND date(scanning_date) <= ?'
                params.append(end_date)

            c.execute(query, params)

            columns = [description[0] for description in c.description]
            invoices = [dict(zip(columns, row)) for row in c.fetchall()]
            all_invoices.extend(invoices)

        conn.close()
        return jsonify(all_invoices)
    
    except Exception as e:
      app.logger.error(f"Report error: {str(e)}") # Log error
      return jsonify({'error': 'An unexpected error occurred'}), 500

# Helper functions
def process_invoice(file_path):
    print("hello")
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
        invoice_number, invoice_date, total_amount(remove commas in the number),job_ID( like "J-number" if not present then NA), vehicle_number(if not present NA),
        line items(item_description, product_code(HSN/SAC), quantity(can also be present as PCS), unit_Price(can also be present as amount),line_total),
        total_tax_percentage(not null give 0% instead) from the OCR processed text.
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
    print(response.text)
    return response.text

def clean_response(response_text):
    cleaned_text = response_text.replace("```json", "").replace("```", "").strip()
    return cleaned_text

if __name__ == '__main__':
    app.run(debug=True)
