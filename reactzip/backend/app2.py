import os
from dotenv import load_dotenv
load_dotenv()
print("DATABASE_URL:", os.environ.get('DATABASE_URL'))  # Debug line

os.environ["USE_TORCH"] = "1"
import json
import uuid
import imaplib
import email
from datetime import datetime
from email.header import decode_header
import tempfile
import traceback

import boto3
from botocore.exceptions import ClientError
import google.generativeai as genai
from doctr.models import ocr_predictor
from doctr.io import DocumentFile
from flask import Flask, request, jsonify, send_file, abort
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, create_refresh_token, set_access_cookies, set_refresh_cookies, unset_jwt_cookies, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect, generate_csrf
from sqlalchemy import or_
import logging

# Load environment variables

app = Flask(__name__)
CORS(app, supports_credentials=True)

# Configuration from environment variables
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES', 15 * 60)) # Default 15 minutes
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = int(os.environ.get('JWT_REFRESH_TOKEN_EXPIRES', 30 * 24 * 60 * 60)) # Default 30 days
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')  # For CSRF
app.config['JWT_TOKEN_LOCATION'] = ['cookies']
app.config['JWT_COOKIE_SECURE'] = False # Set to True in production (HTTPS)
app.config['JWT_COOKIE_CSRF_PROTECT'] = True
app.config['JWT_CSRF_IN_COOKIES'] = True
app.config['DEBUG'] = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true' # Enable debug mode if FLASK_DEBUG is set to true

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)
csrf = CSRFProtect(app)

# Logging configuration
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    filename='app.log',
                    filemode='a')

logger = logging.getLogger(__name__)

# Initialize models and configs
ocr_model = ocr_predictor(pretrained=True)
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
genai_model = genai.GenerativeModel("gemini-1.5-flash")

# S3 Configuration (uncomment in production)
# s3_client = boto3.client('s3',
#                          aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
#                          aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
#                          region_name=os.environ.get('AWS_REGION'))
# BUCKET_NAME = os.environ.get('S3_BUCKET_NAME')

# --- Database Models ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(80), nullable=False)

    def __repr__(self):
        return f'<User {self.username}>'

class Invoice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    division = db.Column(db.String(50), nullable=False)
    invoice_number = db.Column(db.String(255), unique=True, nullable=False)
    invoice_date = db.Column(db.String(50))
    supplier_name = db.Column(db.String(255))
    supplier_address = db.Column(db.Text)
    supplier_GSTIN = db.Column(db.String(50))
    customer_address = db.Column(db.Text)
    customer_GSTIN = db.Column(db.String(50))
    PO_number = db.Column(db.String(255))
    total_amount = db.Column(db.String(50))
    total_tax_percentage = db.Column(db.String(50))
    job_ID = db.Column(db.String(50))
    vehicle_number = db.Column(db.String(50))
    s3_filepath = db.Column(db.Text)
    scanning_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default='pending')
    processed_by = db.Column(db.String(80))
    approved_by = db.Column(db.String(80))
    reference_number = db.Column(db.String(255), unique=True, nullable=False)
    data = db.Column(db.JSON)
    ocr_quality_score = db.Column(db.Float)

    def __repr__(self):
        return f'<Invoice {self.invoice_number}>'

# --- Database Initialization ---
def init_db():
    with app.app_context():
        db.create_all()

        # Insert default users if they don't exist
        if not User.query.filter(User.username.in_(['admin', 'gate', 'store'])).first():
            admin_user = User(username='admin', password=generate_password_hash(os.environ.get('ADMIN_PASSWORD')), role='admin')
            gate_user = User(username='gate', password=generate_password_hash(os.environ.get('GATE_PASSWORD')), role='gate')
            store_user = User(username='store', password=generate_password_hash(os.environ.get('STORE_PASSWORD')), role='store')
            db.session.add_all([admin_user, gate_user, store_user])
            db.session.commit()
            logger.info("Default users created.")

