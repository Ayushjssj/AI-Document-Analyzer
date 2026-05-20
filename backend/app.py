from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

from groq import Groq
from pypdf import PdfReader
from docx import Document

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings

from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import MongoClient

load_dotenv()

app = Flask(__name__)
CORS(app)

app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
jwt = JWTManager(app)

mongo_client = MongoClient(os.getenv("MONGO_URI"))
db = mongo_client["ai_document_analyzer"]
users_collection = db["users"]

UPLOAD_FOLDER = "../uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

document_text = ""
vector_db = None


def get_ai_response(prompt):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


def extract_pdf_text(file_path):
    text = ""
    reader = PdfReader(file_path)
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


def extract_docx_text(file_path):
    doc = Document(file_path)
    return "\n".join([para.text for para in doc.paragraphs])


def create_vector_database(text):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=700,
        chunk_overlap=120,
    )

    chunks = text_splitter.split_text(text)

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    return FAISS.from_texts(chunks, embeddings)


@app.route("/")
def home():
    return "AI Document Analyzer Backend Running with RAG and Authentication!"


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "User already exists"}), 409

    users_collection.insert_one({
        "name": name,
        "email": email,
        "password": generate_password_hash(password),
    })

    return jsonify({"message": "User registered successfully"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = users_collection.find_one({"email": email})

    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=email)

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "name": user["name"],
            "email": user["email"],
        },
    })


@app.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    current_user_email = get_jwt_identity()

    user = users_collection.find_one(
        {"email": current_user_email},
        {"_id": 0, "password": 0},
    )

    return jsonify({
        "message": "Protected profile accessed successfully",
        "user": user,
    })


@app.route("/upload", methods=["POST"])
def upload_file():
    global document_text, vector_db

    if "files" not in request.files:
        return jsonify({"error": "No files uploaded"}), 400

    files = request.files.getlist("files")

    combined_text = ""
    uploaded_files = []

    for file in files:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)

        if file.filename.lower().endswith(".pdf"):
            text = extract_pdf_text(file_path)
        elif file.filename.lower().endswith(".docx"):
            text = extract_docx_text(file_path)
        else:
            continue

        combined_text += f"\n\n--- Document: {file.filename} ---\n\n{text}"
        uploaded_files.append(file.filename)

    if not combined_text.strip():
        return jsonify({"error": "No valid PDF or DOCX files found"}), 400

    document_text = combined_text
    vector_db = create_vector_database(combined_text)

    return jsonify({
        "message": "Files uploaded and vector database created successfully",
        "uploaded_files": uploaded_files,
        "extracted_text": combined_text[:5000],
    })


@app.route("/summarize", methods=["POST"])
def summarize():
    global document_text

    if not document_text:
        return jsonify({"error": "Please upload a document first"}), 400

    prompt = f"""
    Summarize the following document clearly.
    Include:
    - Short summary
    - Key points
    - Important clauses or highlights

    Document:
    {document_text[:12000]}
    """

    summary = get_ai_response(prompt)
    return jsonify({"summary": summary})


@app.route("/ask", methods=["POST"])
def ask_question():
    global vector_db

    data = request.get_json()
    question = data.get("question", "")

    if not question:
        return jsonify({"error": "Question is required"}), 400

    if vector_db is None:
        return jsonify({"error": "Please upload a document first"}), 400

    relevant_docs = vector_db.similarity_search(question, k=4)
    context = "\n\n".join([doc.page_content for doc in relevant_docs])

    prompt = f"""
    You are an AI document assistant.
    Answer the question using only the context below.
    If the answer is not found in the context, say:
    "I could not find this information in the uploaded document."

    Context:
    {context}

    Question:
    {question}
    """

    answer = get_ai_response(prompt)
    return jsonify({"answer": answer})

@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()

    email = data.get("email")
    new_password = data.get("new_password")

    if not email or not new_password:
        return jsonify({"error": "Email and new password are required"}), 400

    user = users_collection.find_one({"email": email})

    if not user:
        return jsonify({"error": "User not found"}), 404

    hashed_password = generate_password_hash(new_password)

    users_collection.update_one(
        {"email": email},
        {"$set": {"password": hashed_password}}
    )

    return jsonify({"message": "Password updated successfully"}), 200


if __name__ == "__main__":
    app.run(debug=True)