# --- Routes ---

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data or not all(key in data for key in ['username', 'password']):
            return jsonify({'error': 'Username and password are required'}), 400

        username = data.get('username')
        password = data.get('password')

        user = User.query.filter_by(username=username).first()

        if user and check_password_hash(user.password, password):
            user_identity = json.dumps({
                'username': username,
                'role': user.role
            })
            access_token = create_access_token(identity=user_identity)
            refresh_token = create_refresh_token(identity=user_identity)
            resp = jsonify({'login': True, 'role': user.role})
            set_access_cookies(resp, access_token)
            set_refresh_cookies(resp, refresh_token)
            return resp, 200

        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        logger.exception(f"Login error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    try:
        current_user = json.loads(get_jwt_identity())
        new_access_token = create_access_token(identity=json.dumps(current_user))
        resp = jsonify({'refresh': True})
        set_access_cookies(resp, new_access_token)
        return resp, 200
    except Exception as e:
        logger.exception(f"Refresh token error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred during token refresh'}), 500

@app.route('/logout', methods=['POST'])
def logout():
    resp = jsonify({'logout': True})
    unset_jwt_cookies(resp)
    return resp, 200

@app.after_request
def handle_csrf(response):
    """Set CSRF token cookie after each request."""
    response.set_cookie("csrf_token", generate_csrf())
    return response

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

        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 409

        hashed_password = generate_password_hash(password)
        new_user = User(username=username, password=hashed_password, role=role)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'User registered successfully'}), 201

    except Exception as e:
        logger.exception(f"Registration error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500


@app.route('/upload_invoice/<division>', methods=['POST'])
@jwt_required()
@csrf.exempt
def upload_invoice(division):
    try:
        current_user = json.loads(get_jwt_identity())
        if current_user['role'] not in ['gate', 'admin']:
            return jsonify({'error': 'Unauthorized'}), 403

        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not file.filename.endswith('.pdf'):
            return jsonify({'error': 'Only PDF files are allowed'}), 400

        # Local storage during testing (replace with S3 in production)
        temp_dir = 'temp_invoices'
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
        file_path = os.path.join(temp_dir, f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
        file.save(file_path)

        # Process invoice
        result, ocr_quality_score = process_invoice(file_path)
        extracted_data = json.loads(clean_response(result))
       

        # Store in database
        if Invoice.query.filter_by(division=division, invoice_number=extracted_data['invoice_number']).first():
            return jsonify({'error': 'Invoice with this number already exists in this division'}), 409

        reference_number = str(uuid.uuid4())
        new_invoice = Invoice(
            division=division,
            invoice_number=extracted_data['invoice_number'],
            invoice_date=extracted_data['invoice_date'],
            supplier_name=extracted_data['supplier_name'],
            supplier_address=extracted_data.get('supplier_address', 'NA'),
            supplier_GSTIN=extracted_data.get('supplier_GSTIN', 'NA'),
            customer_address=extracted_data.get('customer_address', 'NA'),
            customer_GSTIN=extracted_data.get('customer_GSTIN', 'NA'),
            PO_number=extracted_data.get('PO_number', 'NA'),
            total_amount=extracted_data['total_amount'],
            total_tax_percentage=extracted_data.get('total_tax_percentage', 'NA'),
            job_ID=extracted_data.get('job_ID', 'NA'),
            vehicle_number=extracted_data.get('vehicle_number', 'NA'),
            s3_filepath=file_path,  # Will be S3 path in production
            scanning_date=datetime.now(),
            status='pending',
            processed_by=current_user['username'],
            reference_number=reference_number,
            data=extracted_data,
            ocr_quality_score=ocr_quality_score
        )
        db.session.add(new_invoice)
        db.session.commit()

        return jsonify({
            'message': 'Invoice uploaded and processed successfully',
            'data': extracted_data,
            'id': new_invoice.id,
            'ocr_quality_score': ocr_quality_score
        }), 201

    except Exception as e:
        logger.exception(f"Upload error: {str(e)} \n Traceback: {traceback.format_exc()}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

# Additional routes for getting invoices, updating status, etc.

@app.route('/get_invoices/<division>', methods=['GET'])
@jwt_required()
def get_invoices(division):
    try:
        current_user_role = json.loads(get_jwt_identity())['role']

        status = request.args.get('status')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search_query = request.args.get('search', '', type=str)

        query = Invoice.query.filter_by(division=division)

        if status:
            query = query.filter_by(status=status)

        if start_date:
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(Invoice.scanning_date >= start_date_obj)

        if end_date:
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')
            query = query.filter(Invoice.scanning_date <= end_date_obj)

        if search_query:
            query = query.filter(or_(
                Invoice.invoice_number.contains(search_query),
                Invoice.supplier_name.contains(search_query),
                Invoice.PO_number.contains(search_query),
                Invoice.reference_number.contains(search_query)
            ))
       
        # Role-based filtering for non-admin users
        if current_user_role != 'admin':
            query = query.filter(Invoice.status != 'rejected')
       
        # Pagination
        paginated_invoices = query.paginate(page=page, per_page=per_page, error_out=False)
        invoices = [invoice.__dict__ for invoice in paginated_invoices.items]

        for invoice in invoices:
            invoice.pop('_sa_instance_state', None)

        return jsonify({
            'invoices': invoices,
            'total': paginated_invoices.total,
            'pages': paginated_invoices.pages,
            'current_page': page
        })

    except Exception as e:
        logger.exception(f"Get invoices error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/get_pdf/<division>/<int:invoice_id>', methods=['GET'])
@jwt_required()
def get_pdf(division, invoice_id):
    try:
        invoice = Invoice.query.filter_by(division=division, id=invoice_id).first()

        if invoice and invoice.s3_filepath:
            file_path = invoice.s3_filepath
            if os.path.exists(file_path):  # Check if file exists locally (testing)
                return send_file(
                    file_path,
                    mimetype='application/pdf',
                    as_attachment=False
                )
            # else: # Uncomment in production when using S3
            #     # Generate a presigned URL for the S3 object
            #     url = s3_client.generate_presigned_url(
            #         ClientMethod='get_object',
            #         Params={
            #             'Bucket': BUCKET_NAME,
            #             'Key': invoice.s3_filepath
            #         },
            #         ExpiresIn=3600  # URL expires in 1 hour
            #     )
            #     return jsonify({'url': url})

        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        logger.exception(f"Error serving PDF: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500
   
@app.route('/approve_invoice/<division>/<int:invoice_id>', methods=['PUT'])
@jwt_required()
def approve_invoice(division, invoice_id):
    try:
        current_user = json.loads(get_jwt_identity())
        if current_user['role'] not in ['store', 'admin']:
            return jsonify({'error': 'Unauthorized'}), 403

        invoice = Invoice.query.filter_by(division=division, id=invoice_id).first()

        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404

        invoice.status = 'approved'
        invoice.approved_by = current_user['username']
        db.session.commit()

        return jsonify({'message': 'Invoice approved successfully'}), 200

    except Exception as e:
        logger.exception(f"Approve invoice error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/reject_invoice/<division>/<int:invoice_id>', methods=['PUT'])
@jwt_required()
def reject_invoice(division, invoice_id):
    try:
        current_user = json.loads(get_jwt_identity())
        if current_user['role'] not in ['store', 'admin']:
            return jsonify({'error': 'Unauthorized'}), 403

        invoice = Invoice.query.filter_by(division=division, id=invoice_id).first()

        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404

        invoice.status = 'rejected'
        invoice.approved_by = current_user['username']
        db.session.commit()

        return jsonify({'message': 'Invoice rejected successfully'}), 200

    except Exception as e:
        logger.exception(f"Reject invoice error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/get_invoice/<division>/<int:invoice_id>', methods=['GET'])
@jwt_required()
def get_invoice(division, invoice_id):
    try:
        invoice = Invoice.query.filter_by(division=division, id=invoice_id).first()

        if invoice:
            invoice_data = invoice.__dict__
            invoice_data.pop('_sa_instance_state', None)  # Remove SQLAlchemy internal state
            return jsonify(invoice_data), 200
        else:
            return jsonify({'error': 'Invoice not found'}), 404
    except Exception as e:
        logger.exception(f"Get invoice error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/edit_invoice/<division>/<int:invoice_id>', methods=['PUT'])
@jwt_required()
def edit_invoice(division, invoice_id):
    try:
        current_user = json.loads(get_jwt_identity())
        if current_user['role'] not in ['gate', 'store', 'admin']:
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        invoice = Invoice.query.filter_by(division=division, id=invoice_id).first()
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404

        for key, value in data.items():
            if hasattr(invoice, key):
                setattr(invoice, key, value)

        db.session.commit()
        return jsonify({'message': 'Invoice updated successfully'}), 200

    except Exception as e:
        logger.exception(f"Edit invoice error: {str(e)}")
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

        query = Invoice.query

        if start_date:
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(Invoice.scanning_date >= start_date_obj)

        if end_date:
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')
            query = query.filter(Invoice.scanning_date <= end_date_obj)

        all_invoices = query.all()
        invoices_data = [invoice.__dict__ for invoice in all_invoices]
        for invoice in invoices_data:
            invoice.pop('_sa_instance_state', None)

        return jsonify(invoices_data), 200

    except Exception as e:
        logger.exception(f"Report generation error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/fetch_invoice_attachments', methods=['GET'])
def fetch_invoice_attachments():
    try:
        # Connect to the email server
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(os.environ.get("EMAIL_USER"), os.environ.get("EMAIL_PASSWORD"))
        mail.select("inbox")

        # Search for unread emails
        status, messages = mail.search(None, '(UNSEEN)')
        email_ids = messages[0].split()

        pdf_attachments = []

        for email_id in email_ids:
            status, msg_data = mail.fetch(email_id, "(RFC822)")
            msg = email.message_from_bytes(msg_data[0][1])

            for part in msg.walk():
                if part.get_content_maintype() == "multipart":
                    continue
                if part.get("Content-Disposition") is None:
                    continue

                filename = part.get_filename()
                if filename and filename.endswith(".pdf"):
                    pdf_attachments.append({
                        "filename": filename,
                        "content": part.get_payload(decode=True)
                    })

        mail.logout()

        return jsonify({
            'message': 'Fetched PDF attachments successfully',
            'attachments': pdf_attachments
        })

    except Exception as e:
        logger.exception(f"Fetch error: {str(e)} \n Traceback: {traceback.format_exc()}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

# --- Developer Routes (No Authentication Required) ---

@app.route('/dev/cleanup_db', methods=['POST'])
def cleanup_db():
    """
    Route to clean up the database. This is a developer-only route.
    """
    if not app.debug:
        abort(404)  # Only allow in debug mode

    try:
        # Delete all invoices
        num_invoices_deleted = Invoice.query.delete()
        logger.info(f"Deleted {num_invoices_deleted} invoices.")

        # Delete all users except admin, gate, and store
        num_users_deleted = User.query.filter(~User.username.in_(['admin', 'gate', 'store'])).delete()
        logger.info(f"Deleted {num_users_deleted} users.")

        db.session.commit()
        return jsonify({'message': 'Database cleaned up successfully'}), 200
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error during database cleanup: {str(e)}")
        return jsonify({'error': 'Failed to cleanup database'}), 500

@app.route('/dev/create_dummy_invoices', methods=['POST'])
def create_dummy_invoices():
    """
    Route to create dummy invoices for testing. This is a developer-only route.
    """
    if not app.debug:
        abort(404) # Only allow in debug mode
   
    try:
        dummy_invoices = []
        for i in range(1, 6): # Create 5 dummy invoices
            dummy_invoices.append(Invoice(
                division='engineering',
                invoice_number=f'INV-{i}',
                invoice_date='2023-12-01',
                supplier_name=f'Supplier {i}',
                supplier_address=f'Address {i}',
                supplier_GSTIN='GSTIN' + str(i),
                customer_address=f'Customer Address {i}',
                customer_GSTIN='CGSTIN' + str(i),
                PO_number=f'PO-{i}',
                total_amount=str(1000 * i),
                total_tax_percentage='18%',
                job_ID=f'J-{i}',
                vehicle_number=f'VEH-{i}',
                s3_filepath='dummy_path',
                scanning_date=datetime.now(),
                status='pending',
                processed_by='dummy_user',
                reference_number=str(uuid.uuid4()),
                data={'dummy': 'data'},
                ocr_quality_score=0.9
            ))

        db.session.add_all(dummy_invoices)
        db.session.commit()
        return jsonify({'message': 'Dummy invoices created successfully'}), 200
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error creating dummy invoices: {str(e)}")
        return jsonify({'error': 'Failed to create dummy invoices'}), 500

# --- Helper Functions ---
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
        invoice_number, invoice_date, total_amount(remove commas in the number),job_ID( like "J-number" if not present then NA), vehicle_number(if not present NA),
        line items(item_description, product_code(HSN/SAC), quantity(can also be present as PCS), unit_Price(can also be present as amount),line_total),
        total_tax_percentage(not null give 0% instead) from the OCR processed text.
        No explanation, just json, no backticks and "json" string, just start with curly braces.
        Ensure the output is a valid JSON object, strictly adhering to JSON standards.
        If multiple pages are different invoices, make them different jsons
        If some fields are unrecognizable, just fill with context or null.
        Verify the total amount with the total in words, words is final.
        Give a quality score from 0 to 1, where 1 represents perfect OCR recognition, and 0 represents very poor OCR recognition.
        Name this key as 'ocr_quality_score' and put it outside along with other invoice details
        NOTE:
        1. Sometimes the total amount may have a prefix of rupee symbol that is being recognized as '2'
        2. For total tax amount, add up components like SGST, CGST but careful of duplicates
        The OCR processed Text: {recognized_lines}
    """

    response = genai_model.generate_content(prompt)
    cleaned_text = clean_response(response.text)

    try:
        data = json.loads(cleaned_text)
        ocr_quality_score = data.get('ocr_quality_score', 0.0)  # Extract OCR quality score
        #Remove ocr quality score from llm output
        if 'ocr_quality_score' in data:
            del data['ocr_quality_score']
    except json.JSONDecodeError:
        logger.error(f"Failed to decode JSON: {cleaned_text}")
        ocr_quality_score = 0.0

    return json.dumps(data), ocr_quality_score

def clean_response(response_text):
    cleaned_text = response_text.replace("```json", "").replace("```", "").strip()
    return cleaned_text

# --- Error Handlers ---
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.exception('An unexpected error occurred: %s', error)
    return jsonify({'error': 'Internal server error'}), 500

# --- Run Application ---

if __name__ == '__main__':
    init_db()
    app.run()
